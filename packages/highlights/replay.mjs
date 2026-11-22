import { isDeepStrictEqual } from "node:util";
import { fromCardHistory } from "../contracts/dist/index.js";
import { hash, cardScope } from "../scene-state/store.mjs";
import { reviewVisualHistory } from "../first-play/visual-consistency.mjs";
import { createEvidenceReplay } from "../first-play/scene-evidence-v2.mjs";
import { extractEvents } from "./events.mjs";
import { connectTurn } from "./graph.mjs";
export const method = "narrative-highlight/1";
const recentWindow = 4;
function savedPrefix(ctx) {
    if (!ctx || ctx.replayOnly !== true || ctx.authorized !== true || typeof ctx.owner !== "string" ||
        typeof ctx.sessionId !== "string" || ctx.scope !== cardScope(ctx.owner, ctx.sessionId))
        throw Error("inaccessible-replay");
    if (!Array.isArray(ctx.history) || !ctx.history.length || ctx.revision !== ctx.history.length ||
        ctx.receipts?.length !== ctx.history.length)
        throw Error("unverified-prefix");
    const keys = new Set();
    return ctx.history.map((row, i) => {
        const { source } = fromCardHistory(ctx.owner, ctx.sessionId, row);
        const receipt = ctx.receipts[i], digest = hash(row.narrative);
        if (source.revision !== i + 1 || keys.has(source.key) || !isDeepStrictEqual(source, receipt?.source) ||
            receipt?.narrativeSha256 !== digest)
            throw Error("unverified-completed-history");
        keys.add(source.key);
        return { source, digest, narrative: row.narrative };
    });
}
function director(proposal, review, turn, enabled) {
    const result = { status: "hold", reason: "insufficient-visible-evidence", visualKey: null, send: false };
    if (!enabled)
        return { ...result, reason: "display-disabled" };
    if (proposal.framing === "inner-change" || proposal.framing === "choice-only")
        return { ...result, reason: "text-first" };
    if (!review?.imageEligible || !turn?.result.visual)
        return result;
    // The current visual schema describes a scene and its roster. It cannot attest to
    // the handover of an item or the outcome of combat. Only an observed arrival
    // independently confirmed in the same visual is mapped by this version.
    if (proposal.framing !== "visible-arrival")
        return { ...result, reason: "moment-not-grounded-in-visual" };
    const v = turn.result.visual;
    return { status: "director-review", reason: "arrival-and-current-survey", send: false,
        visualKey: JSON.stringify([v.source.ownerId, v.source.sessionId, v.sceneId, v.visualVersion, review.lightSource ?? null]),
        source: v.source, sceneId: v.sceneId, version: v.visualVersion, reviewSha256: review.reviewSha256 };
}
function ranked(candidates) {
    return candidates.slice().sort((a, b) => b.score - a.score || a.revision - b.revision ||
        Number(a.moment.split("@")[1]) - Number(b.moment.split("@")[1]));
}
const positions = candidates => ranked(candidates).map((c, i) => ({ id: c.id, revision: c.revision, rank: i + 1, score: c.score }));
// Internal, synchronous, read-only. The trusted host supplies an already-authorized
// completed-history prefix plus independently read receipts. No client JSON endpoint.
export function replayHighlights(ctx) {
    const rows = savedPrefix(ctx);
    const reviewed = ctx.enabled === true ? reviewVisualHistory(ctx) : null;
    // Text-only replay can still use the observed roster, independently of image permission.
    const factual = reviewed?.turns ? null : createEvidenceReplay({ owner: ctx.owner, sessionId: ctx.sessionId, registry: ctx.registry, replayOnly: true });
    const events = [], links = new Map(), candidates = [], rounds = [], seen = new Map(), visuals = new Set();
    const addEdge = e => links.set(JSON.stringify(e), e);
    for (const [i, row] of rows.entries()) {
        const revision = i + 1;
        const extracted = extractEvents(row.narrative, row.source, row.digest);
        const turn = reviewed?.turns?.[i] ?? factual.append(ctx.history[i], ctx.receipts[i]);
        const { proposals, edges } = connectTurn(events, extracted.events, turn?.result, candidates);
        const ids = [], repetitions = [];
        for (const e of edges)
            addEdge(e);
        for (const p of proposals) {
            for (const e of p.links)
                addEdge(e);
            const previous = seen.get(p.fingerprint);
            if (previous) {
                repetitions.push({ moment: p.moment, original: previous.id });
                addEdge({ from: previous.moment, to: p.moment, relation: "restatement" });
                continue;
            }
            const visual = director(p, reviewed?.reviews?.[i], turn, ctx.enabled === true);
            if (visual.visualKey) {
                if (visuals.has(visual.visualKey)) {
                    visual.status = "hold";
                    visual.reason = "duplicate-visual";
                }
                visuals.add(visual.visualKey);
            }
            const id = hash(JSON.stringify([method, ctx.scope, row.source.key, p.moment, p.kind]));
            const c = { schemaVersion: "HighlightCandidate/1", method, replayOnly: true, id, revision, source: row.source,
                kind: p.kind, level: p.score >= 6 ? "major" : p.score >= 4 ? "significant" : "turning-point", score: p.score,
                topic: p.topic, arc: p.anchor, moment: p.moment, signals: p.signals, reason: p.explanation,
                evidence: p.events.map(e => ({ ...e.evidence, eventId: e.id, type: e.type, roles: e.roles })), links: p.links,
                depiction: p.framing, visual };
            seen.set(p.fingerprint, c);
            ids.push(id);
            candidates.push(c);
        }
        events.push(...extracted.events);
        rounds.push({ revision, kind: ranked(candidates.filter(c => c.revision === revision))[0]?.kind ?? "ordinary",
            finding: ids.length ? "highlight" : repetitions.length ? "repeated" : extracted.abstention ? "outside-current-scope" :
                extracted.events.length ? "evidenced-context" : "no-recognized-event",
            candidateIds: ids, repetitions, abstention: extracted.abstention, visualVerdict: reviewed?.reviews?.[i]?.verdict ?? "unavailable" });
    }
    const arcs = new Map();
    for (const c of candidates) {
        if (!arcs.has(c.arc))
            arcs.set(c.arc, []);
        arcs.get(c.arc).push(c);
    }
    return { method, replayOnly: true, through: ctx.revision, events, edges: [...links.values()], rounds, candidates,
        rankings: { story: positions(candidates), recent: positions(candidates.filter(c => c.revision > ctx.revision - recentWindow)),
            recentWindow, storylines: [...arcs].map(([arc, items]) => ({ arc, ranking: positions(items) })) } };
}
