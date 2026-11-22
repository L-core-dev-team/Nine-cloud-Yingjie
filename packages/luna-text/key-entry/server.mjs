import {createServer} from "node:http";
import {randomBytes,timingSafeEqual} from "node:crypto";
import {readFileSync} from "node:fs";
import {once} from "node:events";
import {stageJournal} from "./stages.mjs";

const files=new Map([["/",["index.html","text/html; charset=utf-8"]],["/entry.js",["entry.js","text/javascript"]],
  ["/style.css",["style.css","text/css"]]].map(([path,[file,mime]])=>[path,{mime,body:readFileSync(new URL(file,import.meta.url))}]));
const token=()=>randomBytes(32).toString("base64url");
const matches=(given,want)=>typeof given==="string" && typeof want==="string" && /^[A-Za-z0-9_-]{43}$/.test(given) &&
  timingSafeEqual(Buffer.from(given),Buffer.from(want));
const headers={"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"DENY","Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Resource-Policy":"same-origin",
  "Content-Security-Policy":"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; worker-src 'none'; object-src 'none'",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()"};
// No access logger; deny unexpected destinations and authenticate before reading any bytes.
export async function serve({inspect,execute,verifyModel,html,journal=stageJournal(),lifetimeMs=15*60_000,leaseMs=90_000,now=Date.now}) {
  const {mark,runHash}=journal;
  let invite=token(),session=null,secret=null,state="new",verified=false;
  const expiresAt=now()+lifetimeMs;
  let lastSeen=now(),origin,timer,modelVisible=false;
  const controller=new AbortController();
  function forget(){secret?.fill(0);secret=null;}
  function close(){
    if(state==="closed")return;
    if(state!=="running"){try{mark("stop");}catch{/* Cleanup still takes priority. */}}
    state="closed";forget();invite=null;session=null;controller.abort();clearInterval(timer);
    server.close();server.closeIdleConnections();
  }
  function expired(){return now()>=expiresAt || (session && now()-lastSeen>leaseMs);}
  const server=createServer({maxHeaderSize:8192,requestTimeout:5000,headersTimeout:5000},async(req,res)=>{
    for(const [k,v] of Object.entries(headers))res.setHeader(k,v);
    res.setHeader("Connection","close");
    const json=(status,obj)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(obj));};
    const deny=(status=403)=>json(status,{status:"DENIED"});
    let body;
    try{
      if(req.socket.remoteAddress!=="127.0.0.1" || req.headers.host!==origin.slice(7))return deny();
      if(expired() || state==="closed"){json(410,{status:"INVITE_EXPIRED"});close();return;}
      if(req.method==="GET" && files.has(req.url)){
        const {mime,body}=files.get(req.url);res.writeHead(200,{"Content-Type":mime});return res.end(req.url==="/" && html?html:body);
      }
      if(req.method!=="POST" || req.headers.origin!==origin || (req.headers["sec-fetch-site"] && req.headers["sec-fetch-site"]!=="same-origin") ||
        req.headers["content-type"]!=="application/octet-stream")return deny();
      const claim=req.url==="/claim";
      if(!matches(req.headers["x-yj-session"],claim?invite:session))return deny();
      // Browsers set Content-Length on these small in-memory fetch bodies. No streaming/chunked uploads.
      const n=Number(req.headers["content-length"]);
      if(req.headers["transfer-encoding"] || !Number.isSafeInteger(n) || n<0 || n>(req.url==="/check"?512:0))return deny(400);
      body=Buffer.alloc(n);let offset=0;
      for await(const chunk of req){try{if(offset+chunk.length>n)return deny(400);chunk.copy(body,offset);offset+=chunk.length;}finally{chunk.fill(0);}}
      if(offset!==n || expired() || state==="closed" || !matches(req.headers["x-yj-session"],claim?invite:session))return deny();
      if(claim){
        invite=null;session=token();state="open";lastSeen=now();
        mark("invite-claimed");return json(200,{session,expiresAt,runHash});
      }
      lastSeen=now();
      if(req.url==="/start")mark("start-received");
      if(req.url==="/clear"){json(200,{status:"CLEARED"});close();return;}
      if(req.url==="/ping")return json(200,{status:"OPEN"});
      if(req.url==="/check" && ["open","checked","ready"].includes(state)){
        if(n){
          if(secret || n<12 || body.some(b=>b<33 || b>126))return deny(400);
          secret=Buffer.from(body);
        }
        verified=req.headers["x-yj-project"]==="verified";
        let reasons;
        try{reasons=inspect(Boolean(secret),verified);}catch{reasons=["CHECK_BLOCKED"];}
        if(verifyModel && !reasons.length && !modelVisible){
          state="checking";
          try{modelVisible=await verifyModel(secret.toString("ascii"),controller.signal);}catch{modelVisible=false;}
          if(state==="closed" || expired())return deny(410);
          if(!modelVisible)reasons.push("MODEL_VISIBILITY_UNCONFIRMED");
        }
        mark(reasons.length?"check-blocked":"preflight-ready");
        state=reasons.length?"checked":"ready";
        return json(200,{status:state==="ready"?"READY":"LIVE_BLOCKED",reasons,held:Boolean(secret)});
      }
      if(req.url==="/start" && state==="ready" && (!verifyModel || modelVisible) && secret && req.headers["x-yj-confirm"]==="one-luna-text"){
        let reasons;
        try{reasons=inspect(true,verified);}catch{reasons=["CHECK_BLOCKED"];}
        if(reasons.length){
          mark("gate-denied");json(409,{status:"START_REJECTED_BEFORE_SEND"});close();return;
        }
        state="running";
        try{mark("start-accepted");}catch{json(503,{status:"START_REJECTED_BEFORE_SEND"});close();return;}
        res.writeHead(200,{"Content-Type":"application/json","X-YJ-Start":"accepted"});
        res.flushHeaders();
        res.on("close",()=>{if(!res.writableEnded)close();});
        const takeKey=()=>{controller.signal.throwIfAborted();if(!secret)throw Error("KEY_UNAVAILABLE");
          try{return secret.toString("ascii");}finally{forget();}};
        let result;
        try{result=await execute({takeKey,verified,signal:controller.signal,mark,runHash});}
        catch{result={status:"POSSIBLE_SEND_UNCONFIRMED"};}
        finally{
          try{mark("stop");}catch{result={status:"POSSIBLE_SEND_UNCONFIRMED"};}
          if(!res.destroyed)res.end(JSON.stringify(result));
          close();
        }
        return;
      }
      deny(409);
    }catch{if(!res.headersSent&&!res.destroyed)deny(400);}
    finally{body?.fill(0);}
  });
  server.on("clientError",(_error,socket)=>socket.destroy());
  server.setTimeout(120_000,socket=>socket.destroy());
  server.listen({host:"127.0.0.1",port:0,exclusive:true});await once(server,"listening");
  origin="http://127.0.0.1:"+server.address().port;
  timer=setInterval(()=>{if(expired())close();},Math.min(1000,leaseMs));
  return {url:origin+"/#"+invite,origin,expiresAt,close};
}
