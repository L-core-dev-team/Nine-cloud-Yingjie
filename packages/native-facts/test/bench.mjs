import {performance} from "node:perf_hooks";
import {loadRules,simulate,makeReader} from "./host.mjs";
import {createNativeFactReplay} from "../admission.mjs";
const core=await loadRules(process.argv[2]),n=Number(process.argv[3]);
if(![20,100,300,1000].includes(n))throw Error("expected 20, 100, 300 or 1000");
const W="loc_wangqitai",F="loc_luhuadu",move=id=>({intent:{kind:"move",payload:{destinationId:id}}});
const turns=[move(W),{intent:{kind:"observe",payload:{targetId:"obstacle_rockslide",method:"scan"}}},move(F)];
while(turns.length<n)turns.push(move(turns.length%2?W:F));
const hostStart=performance.now(),repo=await simulate(core,{id:"bench",owner:"synthetic",save:"perf",turns});
const hostMs=performance.now()-hostStart,trials=[];
for(let i=0;i<4;i++){
    const start=performance.now(),cpu=process.cpuUsage(),mem=process.memoryUsage().heapUsed;
    const api=createNativeFactReplay(makeReader(repo));let facts=0;
    for(const ref of repo.refs){const v=api.inspect(ref);if(v.status==="UNVERIFIED")throw Error(v.reason);facts+=v.added;}
    const u=process.cpuUsage(cpu);
    if(i)trials.push({facts,wallMs:performance.now()-start,cpuMs:(u.user+u.system)/1000,heapChangeBytes:process.memoryUsage().heapUsed-mem});
}
console.log(JSON.stringify({n,hostMs,trials,processMaxRSSKiB:process.resourceUsage().maxRSS,node:process.version}));
