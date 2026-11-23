import {readFileSync,readdirSync} from "node:fs";
import {isDeepStrictEqual as equal} from "node:util";
import {digest,createNativeFactReplay} from "../admission.mjs";
import {loadRules,simulate,makeReader} from "./host.mjs";
import {createHash} from "node:crypto";
const dir="packages/native-facts/test/frozen/", evidence="docs/reports/evidence/YJ-P04-NATIVE-FACT-01/";
export function readCorpus(part,kind){
    return readdirSync(dir).filter(f=>f.startsWith(part+"-"+kind+"-")).sort()
        .flatMap(f=>readFileSync(dir+f,"utf8").trim().split("\n").map(JSON.parse));
}
export function verifyFreeze(){
    const manifest=JSON.parse(readFileSync(evidence+"freeze.json"));
    for(const [file,h] of Object.entries(manifest.files))
        if(createHash("sha256").update(readFileSync(dir+file)).digest("hex")!==h)throw Error("changed frozen file "+file);
}
const classes={WORLD:"world-location-change",SUB:"sublocation-change",BLOCKED:"blocked",BYPASS:"OUT_OF_SCOPE_SUPPORTED_EVENT",OTHER:"other-authorized-event"};
const scores=()=>({TP:0,FP:0,FN:0,TN:0,duplicates:0,scene:0,send:0});
export async function measure(part,core){
    verifyFreeze();
    const inputs=readCorpus(part,"input"),gold=new Map(readCorpus(part,"gold").map(x=>[x.id,x]));
    const arms=["trusted-native","plain-prose","untrusted-wire","scope-layer-mixed"],totals=Object.fromEntries(arms.map(n=>[n,scores()]));
    const cases=[],failures=[],faultReasons={};let attackCount=0;
    for(const s of inputs){
        const g=gold.get(s.id),repo=await simulate(core,s),native=createNativeFactReplay(makeReader(repo));
        const mixed=createNativeFactReplay(makeReader(repo,{prose:s.turns.map(t=>t.mixed)}));
        const trace={id:s.id,rows:[],attacks:[]};cases.push(trace);
        for(const [i,ref] of repo.refs.entries()){
            const row=repo.records[i],want=g.turns[i],t=s.turns[i];
            const wire=JSON.parse(JSON.stringify({...row,verified:true,authority:"RULES"}));
            const a=native.inspect(ref),outputs=[a,createNativeFactReplay(t.plain).inspect(ref),createNativeFactReplay(wire).inspect(ref),mixed.inspect(ref)];
            const again=native.inspect(ref);
            const errors=[];
            if(again.added||!equal(a.facts,again.facts))errors.push("duplicate publication");
            if(!equal(a,outputs[3]))errors.push("prose influenced native result");
            if(ref.r!==want.r || row.before.value.state.locationId!==want.before || row.after.value.state.locationId!==want.after ||
                row.before.value.state.facts.currentSublocationId!==want.subBefore || row.after.value.state.facts.currentSublocationId!==want.subAfter)
                errors.push("rule output disagrees with frozen world or sublocation");
            const observed={};
            for(const [j,v] of outputs.entries()){
                const name=arms[j],m=totals[name],authorized=j===0||j===3,positive=authorized&&want.facts===1;
                const correct=positive&&v.facts.length===1&&v.facts[0].before===want.before&&v.facts[0].after===want.after&&v.facts[0].revision===want.r;
                m.TP+=Number(correct);m.FP+=v.facts.length-Number(correct);m.FN+=Number(positive&&!correct);m.TN+=Number(!positive&&!v.facts.length);
                m.scene+=Number(v.sceneEligible!==false);m.send+=Number(v.send!==false);
                if(j===0)m.duplicates+=again.added;
                if((positive&&!correct)||v.facts.length!==Number(positive)||v.sceneEligible||v.send||
                    (authorized?v.reason!==classes[want.eventClass]:v.status!=="UNVERIFIED"))errors.push(name);
                observed[name]=[v.status,v.reason,v.added];
            }
            if(errors.length)failures.push({id:s.id,r:i+1,errors,expected:want,observed});
            trace.rows.push({r:ref.r,key:ref.key,world:[row.before.value.state.locationId,row.after.value.state.locationId],
                sub:[row.before.value.state.facts.currentSublocationId,row.after.value.state.facts.currentSublocationId],
                receiptSha:row.receiptSha,versions:[row.receipt.rulesVersion,row.receipt.branchId],outcome:row.receipt.decision.outcome,
                events:row.batch.map(b=>({id:b.event.id,type:b.event.type,delta:b.event.payload.stateDelta.locationChange})),
                observed,facts:a.facts,duplicateAdded:again.added});
        }
        for(const [i,attack] of s.attacks.entries()){
            const ref=repo.refs[attack.at-1],v=createNativeFactReplay(makeReader(repo,attack)).inspect(ref),expected=g.attacks[i];
            const ok=expected.status===v.status&&v.facts.length===expected.facts&&!v.sceneEligible&&!v.send;
            trace.attacks.push({...attack,status:v.status,reason:v.reason,added:v.added,pass:ok});attackCount++;
            faultReasons[v.reason]=(faultReasons[v.reason]??0)+1;
            if(!ok)failures.push({id:s.id,attack,actual:v});
        }
    }
    for(const m of Object.values(totals)){
        m.precision=m.TP+m.FP?m.TP/(m.TP+m.FP):null;m.recall=m.TP+m.FN?m.TP/(m.TP+m.FN):null;
    }
    return {part,totals,attackCount,faultReasons,failures,cases,inputDigest:digest(inputs)};
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/native-facts/test/measure.mjs")){
    const [split,dir]=process.argv.slice(2);
    if(!["dev","held"].includes(split))throw Error("expected dev or held");
    const result=await measure(split,await loadRules(dir));
    console.log(JSON.stringify(result));if(result.failures.length||!result.totals["trusted-native"].TP)process.exitCode=1;
}
