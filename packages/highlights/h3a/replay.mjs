import { performance } from "node:perf_hooks";
import { replayHighlights2R } from "../h2r/replay.mjs";
import { collectRevision } from "./collect.mjs";
import { emptyLedger, reviewRevision } from "./transaction.mjs";
export const method = "narrative-highlight/3a";
const propertyFrames = new Set(["rights-transfer", "durable-right"]);
const order = (a, b) => b.score - a.score || a.revision - b.revision || a.evidence.at(-1).start - b.evidence.at(-1).start;
const hold = reason => ({ action: "text-only", reason, send: false });
// Synchronous, authorized host-only replay. Each invocation starts with an
// empty ledger. No approval, server, storage or provider is constructed here.
export function replayHighlights3A(ctx, timing) {
    const start = performance.now(), legacy = replayHighlights2R(ctx);
    const clock = { validatedHostAndLegacy: performance.now() - start, extract: 0, review: 0, commit: 0, rankAndAudit: 0 };
    const byID = new Map(legacy.candidates.map(c => [c.id, c])), candidates = [], rounds = [], edges = [], inherited = [];
    let state = emptyLedger(), focus = null;
    for (const [i, row] of ctx.history.entries()) {
        let t = performance.now();
        const receipt = ctx.receipts[i], baseline = legacy.rounds[i], revision = i + 1;
        const old = baseline.candidateIds.map(id => byID.get(id));
        const collection = collectRevision(ctx, row, receipt, old.filter(c => ["relation", "inner-change"].includes(c.frame)));
        clock.extract += performance.now() - t;
        t = performance.now();
        const checked = reviewRevision(state, collection, receipt, ctx, focus);
        clock.review += performance.now() - t;
        t = performance.now();
        // Single publication boundary. No staged candidates/keys/edges are visible
        // to later revisions if extraction or review throws.
        state = checked.draft;
        focus = checked.focus;
        edges.push(...checked.audit.edges);
        clock.commit += performance.now() - t;
        t = performance.now();
        const retained = old.filter(c => !propertyFrames.has(c.frame));
        inherited.push(...retained);
        const current = [...checked.candidates, ...retained].sort(order);
        candidates.push(...current);
        const active = [...inherited, ...[...state.candidates.values()].filter(c => c.status === "active")].sort(order);
        const peak = current[0], guarded = old.some(c => propertyFrames.has(c.frame)) || collection.observations.some(o => ["effect", "sign", "registry", "challenge", "restated"].includes(o.kind));
        let cadence = hold("no-confirmed-visual-moment");
        if (peak && retained.includes(peak) && baseline.candidateIds[0] === peak.id)
            cadence = baseline.cadence;
        else if (!peak && !guarded) {
            const repeatVerified = inherited.some(c => c.moment === baseline.cadence.original || c.id === baseline.cadence.original);
            if (baseline.cadence.action === "text-only" || baseline.cadence.action === "suppress-duplicate" && repeatVerified)
                cadence = baseline.cadence;
        }
        else if (!peak && ctx.enabled === true && collection.observations.some(o => o.kind === "sign") &&
            [...state.pending.values()].some(d => d.validity === "signed" && d.evidence.revision === revision))
            cadence = { action: "defer", reason: "await-effective-result", send: false };
        if (!peak && ctx.enabled === true && collection.observations.some(o => o.kind === "restated" && [...state.titles.values()].some(v => v.asset === o.asset && v.actor === o.to && v.parent && state.candidates.get(v.parent)?.status === "active")))
            cadence = { action: "suppress-duplicate", reason: "previously-admitted-disposition", send: false };
        rounds.push({ revision, source: receipt.source, state: peak ? "confirmed-peak" : guarded ? "unverified" : baseline.state,
            narrativeImportance: peak ? "recognized" : guarded ? "possible-material-event" : "no-new-peak",
            candidateIds: current.map(c => c.id), ranking: active.map(c => c.id), cadence: { ...cadence, send: false }, audit: checked.audit });
        clock.rankAndAudit += performance.now() - t;
    }
    if (timing)
        Object.assign(timing, clock);
    return { method, replayOnly: true, scope: ctx.scope, through: ctx.revision, rounds, candidates, edges };
}
