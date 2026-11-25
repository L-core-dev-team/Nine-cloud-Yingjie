import {readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {hash,openStore,blocked} from "./data.mjs";
const version="p05-relay/1";
export const prompts={
 state:"仅据截至本轮的已存正文和公开规则结果。以对象/属性拆分主张，当前可见、部分可见、明确无人、未知、历史、转述、后果和观察差异分开。同句可分别支持局部与限制。不得由地点名补人物名单或视角。只返回 JSON {scope,revision,claims:[{entity,attribute,value,status,quote}]}。scope/revision 原样复制；status 为 visible/partial/absent/unknown/limit/history/reported/consequence/change/first-known。value 为简短字符串，unknown 时为 null；未知可空引文，其余 quote 必须为本轮正文内逐字唯一短引。公开规则已独立保存，无需杜撰引文。",
 timing:"依据当前已存正文、程序实际保存的候选、限制与前序建议。安静的权益后果可用文字；局部可见或建立空间是否值得画取决于新增信息。上一建议受阻不能作为补图理由。区分同轮与精确同步及观察主体。无真实参考。只返回 JSON {scope,revision,importance,visual,intent,reason,focus,withoutReference,withReference,conditions}。importance 为 high/medium/low；visual 为 clear/small/unknown/none；intent 为 update/text-only/defer/needs-review。focus 为 [{claimId,quote}]，只用本轮投影中可见或部分可见的 claimId 及对应逐字引文；可为空。无参考为 new 或与非更新意图相同。有适用参考可选 edit/process/reuse/text-only/defer/needs-review。有裁切/遮挡等处理选 process/edit；直接 reuse 要求原画面已适合。conditions 为字符串数组，reason 为简短中文，说明未知与节奏。"
};
function slot(store,scope,rev,kind){return store.db.prepare("SELECT * FROM slot WHERE scope=? AND rev=? AND kind=?").get(scope,rev,kind)}
function prior(s){return s?{status:s.status,result:s.result&&JSON.parse(s.result)}:{status:"missing",result:null}}
function put(store,p){store.db.prepare("INSERT INTO slot(scope,rev,kind,packet,status) VALUES(?,?,?,?,'prepared')").run(p.scope,p.revision,p.kind,JSON.stringify(p))}
export function prepareState(store,r){
 const history=store.history(r.scope).filter(h=>h.revision<=r.revision);
 const lastSeen={};
 for(const h of history.slice(0,-1)){const prev=prior(slot(store,r.scope,h.revision,"state"));for(const c of prev.result?.claims||[])if(["visible","partial","absent"].includes(c.status))lastSeen[JSON.stringify([h.native.location,c.entity,c.attribute])]={rev:h.revision,place:h.native.location,claim:c}}
 put(store,{version,kind:"state",prompt:prompts.state,scope:r.scope,revision:r.revision,bodySha:r.bodySha,source:"deterministic",prefix:history.map(h=>({rev:h.revision,text:h.text})),
 native:{place:r.native.place,location:r.native.location,sub:r.native.sub,rewardClaimed:r.native.quest.rewardClaimed,events:r.events},previousState:prior(slot(store,r.scope,r.revision-1,"state")),lastSeen:Object.values(lastSeen)});
}
function timingPacket(store,p,result){
 return {version,kind:"timing",prompt:prompts.timing,scope:p.scope,revision:p.revision,bodySha:p.bodySha,prefix:p.prefix,native:p.native,
 previousTiming:prior(slot(store,p.scope,p.revision-1,"timing")),referenceStatus:"none-established",projection:result};
}
function check(c,msg){if(!c)throw Error(msg)}
function exact(a,keys){check(a && typeof a==="object" && Object.keys(a).sort().join(",")===keys.split(" ").sort().join(","),"fields")}
function string(x){return typeof x==="string"&&x.trim()&&x.length<=1800}
export function validate(p,b){
 try{const a=JSON.parse(b.toString("utf8"));check(a.scope===p.scope&&a.revision===p.revision,"scope/revision");
 const text=p.prefix.at(-1).text;check(hash(text)===p.bodySha,"source digest");
 if(p.kind==="state"){
  exact(a,"scope revision claims");check(Array.isArray(a.claims)&&a.claims.length<=40,"claims");
  const claims=a.claims.map(c=>{exact(c,"entity attribute value status quote");check(string(c.entity)&&string(c.attribute),"target");
    check(["visible","partial","absent","unknown","limit","history","reported","consequence","change","first-known"].includes(c.status),"status");
    check(c.status==="unknown"?c.value===null:string(c.value),"value");
    check(typeof c.quote==="string"&&((!c.quote&&c.status==="unknown")||(string(c.quote)&&text.split(c.quote).length===2)),"quote");
    const start=c.quote?text.indexOf(c.quote):null;
    return {...c,origin:"model-candidate",claimId:hash([p.scope,p.revision,p.bodySha,c]).slice(0,24),start,end:start===null?null:start+c.quote.length};
  });
  for(const c of claims){
    if(claims.some(o=>o!==c&&o.entity===c.entity&&o.attribute===c.attribute&&o.status!=="history"&&c.status!=="history"&&o.value!==c.value))c.status="needs-review";
    if(["当前地点","地点名称"].includes(c.attribute)&&c.value&&c.value!==p.native.place)c.status="needs-review";
  }
  return {valid:true,claims,...blocked};
 }
 exact(a,"scope revision importance visual intent reason focus withoutReference withReference conditions");
 check(["high","medium","low"].includes(a.importance)&&["clear","small","unknown","none"].includes(a.visual)&&string(a.reason),"assessment");
 check(["update","text-only","defer","needs-review"].includes(a.intent)&&a.withoutReference===(a.intent==="update"?"new":a.intent),"intent");
 check(Array.isArray(a.conditions)&&a.conditions.every(string)&&["edit","process","reuse","text-only","defer","needs-review"].includes(a.withReference),"conditions");
 if(["edit","reuse","process"].includes(a.withReference))check(a.conditions.length,"missing conditions");
 check(Array.isArray(a.focus)&&a.focus.length<=30,"focus");
 for(const f of a.focus){exact(f,"claimId quote");check(p.projection.claims?.some(c=>c.claimId===f.claimId&&c.quote===f.quote&&["visible","partial","absent","change"].includes(c.status)),"unsupported focus")}
 if(a.intent==="update")check(a.focus.length&&["clear","small"].includes(a.visual),"unsupported update");
 return {valid:true,...a,...blocked};
 }catch(e){return {valid:false,reason:e.message.slice(0,150),claims:[],...blocked}}
}
export function relay(store,op,rev,kind,file){
 const rows=store.db.prepare("SELECT * FROM slot WHERE rev=? AND kind=?").all(rev,kind);check(rows.length===1,"slot missing/ambiguous");const s=rows[0],p=JSON.parse(s.packet);
 if(op==="reserve"){
  check(s.status==="prepared","already used");writeFileSync(file,s.packet,{flag:"wx"});
  check(store.db.prepare("UPDATE slot SET status='reserved' WHERE scope=? AND rev=? AND kind=? AND status='prepared'").run(s.scope,rev,kind).changes===1,"occupied");
 }else{
  check(op==="import"||op==="unknown","operation");const b=op==="import"?readFileSync(file):null;
  const result=b?validate(p,b):{valid:false,reason:"delivery-unknown",claims:[],...blocked};
  store.db.exec("BEGIN IMMEDIATE");
  try{check(store.db.prepare("UPDATE slot SET status=?,raw=?,result=? WHERE scope=? AND rev=? AND kind=? AND status='reserved'").run(b?"returned":"unknown",b,JSON.stringify(result),s.scope,rev,kind).changes===1,"slot not reserved");
    if(kind==="state")put(store,timingPacket(store,p,prior(slot(store,s.scope,rev,"state")).result));
    store.db.exec("COMMIT");
  }catch(e){store.db.exec("ROLLBACK");throw e}
  return result;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [dir,op,r,k,file]=process.argv.slice(2);const store=openStore(dir);try{console.log(JSON.stringify(relay(store,op,Number(r),k,file)??{reserved:true}))}finally{store.db.close()}
}
