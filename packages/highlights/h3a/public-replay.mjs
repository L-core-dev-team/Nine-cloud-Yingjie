import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlights2R } from "../h2r/replay.mjs";
import { replayHighlights3A } from "./replay.mjs";
assert.equal(process.permission?.has("net"), false);
const load = name => readFileSync("packages/highlights/test/" + name, "utf8");
const lines = name => load(name).trimEnd().split("\n").map(JSON.parse);
const receipts = {}, outputs = {}, sourceErrors = [], changes = [];
let prefixes = 0;
for (const dataset of ["h1", "h2", "h2r-dev", "h2r-held-public"]) {
    const stories = dataset === "h1" ? lines("locked.jsonl") : dataset === "h2" ? lines("h2-locked.jsonl") :
        Array.from({ length: 18 }, (_, i) => JSON.parse(load("h2r/" + (dataset === "h2r-dev" ? "dev" : "held") + "/" + String(i + 1).padStart(2, "0") + ".json")));
    const groups = [1, 2].map(() => ({ hits: 0, miss: 0, fp: 0, tn: 0, top1: 0, top3: 0, storiesWithPeaks: 0, visualReviews: 0, unauthorizedReviews: 0, quiet: 0, quietGold: 0 }));
    const storyRows = [];
    for (const story of stories) {
        const host = session("public-" + dataset + story.id);
        const rows = story.history?.map((text, i) => ({ text, positive: story.kinds[i] !== "ordinary", quiet: story.kinds[i] === "quiet" })) ??
            story.turns?.map(t => ({ text: t.text, positive: t.expected.type !== "ordinary", quiet: t.expected.type === "quiet" })) ??
            story.rows.map(t => ({ ...t, positive: t.label === "confirmed-peak", quiet: t.kind === "quiet" }));
        const target = story.rank ?? story.turns.at(-1).expected.top3;
        const contexts = rows.map((r, i) => {
            const c = host.append(r.text);
            return { ...c, replayOnly: true, planningSnapshots: c.receipts.map((v, j) => ({ scope: c.scope, revision: j + 1, sourceKey: v.source.key,
                    narrativeSha256: v.narrativeSha256, task: "idle", operation: "generate", enabled: true, planningAllowed: rows[j].permission !== "revoked" })) };
        });
        const runs = [replayHighlights2R(contexts.at(-1)), replayHighlights3A(contexts.at(-1))], series = [];
        for (const [v, run] of runs.entries()) {
            const g = groups[v], find = new Map(run.candidates.map(c => [c.id, c])), rank = run.rounds.at(-1).ranking.map(id => find.get(id).revision);
            if (target.length) {
                g.storiesWithPeaks++;
                g.top1 += Number(rank[0] === target[0]);
                g.top3 += Number(rank.slice(0, 3).includes(target[0]));
            }
            const peaks = [];
            for (const [i, r] of run.rounds.entries()) {
                const pos = r.candidateIds.length > 0, gold = rows[i];
                g[pos ? (gold.positive ? "hits" : "fp") : (gold.positive ? "miss" : "tn")]++;
                if (gold.quiet) {
                    g.quietGold++;
                    g.quiet += Number(pos);
                }
                if (pos)
                    peaks.push(i + 1);
                if (r.cadence.action === "director-review") {
                    g.visualReviews++;
                    if (gold.permission === "revoked")
                        g.unauthorizedReviews++;
                }
                assert.equal(r.cadence.send, false);
                if (v === 1) {
                    const short = replayHighlights3A(contexts[i]);
                    assert.deepEqual(short.rounds, run.rounds.slice(0, i + 1));
                    assert.deepEqual(short.candidates, run.candidates.filter(c => c.revision <= i + 1));
                    assert.deepEqual(short.edges, run.edges.filter(e => e.learnedAt <= i + 1));
                    prefixes++;
                    if (pos !== gold.positive)
                        sourceErrors.push({ dataset, story: story.id, r: i + 1, expected: gold.positive, observed: pos, reason: r.audit.judgments.map(x => x.reason) });
                }
            }
            series.push({ peaks, rank });
        }
        if (JSON.stringify(series[0]) !== JSON.stringify(series[1]))
            changes.push({ dataset, story: story.id, old: series[0], current: series[1] });
        storyRows.push({ story: story.id, expected: rows.flatMap((g, i) => g.positive ? [i + 1] : []), goldRank: target, series });
    }
    receipts[dataset] = groups;
    outputs[dataset] = storyRows;
}
console.log(JSON.stringify({ prefixes, receipts, outputs, sourceErrors, changes }));
