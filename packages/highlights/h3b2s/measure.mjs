import {readFileSync,readdirSync} from "node:fs";
import {contexts,lines} from "../h3b/evaluate.mjs";
import {replayHighlights3A} from "../h3a/replay.mjs";
import {replayHighlights3B} from "../h3b/replay.mjs";
import {suggestNarrativeCandidates} from "../h3b/fixture.mjs";
import {replayHighlights3B2} from "../h3b2/replay.mjs";
import {replayHighlights3B2S} from "./replay.mjs";
const dir="packages/highlights/test/h3b2s/";
export const corpus=split=>readdirSync(dir).filter(s=>s.startsWith(split+"-")).sort().flatMap(s=>lines(dir+s));
const code={"current-reality":"R",dream:"D","staged-performance":"S",hypothetical:"H",reported:"Q",retrospective:"T",unknown:"U"};
const label=s=>s.path.slice(1).map(k=>code[k]).join("/")||"R";
function transitions(rows){
    let old=[];const sets={open:[],close:[],nested:[],intra:[]};
    for(const [i,row] of rows.entries())for(const s of row){
        const path=s.path==="R"?[]:s.path.split("/");let k=0;
        while(k<Math.min(path.length,old.length)&&path[k]===old[k])k++;
        function add(op,p){const id=[i+1,s.start,op,p.join("/")].join(":");sets[op].push(id);if(p.length>1)sets.nested.push(id);if(s.start>0)sets.intra.push(id);}
        for(let j=old.length;j>k;j--)add("close",old.slice(0,j));
        for(let j=k;j<path.length;j++)add("open",path.slice(0,j+1));old=path;
    }
    return sets;
}
function scoreParts(gold,obs){
    const matrix={},bad=[];
    for(const [i,g] of gold.entries())for(const s of g)for(const o of obs[i]){
        const lo=Math.max(s.start,o.start),hi=Math.min(s.end,o.end);if(hi<=lo)continue;
        const k=s.path+">"+o.path;matrix[k]=(matrix[k]??0)+hi-lo;
        if(s.path!==o.path)bad.push({r:i+1,start:lo,end:hi,gold:s.path,observed:o.path,frameId:o.frameId,reason:o.reason});
    }
    const want=transitions(gold),got=transitions(obs),boundaries={};
    for(const k of Object.keys(want)){const a=new Set(want[k]),b=new Set(got[k]);boundaries[k]=[...b].reduce((v,x)=>v+Number(a.has(x)),0);
        boundaries[k]=[boundaries[k],b.size-boundaries[k],a.size-boundaries[k]];}
    return {matrix,boundaries,bad};
}
const evRef=e=>({r:e.revision,start:e.start,end:e.end,sourceKey:e.sourceKey,sha:e.narrativeSha256??e.sha256,frameId:e.frameId??null,quote:e.quote});
function runStory(s){
    const ctx=contexts("scope-eval-"+s.id,s.rows.map(r=>r.text)).at(-1);
    const runs={h3a:replayHighlights3A(ctx),h3b:replayHighlights3B(ctx,suggestNarrativeCandidates),h3b2:replayHighlights3B2(ctx),h3b2s:replayHighlights3B2S(ctx)};
    const result={id:s.id,arms:{},rows:[],byRevision:[]};
    for(const [arm,out] of Object.entries(runs)){
        const metrics={fact:[0,0,0],review:[0,0,0],role:[0,0],state:[0,0],realFP:0,scopeLeak:0,unauthorized:0,sends:0,top1:0,top3:0,rankGold:0,pairs:0,ordered:0};result.arms[arm]=metrics;
        const byID=new Map(out.candidates.map(c=>[c.id,c])),bad=[];
        for(const [i,r] of out.rounds.entries()){
            const gs=s.rows[i],targets=gs.spans.filter(c=>["F","-F"].includes(c.op)),expected=targets.filter(g=>g.cause),matched=new Set(),offered=new Set();
            const facts=r.candidateIds.map(id=>byID.get(id));
            const props=(r.grounding??[]).map(f=>f.claim??f.statement).filter(Boolean);
            const suggestions=[...props,...(r.proposals?.suggestions??[])];
            for(const q of suggestions){
                const anchor=q.spans.at(-1),g=targets.find(t=>t.start<=anchor.start&&anchor.end<=t.end);
                if(g)offered.add(g);else metrics.review[1]++;
            }
            for(const g of targets){
                const qs=props.filter(q=>q.spans.at(-1).start>=g.start&&q.spans.at(-1).end<=g.end);
                metrics.role[1]++;metrics.state[1]++;
                metrics.role[0]+=Number(qs.some(q=>Object.entries(s.roles).every(([k,v])=>q[k]===v)));
                metrics.state[0]+=Number(qs.some(q=>q.kind==="delivery"&&q.before==="promised"&&q.after==="delivered"));
            }
            for(const c of facts){
                const anchor=c.evidence.at(-1);
                const g=targets.find(t=>t.start<=anchor.start&&anchor.end<=t.end);
                if(g)offered.add(g);
                const ok=g?.cause && !matched.has(g) && Object.entries(s.roles).every(([k,v])=>c.roles[k]===v) &&
                    c.evidence.some(e=>e.revision===g.cause[0]&&e.start===g.cause[1]&&e.end===g.cause[2]);
                if(ok){metrics.fact[0]++;matched.add(g);}else{
                    metrics.fact[1]++;if(g?.path!=="R")metrics.realFP++;else metrics.scopeLeak++;
                    bad.push({type:"false-confirmation",r:i+1,expected:g??null,source:gs.text,evidence:c.evidence.map(evRef),id:c.id});
                }
            }
            metrics.fact[2]+=expected.length-matched.size;metrics.review[0]+=offered.size;metrics.review[2]+=targets.length-offered.size;
            for(const g of expected)if(!matched.has(g))bad.push({type:"miss",r:i+1,expected:g,source:gs.text});
            const record=result.byRevision[i]??={r:i+1,arms:{}};
            record.arms[arm]={facts:facts.map(c=>({id:c.id,evidence:c.evidence.map(evRef)})),reviewed:[...offered].map(g=>g.start),
                rank:r.ranking.map(id=>byID.get(id).revision),scope:arm==="h3b2"?r.scope.world:null};
            metrics.unauthorized+=Number(r.cadence.action==="director-review");metrics.sends+=Number(r.cadence.send!==false);
            if(arm==="h3b2s")result.rows.push({r:i+1,source:gs.text,spans:r.scope.spans.map(z=>({start:z.start,end:z.end,path:label(z),frameId:z.frameId,reason:z.reason})),
                transitions:r.scope.changes,grounding:r.grounding.map(f=>({reason:f.reason,world:f.world,effective:f.effective,observed:f.observedInFrame,
                    frameId:f.frameId,roles:[f.claim.actor,f.claim.other,f.claim.item],spans:f.claim.spans.map(evRef),support:f.support?.map(evRef)})),
                changes:r.semanticChanges,ids:r.candidateIds,ranking:r.ranking});
        }
        const rank=out.rounds.at(-1).ranking.map(id=>byID.get(id).revision),g=s.rows.at(-1).rank;
        if(g.length){metrics.rankGold=1;metrics.top1=Number(rank[0]===g[0]);metrics.top3=Number(rank.slice(0,3).includes(g[0]));}
        for(const [j,a] of g.entries())for(const b of g.slice(j+1)){metrics.pairs++;metrics.ordered+=Number(rank.includes(a)&&rank.includes(b)&&rank.indexOf(a)<rank.indexOf(b));}
        metrics.failures=bad;metrics.rank=rank;
    }
    result.scope=scoreParts(s.rows.map(r=>r.spans),result.rows.map(r=>r.spans));
    return result;
}
if(process.argv[1]?.endsWith("/measure.mjs")||process.argv[1]?.endsWith("\\measure.mjs")){
    const part=process.argv[2]?.replace("--split=","");
    if(["dev","held"].includes(part))console.log(JSON.stringify(corpus(part).map(runStory)));
}
