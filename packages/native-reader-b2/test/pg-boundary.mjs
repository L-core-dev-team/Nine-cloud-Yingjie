import assert from "node:assert/strict";
import {digest} from "../../native-facts/admission.mjs";

export async function measureDamagedReads({http,barriers,token,ref,record}) {
    const {r} = ref;
    const faults = [
        ["old receipt plus latest only",s=>{s.history=new Map([[r,s.history.get(r)]]); s.rows.length=0;}],
        ["no R0",s=>s.history.delete(0)],["no R-1",s=>s.history.delete(r-1)],["no R",s=>s.history.delete(r)],
        ["matching location only",s=>{s.history.get(r).save={state:{locationId:s.history.get(r).save.state.locationId}};}],
        ["unsupported rule",s=>{s.history.get(0).save.ruleVersion="unsupported";}],
        ["receipt/event mismatch",s=>{const req=s.requests.find(v=>v.idempotency_key===ref.key);
            req.result.decision.events[0].payload.from="conflicting-location";s.history.get(r).receiptDigest=digest(req.result);}],
        ["event missing interior",s=>s.rows.splice(1,1)],
        ["tail truncated with internally valid chain",s=>{s.rows.pop(); assert.ok(s.rows.every((row,i)=>
            row.sequence===i && row.event_hash===row.recomputed && row.previous_hash===(i?s.rows[i-1].event_hash:"0".repeat(64))));}],
        ["event reorder",s=>s.rows.reverse()],["duplicate event",s=>s.rows.push(s.rows.at(-1))],
        ["wrong anchor",s=>{s.history.get(r).end="0".repeat(64);}],
        ["wrong chain",s=>{s.rows[1].previous_hash="0".repeat(64);}],
        ["full-state mismatch after valid first event",s=>{s.history.get(r).save.state.elapsedMinutes++;}],
        ["tampered late batch member",s=>{const i=s.rows.findIndex((row,j)=>j>0 && row.after_revision===s.rows[j-1].after_revision);
            assert.ok(i>0);s.rows[i].payload={};}],
        ["replay mismatch",s=>{s.history.get(0).save.state.facts.creationRequestHash="a".repeat(64);}]
    ];
    for (const [name,mutate] of faults) {
        let injected = false;
        barriers.checkCopy = (s,settings) => {
            assert.deepEqual(settings,{isolation:"repeatable read",readonly:"on"});
            mutate(s);
            injected = true;
        };
        let value;
        try { value=await http.read(token,ref); } finally { delete barriers.checkCopy; }
        assert.ok(injected,name);
        assert.deepEqual(value,{sceneEligible:false,send:false,added:0,status:"UNVERIFIED"},name);
        assert.equal((await http.knownAt(token,ref,r)).status,"NO_KNOWN_FACT");
        record(name,{layer:"authorized-pg-read/isolated-verifier-copy",readerStatus:value.status,added:value.added,
            noLedgerEntry:true});
    }
}
