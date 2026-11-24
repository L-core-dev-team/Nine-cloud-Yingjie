// Pure boundary checks on an existing public native-facts path. No authentication,
 // database or SQL hash is emulated or credited as a B2 service test.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {loadRules,simulate} from "../../native-facts/test/host.mjs";
import {digest} from "../../native-facts/admission.mjs";
import {genesis,verifyPrefix} from "../history.mjs";

const rules = await loadRules(process.argv[2]);
const core = {contracts:rules,domain:rules,runtime:{rules},approval:{ruleVersion:"prologue-v1-candidate-20261005",
    canonVersion:"prologue-canon-candidate-20261005",memoryPolicyVersion:"p1-memory-policy-v1"}};
const path = new URL("../../native-facts/test/frozen/held-input-1.jsonl",import.meta.url);
const story = JSON.parse((await readFile(path,"utf8")).trim().split("\n")[0]);
const {records} = await simulate(rules,story);
function specimen(r) {
    const rows = [], requests = [], checkpoints = new Map();
    let end = genesis;
    checkpoints.set(0,{save:records[0].before.value,count:0,end});
    for (const record of records.slice(0,r)) {
        requests.push({save_id:record.save,idempotency_key:record.key,expected_revision:record.before.revision,result:record.receipt});
        for (const {event} of record.batch) {
            const anchor = digest(["verifier-test-only",event.id]); // Opaque fixture value, never a SQL digest.
            rows.push({id:event.id,save_id:event.saveId,branch_id:event.branchId,idempotency_key:record.key,
                sequence:rows.length,previous_hash:end,event_hash:anchor,recomputed:anchor,exact_millis:true,event_type:event.type,
                source:event.source,rule_version:event.ruleVersion,before_revision:event.beforeRevision,
                after_revision:event.afterRevision,occurred_at:new Date(event.occurredAt),payload:event.payload});
            end = anchor;
        }
        checkpoints.set(record.after.revision,{save:record.after.value,key:record.key,count:rows.length,
            end,receiptDigest:digest(record.receipt)});
    }
    return structuredClone({locator:{saveId:story.save,key:records[r-1].key,r},checkpoints,rows,requests});
}
const review = s => verifyPrefix(core,s.locator,s.checkpoints,s.rows,s.requests);
const checks = [];
for (const [r,expected] of [[1,"world-location-change"],[2,"sublocation-change"],[5,"OUT_OF_SCOPE_SUPPORTED_EVENT"],[7,"world-location-change"]]) {
    assert.equal(review(specimen(r)).classification,expected);
    checks.push({turn:r,expected,passed:true});
}
for (const [fault,change] of [
    ["latest as R0",s=>s.checkpoints.set(0,s.checkpoints.get(5))],
    ["missing previous",s=>s.checkpoints.delete(4)],["missing after",s=>s.checkpoints.delete(5)],
    ["removed tail",s=>s.rows.pop()],["missing interior",s=>s.rows.splice(2,1)],
    ["swapped events",s=>s.rows.reverse()],["duplicate",s=>s.rows.push(s.rows.at(-1))],
    ["bad chain",s=>s.rows[0].recomputed=genesis],["bad endpoint",s=>s.checkpoints.get(5).end=genesis],
    ["receipt mismatch",s=>s.requests[0].result.clockMinute++],["wrong expected revision",s=>s.requests[0].expected_revision++],
    ["wrong key",s=>s.locator.key=s.requests[0].idempotency_key],["wrong branch",s=>s.rows[0].branch_id="elsewhere"],
    ["late state conflict",s=>s.checkpoints.get(5).save.state.elapsedMinutes++],
    ["wrong scope",s=>s.rows.at(-1).save_id="other"],["wrong rule version",s=>s.rows.at(-1).rule_version="other"],
    ["DB timestamp not losslessly representable",s=>s.rows.at(-1).exact_millis=false]
]) {
    const s = specimen(5);
    change(s);
    assert.throws(()=>review(s));
    checks.push({fault,passed:true});
}
console.log(JSON.stringify({suite:"pure-verifier-only",checks,sessions:0,postgres:false}));
