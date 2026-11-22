import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { hash } from "../scene-state/store.mjs";
import { session } from "../first-play/test/s2-host.mjs";
import { classifyTrigger } from "../first-play/trigger.mjs";
import { reviewVisualHistory } from "../first-play/visual-consistency.mjs";
import { replayHighlights } from "./replay.mjs";
assert.equal(process.permission?.has("net"), false, "offline permission required");
const corpus = await readFile(new URL("./test/locked.jsonl", import.meta.url), "utf8");
assert.equal(hash(corpus), "926c492f656319e14a0f2f7b894a192f0244f71c4e94d41d9221d4441d7919e8");
const stories = corpus.trimEnd().split("\n").map(JSON.parse);
const groups = {}, failures = [], runs = [], checks = [], examples = [];
const measure = () => ({ turns: 0, truePositive: 0, trueNegative: 0, miss: 0, falsePositive: 0, wrongKind: 0,
    byKind: {}, top1Correct: 0, rankedStories: 0, orderedPairs: 0, expectedPairs: 0, duplicateDirectorKeys: 0, directorCandidates: 0, restatements: 0 });
const started = performance.now();
for (const s of stories) {
    const host = session("h1-" + s.id);
    for (const t of s.history)
        host.append(t);
    const ctx = { ...host.context(), replayOnly: true };
    const result = replayHighlights(ctx), m = groups[s.split] ??= measure();
    const order = result.rankings.story.map(c => c.revision), gold = s.rank;
    const unique = new Set();
    for (const [i, row] of result.rounds.entries()) {
        const expected = s.kinds[i], actual = row.kind, positive = expected !== "ordinary";
        m.turns++;
        m.restatements += row.repetitions.length;
        const bucket = m.byKind[expected] ??= { total: 0, correct: 0 };
        bucket.total++;
        if (expected === actual)
            bucket.correct++;
        if (positive && actual !== "ordinary")
            m.truePositive++;
        else if (positive)
            m.miss++;
        else if (actual === "ordinary")
            m.trueNegative++;
        else
            m.falsePositive++;
        if (positive && actual !== "ordinary" && expected !== actual)
            m.wrongKind++;
        if (expected !== actual)
            failures.push({ story: s.id, revision: i + 1, expected, actual, prose: s.history[i], abstention: row.abstention });
    }
    for (const c of result.candidates) {
        for (const e of c.evidence) {
            assert.equal(s.history[e.revision - 1].slice(e.start, e.end), e.quote);
            assert.equal(hash(s.history[e.revision - 1]), e.sha256);
            assert.ok(e.revision <= c.revision);
        }
        if (c.visual.status === "director-review") {
            m.directorCandidates++;
            if (unique.has(c.visual.visualKey))
                m.duplicateDirectorKeys++;
            unique.add(c.visual.visualKey);
        }
    }
    const ids = new Set(result.events.map(e => e.id));
    assert.ok(result.edges.every(e => ids.has(e.from) && ids.has(e.to)));
    if (gold.length) {
        m.rankedStories++;
        if (order[0] === gold[0])
            m.top1Correct++;
    }
    for (let a = 0; a < gold.length; a++)
        for (let b = a + 1; b < gold.length; b++) {
            m.expectedPairs++;
            if (order.includes(gold[a]) && order.indexOf(gold[b]) > order.indexOf(gold[a]))
                m.orderedPairs++;
        }
    runs.push({ story: s.id, split: s.split, expected: s.kinds, actual: result.rounds.map(r => r.kind), goldOrder: gold, actualOrder: order,
        correctOrder: JSON.stringify(order) === JSON.stringify(gold), events: result.events.length, edges: result.edges.length });
    if (s.id === "两条线" || s.id === "钥匙")
        examples.push({ story: s.id, result });
}
function test(name, fn) { fn(); checks.push(name); }
const make = (texts, label) => { const h = session(label); for (const t of texts)
    h.append(t); return { ...h.context(), replayOnly: true }; };
