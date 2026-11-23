import assert from "node:assert/strict";
import {loadRules,simulate,makeReader} from "./host.mjs";
import {createNativeFactReplay,digest} from "../admission.mjs";
const core=await loadRules(process.argv[2]), W="loc_wangqitai",F="loc_luhuadu";
const move=id=>({intent:{kind:"move",payload:{destinationId:id}}});
const story={id:"guards",owner:"scope-test",save:"isolated",turns:[move(W),move(F),move("subloc_reef_ledge"),move(W),move(W)]};
const repo=await simulate(core,story),checks=[];
function test(name,fn){try{const data=fn();checks.push({name,ok:true,data});}catch(e){checks.push({name,ok:false,error:String(e.message).slice(0,400)});}}
const run=(ref,options)=>createNativeFactReplay(makeReader(repo,options)).inspect(ref);
function denied(result){assert.equal(result.status,"UNVERIFIED");assert.equal(result.added,0);assert.deepEqual(result.facts,[]);return result.reason;}
test("historical R1 is confirmed while the current revision is later",()=>{
    const v=run(repo.refs[0]);assert.equal(v.facts[0].revision,1);assert.ok(repo.through>1);return v.status;
});
test("legitimate rejected attempt retained its prior revision",()=>{
    const v=run(repo.refs[4]);assert.equal(repo.records[4].receipt.decision.status,"rejected");
    assert.equal(v.status,"NOT_A_WORLD_LOCATION_CHANGE");return v.reason;
});
for(const f of ["no-before","no-after","no-batch"])test("rejected-without-"+f,()=>denied(run(repo.refs[4],{at:5,fault:f})));
for(const [field,value] of [["save","foreign"],["branch","fork"],["key","foreign-key"],["r",99]])test("untrusted locator "+field,()=>denied(run({...repo.refs[0],[field]:value})));
test("no future evidence from a valid reader",()=>denied(run(repo.refs[2],{through:2})));
test("capability loses authority on JSON round-trip",()=>denied(createNativeFactReplay(JSON.parse(JSON.stringify(makeReader(repo)))).inspect(repo.refs[0])));
test("malformed later member rolls back first valid arrival",()=>{
    let corrupt=true;
    const reader=makeReader(repo,{mutate(row){
        if(!corrupt)return;
        const tail=structuredClone(row.receipt.decision.events[0]);tail.id="00000000-0000-4000-8000-000000000099";
        tail.type="observe.result";tail.payload.stateDelta={timeChange:1,locationChange:null,factChanges:[
            {key:"archiveKind",before:{present:false},after:{present:true,value:"forged"}}]};
        row.receipt.decision.events.push(tail);
        row.batch.push({...structuredClone(row.batch[0]),ordinal:1,event:structuredClone(tail)});row.receiptSha=digest(row.receipt);
    }});
    const api=createNativeFactReplay(reader),red=denied(api.inspect(repo.refs[0]));corrupt=false;
    assert.equal(api.inspect(repo.refs[0]).added,1);assert.equal(api.inspect(repo.refs[0]).added,0);return red;
});
test("same key cannot replace prior commitment",()=>{
    let changed=false;
    const api=createNativeFactReplay(makeReader(repo,{mutate(row){if(changed){row.receipt.rng.draws=1;row.receipt.rng.seed="fixture";row.receiptSha=digest(row.receipt);}}}));
    assert.equal(api.inspect(repo.refs[0]).added,1);changed=true;return denied(api.inspect(repo.refs[0]));
});
test("different stored owner cannot relabel historical save",()=>denied(run(repo.refs[0],{mutate(row){row.before.owner="foreign";}})));
test("non-root event missing branch is not defaulted to authority",()=>denied(run(repo.refs[0],{mutate(row){
    delete row.receipt.decision.events[0].branchId;delete row.batch[0].event.branchId;row.receiptSha=digest(row.receipt);
}})));
test("accepted legal_failure with world delta cannot become a positive",()=>denied(run(repo.refs[0],{mutate(row){
    row.receipt.decision.outcome="legal_failure";row.receipt.decision.code="RULE_ROAD_BLOCKED";row.receiptSha=digest(row.receipt);
}})));
test("full state, not only final locationId",()=>denied(run(repo.refs[0],{mutate(row){
    row.after.value.state.facts.stamina--;row.after.sha=digest(row.after.value);
}})));
test("changed request body cannot borrow existing receipt fingerprint",()=>denied(run(repo.refs[0],{at:1,fault:"subject-fingerprint"})));
test("old data remains immutable after caller mutates an emitted fact",()=>{
    const api=createNativeFactReplay(makeReader(repo)),v=api.inspect(repo.refs[0]);v.facts[0].after="poison";
    assert.equal(api.inspect(repo.refs[0]).facts[0].after,W);
});
console.log(JSON.stringify({checks}));if(checks.some(x=>!x.ok))process.exitCode=1;
