import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {readFileSync} from "node:fs";
import {session} from "../../first-play/test/s2-host.mjs";
import {replayHighlights3A} from "./replay.mjs";
assert.equal(process.permission?.has("net"),false);
const cases=Array.from({length:18},(_,i)=>JSON.parse(readFileSync("packages/highlights/test/h2r/dev/"+String(i+1).padStart(2,"0")+".json")).rows.map(r=>r.text)).flat();
const inputs=readFileSync("packages/highlights/test/h3a/04-time.jsonl","utf8").trim().split("\n").flatMap(line=>JSON.parse(line).texts).concat(cases);
const results=[];
for(const n of [20,100,300,1000]){
  const start=performance.now(),host=session("h3a-cost-"+n);
  for(let i=0;i<n;i++)host.append(inputs[i%inputs.length]);
  const ctx={...host.context(),replayOnly:true},hostMs=performance.now()-start;
  replayHighlights3A(ctx);
  const samples=[];
  for(let i=0;i<3;i++){
    const timing={},t=performance.now(),run=replayHighlights3A(ctx,timing);
    samples.push({totalMs:performance.now()-t,timing,candidates:run.candidates.length});
  }
  results.push({n,hostMs,samples,medianMs:samples.map(s=>s.totalMs).sort((a,b)=>a-b)[1]});
}
console.log(JSON.stringify({node:process.version,networkPermission:false,results,peakRssKiB:process.resourceUsage().maxRSS,
  method:"one CPU process, validated synthetic history, one warmup plus three trials; review includes isolated draft and change journal; commit publishes it"}));
