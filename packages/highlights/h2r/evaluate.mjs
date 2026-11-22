import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlights } from "../replay.mjs";
import { replayHighlightsV2 } from "../v2/replay.mjs";
import { replayHighlights2R } from "./replay.mjs";
assert.equal(process.permission?.has("net"), false);
const split = process.argv[2];
if (!["dev", "held"].includes(split))
    throw Error("specify exactly one partition");
const base = JSON.parse(readFileSync("docs/reports/evidence/YJ-P04-H2R/baseline.json"));
const methods = [replayHighlights, replayHighlightsV2, replayHighlights2R];
const groups = {}, stories = [], failures = [];
function group(name) { return groups[name] ??= { matrix: {}, byFamily: {}, quiet: [0, 0], strictEvidence: [0, 0], precision: [0, 0], recall: [0, 0], top1: [0, 0], top3: [0, 0], pairs: [0, 0], cadence: [0, 0], forbiddenReview: 0, duplicateReview: 0, unrecognized: 0, wrongConfirmation: 0 }; }
function count(pair, ok) { pair[0] += Number(ok); pair[1]++; }
function scorePair(g, ranks, expected) {
    if (expected.length) {
        count(g.top1, ranks[0] === expected[0]);
        count(g.top3, ranks.slice(0, 3).includes(expected[0]));
    }
    for (const [i, a] of expected.entries())
        for (const b of expected.slice(i + 1))
            count(g.pairs, ranks.includes(a) && ranks.indexOf(b) > ranks.indexOf(a));
}
const classify = (r, kind) => r.state ?? (kind !== "ordinary" ? "confirmed-peak" : r.finding === "outside-current-scope" || r.finding === "abstained" || r.cadence?.action === "defer" ? "potential-unverified" : "ordinary");
function bound(ctx, rows) {
    return { ...ctx, replayOnly: true, planningSnapshots: ctx.receipts.map((v, i) => ({ scope: ctx.scope, revision: i + 1, sourceKey: v.source.key,
            narrativeSha256: v.narrativeSha256, task: "idle", operation: "generate", enabled: true, planningAllowed: rows[i].permission !== "revoked" })) };
}
for (const entry of base.corpus.filter(p => p.file.includes("/" + split + "/"))) {
    const raw = readFileSync(entry.file);
    assert.equal(createHash("sha256").update(raw).digest("hex"), entry.sha256);
    const s = JSON.parse(raw), host = session("h2r-eval-" + split + s.id), cases = [], rankings = {};
    const inputs = s.rows.map((v, i) => bound(host.append(v.text), s.rows.slice(0, i + 1)));
    const finalRuns = methods.map(f => f(inputs.at(-1)));
    for (const [v, run] of finalRuns.entries()) {
        const name = run.method, g = group(name), seenProposals = new Set(), rows = [];
        const fam = g.byFamily[s.family] ??= { tp: 0, miss: 0, falseConfirm: 0, positive: 0, ordinary: 0 };
        for (const [i, gold] of s.rows.entries()) {
            const r = run.rounds[i], c = run.candidates.find(x => x.id === r.candidateIds[0]);
            const state = classify(r, c?.kind ?? "ordinary"), isPeak = state === "confirmed-peak", positive = gold.label === "confirmed-peak";
            const cadence = r.cadence?.action ?? (c?.visual.status === "director-review" ? "director-review" : r.repetitions?.length ? "suppress-duplicate" : "text-only");
            const target = ({ "director-review-eligible": "director-review", "text-only-incomplete-visual": "text-only", "ambiguous-location": "text-only", defer: "defer", "suppress-duplicate": "suppress-duplicate" })[gold.visual];
            const cell = g.matrix[gold.label] ??= {};
            cell[state] = (cell[state] ?? 0) + 1;
            if (isPeak)
                count(g.precision, positive);
            if (positive) {
                fam.positive++;
                count(g.recall, isPeak);
                if (!isPeak)
                    fam.miss++;
                else
                    fam.tp++;
            }
            else if (isPeak) {
                g.wrongConfirmation++;
                fam.falseConfirm++;
            }
            else if (gold.label === "ordinary")
                fam.ordinary++;
            if (positive && gold.kind === "quiet")
                count(g.quiet, isPeak);
            if (r.recognized === false || r.finding === "no-recognized-event")
                g.unrecognized++;
            count(g.cadence, cadence === target);
            if (cadence === "director-review" && target !== "director-review")
                g.forbiddenReview++;
            if (cadence === "director-review") {
                if (seenProposals.has(c.id))
                    g.duplicateReview++;
                seenProposals.add(c.id);
            }
            if (r.cadence)
                assert.equal(r.cadence.send, false);
            const issues = [];
            if (state !== gold.label)
                issues.push("state");
            if (cadence !== target)
                issues.push("cadence");
            if (c) {
                const addressed = c.roles ?? Object.assign({}, ...c.evidence.map(e => e.roles ?? {}));
                const actor = addressed.actor, recipient = addressed.beneficiary ?? addressed.after ?? addressed.other;
                const rolesOk = !gold.roles || Object.entries(gold.roles).every(([k, value]) => ({ actor, asset: addressed.asset, beneficiary: recipient })[k] === value);
                const valid = c.evidence.every(e => e.revision <= i + 1 && e.sourceKey === inputs[i].receipts[e.revision - 1].source.key &&
                    e.sha256 === inputs[i].receipts[e.revision - 1].narrativeSha256 && s.rows[e.revision - 1].text.slice(e.start, e.end) === e.quote);
                const depsOk = gold.deps.every(d => c.evidence.some(e => e.revision === d));
                const spanOk = gold.spans.every(([a, b]) => c.evidence.some(e => e.revision === i + 1 && e.start < b && e.end > a));
                if (positive)
                    count(g.strictEvidence, rolesOk && valid && depsOk && spanOk);
                if (!rolesOk || !depsOk || !spanOk || !valid)
                    issues.push("role-or-support");
            }
            if (issues.length)
                failures.push({ s: s.id, r: i + 1, m: name, issues, gold: [gold.label, target], got: [state, cadence], reason: r.reason ?? r.finding, evidence: c?.evidence.map(e => [e.revision, e.start, e.end]) });
            rows.push([state, cadence, r.reason ?? r.finding]);
            if (v === 2) {
                const again = replayHighlights2R(inputs[i]);
                assert.deepEqual(again.rounds, run.rounds.slice(0, i + 1));
                assert.deepEqual(again.candidates, run.candidates.filter(x => x.revision <= i + 1));
                assert.deepEqual(again.events, run.events.filter(x => x.learnedAt <= i + 1));
            }
        }
        const rank = v === 0 ? run.rankings.story.map(x => x.revision) : (v === 1 ? run.rounds.at(-1).rankings.story : run.rounds.at(-1).ranking).map(id => run.candidates.find(c => c.id === id).revision);
        scorePair(g, rank, s.rank);
        rankings[name] = rank;
        if (JSON.stringify(rank) !== JSON.stringify(s.rank))
            failures.push({ s: s.id, m: name, issues: ["ranking"], gold: s.rank, got: rank });
        cases.push({ name, rows });
    }
    stories.push({ id: s.id, cases, rankings });
}
function interval([k, n]) { if (!n)
    return null; const z = 1.96, p = k / n, v = 1 + z * z / n, d = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(p + z * z / (2 * n) - d) / v, (p + z * z / (2 * n) + d) / v].map(x => Math.max(0, Math.min(1, Number(x.toFixed(4))))); }
for (const g of Object.values(groups)) {
    g.wilson95 = Object.fromEntries(["precision", "recall", "quiet", "top1", "top3", "pairs"].map(k => [k, interval(g[k])]));
    g.classes = {};
    for (const label of ["confirmed-peak", "potential-unverified", "ordinary", "unknown"]) {
        const ok = g.matrix[label]?.[label] ?? 0;
        const actual = Object.values(g.matrix[label] ?? {}).reduce((a, b) => a + b, 0);
        const predicted = Object.values(g.matrix).reduce((n, row) => n + (row[label] ?? 0), 0);
        g.classes[label] = { precision: [ok, predicted], recall: [ok, actual], recall95: interval([ok, actual]) };
    }
    for (const f of Object.values(g.byFamily))
        f.recallInterval = interval([f.tp, f.positive]);
}
console.log(JSON.stringify({ split, groups, stories, failures, net: false }));
