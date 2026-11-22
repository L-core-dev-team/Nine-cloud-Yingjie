import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import {Readable} from "node:stream";
import {randomUUID} from "node:crypto";
import {mkdtemp,readFile,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {cardModel,endpoint} from "../adapter.mjs";
import {digest} from "../../provider-readiness/reservations.mjs";
import {east,prose,rejected,tower} from "../../first-play/test/scene-evidence-fixtures.mjs";
import {extract} from "../l4/analysis.mjs";
import {fixtureKey,action,prepare} from "./request.mjs";
import {openRehearsal} from "./pilot.mjs";

function memoryHttp(){
  let handler;
  function makeServer(_options,callback){
    handler=callback;
    const bus=new EventEmitter();
    bus.setTimeout=bus.close=bus.closeIdleConnections=()=>{};
    bus.listen=()=>queueMicrotask(()=>bus.emit("listening"));
    bus.address=()=>({port:40001});return bus;
  }
  function request(url,session,body="",extra={}){
    const headers={"content-type":"application/octet-stream","content-length":String(Buffer.byteLength(body)),
      host:"127.0.0.1:40001",origin:"http://127.0.0.1:40001","x-yj-session":session,...extra};
    const req=Object.assign(Readable.from(body?[Buffer.from(body)]:[]),{url,method:"POST",headers,socket:{remoteAddress:"127.0.0.1"}});
    const res=new EventEmitter(),accepted=Promise.withResolvers();
    res.setHeader=()=>{};
    res.writeHead=(code,h)=>{res.code=code;res.headersSent=true;if(h?.["X-YJ-Start"]==="accepted")accepted.resolve();};
    res.flushHeaders=()=>{};
    res.end=s=>{res.writableEnded=true;res.data=JSON.parse(s);};
    return {res,accepted:accepted.promise,done:handler(req,res)};
  }
  return {request,makeServer};
}
const reviewed=[];
const source={schemaVersion:"0.1",kind:"card-history",evidence:"completed-history",ownerId:"synthetic",sessionId:randomUUID(),key:randomUUID(),revision:1};
for(const [id,story,expected] of [
  ["complete",prose(east),"ready"],["nonexclusive",rejected.nonexclusive,"not-ready"],
  ["location",prose(tower),"not-ready"],["viewpoint",prose(east.with(1,"你站在正门，向南望去")),"not-ready"],
  ["old-image",rejected.oldImage,"not-ready"],["self-report",rejected.hiddenJson,"not-ready"],
  ["partial",rejected.partial,"not-ready"],["paraphrase","走进东村青石酒馆，你立在正门向北看。正午日光映着固定的柜台、双窗。你看遍全堂，确认仅掌柜、蓝衣客与赭衣客三人在场。","not-ready"]
]){
  const {audit}=extract({source,narrative:story,action:prepare({action}).body,state:{places:[],current:null}});
  assert.equal(audit.status,expected,id);reviewed.push({id,status:audit.status,blockers:audit.blockers,conflicts:audit.conflicts});
}
const modes=["lost","reject","expiry","slow-disconnect","slow-reply","pagehide","lease-after-accept","unknown","ack-no-history","scene-failure","complete","nonexclusive"];
const checks=[];
for(const mode of modes){
  const root=await mkdtemp(join(tmpdir(),"yj-l5-memory-")),http=memoryHttp();
  let now=Date.now(),allowed=true,sends=0;
  const detached=["slow-disconnect","slow-reply","pagehide","lease-after-accept"].includes(mode);
  const resume=Promise.withResolvers(),entered=Promise.withResolvers();
  const options={makeServer:http.makeServer,now:()=>now,checkGate:()=>allowed,story:mode==="nonexclusive"?mode:"complete",
    async runCard({ledger,takeKey,gate,cancelSignal,pilot}){
      if(mode!=="slow-reply"){entered.resolve();if(detached)await resume.promise;}
      const call={owner:"synthetic",sessionId:randomUUID(),key:randomUUID()};
      gate();ledger.arm(call,pilot.prepare({action}));
      const model=cardModel({ledger,takeKey,gate,cancelSignal,prepareRequest:pilot.prepare,mark:pilot.mark,hashResponseId:true,estimateCharge:pilot.estimateCharge,
        transport:async(url,init)=>{
          assert.equal(url,endpoint);assert.equal(init.headers.Authorization,"Bearer "+fixtureKey);
          assert.equal(init.redirect,"error");assert.equal(ledger.snapshot().state,"possible-sent");sends++;
          if(mode==="slow-reply"){entered.resolve();await resume.promise;}
          if(mode==="unknown")throw Error("fixture-timeout");return Response.json(await pilot.fakeReply());
        }});
      const narrative=await model({action},new AbortController().signal,call);
      assert.equal(ledger.snapshot().usage.estimatedNanoUsd,null);
      if(mode==="ack-no-history")throw Error("HISTORY_FIXTURE_FAILURE");
      assert.equal(digest(narrative),ledger.snapshot().bodySha256);
      pilot.mark("history-committed");
      if(mode==="scene-failure")throw Error("PROJECTION_FIXTURE_FAILURE");
      const {audit}=pilot.extract({source,narrative,state:{places:[],current:null}});
      pilot.mark("scene-reviewed");return {revision:1,extraction:audit.status,historyFixture:"memory-only"};
    }};
  const server=await openRehearsal(root,options);
  const invite=new URL(server.url).hash.slice(1);
  let session=invite;
  const post=async(url,body="",extra={})=>{const r=http.request(url,session,body,extra);await r.done;return r.res;};
  try{
    const claim=await post("/claim");assert.equal(claim.code,200);
    assert.equal((await post("/claim")).code,403);session=claim.data.session;
    assert.equal((await post("/check","untrusted-input-123")).code,400);
    assert.equal((await post("/check",fixtureKey,{"x-yj-project":"verified"})).data.status,"READY");
    if(mode==="reject")allowed=false;
    if(mode==="expiry")now+=16*60_000;
    if(mode!=="lost"){
      const start=http.request("/start",session,"",{"x-yj-confirm":"one-luna-text"});
      if(detached){
        await Promise.all([start.accepted,entered.promise]);
        assert.equal((await post("/start")).code,409);
        if(mode==="pagehide")assert.equal((await post("/clear")).code,200);
        else if(mode==="lease-after-accept"){now+=91_000;assert.equal((await post("/ping")).code,410);}
        else{if(mode==="slow-reply")await delay(8100);assert.equal((await post("/ping")).code,200);}
        start.res.destroyed=true;start.res.emit("close");resume.resolve();
      }
      await start.done;
      if(mode==="reject")assert.equal(start.res.data.status,"START_REJECTED_BEFORE_SEND");
      if(mode==="expiry")assert.equal(start.res.data.status,"INVITE_EXPIRED");
    }
  }finally{resume.resolve();server.close();}
  const log=await readFile(join(server.directory,"audit",server.runHash+".jsonl"),"utf8");
  for(const forbidden of [fixtureKey,invite,session,action])assert.ok(!log.includes(forbidden));
  const stages=log.trim().split("\n").map(line=>{const row=JSON.parse(line);
    assert.deepEqual(Object.keys(row),["runHash","utc","stage"]);assert.equal(row.runHash,server.runHash);return row.stage;});
  const result=server.status(),before=["lost","reject","expiry"].includes(mode);
  assert.equal(sends,before?0:1);
  const expected=before?"NO_LOCAL_RECORD":mode==="unknown"?"POSSIBLE_SEND_UNCONFIRMED":
    mode==="ack-no-history"?"ACKNOWLEDGED_HISTORY_UNVERIFIED":mode==="scene-failure"?"HISTORY_COMMITTED_SCENE_UNVERIFIED":"MOCK_HISTORY_VERIFIED";
  assert.equal(result.status,expected);
  if(result.scene)assert.equal(result.scene,mode==="nonexclusive"?"not-ready":"ready");
  if(!before){
    const next=await openRehearsal(root,options);
    try{session=new URL(next.url).hash.slice(1);session=(await post("/claim")).data.session;
      assert.deepEqual((await post("/check",fixtureKey,{"x-yj-project":"verified"})).data.reasons,["APPROVAL_LOCKED"]);}
    finally{next.close();}
    assert.ok(stages.indexOf("ledger-possible-sent")>stages.indexOf("receipt-created"));
  }
  checks.push({mode,sends,stages,status:result.status,scene:result.scene});
}
await writeFile(process.argv[2],JSON.stringify({status:"PASS",http:"in-memory",history:"test-double",checks,reviewed,
  realModelQueries:0,realTextCalls:0,realImageCalls:0,newCostUsd:0},null,2)+"\n",{flag:"wx"});
