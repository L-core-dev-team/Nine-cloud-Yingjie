import assert from "node:assert/strict";
import {session} from "../../first-play/test/s2-host.mjs";
import {contexts,lines} from "../h3b/evaluate.mjs";
import {sourceRow} from "../h3b/protocol.mjs";
import {envelope} from "../h3b2/propositions.mjs";
import {stories} from "../h3b2/measure.mjs";
import {replayHighlights3B2} from "../h3b2/replay.mjs";
import {replayHighlights3B2S as replay} from "./replay.mjs";
const checks=[];
function check(id,fn){try{const detail=fn();checks.push({id,pass:true,detail});}catch(e){checks.push({id,pass:false,error:e.message.slice(0,500)});}}
for(const c of lines("packages/highlights/test/h3b2s/hostile.jsonl")){
    check(c.family+"/"+c.mutation,()=>{
        const host=session("untrusted-"+c.family),m=c.mutation;
        for(const t of c.history)host.append(t,m==="action-only"?"叙述回到现实。":"继续观察");
        const ctx={...host.context(),replayOnly:true},n=ctx.revision;
        const q=envelope({kind:"delivery",actor:c.actor,other:c.other,item:c.item,before:"promised",after:"delivered",
            source:"narrator",time:"current",polarity:"positive",qualifier:"unconditional"},[sourceRow(ctx,n-2),sourceRow(ctx,n-1)]);
        let batch=[q];
        switch(m){
            case "forged-world": q.world="current-reality";break;
            case "forged-close": q.closeFrame=true;break;
            case "foreign-session": q.spans[0].session="other";break;
            case "future": q.spans[0].revision=n+1;break;
            case "roles-swapped": [q.actor,q.other]=[q.other,q.actor];break;
            case "wrong-source": q.spans[0].sourceKey="other";break;
            case "missing-spans": q.spans=[];break;
            case "mixed-batch":batch=[q,{...q,approved:true}];break;
            case "action-only":case "claim-narrator":break;
            default:throw Error("unhandled mutation");
        }
        const tape=Array(n).fill("[]");tape[n-1]=JSON.stringify(batch);
        const out=replay(ctx,JSON.stringify(tape)),r=out.rounds.at(-1);
        assert.equal(out.events.length,c.expectedRealFacts);assert.ok(out.rounds.every(r=>r.cadence.action!=="director-review"&&!r.cadence.send));
        return {error:r.batchError,verdict:r.grounding.map(g=>g.reason),frame:r.scope.spans.at(-1).world};
    });
}
const run=texts=>replay(contexts("scope-control",texts).at(-1));
const p="杜苓答应把山图交给东馆。",f="杜苓把山图交给东馆。东馆当场签收了山图。",x="东馆更正了山图签收记录，原记载作废。",d="她睡着了，此后的场景全是梦。",w="她醒了，叙述回到现实。";
check("history, withdrawal and independent re-signing",()=>{
    const a=run([p,f,d,p,f,x,w,p,f,x]),ids=a.events.map(e=>e.id);
    assert.equal(new Set(ids).size,2);assert.deepEqual(a.rounds[5].ranking,[ids[0]]);assert.deepEqual(a.rounds[8].ranking,ids);
    assert.deepEqual(a.rounds[9].ranking,[]);assert.deepEqual(a.events.map(e=>e.revision),[2,9]);
});
check("unclosed quotation cannot wake parent",()=>assert.equal(run([d,"「她醒了。",w,"」",p,f]).events.length,0));
check("no inherited dream premise after awakening",()=>assert.equal(run([d,p,w,f]).events.length,0));
check("no pre-dream premise reused after awakening",()=>assert.equal(run([p,d,w,f]).events.length,0));
check("two worlds in one saved revision",()=>assert.deepEqual(run([d,p,f+w+p+f]).events.map(e=>e.evidence[0].start),[(f+w).length]));
check("same-turn real rebuttal vetoes earlier result",()=>assert.equal(run([p,f+x]).events.length,0));
check("host rejects unauthorized input",()=>assert.throws(()=>replay({...contexts("auth",[p,f]).at(-1),authorized:false})));
check("unknown can close",()=>assert.equal(run(["以下数段来历不明。",p,f,"叙述回到现实。",p,f]).events.length,1));
const reserve=[],totals={old:[0,0,0],scoped:[0,0,0]};let wusan;
for(const s of stories("reserve")){
    const ctx=contexts("ground-"+s.id,s.rows.map(r=>r.text)).at(-1),arms={old:replayHighlights3B2(ctx),scoped:replay(ctx)};
    const item={id:s.id,arms:{}};reserve.push(item);
    for(const [arm,result] of Object.entries(arms)){
        const facts=result.events.filter(e=>e.roles),nums=[0,0,0];
        for(const [i,r] of s.rows.entries()){
            const events=facts.filter(e=>e.revision===i+1);
            const correct=r.event&&events.some(e=>e.frame===r.claim.kind&&["actor","other","item"].every(k=>e.roles[k]===r.claim[k]));
            nums[0]+=Number(!!correct);nums[1]+=events.length-Number(!!correct);nums[2]+=Number(!!r.event&&!correct);
        }
        item.arms[arm]=nums;nums.forEach((n,i)=>totals[arm][i]+=n);
    }
    if(s.id==="雾散后"){
        wusan=s.rows.map((r,i)=>{const a=arms.scoped.rounds[i];return {text:r.text,revision:i+1,old:arms.old.rounds[i].candidateIds,
            current:a.candidateIds,ranking:a.ranking,spans:a.scope.spans,changes:a.scope.changes,admissions:a.semanticChanges,
            ground:a.grounding.map(g=>({verdict:g.reason,effective:g.effective,support:g.support}))};});
        check("public Wusan revision 3 and 7",()=>{assert.equal(wusan[2].current.length,0);assert.equal(wusan[6].current.length,1);
            assert.deepEqual(wusan[6].ground[0].support.map(e=>e.revision),[5,7,7]);});
    }
}
console.log(JSON.stringify({checks,reserve,totals,wusan}));if(checks.some(c=>!c.pass))process.exitCode=1;
