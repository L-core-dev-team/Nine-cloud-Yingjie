import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hash } from "../../scene-state/store.mjs";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlights } from "../replay.mjs";
import { replayHighlightsV2 } from "./replay.mjs";
assert.equal(process.permission?.has("net"), false);
const read = name => readFileSync(new URL("../test/" + name, import.meta.url), "utf8");
const corpus = read("h2-locked.jsonl"), digest = hash(corpus);
assert.equal(digest, "88456751358b5378076735a46a064856284c8ac450b42f8c74e7df71290b4152");
const parse = s => s.trimEnd().split("\n").map(JSON.parse);
const groups = {}, ab = [], failures = [], cadence = [], details = [], samples = {};
let prefixChecks = 0, spanChecks = 0, edgeChecks = 0;
function bind(ctx) {
    return { ...ctx, replayOnly: true, planningSnapshots: ctx.receipts.map(r => ({ scope: ctx.scope, revision: r.source.revision,
            sourceKey: r.source.key, narrativeSha256: r.narrativeSha256, planningAllowed: true, enabled: true, operation: "generate", task: "idle" })) };
}
function count(k) {
    return groups[k] ??= { turns: 0, tp: 0, tn: 0, fp: 0, miss: 0, wrongType: 0, byType: {}, storiesWithPeaks: 0, top1: 0, top3: 0,
        comparablePairs: 0, orderedPairs: 0, prefixTop3Correct: 0, recentCorrect: 0, arcOrderCorrect: 0, rolesChecked: 0, roleErrors: 0, dependencyErrors: 0 };
}
function record(g, kind, gold) {
    g.turns++;
    const label = g.byType[gold] ??= { expected: 0, exact: 0 };
    label.expected++;
    label.exact += Number(gold === kind);
    if (kind === "ordinary")
        g[gold === "ordinary" ? "tn" : "miss"]++;
    else if (gold === "ordinary")
        g.fp++;
    else {
        g.tp++;
        if (kind !== gold)
            g.wrongType++;
    }
}
function rankMetrics(g, pred, gold) {
    if (!gold.length)
        return;
    g.storiesWithPeaks++;
    g.top1 += Number(pred[0] === gold[0]);
    g.top3 += Number(pred.slice(0, 3).includes(gold[0]));
    for (let i = 0; i < gold.length; i++)
        for (const later of gold.slice(i + 1)) {
            g.comparablePairs++;
            const pos = pred.indexOf(gold[i]);
            g.orderedPairs += Number(pos >= 0 && pred.indexOf(later) > pos);
        }
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const [legacyCorpus, stories] of [[false, parse(corpus)], [true, parse(read("locked.jsonl"))]]) {
    for (const story of stories) {
        const texts = story.history ?? story.turns.map(t => t.text), host = session("h2-assessment-" + story.id);
        const contexts = texts.map(t => bind(host.append(t))), ctx = contexts.at(-1);
        const v1 = replayHighlights(ctx), v2 = replayHighlightsV2(ctx);
        const map = new Map(v2.candidates.map(c => [c.id, c])), rev = ids => ids.map(id => map.get(id).revision);
        const ids = new Set(v2.events.map(e => e.id));
        for (const edge of v2.edges) {
            assert.ok(ids.has(edge.from) && ids.has(edge.to), JSON.stringify(edge));
            assert.ok(parseInt(edge.from) <= parseInt(edge.to) && parseInt(edge.to) <= edge.learnedAt);
            edgeChecks++;
        }
        for (const c of v2.candidates)
            for (const e of c.evidence) {
                const j = e.revision - 1;
                assert.ok(j >= 0 && e.revision <= c.revision);
                assert.equal(e.sha256, ctx.receipts[j].narrativeSha256);
                assert.equal(e.sourceKey, ctx.receipts[j].source.key);
                assert.equal(texts[j].slice(e.start, e.end), e.quote);
                spanChecks++;
            }
        for (const input of contexts) {
            const short = replayHighlightsV2(input), n = input.revision;
            assert.deepEqual(short.rounds, v2.rounds.slice(0, n));
            assert.deepEqual(short.candidates, v2.candidates.filter(c => c.revision <= n));
            assert.deepEqual(short.events, v2.events.filter(e => e.evidence.revision <= n));
            assert.deepEqual(short.edges, v2.edges.filter(e => e.learnedAt <= n));
            prefixChecks++;
        }
        const versions = [v1, v2], target = legacyCorpus ? story.rank : story.turns.at(-1).expected.top3;
        const ranks = [v1.rankings.story.map(c => c.revision), rev(v2.rounds.at(-1).rankings.story)];
        for (const [v, result] of versions.entries()) {
            const g = count((legacyCorpus ? "original" : "new") + "-" + (v + 1) + "-" + story.split);
            rankMetrics(g, ranks[v], target);
            for (const [i, r] of result.rounds.entries()) {
                const gold = legacyCorpus ? story.kinds[i] : story.turns[i].expected.type;
                record(g, r.kind, gold);
                if (r.kind !== gold)
                    failures.push({ set: legacyCorpus ? "original" : "new", split: story.split, story: story.id, r: i + 1, v: v + 1, issue: "kind", want: gold, got: r.kind });
            }
        }
        if (legacyCorpus) {
            ab.push({ story: story.id, gold: story.kinds, v1: v1.rounds.map(r => r.kind), v2: v2.rounds.map(r => r.kind), goldRank: target, ranks });
            if (story.id === "渡船")
                samples.ferry = v2.candidates;
            continue;
        }
        const g = count("new-2-" + story.split), rows = [], actions = [];
        for (const [i, r] of v2.rounds.entries()) {
            const gold = story.turns[i].expected, c = map.get(r.candidateIds[0]), rank = r.rankings;
            const top = rev(rank.story.slice(0, 3)), recent = rev(rank.recent.slice(0, 3)), arc = c ? rev(rank.arcs.find(a => a.arc === c.arc).ids) : [];
            const deps = c ? [...new Set(c.evidence.map(e => e.revision).filter(n => n < i + 1))] : [];
            const issue = (name, want, got) => failures.push({ set: "new", split: story.split, story: story.id, r: i + 1, v: 2, issue: name, want, got });
            for (const [name, a, b, key] of [["prefixTop3", gold.top3, top, "prefixTop3Correct"], ["recent", gold.recent, recent, "recentCorrect"], ["arc", gold.arcOrder, arc, "arcOrderCorrect"]]) {
                if (equal(a, b))
                    g[key]++;
                else
                    issue(name, a, b);
            }
            if (c && gold.roles) {
                g.rolesChecked++;
                if (!Object.entries(gold.roles).every(([k, v]) => c.roles[k] === v)) {
                    g.roleErrors++;
                    issue("roles", gold.roles, c.roles);
                }
                if (!gold.depends.every(n => deps.includes(n))) {
                    g.dependencyErrors++;
                    issue("prior-support", gold.depends, deps);
                }
                const current = c.evidence.filter(e => e.revision === i + 1);
                if (!gold.spans.every(([a, b]) => current.some(e => e.start < b && e.end > a)))
                    issue("no-overlap", gold.spans, current.map(e => [e.start, e.end]));
            }
            if (r.cadence.action !== gold.cadence)
                issue("cadence", gold.cadence, r.cadence.action);
            assert.equal(r.cadence.send, false);
            rows.push([r.kind, top, recent, arc, deps, r.finding]);
            actions.push([r.cadence.action, r.cadence.reason]);
        }
        cadence.push({ story: story.id, split: story.split, actions });
        details.push({ story: story.id, split: story.split, h1: v1.rounds.map(r => r.kind), ranks, rows });
        if (!samples.long && texts.length >= 14)
            samples.long = { story: story.id, candidates: v2.candidates, edges: v2.edges };
    }
}
const counts = {};
for (const row of cadence)
    for (const [action] of row.actions) {
        const g = counts[row.split] ??= {};
        g[action] = (g[action] ?? 0) + 1;
    }
console.log(JSON.stringify({ measurement: { method: "narrative-highlight/2", digest, groups, original: ab, spanChecks, prefixChecks, edgeChecks,
        rowColumns: ["kind", "topThree", "recentThree", "ownArc", "priorEvidenceRevisions", "finding"], details }, cadence: { counts, stories: cadence }, failures, samples }));
