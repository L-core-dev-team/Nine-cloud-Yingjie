import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {contexts,lines,prefixes} from "./evaluate.mjs";
import {replayHighlights3A} from "../h3a/replay.mjs";
import {replayHighlights3B} from "./replay.mjs";
import {suggestNarrativeCandidates} from "./fixture.mjs";
assert.equal(process.permission?.has("net"),false);
const read=f=>JSON.parse(readFileSync(f)),dir="docs/reports/evidence/YJ-P04-H3A/",corpus="packages/highlights/test/";
const original=read(dir+"pre-fix.json").replay.results.map(s=>({id:s.label,texts:s.texts}));
const targeted=[...original,...read(dir+"new-corpus-freeze.json").files.flatMap(f=>lines(f.file))];
const output={prefixes:{},publicMetrics:{},targeted:[],publicCases:[],errors:[],safety:[]};
const prior=new Map(read("docs/reports/evidence/YJ-P04-H3B/baseline.json").prior.map(p=>[p.id,p.revision]));
function paired(group,id,texts,permission) {
    const cs=contexts("historical-h3b-"+group+id,texts,permission),ctx=cs.at(-1);
    const a=replayHighlights3A(ctx), b=replayHighlights3B(ctx,suggestNarrativeCandidates);
    prefixes(cs,b);
    output.prefixes[group]=(output.prefixes[group]??0)+cs.length;
    for (const [i,r] of b.rounds.entries()) {
        const old=a.rounds[i];
        assert.ok(r.cadence.action!=="director-review" || (old.cadence.action==="director-review" && permission?.[i]!=="revoked" && old.candidateIds[0]===r.candidateIds[0]));
        for (const cid of r.ranking) {
            const c=b.candidates.find(item=>item.id===cid);
            assert.ok(c && c.revision<=i+1);
            assert.equal(c.source.revision,c.revision);
            assert.ok(c.learnedAt===undefined || c.learnedAt<=i+1);
            assert.ok(b.rounds[c.revision-1].candidateIds.includes(cid));
        }
        for (const c of b.candidates.filter(c=>c.revision===i+1 && !old.candidateIds.includes(c.id)))
            if(c.review?.causalSupport!=="supported" || c.review.substantiveRight!=="effective" || c.review.documentValidity!=="signed" || c.review.against.length)
                output.safety.push({group,id,revision:i+1,error:"unsupported new confirmation"});
    }
    return [a,b];
}
for (const s of targeted) {
    const [a,b]=paired("targeted",s.id,s.texts);
    const same=JSON.stringify(a.rounds)===JSON.stringify(b.rounds.map(({proposals,...r})=>r)) &&
        JSON.stringify(a.edges)===JSON.stringify(b.edges) && JSON.stringify(a.candidates)===JSON.stringify(b.candidates);
    output.targeted.push({id:s.id,identicalCausalTrace:same,revisions:b.through,peaks:b.candidates.map(c=>c.revision)});
    if(!same) output.safety.push({id:s.id,error:"changed targeted causal trace"});
}
for(const group of ["h1","h2","h2r-dev","h2r-held-public"]) {
    const stories=group==="h1"?lines(corpus+"locked.jsonl"):group==="h2"?lines(corpus+"h2-locked.jsonl"):
        Array.from({length:18},(_,i)=>read(corpus+"h2r/"+(group==="h2r-dev"?"dev":"held")+"/"+String(i+1).padStart(2,"0")+".json"));
    const metrics=[{},{}];
    for(const s of stories) {
        const rows=s.history?.map((text,i)=>({text,pos:s.kinds[i]!=="ordinary"}))??s.turns?.map(t=>({text:t.text,pos:t.expected.type!=="ordinary"}))??s.rows.map(r=>({...r,pos:r.label==="confirmed-peak"}));
        const target=s.rank??s.turns.at(-1).expected.top3;
        const runs=paired(group,s.id,rows.map(r=>r.text),rows.map(r=>r.permission));
        for(const [arm,run] of runs.entries()) {
            const m=metrics[arm],add=(k,n=1)=>{m[k]=(m[k]??0)+n;};
            const rank=run.rounds.at(-1).ranking.map(id=>run.candidates.find(c=>c.id===id).revision);
            if(target.length){add("rankGold");add("top1",Number(rank[0]===target[0]));add("top3",Number(rank.slice(0,3).includes(target[0])));}
            for(const [i,r] of run.rounds.entries()){
                const actual=r.candidateIds.length>0, gold=rows[i].pos;
                add(actual?(gold?"TP":"FP"):(gold?"FN":"TN"));
                if(actual!==gold) output.errors.push({group,story:s.id,r:i+1,arm:arm?"fixture":"h3a",gold,actual});
                if(prior.get(s.id)===i+1 && arm===1) output.publicCases.push({group,story:s.id,revision:i+1,old:runs[0].rounds[i].candidateIds,
                    status:actual?"recovered-confirmation":r.proposals.suggestions.length?"candidate-only":"unresolved",
                    new:r.candidateIds,proposals:r.proposals.suggestions.map(p=>({type:p.type,entities:p.entities,disposition:p.disposition})),
                    judgments:r.audit.judgments.map(j=>({reason:j.reason,support:j.support.map(e=>e.revision),against:j.against.map(e=>e.revision)}))});
            }
        }
    }
    output.publicMetrics[group]=metrics;
}
console.log(JSON.stringify(output));if(output.safety.length)process.exitCode=1;
