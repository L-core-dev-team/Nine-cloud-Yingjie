import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { session } from "../first-play/test/s2-host.mjs";
import { initialPng, editedPng } from "../first-play/test/s2-png.mjs";
import { reviewVisualHistory } from "../first-play/visual-consistency.mjs";
const dir = new URL("./", import.meta.url), out = new URL("dist/", dir);
const read = name => readFile(new URL(name, dir));
const json = async (name) => JSON.parse(await read(name));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const evidence = "../../docs/reports/evidence/";
const raw = await read(evidence + "YJ-P03-S2/story-slice.json");
const sourceSha = sha(raw);
assert.equal(sourceSha, "65ccd55cf5ebef6922a08eb48e9e8330799251b5b763a58b0a3fbc36f263a3fb");
const source = JSON.parse(raw), texts = await json("story-text.json");
assert.equal(texts.length, 20);
const host = session("continuous-slice");
const turns = texts.map((text, index) => {
    const receipt = source.turns[index], ctx = host.append(text), v = ctx.result.visual;
    const { review } = reviewVisualHistory(ctx);
    assert.deepEqual([ctx.revision, sha(text), v?.sceneId ?? null, v?.visualVersion ?? null, v?.people.length ?? null, review.verdict, review.reason], [receipt.revision, receipt.narrativeSha256, receipt.scene, receipt.visualVersion, receipt.people, receipt.verdict, receipt.reason]);
    const fieldSources = Object.fromEntries(Object.entries(ctx.audit.fields).filter(([, field]) => field.precision === "complete" && field.admitted !== false).map(([key, field]) => {
        const spans = field.spans.map(i => { const { start, end } = ctx.audit.evidence[i]; return [start, end]; });
        return [key, { spans, priorRevision: field.confirmedFrom?.revision ?? null }];
    }));
    return { ...receipt, text, fieldSources, action: ctx.history.at(-1).action, name: v ? ctx.result.scene.name : null,
        area: v ? ctx.result.scene.parentSceneId : null, roster: v?.people ?? null, features: v?.features ?? null,
        time: v?.timeOfDay ?? null, light: v?.lighting ?? null, position: v?.viewpoint ?? null, direction: v?.perspective ?? null };
});
const reviews = source.reviews.map(r => {
    const call = source.traffic.find(t => t.revision === r.sourceRevision);
    assert.ok(call && turns[call.revision - 1].fakeSends === 1);
    assert.ok(r.reviewedDuring >= call.revision && r.from === "pending");
    assert.equal(r.sha256, sha(call.operation === "generate" ? initialPng : editedPng));
    return { ...r, operation: call.operation, reference: call.reference, scene: turns[call.revision - 1].scene };
});
for (const t of turns.filter(t => t.displaySha256)) {
    const a = reviews.find(a => a.sha256 === t.displaySha256 && a.to === "accepted" && a.reviewedDuring <= t.revision);
    assert.ok(a && a.scene === t.scene && t.verdict === "eligible");
    assert.equal(t.visualVersion, turns[a.sourceRevision - 1].visualVersion);
}
const archive = await json(evidence + "YJ-02-image-runs.json");
const legacy = await json(evidence + "YJ-02/fixture-v1.json");
const assets = new Map();
for (const call of archive.calls) {
    assert.ok(["I0", "I1", "I2"].includes(call.id));
    assert.equal(call.visualReview.decision, "accepted");
    const bytes = await read(evidence + "YJ-02/" + call.id + ".png");
    assert.equal(sha(bytes), call.output.sha256);
    assets.set(call.id, { bytes, sha256: sha(bytes) });
}
const stages = legacy.stages.map(([stage, text]) => {
    const call = archive.calls.find(c => c.stage === stage), reuse = archive.reuse.find(c => c.stage === stage);
    assert.ok(Boolean(call) !== Boolean(reuse));
    const id = call?.id ?? reuse.file.split("/").at(-1).replace(".png", "");
    assert.equal(assets.get(id).sha256, call?.output.sha256 ?? reuse.sha256);
    return { stage, text, id, reuse: !!reuse, people: archive.calls.find(c => c.id === id).visualReview.people };
});
const fixture = { schemaVersion: "offline-preview/1", sourceCommit: "c5f75abf53d278a2f00e0ee9581bbc45ec224141", sourceSha, turns, reviews, stages,
    mock: { sha256: sha(initialPng), url: "data:image/png;base64," + initialPng.toString("base64") } };
const template = (await read("page.html")).toString();
const css = (await read("../ui-shell/yingjie.css")).toString() + "\n" + await read("preview.css");
const js = (await read("preview.js")).toString();
const html = template.replace("/* STYLES */", () => css).replace("/* FIXTURE */", () => JSON.stringify(fixture).replaceAll("<", "\\u003c")).replace("/* PLAYER */", () => js);
await mkdir(new URL("media/", out), { recursive: true });
for (const [id, { bytes }] of assets)
    await writeFile(new URL("media/" + id + ".png", out), bytes);
await writeFile(new URL("index.html", out), html);
console.log(JSON.stringify({ entry: "dist/index.html", htmlSha256: sha(html), fixtureSha256: sha(JSON.stringify(fixture)), sourceSha, turns: turns.length,
    media: Object.fromEntries([...assets].map(([id, a]) => [id, a.sha256])) }));
