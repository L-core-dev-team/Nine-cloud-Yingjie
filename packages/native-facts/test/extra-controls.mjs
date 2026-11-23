// Additional public controls after scorer lock; excluded from both frozen splits.
import assert from "node:assert/strict";
import {loadRules,simulate,makeReader} from "./host.mjs";
import {createNativeFactReplay,digest} from "../admission.mjs";
const core=await loadRules(process.argv[2]),checks=[];
const fields={id:"public-extra",owner:"owner-1",save:"same-save"};
const move={intent:{kind:"move",payload:{destinationId:"loc_wangqitai"}}};
const repo=await simulate(core,{...fields,turns:[move,{intent:{kind:"free_text",payload:{text:"我已经到了。"}}}]});
function check(name,fn){try{const data=fn();checks.push({name,ok:true,data});}catch(e){checks.push({name,ok:false,error:String(e.message).slice(0,320)});}}
const read=(source,i,options)=>createNativeFactReplay(makeReader(source,options)).inspect(source.refs[i]);
check("genuine clarification with a claimed arrival",()=>{
    assert.equal(repo.records[1].receipt.decision.status,"clarify");const v=read(repo,1);
    assert.equal(v.reason,"decision-clarify");assert.equal(v.added,0);return v.reason;
});
check("pending lookup while a preceding turn is confirmed",()=>{
    const v=createNativeFactReplay(makeReader(repo)).inspect({...repo.refs[0],key:"uncommitted-key"});
    assert.equal(v.status,"UNVERIFIED");assert.equal(v.added,0);return v.reason;
});
check("post-commit visibility revocation never returns cached facts",()=>{
    let allowed=true;const api=createNativeFactReplay(makeReader(repo,{mutate:r=>{r.visible=allowed;}}));
    assert.equal(api.inspect(repo.refs[0]).added,1);allowed=false;
    const v=api.inspect(repo.refs[0]);assert.equal(v.status,"UNVERIFIED");assert.deepEqual(v.facts,[]);return v.reason;
});
check("array ordering in trusted final state matters",()=>{
    const v=read(repo,0,{mutate:r=>{r.after.value.state.facts.knownLocations.reverse();r.after.sha=digest(r.after.value);}});
    assert.equal(v.status,"UNVERIFIED");return v.reason;
});
const second=await simulate(core,{...fields,owner:"owner-2",turns:[move]});
check("identical save, request and event identifiers under distinct synthetic owners",()=>{
    const a=read(repo,0).facts[0],b=read(second,0).facts[0];assert.equal(a.eventId,b.eventId);assert.notEqual(a.id,b.id);
    const v=read(repo,0,{mutate:r=>{r.after=structuredClone(second.records[0].after);}});assert.equal(v.status,"UNVERIFIED");return v.reason;
});
console.log(JSON.stringify({checks}));if(checks.some(t=>!t.ok))process.exitCode=1;
