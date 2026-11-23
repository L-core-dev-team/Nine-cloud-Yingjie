import {createHash} from "node:crypto";
import {isDeepStrictEqual as equal} from "node:util";
import {readHistorical} from "./reader.mjs";
export const SOURCE="SYNTHETIC_AUTHORITY_FIXTURE";
export const PIN="f1fe6ea561c5ef4d1ec670b7a406625ce5df774c";
const RULE="prologue-v1-candidate-20261005", CANON="prologue-canon-candidate-20261005";
function canonical(x){
    if(Array.isArray(x))return x.map(canonical);
    if(x&&typeof x==="object")return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));
    return x;
}
export const digest=value=>createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
function need(ok,reason){if(!ok)throw Error(reason);}
function snapshot(s,owner,ref,n,core){
    need(s?.kind==="revision-snapshot" && s.owner===owner && s.save===ref.save && s.revision===n &&
        s.availableAt===n && s.branch==="root","historical-snapshot-unavailable");
    const value=core.SaveEnvelopeSchema.parse(s.value);
    need(value.schemaVersion===3 && value.branchId==="root" && value.parentBranchId===null &&
        value.revision===n && value.saveId===ref.save && value.ruleVersion===RULE && value.canonVersion===CANON &&
        digest(value)===s.sha && value.state.facts.archiveKind!=="local-untrusted-v1","snapshot-binding");
    return value;
}
function review(token,ref){
    const {record,owner,core}=readHistorical(token,ref);
    const raw=record.receipt;
    need(raw?.branchId==="root"&&raw.rulesVersion===RULE&&core.pin===PIN,"unapproved-version-or-branch");
    const receipt=core.TurnReceiptSchema.parse(raw);
    const receiptSha=digest(raw);
    need(receiptSha===record.receiptSha && receipt.saveId===ref.save && receipt.idempotencyKey===ref.key &&
        receipt.requestFingerprint===record.fingerprint && receipt.resultingRevision===ref.r,"receipt-binding");
    const decision=receipt.decision;
    if(decision.status!=="accepted"){
        const before=snapshot(record.before,owner,ref,ref.r,core),after=snapshot(record.after,owner,ref,ref.r,core);
        need(Array.isArray(record.batch)&&record.batch.length===0&&equal(before,after),"unverified-noncommit");
        return {status:"NOT_A_WORLD_LOCATION_CHANGE",reason:"decision-"+decision.status,receiptSha,facts:[]};
    }
    need(ref.r>0&&decision.nextRevision===ref.r,"revision-step");
    const before=snapshot(record.before,owner,ref,ref.r-1,core),after=snapshot(record.after,owner,ref,ref.r,core);
    const batch=record.batch;
    need(Array.isArray(batch)&&batch.length===decision.events.length&&batch.length>0,"incomplete-event-batch");
    need(batch.every((entry,i)=>entry.ordinal===i && entry.owner===owner && entry.save===ref.save && entry.key===ref.key &&
        entry.event?.branchId==="root"&&equal(entry.event,raw.decision.events[i])),"batch-identity-or-order");
    need(before.state.playerId===after.state.playerId,"different-player");
    let state=before.state,reason="other-authorized-event";const facts=[];
    for(const event of decision.events){
        need(event.source==="RULES"&&event.ruleVersion===RULE&&event.saveId===ref.save&&event.branchId==="root"&&
            event.beforeRevision===ref.r-1&&event.afterRevision===ref.r,"event-binding");
        const delta=core.StateDeltaSchema.parse(event.payload.stateDelta);
        const next=core.reduce(state,event);
        const a=state.locationId,b=next.locationId,p=event.payload;
        if(event.type==="move.arrived"){
            need(decision.outcome==="success"&&p.from===a&&p.to===b,"arrival-endpoint-mismatch");
            if(delta.locationChange===null){
                need(a===b && state.facts.currentSublocationId!==next.facts.currentSublocationId &&
                    p.fromSublocationId===state.facts.currentSublocationId && p.toSublocationId===next.facts.currentSublocationId,
                    "unverified-sublocation");
                reason="sublocation-change";
            }else{
                need(a!==b&&delta.locationChange.before===a&&delta.locationChange.after===b,"invalid-world-delta");
                const id=digest([owner,ref.save,"root",ref.key,event.id,ref.r,RULE]);
                facts.push({id,type:"world-location-change",before:a,after:b,revision:ref.r,eventId:event.id,ruleVersion:RULE,
                    receiptSha,deltaSha:digest(delta),fromSnapshot:record.before.sha,toSnapshot:record.after.sha});
            }
        }else if(event.type==="move.blocked"){
            need(a===b&&delta.locationChange===null&&decision.outcome==="legal_failure","blocked-move-conflict");
            reason="blocked";
        }else if(event.type==="move.bypassed"){
            need(p.from===a&&p.to===b&&a!==b&&decision.outcome==="success","bypass-conflict");
            reason="OUT_OF_SCOPE_SUPPORTED_EVENT";
        }
        state=next;
    }
    need(equal({...before,revision:ref.r,state},after)&&receipt.clockMinute===state.facts.gameMinute,"after-state-mismatch");
    if(facts.length){
        need(facts.length===1&&facts[0].before===before.state.locationId&&facts[0].after===after.state.locationId,"ambiguous-batch-movement");
        return {status:"CONFIRMED_NATIVE_LOCATION",reason:"world-location-change",receiptSha,facts};
    }
    return {status:"NOT_A_WORLD_LOCATION_CHANGE",reason,receiptSha,facts};
}
export function createNativeFactReplay(reader){
    const committed=new Map(),byEvent=new Map();
    function inspect(ref){
        const base={source:SOURCE,replayOnly:true,sceneEligible:false,send:false,added:0};
        try{
            const result=review(reader,ref);
            const prior=committed.get(ref.key);
            if(prior)need(prior.receiptSha===result.receiptSha&&equal(prior.facts,result.facts),"conflicting-replay");
            for(const fact of result.facts)need(!byEvent.has(fact.eventId)||byEvent.get(fact.eventId)===fact.id,"event-id-reused");
            // No external writes and no await between validation and publication.
            if(!prior){
                committed.set(ref.key,structuredClone(result));
                for(const f of result.facts)byEvent.set(f.eventId,f.id);
            }
            return {...base,...result,added:prior?0:result.facts.length};
        }catch(error){
            const reason=error instanceof Error&&/^[a-z][a-z0-9-]{1,70}$/.test(error.message)?error.message:"invalid-receipt-state-or-delta";
            return {...base,status:"UNVERIFIED",reason,facts:[]};
        }
    }
    return Object.freeze({inspect});
}
