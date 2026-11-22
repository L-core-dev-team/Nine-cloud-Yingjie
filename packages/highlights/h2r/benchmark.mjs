import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {readFileSync} from "node:fs";
import {session} from "../../first-play/test/s2-host.mjs";
import {replayHighlights2R} from "./replay.mjs";
assert.equal(process.permission?.has("net"),false);
const corpus=Array.from({length:12},(_,n)=>JSON.parse(readFileSync(new URL("../test/h2r/dev/"+String(n+1).padStart(2,"0")+".json",import.meta.url))).rows.map(x=>x.text)).flat();
const rows=[];
for(const n of [20,100,300,1000]){
  const start=performance.now(),h=session("bench"+n);
  for(let i=0;i<n;i++)h.append(corpus[i%corpus.length]);
  const ctx={...h.context(),replayOnly:true},hostMs=performance.now()-start;
  replayHighlights2R(ctx);const samples=[];
  for(let i=0;i<3;i++){const stages={},before=performance.now();const o=replayHighlights2R(ctx,stages);samples.push({elapsed:performance.now()-before,stages,candidates:o.candidates.length});}
  rows.push({n,hostMs,samples,median:samples.map(s=>s.elapsed).sort((a,b)=>a-b)[1]});
}
console.log(JSON.stringify({node:process.version,rows,peakKiB:process.resourceUsage().maxRSS,net:false,scope:"one warmup, three CPU-only replays, cycling development narratives; no model"}));
