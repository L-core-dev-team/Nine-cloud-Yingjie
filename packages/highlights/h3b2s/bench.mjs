import {performance} from "node:perf_hooks";
import {session} from "../../first-play/test/s2-host.mjs";
import {corpus} from "./measure.mjs";
import {replayHighlights3B2S} from "./replay.mjs";
const texts=corpus("dev").flatMap(s=>s.rows.map(r=>r.text)),results=[];
for(const count of [20,100,300,1000]){
    const host=session("cost-scope-"+count);
    for(let i=0;i<count;i++)host.append(texts[i%texts.length]);
    const ctx={...host.context(),replayOnly:true},trials=[];
    replayHighlights3B2S(ctx);
    for(let i=0;i<3;i++){
        const t={},start=performance.now(),cpu=process.cpuUsage();
        replayHighlights3B2S(ctx,null,t);
        const usage=process.cpuUsage(cpu);trials.push({wallMs:performance.now()-start,cpuMs:(usage.user+usage.system)/1000,...t});
    }
    results.push({count,trials,medianWallMs:trials.map(t=>t.wallMs).sort((a,b)=>a-b)[1]});
}
console.log(JSON.stringify({node:process.version,trials:3,warmup:1,unit:"ms",results}));
