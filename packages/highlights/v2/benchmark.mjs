import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlightsV2 } from "./replay.mjs";
assert.equal(process.permission?.has("net"), false);
const stories = readFileSync(new URL("../test/h2-locked.jsonl", import.meta.url), "utf8").trimEnd().split("\n").map(JSON.parse);
const texts = stories.flatMap(s => s.turns.map(t => t.text));
const rows = [];
for (const revisions of [20, 100, 300, 1000]) {
    const begin = performance.now(), host = session("cost-" + revisions);
    for (let i = 0; i < revisions; i++)
        host.append(texts[i % texts.length]);
    const ctx = { ...host.context(), replayOnly: true };
    const hostMs = performance.now() - begin;
    replayHighlightsV2(ctx);
    const samples = [];
    for (let i = 0; i < 3; i++) {
        const stages = {}, start = performance.now(), run = replayHighlightsV2(ctx, stages);
        samples.push({ totalMs: performance.now() - start, stages, candidates: run.candidates.length, edges: run.edges.length });
    }
    rows.push({ revisions, hostMs, medianMs: samples.map(r => r.totalMs).sort((a, b) => a - b)[1], samples });
}
console.log(JSON.stringify({ node: process.version, fixture: "cyclic locked stories concatenated into a single artificial session; no planning snapshot",
    timing: "single CPU process, one warmup + three replays; hostAndLegacy includes validated H1 replay and independent S2 reconstruction",
    rows, processPeakRssKiB: process.resourceUsage().maxRSS, net: false, modelLoads: 0, costUsd: 0 }));
