import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {validate} from "./relay.mjs";
import {hash,blocked} from "./data.mjs";
const base=new URL("../../docs/reports/evidence/YJ-P05-PLAYABLE-LOOP-01/",import.meta.url);
const bytes=p=>readFileSync(new URL(p,base)),read=p=>JSON.parse(bytes(p));
const formal=read("demo-export.json"),dry=read("rehearsal-export.json");
assert.equal(formal.rounds.length,8);assert.equal(formal.slots.length,16);assert.equal(dry.rounds.length,8);
assert.notEqual(formal.rounds[0].scope,dry.rounds[0].scope);
assert.ok(dry.slots.every(s=>s.status==="prepared"&&s.result===null));
for(const name of ["reward","prepared"]){
 const before=read(name+"-restart-before.json"),after=read(name+"-restart-after.json");
 assert.deepEqual(before,after);assert.equal(before.history.length,name==="reward"?4:1);
 if(name==="reward")assert.ok(before.history.at(-1).native.quest.rewardClaimed);
}
const get=(r,k)=>formal.slots.find(s=>s.revision===r&&s.kind===k);
let accepted=0,unknown=0;
for(const s of formal.slots){
 const id=s.kind+String(s.revision).padStart(2,"0"),pk=bytes("packets/"+id+".json"),raw=bytes("raw/"+id+".json"),p=JSON.parse(pk);
 assert.equal(s.packetSha,hash(pk));assert.equal(s.rawSha,hash(raw));assert.deepEqual(read("access/"+id+".json"),s.trace);
 assert.equal(s.trace.attempt,1);assert.equal(s.trace.observedOnlyPacketRead,true);assert.equal(s.trace.inheritedUserHistory,false);
 const r=formal.rounds[s.revision-1];assert.equal(r.scope,p.scope);assert.equal(r.bodySha,hash(r.text));assert.equal(p.bodySha,r.bodySha);
 for(const [field,value] of Object.entries(s.sourceBinding))assert.deepEqual(value,r[field]);
 assert.deepEqual(p.prefix,formal.rounds.slice(0,s.revision).map(r=>({rev:r.revision,text:r.text})));
 if(s.kind==="timing")assert.deepEqual(p.projection,get(s.revision,"state").result);
 if(s.revision>1)assert.deepEqual((s.kind==="state"?p.previousState:p.previousTiming).result,get(s.revision-1,s.kind).result);
 const replay=validate(p,raw);assert.deepEqual(replay,s.result);assert.equal(hash(replay),s.resultSha);
 for(const [k,v] of Object.entries(blocked))assert.equal(replay[k],v);
 accepted+=Number(replay.valid);unknown+=replay.claims?.filter(c=>c.status==="unknown").length||0;
}
console.log(JSON.stringify({authenticatedFormalTurns:8,archivedReplies:16,mechanicalAccepted:accepted,unknownClaims:unknown,
 restoredAfter:[1,4],separateRehearsalTurns:8,modelCallsInReplay:0}));
