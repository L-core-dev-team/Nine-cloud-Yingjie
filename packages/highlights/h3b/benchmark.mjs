import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {session} from "../../first-play/test/s2-host.mjs";
import {replayHighlights3B} from "./replay.mjs";
import {suggestNarrativeCandidates} from "./fixture.mjs";
import {lines} from "./evaluate.mjs";
assert.equal(process.permission?.has("net"),false);
const texts=lines("packages/highlights/test/h3b/dev.jsonl").flatMap(s=>s.rows.map(r=>r.text)),results=[];
for(const n of [20,100,300,1000]) {
    const host=session("h3b-cost-"+n);
    for(let i=0;i<n;i++)host.append(texts[i%texts.length]);
    const ctx={...host.context(),replayOnly:true},samples=[];
    replayHighlights3B(ctx,suggestNarrativeCandidates);
    for(let i=0;i<3;i++){
        const timing={},start=performance.now(),cpu=process.cpuUsage();
        replayHighlights3B(ctx,suggestNarrativeCandidates,timing);
        const usage=process.cpuUsage(cpu);
        samples.push({wallMs:performance.now()-start,cpuMs:(usage.system+usage.user)/1000,...timing});
    }
    results.push({n,samples,medianMs:samples.map(s=>s.wallMs).sort((a,b)=>a-b)[1]});
}
console.log(JSON.stringify({node:process.version,unit:"ms",warmups:1,trials:3,results,peakRssKiB:process.resourceUsage().maxRSS}));
