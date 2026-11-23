import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {contexts,lines} from "../h3b/evaluate.mjs";
import {replayHighlights3B} from "../h3b/replay.mjs";
import {suggestNarrativeCandidates} from "../h3b/fixture.mjs";
import {replayHighlights3B2} from "./replay.mjs";
import {stories} from "./measure.mjs";
const read=f=>JSON.parse(readFileSync(f)),dir="packages/highlights/test/",h3a="docs/reports/evidence/YJ-P04-H3A/";
const prior=new Map(read("docs/reports/evidence/YJ-P04-H3B/baseline.json").prior.map(r=>[r.id,r.revision]));
const result={counts:{},historicalChanges:[],targeted:[],publicErrors:[],problems:[],checkedSpans:0,directorReviews:0,sends:0};
function audit(group,id,texts,permissions){
    const cuts=contexts("prefix3b2-"+group+"-"+id,texts,permissions),full=replayHighlights3B2(cuts.at(-1));
    const legacy=replayHighlights3B(cuts.at(-1),suggestNarrativeCandidates);
    const sameTrace=full.rounds.every((r,i)=>JSON.stringify(r.transaction)===JSON.stringify(legacy.rounds[i].audit));
    assert.ok(sameTrace);
    for(const [i,ctx] of cuts.entries()){
        const r=full.rounds[i],old=legacy.rounds[i],cut=replayHighlights3B2(ctx);
        assert.deepEqual(cut.rounds,full.rounds.slice(0,i+1));
        assert.deepEqual(cut.events,full.events.filter(e=>e.learnedAt<=i+1));
        assert.deepEqual(cut.candidates,full.candidates.filter(e=>e.revision<=i+1));
        assert.deepEqual(cut.edges,full.edges.filter(e=>e.learnedAt<=i+1));
        for(const f of r.grounding){
            assert.equal(f.statement.learnedAt,i+1);
            for(const e of [...f.statement.spans,...f.verdict.support,...f.verdict.against]){
                assert.ok(e.revision<=i+1);assert.equal(e.scope,ctx.scope);assert.equal(e.session,ctx.sessionId);
                assert.equal(e.sourceKey,ctx.receipts[e.revision-1].source.key);
                assert.equal(e.narrativeSha256??e.sha256,ctx.receipts[e.revision-1].narrativeSha256);
                assert.equal(e.quote,texts[e.revision-1].slice(e.start,e.end));result.checkedSpans++;
            }
        }
        result.sends+=Number(r.cadence.send!==false);
        if(r.cadence.action==="director-review"){
            result.directorReviews++;
            assert.equal(old.cadence.action,"director-review");assert.notEqual(permissions?.[i],"revoked");
        }
        const extra=r.candidateIds.filter(cid=>!old.candidateIds.includes(cid));
        if(!group.startsWith("new-")&&extra.length)result.historicalChanges.push({group,id,r:i+1,extra});
        if(prior.get(id)===i+1 && group.startsWith("public-"))
            result.publicErrors.push({group,id,asOf:i+1,confirmed:r.candidateIds.length,legacyReview:r.inheritedReview,
                judgments:r.transaction.judgments.map(j=>({why:j.reason,document:j.documentValidity,registry:j.registryState,right:j.substantiveRight,cause:j.causalSupport})),
                newGrounding:r.grounding.map(x=>x.verdict.reason)});
    }
    if(group==="targeted"){
        const unchanged=full.rounds.every((r,i)=>JSON.stringify(r.ranking)===JSON.stringify(legacy.rounds[i].ranking)&&
            JSON.stringify(r.candidateIds)===JSON.stringify(legacy.rounds[i].candidateIds));
        result.targeted.push({id,unchanged,sameTrace,revisions:texts.length});
        if(!unchanged)result.problems.push({id,reason:"changed-danger-control"});
    }
    result.counts[group]=(result.counts[group]??0)+texts.length;
}
const original=read(h3a+"pre-fix.json").replay.results.map(s=>({id:s.label,texts:s.texts}));
for(const s of [...original,...read(h3a+"new-corpus-freeze.json").files.flatMap(f=>lines(f.file))])audit("targeted",s.id,s.texts);
for(const set of ["h1","h2","h2r-dev","h2r-held-public"]){
    const xs=set==="h1"?lines(dir+"locked.jsonl"):set==="h2"?lines(dir+"h2-locked.jsonl"):
        Array.from({length:18},(_,i)=>read(dir+"h2r/"+(set==="h2r-dev"?"dev":"held")+"/"+String(i+1).padStart(2,"0")+".json"));
    for(const s of xs)audit("public-"+set,s.id,s.history??(s.turns??s.rows).map(t=>t.text),s.rows?.map(t=>t.permission));
}
for(const part of ["dev","held"]){
    for(const s of lines(dir+"h3b/"+part+".jsonl"))audit("h3b-"+part,s.id,s.rows.map(r=>r.text));
    for(const s of stories(part))audit("new-"+part,s.id,s.rows.map(r=>r.text));
}
console.log(JSON.stringify(result));if(result.sends||result.problems.length)process.exitCode=1;
