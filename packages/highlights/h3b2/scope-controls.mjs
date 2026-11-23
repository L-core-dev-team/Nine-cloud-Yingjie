import assert from "node:assert/strict";
import {contexts} from "../h3b/evaluate.mjs";
import {replayHighlights3B2} from "./replay.mjs";
const tests=[];
function check(name,fn){try{fn();tests.push({name,pass:true});}catch(e){tests.push({name,pass:false,message:e.message});}}
const promise="杜苓答应把山图交给东馆。",outcome="杜苓把山图交给东馆。东馆当场签收了山图。";
function replay(texts){return replayHighlights3B2(contexts("scope-controls",texts).at(-1));}
check("fictional speaker cannot reset narration",()=>{
    const r=replay(["以下都是梦境。","梦中有人喊，叙述回到现实。",promise,outcome]);
    assert.equal(r.events.length,0);assert.equal(r.rounds.at(-1).scope.world,"noncurrent-or-reported");
});
check("nonactual premise cannot authorize real fulfillment",()=>{
    const r=replay(["接下来是舞台排练。",promise,"排练结束，叙述回到现实。",outcome]);
    assert.equal(r.events.length,0);assert.equal(r.rounds.at(-1).grounding[0].verdict.reason,"premise-from-another-discourse-epoch");
});
check("a dream cannot revoke the earlier historical event",()=>{
    const r=replay([promise,outcome,"后文是她的梦境。","东馆撤销了山图的签收。"]);
    assert.ok(r.rounds.at(-1).ranking.includes(r.events[0].id));
});
check("quarantine masks inherited rights, ranks, edges and transactional writes",()=>{
    const texts=["以下是剧本。","东宅属于杜和。","杜和签了把东宅赠给山社的契书。","东宅的产权当日登记在山社名下。"];
    const r=replay(texts);
    assert.equal(r.candidates.length,0);assert.equal(r.edges.length,0);
    for(const t of r.rounds){assert.deepEqual(t.transaction.changes,{});assert.equal(t.cadence.action,"text-only");}
});
console.log(JSON.stringify({tests}));if(tests.some(t=>!t.pass))process.exitCode=1;
