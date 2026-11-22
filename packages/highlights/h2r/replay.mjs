import { performance } from "node:perf_hooks";
import { hash } from "../../scene-state/store.mjs";
import { replayHighlightsV2 } from "../v2/replay.mjs";
import { SemanticMemory } from "./semantics.mjs";
export const method = "narrative-highlight/2r";
const rank = (a, b) => b.score - a.score || a.revision - b.revision || a.evidence[0].start - b.evidence[0].start;
export function replayHighlights2R(ctx, timing) {
    const started = performance.now(), legacy = replayHighlightsV2(ctx);
    const stats = { validatedH2: performance.now() - started, semantics: 0, rankingAndReceipts: 0 };
    const memory = new SemanticMemory(), ambiguousMeetings = new Map(), candidates = [], rounds = [], events = [];
    const prior = new Map(legacy.candidates.map(c => [c.id, c]));
    const byRevision = new Map();
    for (const event of legacy.events) {
        const r = event.evidence.revision;
        if (!byRevision.has(r))
            byRevision.set(r, []);
        byRevision.get(r).push(event);
    }
    for (const [i, row] of ctx.history.entries()) {
        const receipt = ctx.receipts[i], revision = i + 1, baseline = legacy.rounds[i];
        let tick = performance.now();
        const delta = memory.advance(row.narrative, receipt);
        events.push(...delta.events);
        const observed = byRevision.get(revision) ?? [];
        for (const event of observed) {
            if (event.type === "promise" && ctx.registry.resolve(event.roles.target).reason === "ambiguous-place")
                ambiguousMeetings.set(event.roles.actor, { revision, sourceKey: receipt.source.key, target: event.roles.target });
        }
        const arrival = observed.find(e => e.type === "arrival");
        const ambiguous = arrival ? ambiguousMeetings.get(arrival.roles.actor) : null;
        stats.semantics += performance.now() - tick;
        tick = performance.now();
        const inherited = baseline.candidateIds.map(id => prior.get(id));
        const current = inherited.map(c => ({ ...c, method, origin: legacy.method }));
        for (const c of delta.candidates) {
            if (inherited.some(v => v.roles.actor === c.roles.actor && (c.roles.asset && v.roles.asset === c.roles.asset || v.roles.other === c.roles.beneficiary)))
                continue;
            const source = receipt.source, id = hash(JSON.stringify([method, ctx.scope, source.key, c.frame, c.roles]));
            const lag = revision - c.evidence[0].revision;
            const factors = { confirmedResult: 3, durability: 2, changeOfRight: c.frame === "durable-right" ? 3 : 0, priorStake: 1, delay: lag >= 8 ? 2 : lag > 0 ? 1 : 0 };
            current.push({ ...c, id, method, origin: method, replayOnly: true, source, revision, learnedAt: revision, factors,
                score: Object.values(factors).reduce((a, b) => a + b, 0) });
        }
        candidates.push(...current);
        let state = delta.state, reason = delta.reason;
        if (current.length) {
            state = "confirmed-peak";
            reason = current[0].reason;
        }
        else if (ambiguous) {
            state = "unknown";
            reason = "promise-place-nonunique-at-commitment";
        }
        else if (state === "ordinary" && baseline.finding === "abstained") {
            state = "potential-unverified";
            reason = "unresolved-in-history";
        }
        let cadence = baseline.cadence;
        if (!baseline.candidateIds.length && ctx.enabled === true && baseline.cadence.action === "text-only") {
            cadence = { method: "highlight-cadence/1", action: delta.action, reason, send: false };
        }
        rounds.push({ revision, state, reason, recognized: reason !== "no-event-recognized", ambiguousPromise: ambiguous ?? null,
            candidateIds: current.sort(rank).map(c => c.id), cadence, ranking: [...candidates].sort(rank).map(c => c.id) });
        stats.rankingAndReceipts += performance.now() - tick;
    }
    if (timing)
        Object.assign(timing, stats);
    return { method, replayOnly: true, scope: ctx.scope, through: ctx.revision, events, candidates, rounds };
}
