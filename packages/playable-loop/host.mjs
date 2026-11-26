import {createServer} from "node:http";
import {randomBytes,randomUUID} from "node:crypto";
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {join} from "node:path";
import {openNative,publicState} from "./native.mjs";
import {openStore,hash,blocked} from "./data.mjs";
import {prepareState} from "./relay.mjs";
import {digest} from "../native-facts/admission.mjs";

const dir=process.argv[2],cfg=JSON.parse(readFileSync(join(dir,"private.json")));
const store=openStore(dir),db=store.db,n=await openNative(cfg,dir,store);
const instance=readFileSync(join(dir,"p05-owned"),"utf8");
const continuing=["visual-reader","repair-a","repair-b","repair-c"].some(name=>instance==="P05/1:"+name);
const policy=continuing?await import("./visual/scene-policy.mjs"):null;
const visualMode=continuing || instance==="P05/1:visual-demo";
const pictures=visualMode?await import("./visual/pictures.mjs"):null;
const ticket=randomBytes(32).toString("hex"),base="http://127.0.0.1:"+cfg.httpPort;
const scopeOf=(owner,save)=>hash([owner,save.saveId,"root"]);
let busy=false;
function failure(status,message){throw Object.assign(Error(message),{status})}
function record(owner,save,row,receipt,text,recovery){
  if(!text?.trim()||receipt.decision.status!=="accepted"||receipt.saveId!==save.saveId||receipt.resultingRevision!==row.expected+1||receipt.idempotencyKey!==row.k)throw Error("receipt binding");
  const bound=JSON.parse(row.body);
  const entry={scope:row.scope,ownerHash:hash(owner),saveHash:hash(save.saveId),branch:"root",revision:receipt.resultingRevision,
    requestKey:row.k,action:bound.label,text,bodySha:hash(text),receiptSha:hash(receipt),canonicalReceiptSha:digest(receipt),source:"deterministic",recovery,
    ruleVersion:save.ruleVersion,canonVersion:save.canonVersion,events:receipt.decision.events.map(e=>e.type),
    native:publicState(save,n.labels),...blocked};
  delete entry.native.actions;
  if(policy)entry.sceneEvidence=policy.sceneEvidence(save,receipt);
  db.exec("BEGIN IMMEDIATE");
  try{db.prepare("UPDATE action SET record=? WHERE k=? AND record IS NULL").run(JSON.stringify(entry),row.k);
    if(policy)policy.bindScene(store,entry,bound);
    else if(pictures)pictures.bindPicture(store,entry,bound);
    else prepareState(store,entry);
    db.exec("COMMIT")}catch(e){db.exec("ROLLBACK");throw e}
  return entry;
}
async function recover(owner,save,scope){
  for(const row of db.prepare("SELECT * FROM action WHERE scope=? AND record IS NULL ORDER BY expected").all(scope)){
    const receipt=await n.repo.getReceiptForOwner(owner,save.saveId,row.k);
    if(!receipt||receipt.decision.status!=="accepted"||save.revision!==receipt.resultingRevision)continue;
    const hints=n.hints.buildP1NarrativeHints(receipt,save);
    const text=n.hints.ensureP1NarrativeHints(await n.core.runtime.narrativeFallback(receipt,hints),receipt,hints);
    record(owner,save,row,receipt,text,"authorized-receipt-fallback");
  }
}
async function body(req){let b="";for await(const chunk of req){b+=chunk;if(b.length>5000)failure(413,"too large")}return JSON.parse(b||"{}")}
const srv=createServer(async(req,res)=>{
  const reply=(status,x,type="application/json")=>{res.writeHead(status,{"Content-Type":type+"; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==="application/json"?JSON.stringify(x):x)};
  try{
    if(req.headers.host!==new URL(base).host)failure(403,"host");
    if(req.method==="GET"&&req.url==="/health")return reply(200,continuing?"P05-visual/2":"P05","text/plain");
    const files={"/":["page.html","text/html"],"/player.js":["player.js","text/javascript"],"/style.css":["style.css","text/css"]};
    if(pictures){
      files["/"]=["visual/page.html","text/html"];
      files["/visual-player.js"]=["visual/display.js","text/javascript"];
      files["/paper.css"]=["visual/paper.css","text/css"];
    }
    if(req.method==="GET"&&Object.hasOwn(files,req.url)){const [path,type]=files[req.url];return reply(200,readFileSync(new URL(path,import.meta.url)),type)}
    if(req.method==="POST"&&req.headers.origin!==base)failure(403,"origin");
    if(req.method==="POST"&&req.url==="/enter"){
      if((await body(req)).ticket!==ticket)failure(403,"local entry required");
      const token=await n.login();res.setHeader("Set-Cookie","p05="+encodeURIComponent(token)+"; HttpOnly; SameSite=Strict; Path=/");return reply(200,{ok:true});
    }
    const cookie=/(?:^|; )p05=([^;]+)/.exec(req.headers.cookie||"")?.[1];
    const token=cookie&&decodeURIComponent(cookie),who=token&&await n.auth.resolve(token);
    if(!who)failure(401,"请从本机专用入口进入");
    if(req.method==="POST"&&req.url==="/logout"){await n.auth.logout(token);return reply(200,{ok:true})}
    const owner=who.ownerId,save=await n.saveFor(owner),scope=scopeOf(owner,save);
    if(!busy)await recover(owner,save,scope);
    if(pictures && req.url.startsWith("/pictures/")){
      if(req.method==="POST" && req.url==="/pictures/preference"){
        const input=await body(req); if(input.scope!==scope)failure(403,"存档不符");
        pictures.setEnabled(store,scope,input.enabled);return reply(200,{ok:true});
      }
      const m=/^\/pictures\/(current|history)\/([1-9][0-9]{0,15})\/([0-9a-f]{64})$/.exec(req.url);
      if(!m || !Number.isSafeInteger(Number(m[2])) || Number(m[2])>save.revision)failure(404,"无适用画面");
      // Read the POST body before checking the current save, including delayed acknowledgements.
      const outcome=req.method==="POST"?(await body(req)).outcome:null;
      const live=publicState(await n.saveFor(owner),n.labels);
      const row=pictures.target(store,scope,live,m[1],Number(m[2]),m[3]);
      if(req.method==="GET")return reply(200,pictures.reviewedBytes(row.asset),"image/png");
      if(req.method==="POST")return reply(200,pictures.recordDisplay(store,row,m[1],outcome));
      failure(405,"方法不适用");
    }
    if(req.method==="GET"&&req.url==="/game"){
      const current=publicState(save,n.labels);
      const history=store.history(scope);
      const visual=pictures?{enabled:pictures.enabled(store,scope),frames:Object.fromEntries(history.map(h=>[h.revision,pictures.describe(store,scope,h.revision)]))}:undefined;
      if(continuing)visual.evidence=Object.fromEntries(history.map(h=>{
        const row=pictures.binding(store,scope,h.revision);
        return [h.revision,row?{version:row.version,reason:row.reason??row.basis,observed:row.sourceRevision}:null];
      }));
      return reply(200,{scope,current,history,visual,...(continuing?{continuing:true}:{}),slots:db.prepare("SELECT rev,kind,status,result FROM slot WHERE scope=? ORDER BY rev,kind").all(scope).map(x=>({...x,result:x.result&&JSON.parse(x.result)})),...blocked});
    }
    if(req.method!=="POST"||req.url!=="/act")failure(404,"not found");
    const input=await body(req);
    if(!/^[0-9a-f-]{36}$/.test(input.key)||input.scope!==scope||!Number.isInteger(input.revision))failure(400,"invalid request");
    const prior=db.prepare("SELECT * FROM action WHERE k=?").get(input.key);
    if(prior){
      if(prior.scope!==scope||prior.expected!==input.revision||JSON.parse(prior.body).id!==input.id)failure(409,"conflicting key");
      if(!prior.record)failure(409,"正文待恢复");return reply(200,{revision:JSON.parse(prior.record).revision,duplicate:true});
    }
    if(busy||input.revision!==save.revision||(!continuing && save.revision>=8))failure(409,"修订已变化或本局已结束");
    if(db.prepare("SELECT 1 FROM action WHERE scope=? AND record IS NULL").get(scope))failure(409,"上一行动待恢复");
    const choice=publicState(save,n.labels).actions.find(x=>x.id===input.id);
    if(!choice)failure(400,"不可用的行动");
    busy=true;
    try{
      db.prepare("INSERT INTO action(k,scope,expected,body) VALUES(?,?,?,?)").run(input.key,scope,save.revision,JSON.stringify(choice));
      const turn=await n.turns.execute(owner,{saveId:save.saveId,actorId:save.state.playerId,branchId:"root",expectedRevision:save.revision,idempotencyKey:input.key,kind:choice.kind,payload:choice.payload},true);
      if(turn.status!=="accepted"){db.prepare("DELETE FROM action WHERE k=? AND record IS NULL").run(input.key);failure(409,"原生规则："+turn.status)}
      if(turn.narrative.source!=="deterministic")failure(503,"正文待恢复");
      const latest=await n.saveFor(owner);
      if(latest.revision!==turn.receipt.resultingRevision)failure(409,"状态待核");
      const row=db.prepare("SELECT * FROM action WHERE k=?").get(input.key);
      record(owner,latest,row,turn.receipt,turn.narrative.text,"returned");
      return reply(200,{revision:latest.revision});
    }finally{busy=false}
  }catch(e){if(!e.status)console.error("host error",e.name,e.code||"",e.message.slice(0,120));return reply(e.status||500,{error:e.status?e.message:"宿主处理失败"})}
});
await new Promise((ok,fail)=>{srv.once("error",fail);srv.listen(cfg.httpPort,"127.0.0.1",ok)});
writeFileSync(join(dir,"open.html"),'<meta charset="utf-8"><meta name="referrer" content="no-referrer"><a href="'+base+'/#'+ticket+'">进入芦花渡短局</a><script>location.replace(document.querySelector("a").href)</script>');
writeFileSync(join(dir,"active"),String(process.pid));
const timer=setInterval(async()=>{if(existsSync(join(dir,"stop"))&&!busy){clearInterval(timer);srv.closeIdleConnections();await new Promise(ok=>srv.close(ok));await n.pool.end();db.close();unlinkSync(join(dir,"active"));}},200);
