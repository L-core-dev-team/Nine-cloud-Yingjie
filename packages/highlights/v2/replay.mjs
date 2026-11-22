import { performance } from "node:perf_hooks";
import { hash } from "../../scene-state/store.mjs";
import { reviewVisualHistory } from "../../first-play/visual-consistency.mjs";
import { replayHighlights } from "../replay.mjs";
import { ArcMemory, readRights } from "./rights.mjs";
import { Meetings } from "./meetings.mjs";
import { suggest } from "./cadence.mjs";
export const method = "narrative-highlight/2";
const byRevision = (items, revisionOf) => {
    const result = new Map();
    for (const item of items) {
        const rev = revisionOf(item);
        if (!result.has(rev))
            result.set(rev, []);
        result.get(rev).push(item);
    }
    return result;
};
function eventRecord(e, scope) {
    const action = e.kind ?? e.type, r = e.roles;
    const open = ["goal", "promise", "purpose", "signed", "choice", "await"].includes(action);
    const before = action === "title" ? r.actor : action === "affect" ? r.before : null;
    const after = ["effective", "common", "restated"].includes(action) ? r.recipient :
        action === "bond" ? r.change : action === "affect" ? r.after : null;
    return { ...e, scope, action, subject: r.actor ?? null, affected: r.recipient ?? r.other ?? r.beneficiary ?? null,
        object: r.asset ?? r.object ?? r.target ?? null, right: r.right ?? null, before, after,
        status: e.confirmed === false ? "unverified" : open ? "observed-commitment-or-intent" : "observed-in-history" };
}
function assess(c, revision, prior) {
    const has = (...types) => c.evidence.some(e => types.includes(e.type));
    const lag = revision - Math.min(...c.evidence.map(e => e.revision));
    const factors = {
        outcome: c.kind === "turn" ? 0 : 2,
        commitment: c.frame === "rights-transfer" || c.frame === "visible-arrival" || has("goal", "plant") ? 2 : 0,
        lasting: c.frame === "rights-transfer" ? 4 : has("passage", "restitution", "bond", "discovery") ? 2 : 0,
        cost: has("cost") || c.roles.before === "退出前有分成资格" ? 2 : 0,
        reversal: c.kind === "emotion" || has("withdrawal") ? 2 : 0,
        setupDistance: lag >= 8 ? 2 : lag > 0 ? 1 : 0,
        resolution: c.kind === "turn" ? 0 : 1
    };
    // An independently planted instrument actually worked at its stated target,
    // and the text records a discovery. A later retelling earns no extra credit.
    factors.plantedPayoff = has("purpose") && has("opening") && has("discovery") ? 2 : 0;
    const score = Object.values(factors).reduce((a, b) => a + b, 0);
    const previous = prior.filter(p => p.arc === c.arc);
    return { ranker: "highlight-ranker/2", factors, score, lag,
        deltaFromPriorArcPeak: previous.length ? score - Math.max(...previous.map(p => p.score)) : null };
}
const order = (a, b) => b.score - a.score || a.revision - b.revision || a.evidence.at(-1).start - b.evidence.at(-1).start;
function snapshot(candidates, rev) {
    const list = [...candidates].sort(order), arcs = new Map();
    for (const c of list) {
        if (!arcs.has(c.arc))
            arcs.set(c.arc, []);
        arcs.get(c.arc).push(c.id);
    }
    return { asOf: rev, story: list.map(c => c.id), recent: list.filter(c => c.revision > rev - 6).map(c => c.id),
        arcs: [...arcs].map(([arc, ids]) => ({ arc, ids })) };
}
function inherited(c) {
    const focus = c.evidence.find(e => e.type === "release" || e.type === "goal") ?? c.evidence[0];
    return { kind: c.kind, frame: c.depiction, arc: c.arc, moment: c.moment, evidence: c.evidence, links: c.links,
        roles: { ...focus.roles }, reason: c.reason };
}
// Internal trusted replay interface. Persisted histories and receipts are independently
// revalidated by the existing host contract before either event reader sees the text.
export function replayHighlightsV2(ctx, timing) {
    const begin = performance.now();
    const legacy = replayHighlights(ctx);
    // Picture settings never alter narrative presence evidence.
    const checked = reviewVisualHistory({ ...ctx, enabled: true });
    if (!checked.turns)
        throw Error("unverified-scene-prefix");
    const clock = { hostAndLegacy: performance.now() - begin, extraction: 0, memory: 0, ranking: 0, evidenceAndCadence: 0 };
    const hostEvents = byRevision(legacy.events, e => e.evidence.revision);
    const hostPeaks = byRevision(legacy.candidates, c => c.revision);
    const memory = new ArcMemory(), meetings = new Meetings(), priorGoals = [], proposed = new Set();
    const events = [], candidates = [], rounds = [], edgeMap = new Map(), inheritedIds = new Set();
    for (const [i, row] of ctx.history.entries()) {
        const revision = i + 1, receipt = ctx.receipts[i], { source, narrativeSha256: digest } = receipt;
        const add = edge => {
            const key = JSON.stringify([edge.from, edge.to, edge.relation]);
            if (!edgeMap.has(key))
                edgeMap.set(key, { ...edge, learnedAt: revision });
        };
        let tick = performance.now();
        const fresh = readRights(row, source, digest), old = hostEvents.get(revision) ?? [];
        events.push(...fresh, ...old);
        clock.extraction += performance.now() - tick;
        tick = performance.now();
        const state = memory.ingest(fresh, priorGoals, row.narrative);
        const visual = checked.turns[i].result.visual;
        const meeting = meetings.step(row.narrative, source, digest, old, ctx.registry, memory, fresh, visual);
        const incoming = [...state.candidates];
        if (meeting.candidate)
            incoming.push(meeting.candidate);
        for (const c of hostPeaks.get(revision) ?? []) {
            if (c.depiction === "visible-arrival" || c.evidence.some(e => [e.roles.actor, e.roles.other].some(n => memory.ambiguous.has(n))))
                continue;
            incoming.push(inherited(c));
            inheritedIds.add(c.id);
        }
        for (const edge of state.edges)
            add(edge);
        for (const e of old.filter(v => v.type === "retract-conflict")) {
            const conflict = events.findLast(v => v.type === "conflict" && v.roles.actor === e.roles.actor && v.roles.object === e.roles.object);
            if (conflict)
                add({ from: conflict.id, to: e.id, relation: "correction" });
        }
        for (const e of old) {
            if (e.type === "goal")
                priorGoals.push(e);
            if (e.type === "abandon") {
                for (let j = priorGoals.length - 1; j >= 0; j--)
                    if (priorGoals[j].roles.actor === e.roles.actor && priorGoals[j].roles.object === e.roles.object)
                        priorGoals.splice(j, 1);
            }
        }
        clock.memory += performance.now() - tick;
        tick = performance.now();
        const current = [];
        for (const c of incoming) {
            const id = hash(JSON.stringify([method, ctx.scope, source.key, c.arc, c.moment, c.kind]));
            const result = { ...c, id, method, schemaVersion: "HighlightCandidate/2", replayOnly: true, source, revision,
                ...assess(c, revision, candidates) };
            for (const edge of c.links ?? [])
                add(edge);
            candidates.push(result);
            current.push(result);
        }
        const rankings = snapshot(candidates, revision);
        clock.ranking += performance.now() - tick;
        tick = performance.now();
        const decisions = current.sort(order).map(c => ({ candidateId: c.id,
            ...suggest(c, checked, visual, ctx, receipt, ctx.planningSnapshots?.[i], proposed) }));
        const repeated = meeting.repeat ?? legacy.rounds[i].repetitions.find(v => inheritedIds.has(v.original))?.original;
        const fallback = repeated ? { action: "suppress-duplicate", reason: "prior-payoff", original: repeated } :
            state.decisions.at(-1) ?? { action: "text-only", reason: state.notes.at(-1) ?? legacy.rounds[i].abstention ?? "no-confirmed-new-peak" };
        const cadence = decisions[0] ?? { method: "highlight-cadence/1", ...(ctx.enabled === true ? fallback : { action: "text-only", reason: "display-disabled" }), send: false };
        const finding = current.length ? "highlight" : cadence.action === "suppress-duplicate" ? "repeat" :
            fresh.some(e => !e.confirmed) || state.notes.length || legacy.rounds[i].abstention ? "abstained" :
                fresh.length || old.length ? "evidenced-context" : "no-recognized-event";
        rounds.push({ revision, kind: current[0]?.kind ?? "ordinary", finding, candidateIds: current.map(c => c.id),
            cadence, decisions, rankings, notes: state.notes, unverified: fresh.filter(e => !e.confirmed).map(e => e.uncertainty) });
        clock.evidenceAndCadence += performance.now() - tick;
    }
    const end = performance.now();
    const records = events.map(e => eventRecord(e, ctx.scope));
    clock.evidenceAndCadence += performance.now() - end;
    if (timing)
        Object.assign(timing, clock);
    return { method, replayOnly: true, scope: ctx.scope, through: ctx.revision, events: records, edges: [...edgeMap.values()], candidates, rounds };
}
