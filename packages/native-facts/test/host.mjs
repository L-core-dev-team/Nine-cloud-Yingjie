import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {mock} from "node:test";
import {digest,PIN} from "../admission.mjs";
import {openSyntheticReader} from "../reader.mjs";
export async function loadRules(directory){
    if(process.permission?.has("net")!==false)throw Error("require-node-no-network-permission");
    const root=resolve(directory),pin=JSON.parse(readFileSync(resolve(root,"pin.json"),"utf8")).commit;
    if(pin!==PIN)throw Error("wrong-rule-bundle");
    const get=p=>import(pathToFileURL(resolve(root,p)).href);
    const contracts=await get("packages/contracts/dist/index.js"),domain=await get("packages/domain/dist/index.js");
    const {default:plugin}=await get("apps/api/dist/services/p1-prologue-plugin.js");
    const {createP1SaveMemoryPolicy}=await get("apps/api/dist/services/p1-memory-policy.js");
    mock.timers.enable({apis:["Date"],now:Date.UTC(2026,0,1)});
    return {...contracts,...domain,pin,reduce:plugin.rules.reduce,decide:plugin.rules.decide,initialState:plugin.initialState,createP1SaveMemoryPolicy};
}
function snapshot(owner,save){
    return {kind:"revision-snapshot",owner,save:save.saveId,branch:save.branchId,revision:save.revision,
        availableAt:save.revision,sha:digest(save),value:structuredClone(save)};
}
export function initial(core,story){
    const memoryPolicy=core.createP1SaveMemoryPolicy("continue");
    const state=core.initialState({ownerId:story.owner,saveId:story.save});
    state.facts.creationRequestHash=digest(["synthetic-creation",story.save]);
    return core.SaveEnvelopeSchema.parse({schemaVersion:3,saveId:story.save,revision:0,state,ruleVersion:"prologue-v1-candidate-20261005",
        canonVersion:"prologue-canon-candidate-20261005",canonArtifactHash:"sha256:"+digest("synthetic-canon-reference"),
        branchId:"root",parentBranchId:null,sourceMigrationId:null,forkRevision:0,createdPolicyVersion:memoryPolicy.policyVersion,
        memoryMode:"continue",memoryPolicyVersion:memoryPolicy.policyVersion,memoryPolicy});
}
function uuid(seed){
    const h=digest(seed);return h.slice(0,8)+"-"+h.slice(8,12)+"-4"+h.slice(13,16)+"-8"+h.slice(17,20)+"-"+h.slice(20,32);
}
export async function simulate(core,story){
    let save=initial(core,story);
    const records=[],refs=[];
    for(const [i,t] of story.turns.entries()){
        const key=uuid([story.id,i]);
        const intent={saveId:story.save,branchId:"root",actorId:save.state.playerId,expectedRevision:save.revision,idempotencyKey:key,...t.intent};
        const prepared=await core.prepareTurn({intent,save,decide:core.decide,reduce:core.reduce});
        if(!["prepared","recorded"].includes(prepared.status))throw Error("unexpected synthetic host result: "+prepared.status);
        const receipt=prepared.receipt,after=prepared.save??save,r=receipt.resultingRevision;
        const events=receipt.decision.events??[];
        records.push({owner:story.owner,save:story.save,key,visible:true,availableAt:r,receipt,receiptSha:digest(receipt),
            fingerprint:"sha256:v1:"+digest(Object.fromEntries(Object.entries(intent).filter(([k])=>k!=="branchId"))),
            before:snapshot(story.owner,save),after:snapshot(story.owner,after),
            batch:events.map((event,ordinal)=>({owner:story.owner,save:story.save,key,ordinal,event:structuredClone(event)}))});
        refs.push({save:story.save,key,branch:"root",r}); save=after;
    }
    return {story,records,refs,through:save.revision,core};
}
// Test-only fault injection on storage reads. Some corruptions are coherent in
// both indexes so receipt parsing and hash equality alone cannot reject them.
function disturb(record,fault,repo){
    const r=record,events=r.receipt.decision.events,first=events?.[0];
    const rewriteEvents=fn=>{
        fn();r.receiptSha=digest(r.receipt);
        r.batch=events.map((event,ordinal)=>({owner:r.owner,save:r.save,key:r.key,ordinal,event:structuredClone(event)}));
    };
    switch(fault){
        case "no-before":delete r.before;break;
        case "no-after":delete r.after;break;
        case "no-batch":delete r.batch;break;
        case "latest-after":case "latest-before":
            r[fault.endsWith("after")?"after":"before"]={...structuredClone(repo.records.at(-1).after),kind:"latest"};break;
        case "drop-tail":r.batch.pop();break;
        case "duplicate-event":rewriteEvents(()=>events.push(structuredClone(first)));break;
        case "foreign-owner":r.owner="other-owner";break;
        case "foreign-save":r.save="other-save";break;
        case "foreign-branch":r.before.branch="fork";break;
        case "future":r.availableAt++;break;
        case "wrong-rule":r.receipt.rulesVersion="unapproved";break;
        case "receipt-key":r.receipt.idempotencyKey=uuid("different");r.receiptSha=digest(r.receipt);break;
        case "migration":rewriteEvents(()=>{first.source="MIGRATION";});break;
        case "delta-before":rewriteEvents(()=>{first.payload.stateDelta.locationChange.before="other";});break;
        case "protected-key":case "duplicate-change":case "state-missing-null":rewriteEvents(()=>{
            const changes=first.payload.stateDelta.factChanges;
            if(fault==="protected-key")changes.push({key:"archiveKind",before:{present:false},after:{present:true,value:"x"}});
            else if(fault==="duplicate-change")changes.push(structuredClone(changes[0]));
            else changes.push({key:"synthetic-absent",before:{present:true,value:null},after:{present:false}});
        });break;
        case "payload-to":rewriteEvents(()=>{first.payload.to="invented";});break;
        case "history-sha":r.before.sha="0".repeat(64);break;
        case "after-drift":r.after.value.state.elapsedMinutes++;r.after.sha=digest(r.after.value);break;
        case "revoked":r.visible=false;break;
        case "subject-fingerprint":r.fingerprint="sha256:v1:"+"0".repeat(64);break;
        case "out-of-order":if(r.batch.length>1)r.batch.reverse();else r.batch[0].ordinal=1;break;
        case "legacy-receipt":delete r.receipt.branchId;break;
        case "wrong-event-id":r.batch[0].event.id=uuid("foreign-event");break;
        case "stale-revision":r.before.value.revision++;r.before.sha=digest(r.before.value);break;
        case "conflicting-request":r.key=uuid("conflict");break;
        case "asof-hidden":r.after.availableAt++;break;
        case "tamper-sibling":rewriteEvents(()=>{
            if(events.length===1){const sibling=structuredClone(first);sibling.id=uuid("tail");events.push(sibling);}
            events.at(-1).payload.stateDelta.factChanges.push({key:"creationRequestHash",before:{present:false},after:{present:false}});
        });break;
        default:throw Error("unexpected-fault");
    }
}
export function makeReader(repo,{fault,at,through=repo.through,prose,mutate}={}){
    if(fault==="wire-verified"||fault==="prose-claim")return {verified:true,source:"RULES",text:prose??"你到了新地点。"};
    const rows=new Map(repo.records.map((r,i)=>[r.key,{r,i}]));
    return openSyntheticReader({read(owner,save,key,revision){
        const hit=rows.get(key);
        if(owner!==repo.story.owner||save!==repo.story.save||!hit||hit.r.receipt.resultingRevision!==revision)return null;
        const data=structuredClone(hit.r);
        if(prose)data.storyText=prose[hit.i];
        if(hit.i+1===at&&fault)disturb(data,fault,repo);
        if(mutate)mutate(data);
        return data;
    }},repo.core,repo.story.owner,repo.story.save,through);
}
