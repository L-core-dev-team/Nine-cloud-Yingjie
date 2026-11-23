import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {contexts,lines} from "../h3b/evaluate.mjs";
import {sourceRow} from "../h3b/protocol.mjs";
import {envelope,transitions} from "./propositions.mjs";
import {replayHighlights3B2} from "./replay.mjs";
assert.equal(process.permission?.has("net"),false);
const tests=[];
function test(id,fn){try{fn();tests.push({id,pass:true});}catch(e){tests.push({id,pass:false,message:e.message.slice(0,600)});}}
function make(c,ctx,refs) {
    const {kind,actor,other,item}=c,[before,after]=transitions[kind];
    return envelope({kind,actor,other,item,before,after,source:"narrator",time:"current",qualifier:"unconditional",polarity:"positive"},refs.map(i=>sourceRow(ctx,i)));
}
const edits={
    sha:q=>q.spans[0].narrativeSha256="0".repeat(64),future:q=>q.spans[0].revision+=100,session:q=>q.spans[0].session="other",
    scope:q=>q.spans[0].scope="other",sourceKey:q=>q.spans[0].sourceKey="other",truncated:q=>{q.spans[0].quote=q.spans[0].quote.slice(1);q.spans[0].start++;},
    overlap:q=>q.spans.push({...q.spans.at(-1)}),"wire-field":q=>q.verified=true,"cross-scope-claim":q=>q.scope="other",
    "old-anchor":q=>q.spans=q.spans.slice(0,1),"wrong-end":q=>q.spans[0].end++,reversed:q=>q.spans.reverse(),
    negative:q=>q.polarity="negative",conditional:q=>q.qualifier="conditional",reported:q=>q.source="third-party",
    "later-time":q=>q.time="future","different-right":q=>q.after="possessed"
};
for(const s of lines("packages/highlights/test/h3b2/adverse.jsonl"))test(s.id,()=>{
    const ctx=contexts("adverse-"+s.id,s.history).at(-1),q=make(s,ctx,[0,ctx.revision-1]),m=s.mutation;
    if(edits[m])edits[m](q);
    let raw=JSON.stringify([q]);
    if(m==="mixed")raw=JSON.stringify([q,{...q,settled:true}]);
    if(m==="duplicate")raw=JSON.stringify([q,q]);
    if(m==="empty")raw="[]";
    if(m==="non-json")raw="{";
    if(m==="limit")raw=" ".repeat(66000);
    const tape=Array(ctx.revision).fill("[]");tape[tape.length-1]=raw;
    const result=replayHighlights3B2(ctx,"data",JSON.stringify(tape)),last=result.rounds.at(-1);
    assert.equal(result.events.length,0);assert.equal(last.cadence.send,false);
    if(!["none","empty","negative","conditional","reported","later-time","different-right"].includes(m))
        {assert.ok(last.batchError);assert.equal(last.grounding.length,0);}
});
const a="杜苓答应把山图交给东馆。",b="杜苓把山图交给东馆。东馆当场签收了山图。";
test("independent evidence, identical repeats, later withdrawal and immutable as-of",()=>{
    const cuts=contexts("withdraw",[a,b,b,"东馆更正了山图签收记录，原记载作废。"]);
    const full=replayHighlights3B2(cuts.at(-1));
    assert.equal(full.events.length,1);
    const id=full.events[0].id;
    assert.ok(full.rounds[1].ranking.includes(id));assert.ok(!full.rounds[3].ranking.includes(id));
    assert.deepEqual(replayHighlights3B2(cuts[1]).rounds,full.rounds.slice(0,2));
});
test("administrator authorization and replay-only are required",()=>{
    for(const change of [{authorized:false},{replayOnly:false},{scope:"other"}])
        assert.throws(()=>replayHighlights3B2({...contexts("auth",[a,b]).at(-1),...change}));
});
test("no execution hook accepted",()=>{
    const ctx=contexts("data",[a,b]).at(-1);assert.throws(()=>replayHighlights3B2(ctx,"data",()=>{}));
});
test("bound roles cannot use extra unrelated evidence",()=>{
    const ctx=contexts("extra",[a,"墙边放着一把空椅。",b]).at(-1);
    const q=make({kind:"delivery",actor:"杜苓",other:"东馆",item:"山图"},ctx,[0,1,2]);
    const out=replayHighlights3B2(ctx,"data",JSON.stringify(["[]","[]",JSON.stringify([q])]));
    assert.equal(out.events.length,0);
});
test("unclosed narrator quotation and antecedent homonym block promotion",()=>{
    for(const extra of ["有两个同名的杜苓。","她在梦中写道：「"])
        assert.equal(replayHighlights3B2(contexts("voice",[extra,a,b]).at(-1)).events.length,0);
});
test("two independent adjacent deliveries",()=>{
    const out=replayHighlights3B2(contexts("adjacent",[a,"阿丰答应把陶盏交给学舍。",b,"阿丰把陶盏交给学舍。学舍当场签收了陶盏。"]).at(-1));
    assert.equal(out.events.length,2);assert.ok(out.rounds.every(r=>r.cadence.send===false));
});
test("opaque interventions cannot be silently interpreted as a continuing promise",()=>{
    const out=replayHighlights3B2(contexts("opaque",[a,"两人把那份约定一笔勾销。",b]).at(-1));
    assert.equal(out.events.length,0);
    assert.equal(out.rounds.at(-1).grounding[0].verdict.cause,"unresolved");
});
test("a declared act without a matching antecedent only establishes that act",()=>{
    const out=replayHighlights3B2(contexts("missing",[b]).at(-1));
    const v=out.rounds[0].grounding[0].verdict;
    assert.equal(v.outcomeEntailment,"supported");assert.equal(v.entailment,"unresolved");assert.equal(v.cause,"unresolved");assert.equal(out.events.length,0);
});
test("signed, registry, collective and account assertions carry no ownership",()=>{
    for(const [kind,text,item,other] of [
        ["signed","杜苓签了把山图赠给东馆的契书。","山图","东馆"],["registry","杜苓将山图登记在东馆名下。","山图","东馆"],
        ["common","杜苓放弃独占渡口。从这日起渡口由船工共有。","渡口","船工"],["account","杜苓把渡资全数汇入东馆公账，柜上出具了到账凭据。","渡资","东馆公账"]]){
        const ctx=contexts("layer-"+kind,[text]).at(-1),q=make({kind,actor:"杜苓",item,other},ctx,[0]);
        const out=replayHighlights3B2(ctx,"data",JSON.stringify([JSON.stringify([q])]));
        assert.equal(out.rounds[0].grounding[0].verdict.outcomeEntailment,"supported");
        assert.equal(out.events.length,0);
    }
});
console.log(JSON.stringify({tests}));if(tests.some(t=>!t.pass))process.exitCode=1;
