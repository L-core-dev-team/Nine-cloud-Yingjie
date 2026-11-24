// Private host-side verification. The caller must supply committed checkpoints and
// independent DB rows inside a single authorized transaction. No transport authority here.
import {isDeepStrictEqual as same} from "node:util";
import {digest} from "../native-facts/admission.mjs";

export const genesis = "0".repeat(64);
export function requireProof(condition) {
    if (!condition) throw Error("incomplete-history");
}
export function verifyPrefix(core, {saveId, key, r}, checkpoints, rows, requests) {
    const {contracts, runtime} = core;
    const initial = checkpoints.get(0);
    requireProof(initial?.save?.saveId === saveId && initial.save.revision === 0 &&
        initial.count === 0 && initial.end === genesis && initial.save.branchId === "root" &&
        initial.save.schemaVersion === 3 && initial.save.parentBranchId === null && initial.save.sourceMigrationId === null &&
        initial.save.forkRevision === 0 && initial.save.state.facts.archiveKind !== "local-untrusted-v1" &&
        initial.save.ruleVersion === core.approval.ruleVersion && initial.save.canonVersion === core.approval.canonVersion &&
        initial.save.memoryPolicyVersion === core.approval.memoryPolicyVersion);
    let state = contracts.SaveEnvelopeSchema.parse(initial.save);
    let offset = 0, end = genesis;
    const ids = new Set();
    const receipts = new Map(requests.map(item => [item.idempotency_key,item]));
    requireProof(receipts.size === requests.length && requests.length === r);
    let classification = "other-rule-event", location, targetMoves = 0;
    for (let rev = 1; rev <= r; rev++) {
        const checkpoint = checkpoints.get(rev), previous = checkpoints.get(rev - 1);
        const stored = receipts.get(checkpoint?.key);
        requireProof(previous && checkpoint && stored && stored.expected_revision === rev - 1 &&
            stored.save_id === saveId && stored.result?.branchId === "root" &&
            digest(stored.result) === checkpoint.receiptDigest);
        const receipt = contracts.TurnReceiptSchema.parse(stored.result);
        const decision = receipt.decision;
        requireProof(receipt.saveId === saveId && receipt.idempotencyKey === stored.idempotency_key &&
            receipt.resultingRevision === rev && receipt.rulesVersion === core.approval.ruleVersion &&
            decision.status === "accepted" && decision.nextRevision === rev && decision.events.length > 0);
        const events = [];
        let intermediate = state.state;
        for (const expected of stored.result.decision.events) {
            const row = rows[offset];
            requireProof(row && row.exact_millis === true && row.sequence === offset && row.idempotency_key === checkpoint.key &&
                row.previous_hash === end && row.event_hash === row.recomputed &&
                /^[0-9a-f]{64}$/.test(row.event_hash) && !ids.has(row.id));
            const event = {id:row.id, saveId:row.save_id, branchId:row.branch_id, type:row.event_type,
                source:row.source, ruleVersion:row.rule_version, beforeRevision:row.before_revision,
                afterRevision:row.after_revision, occurredAt:row.occurred_at.toISOString(), payload:row.payload};
            requireProof(same(event, expected) && event.source === "RULES" && event.branchId === "root" &&
                event.saveId === saveId && event.ruleVersion === state.ruleVersion &&
                event.beforeRevision === rev - 1 && event.afterRevision === rev);
            ids.add(event.id);
            events.push(event);
            const next = runtime.rules.reduce(intermediate, event);
            if (rev === r && event.type.startsWith("move.")) {
                requireProof(++targetMoves === 1);
                const change = contracts.StateDeltaSchema.parse(event.payload.stateDelta).locationChange;
                const from = intermediate.locationId, to = next.locationId;
                if (event.type === "move.arrived") {
                    requireProof(decision.outcome === "success" && event.payload.from === from && event.payload.to === to);
                    if (change === null) {
                        requireProof(from === to && intermediate.facts.currentSublocationId !== next.facts.currentSublocationId &&
                            event.payload.fromSublocationId === intermediate.facts.currentSublocationId &&
                            event.payload.toSublocationId === next.facts.currentSublocationId);
                        classification = "sublocation-change";
                    } else {
                        requireProof(!location && from !== to && change.before === from && change.after === to);
                        location = {from, to};
                        classification = "world-location-change";
                    }
                } else if (event.type === "move.blocked") {
                    requireProof(decision.outcome === "legal_failure" && from === to && change === null);
                    classification = "blocked";
                } else if (event.type === "move.bypassed") {
                    requireProof(decision.outcome === "success" && from !== to && event.payload.from === from && event.payload.to === to);
                    classification = "OUT_OF_SCOPE_SUPPORTED_EVENT";
                }
            }
            intermediate = next;
            offset++;
            end = row.event_hash;
        }
        state = core.domain.replayEvents(state, events, runtime.rules.reduce);
        requireProof(same(state, checkpoint.save) && receipt.clockMinute === state.state.facts.gameMinute &&
            offset === checkpoint.count && end === checkpoint.end);
    }
    requireProof(rows.length === offset && checkpoints.get(r)?.key === key && r > 0);
    if (location) requireProof(location.from === checkpoints.get(r-1).save.state.locationId &&
        location.to === state.state.locationId && classification === "world-location-change");
    return {classification, location};
}
