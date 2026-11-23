// Post-holdout public diagnostic. Never included in the frozen score.
import {contexts} from "../h3b/evaluate.mjs";
import {corpus} from "./measure.mjs";
import {replayHighlights3B2S} from "./replay.mjs";
const original=corpus("held").find(s=>s.id==="套戏").rows.map(r=>r.text);
const texts=original.slice();texts.splice(7,0,original[4]);
const result=replayHighlights3B2S(contexts("post-held-puppet",texts).at(-1));
const r=result.rounds[8];
console.log(JSON.stringify({type:"public-error-reproduction-after-locked-score",mutation:"insert a staged pledge immediately after the inner calculation closes",
    expectedWorld:"staged-performance",expectedFacts:0,actual:r.candidateIds.length,rows:result.rounds.slice(2,9).map((v,j)=>({
        r:v.revision,text:texts[j+2],spans:v.scope.spans,transitions:v.scope.changes,changes:v.semanticChanges,ranking:v.ranking})),
    falseEvidence:result.events.filter(e=>e.revision===9)}));
if(r.candidateIds.length)process.exitCode=1;
