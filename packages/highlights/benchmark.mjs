import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { session } from "../first-play/test/s2-host.mjs";
import { replayHighlights } from "./replay.mjs";
assert.equal(process.permission?.has("net"), false);
const sample = ["梅青一直想归还玉简。家规不许梅青归还玉简。", "梅青放弃了俸禄，选择归还玉简。", "小舟照常经过。", "玉简终于回到失主手里。"];
const rows = [];
for (const length of [20, 100, 300]) {
    const host = session("cost-" + length);
    for (let i = 0; i < length; i++)
        host.append(sample[i % sample.length]);
    const input = { ...host.context(), replayOnly: true };
    const times = [];
    for (let j = 0; j < 6; j++) {
        const start = performance.now();
        replayHighlights(input);
        if (j)
            times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    rows.push({ revisions: length, replays: times.length, medianMs: times[2], rangeMs: [times[0], times.at(-1)] });
}
console.log(JSON.stringify({ node: process.version, method: "one warmup and five synchronous in-process prefix replays, input construction excluded",
    rows, processPeakRssKiB: process.resourceUsage().maxRSS, networkPermission: false, modelLoads: 0, tokenUsage: 0, serviceCostUsd: 0 }, null, 2));