const quiet = stories.find(s => s.id === "账簿"), ctx = make(quiet.history, "checks");
test("a corrected obstacle cannot support a later battle climax", () => {
    const [setup,,,ending] = stories.find(s => s.id === "渡口").history;
    const result = replayHighlights(make([setup, "更正，守军并未封住渡口。", ending], "corrected"));
    assert.equal(result.candidates.length, 0);
    assert.ok(result.edges.some(e => e.relation === "correction"));
});
test("inner reversal needs the same subject, prior avoidance and a changed action", () => {
    const setup = "乔昕一直害怕讲台。乔昕总是绕开讲台。", mood = "乔昕的恐惧变成了平静。";
    const act = "乔昕第一次主动走上讲台。";
    const probe = text => replayHighlights(make([setup, text], "inner")).candidates;
    assert.equal(probe(mood + act)[0].kind, "emotion");
    assert.equal(probe(mood + act)[0].visual.status, "hold");
    for (const text of [mood, mood + act.replace("乔昕", "罗柳"), mood + act.replace("讲台", "木桥"), "如果" + mood + act])
        assert.equal(probe(text).length, 0);
});
test("foreign scope, unapproved source, tampering, gaps and future rows rejected", () => {
    for (const mutate of [x => x.replayOnly = false, x => x.authorized = false, x => x.owner = "other", x => x.revision--,
        x => x.receipts[0].source.sessionId = x.owner, x => x.receipts[1].narrativeSha256 = "0".repeat(64),
        x => x.history[1].resulting_revision++, x => x.history[1].key = x.history[0].key]) {
        const x = { ...ctx, history: structuredClone(ctx.history), receipts: structuredClone(ctx.receipts) };
        mutate(x);
        assert.throws(() => replayHighlights(x));
    }
});
test("action, hidden data and image descriptions cannot create a highlight", () => {
    const x = make(["茶凉了。"], "ordinary");
    x.history[0].action = quiet.history.join("");
    x.hiddenWorldbook = quiet.history;
    x.imageCaption = quiet.history[2];
    assert.equal(replayHighlights(x).candidates.length, 0);
});
test("rankings are reproducible, with no retrospective change to earlier candidates", () => {
    const full = replayHighlights(ctx);
    for (let i = 1; i <= ctx.revision; i++) {
        const cut = make(quiet.history.slice(0, i), "checks"), prefix = replayHighlights(cut);
        assert.deepEqual(prefix.candidates, full.candidates.filter(c => c.revision <= i));
    }
    assert.deepEqual(replayHighlights(ctx), full);
});
const survey = "此时我身在琥洲的听雨酒馆。我在廊下朝北看去。殿中除沈安、宋明、药师再无旁人。我看清了这里的铜柱与长桌。此时是正午。日光照亮眼前。";
const arrival = "林青走了进来，原来的人都还在，除此再无旁人。观察位置、朝向、结构、时段和光照均未改变。";
const waiting = "林青答应沈安回到听雨酒馆。沈安一直在听雨酒馆等林青归来。";
function contrast(texts, label) {
    const ctx = make(texts, label), result = replayHighlights(ctx), old = reviewVisualHistory(ctx), seen = new Map();
    const rows = old.turns.map(({ result: frame, audit }, i) => {
        const v = frame.visual, last = seen.get(v?.sceneId);
        const changed = v && last?.visualVersion !== v.visualVersion;
        const event = { source: ctx.receipts[i].source, normalized_text_hash: ctx.receipts[i].narrativeSha256, audit, previous: last,
            versions: changed ? [{ visual: v, previous: last ? Number(last.visualVersion.slice(1)) : null }] : [] };
        const trigger = classifyTrigger(frame, event);
        if (v)
            seen.set(v.sceneId, v);
        return { revision: i + 1, fieldReady: frame.status, consistency: old.reviews[i].verdict, trigger: trigger.reason,
            visibleChange: trigger.triggerCandidate, highlight: result.rounds[i].kind, visual: result.candidates.filter(c => c.revision === i + 1).map(c => c.visual.status) };
    });
    return { rows, result, ctx };
}
const reunited = contrast([waiting, survey, arrival], "reunion");
const repeated = contrast([waiting, survey, arrival, survey, arrival], "repeat-reunion");
test("repeated fulfillment yields one director candidate and one audited suppression", () => {
    assert.equal(repeated.result.candidates.filter(c => c.visual.status === "director-review").length, 1);
    assert.equal(repeated.result.rounds.at(-1).repetitions.length, 1);
    assert.equal(repeated.result.rounds.at(-1).candidateIds.length, 0);
});
test("same arrival with and without prior stakes; director only gets independently visible facts", () => {
    const plain = contrast([survey, arrival], "unbound-arrival");
    assert.equal(plain.rows.at(-1).highlight, "ordinary");
    assert.ok(plain.rows.at(-1).visibleChange);
    const c = reunited.result.candidates.at(-1);
    assert.equal(c.kind, "quiet");
    assert.equal(c.visual.status, "director-review");
    assert.equal(c.visual.send, false);
    assert.equal(c.visual.source.revision, c.revision);
    const disabled = replayHighlights({ ...reunited.ctx, enabled: false }).candidates.at(-1);
    assert.equal(disabled.kind, c.kind);
    assert.equal(disabled.visual.status, "hold");
});
const s2 = JSON.parse(await readFile(new URL("../offline-play-preview/story-text.json", import.meta.url), "utf8"));
const baseline = contrast(s2, "s2-original");
test("delayed outcome links the original choice; withdrawn and ambiguous objectives abstain", () => {
    const setup = "祁岚一直想归还玉匣。律例禁止祁岚归还玉匣。", choice = "祁岚交出了佩印，决定交回玉匣。";
    const path = [setup, choice, "茶已经凉了。", "玉匣终于回到失主手里。"];
    const r = replayHighlights(make(path, "delay"));
    assert.deepEqual(r.rounds.map(x => x.kind), ["ordinary", "turn", "ordinary", "quiet"]);
    const c = r.candidates.at(-1);
    assert.ok(c.links.some(e => e.relation === "consequence" && e.from.startsWith("2@") && e.to.startsWith("4@")));
    assert.equal(replayHighlights(make([setup, "祁岚正式撤回了归还玉匣的决定。", choice], "cancel")).candidates.length, 0);
    assert.equal(replayHighlights(make([setup, choice, setup.replaceAll("祁岚", "孟舟"), choice.replace("祁岚", "孟舟"), path.at(-1)], "ambiguous")).rounds.at(-1).kind, "ordinary");
});
test("setup and payoff bind holder, instrument and target before linking", () => {
    const r = replayHighlights(make(stories.find(s => s.id === "错扣").history, "binding"));
    assert.equal(r.rounds[2].candidateIds.length, 0);
    const edges = r.candidates[0].links;
    assert.ok(edges.some(e => e.relation === "payoff" && e.from.startsWith("1@") && e.to.startsWith("4@")));
    const c = r.candidates[0];
    assert.ok(c.evidence.some(e => e.type === "use" && e.roles.actor === "丁远" && e.roles.object === "骨签"));
});
test("recent window and full storyline rank different available moments", () => {
    const h = stories.find(s => s.id === "两条线").history;
    const r = replayHighlights(make([...h, "茶凉了。", "日头偏西。"], "ranks"));
    assert.deepEqual(r.rankings.story.map(x => x.revision), [6, 4, 3]);
    assert.deepEqual(r.rankings.recent.map(x => x.revision), [6]);
    assert.equal(r.rankings.storylines.length, 2);
});
test("all 20 S2 visual revisions replay without promoting routine changes", () => {
    assert.equal(baseline.rows.length, 20);
    assert.ok(baseline.rows.some(r => r.visibleChange));
    assert.ok(baseline.rows.some(r => r.consistency === "needs-review"));
    assert.equal(baseline.result.candidates.length, 0);
});
const elapsedMs = performance.now() - started;
const receipt = { method: "narrative-highlight/1", node: process.version, corpusSha256: hash(corpus), groups, failures, runs, checks,
    contrasts: { s2: baseline.rows, reunion: reunited.rows, textOnly: contrast(quiet.history, "text-only").rows,
        repeatedArrival: { rows: repeated.rows, suppressed: repeated.result.rounds.at(-1).repetitions } },
    examples: [...examples, { story: "reunion", candidate: reunited.result.candidates.at(-1) }],
    measured: { elapsedMs, processPeakRssKiB: process.resourceUsage().maxRSS }, modelLoads: 0, networkPermission: false,
    realModelLookups: 0, textCalls: 0, imageCalls: 0, newCostUsd: 0, humanReview: "NOT_RUN" };
console.log(JSON.stringify({ groups, checks: checks.length, failures }, null, 2));
if (process.argv[2])
    await writeFile(process.argv[2], JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
