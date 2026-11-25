import assert from "node:assert/strict";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {openStore,hash,blocked} from "./data.mjs";
import {prepareState,relay,validate} from "./relay.mjs";
import {digest} from "../native-facts/admission.mjs";
const dir=mkdtempSync(join(tmpdir(),"p05-controls-")),s=openStore(dir),scope="isolated-controls";
const row=(r,text,location)=>({scope,revision:r,text,bodySha:hash(text),source:"deterministic",events:[],
 native:{place:location,location,sub:null,quest:{rewardClaimed:false}},...blocked});
const state=r=>JSON.parse(s.db.prepare("SELECT packet FROM slot WHERE rev=? AND kind='state'").get(r).packet);
const seed=r=>{s.db.prepare("INSERT INTO action VALUES(?,?,?,?,?)").run("key"+r.revision,scope,r.revision-1,"{}",JSON.stringify(r));prepareState(s,r)};
const checks=[];
try{
 assert.equal(digest({a:1,b:{q:2,t:3}}),digest({b:{t:3,q:2},a:1}));checks.push("canonical receipt digest survives nested property ordering");
 seed(row(1,"石边只露一线水面。","甲地"));
 const pkt=join(dir,"one");relay(s,"reserve",1,"state",pkt);assert.throws(()=>relay(s,"reserve",1,"state",join(dir,"twice")));checks.push("reserved slot cannot be dispatched twice");
 seed(row(2,"你到了乙地。","乙地"));const before=state(2);assert.equal(before.previousState.status,"reserved");
 const answer={scope,revision:1,claims:[{entity:"石边",attribute:"可见水面",value:"一线",status:"partial",quote:"只露一线水面"},{entity:"石后",attribute:"能见度",value:null,status:"unknown",quote:""}]};
 const raw=join(dir,"raw");writeFileSync(raw,JSON.stringify(answer));relay(s,"import",1,"state",raw);
 assert.deepEqual(state(2),before);assert.equal(state(2).native.place,"乙地");assert.equal(s.history(scope).at(-1).revision,2);checks.push("late R1 import leaves R2 packet, predecessor status and current place unchanged");
 assert.throws(()=>relay(s,"import",1,"state",raw));checks.push("raw import is immutable");
 const p=JSON.parse(s.db.prepare("SELECT packet FROM slot WHERE rev=1 AND kind='timing'").get().packet);
 const a={scope,revision:1,importance:"low",visual:"small",intent:"text-only",reason:"小变化",focus:[],withoutReference:"text-only",withReference:"text-only",conditions:[]};
 for(const [name,value] of [["forged claim",{...a,focus:[{claimId:"invented",quote:"一线"}]}],["foreign scope",{...a,scope:"elsewhere"}],["future revision",{...a,revision:2}],["asset authorization",{...a,send:true}]]){
   const result=validate(p,Buffer.from(JSON.stringify(value)));assert.equal(result.valid,false);assert.equal(result.send,false);checks.push(name+" rejected");
 }
 const stored=s.db.prepare("SELECT result FROM slot WHERE rev=1 AND kind='state'").get();assert.equal(JSON.parse(stored.result).claims[1].status,"unknown");checks.push("partial and unknown preserved for distinct targets");
 assert.equal(validate(p,Buffer.from(JSON.stringify(a))).valid,true);
 console.log(JSON.stringify({type:"synthetic mechanical controls",checks,dispatchAttempted:false}));
}finally{s.db.close();rmSync(dir,{recursive:true})}
