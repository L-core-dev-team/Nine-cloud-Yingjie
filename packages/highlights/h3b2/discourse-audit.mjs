import assert from "node:assert/strict";
import {contexts} from "../h3b/evaluate.mjs";
import {replayHighlights3B2} from "./replay.mjs";
assert.equal(process.permission?.has("net"),false);
const setup="裴因答应把绢册交给药房。",finish="裴因把绢册交给药房。药房当场签收了绢册。";
const cases=[
    ["dream-sequence",["接下来三段都是她昨夜的梦境。",setup,finish],0],
    ["staged-sequence",["现开排练，以下动作全部发生在戏中。",setup,finish],0],
    ["explicit-real-return",["以下都是梦境。","她醒了，叙述回到现实。",setup,finish],1],
    ["actual-observed",[setup,finish],1]
];
const results=cases.map(([id,texts,expected])=>{
    const out=replayHighlights3B2(contexts("scope-"+id,texts).at(-1));
    return {id,texts,expected,observed:out.events.length,ranks:out.rounds.map(r=>r.ranking)};
});
console.log(JSON.stringify({results}));if(results.some(s=>s.observed!==s.expected))process.exitCode=1;
