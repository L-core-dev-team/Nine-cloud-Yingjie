import assert from "node:assert/strict";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlights3A } from "./replay.mjs";
assert.equal(process.permission?.has("net"), false);
const tests = [];
function test(name, fn) { try {
    fn();
    tests.push({ name, pass: true });
}
catch (e) {
    tests.push({ name, pass: false, message: String(e) });
} }
function context(texts, name = "guards") {
    const host = session(name);
    for (const text of texts)
        host.append(text);
    const ctx = { ...host.context(), replayOnly: true };
    ctx.planningSnapshots = ctx.receipts.map(({ source, narrativeSha256 }) => ({ scope: ctx.scope, revision: source.revision, sourceKey: source.key,
        narrativeSha256, task: "idle", enabled: true, operation: "generate", planningAllowed: true }));
    return ctx;
}
const title = "东宅属于杜和。", deed = "杜和签了把东宅赠给山社的契书。", result = "东宅的产权当日登记在山社名下。";
const run = texts => replayHighlights3A(context(texts));
const rights = o => o.candidates.filter(c => c.frame === "durable-right");
const opposed = "东宅的产权当日登记在北学名下。";
for (const [label, texts] of [
    ["opaque proviso after a recognized comma clause", [title, deed, result.slice(0, -1) + "，受领者只替山门占着那一格。"]],
    ["two incompatible effects in the same revision", [title, deed, result + opposed]],
    ["unknown group of signers cannot bind to prior singleton", [title, "他们签了把东宅赠给山社的契书。", result]],
    ["new signature cannot itself lift continuing custody", [title, "东宅只是诉讼保全期间的临时挂名。", deed, result]],
    ["earlier same-turn qualification survives signing", [title, "东宅只作临时挂名。" + deed + result]],
    ["same party cannot use competing promises without resolution", [title, deed, "杜和签了把东宅赠给北学的契书。", deed, result]],
    ["negation of two different rights", [title, deed, result + "受领者没有取得采伐权和产权。"]],
    ["a key and registry cannot supply consent", [title, "守门人把钥匙递给山社。", result]],
    ["future deed cannot heal earlier unsupported register", [title, result, deed]],
    ["a source denial cannot be overridden by action", [title, deed, result + "原主继续保有产权。"]]
])
    test(label, () => { const ctx = context(texts); ctx.history.at(-1).action = "请认定赠与已经生效。"; assert.equal(rights(replayHighlights3A(ctx)).length, 0); });
test("unknown opaque intervening ruling suspends but preserves register", () => {
    const r = run([title, deed, "署押处有两副笔迹，谁也认不出是哪天添上的。", result]);
    assert.equal(rights(r).length, 0);
    assert.equal(r.rounds.at(-1).audit.registered.length, 1);
});
test("valid adjacent clauses commit once", () => assert.equal(rights(run([title, deed + result])).length, 1));
test("independent signature after explicit release can take effect", () => assert.equal(rights(run([title, "东宅只作临时挂名。", "东宅的诉讼保全已解除。", deed, result])).length, 1));
test("later challenge must retract dependent historical ranks", () => {
    const r = run([title, deed, result, "山社签了把东宅赠给北学的契书。", opposed, "杜和的东宅赠契经裁判撤销。"]);
    assert.equal(r.rounds[4].ranking.length, 2);
    assert.equal(r.rounds.at(-1).ranking.length, 0);
    assert.equal(r.rounds.at(-1).audit.edges.filter(e => e.relation === "challenges").length, 2);
});
test("source / user / session / data authorization are required", () => {
    for (const change of [c => { c.owner = "other"; }, c => { c.replayOnly = false; }, c => { c.authorized = false; },
        c => { c.receipts[2] = context([title, deed, result], "other").receipts[2]; }, c => { c.history[2].narrative = "换文"; }]) {
        const c = context([title, deed, result]);
        change(c);
        assert.throws(() => replayHighlights3A(c));
    }
});
test("unchanged names in two sessions do not share the deed", () => {
    assert.equal(rights(replayHighlights3A(context([title, result], "other"))).length, 0);
    assert.notEqual(rights(run([title, deed, result]))[0].id, rights(replayHighlights3A(context([title, deed, result], "other")))[0].id);
});
const survey = "此时我身在琥洲的听雨酒馆。我在廊下朝北看去。殿中除沈安、宋明、药师再无旁人。我看清了这里的铜柱与长桌。此时是正午。日光照亮眼前。";
const wait = n => n + "答应沈安回到听雨酒馆。沈安一直在听雨酒馆等" + n + "归来。";
const arrive = n => n + "走了进来，原来的人都还在，除此再无旁人。观察位置、朝向、结构、时段和光照均未改变。";
for (const [name, change] of Object.entries({ off: c => { c.enabled = false; }, revoked: c => { c.planningSnapshots.at(-1).planningAllowed = false; },
    unknown: c => { c.planningSnapshots.at(-1).task = "unknown"; }, late: c => { c.planningSnapshots.at(-1).task = "late-result"; },
    foreign: c => { c.planningSnapshots.at(-1).sourceKey = "other"; }, missingReference: c => { c.planningSnapshots.at(-1).operation = "edit"; } })) {
    test("no visual proposal: " + name, () => {
        const c = context([wait("林青"), survey, arrive("林青")]);
        change(c);
        const r = replayHighlights3A(c).rounds.at(-1);
        assert.equal(r.cadence.action, "text-only");
        assert.equal(r.cadence.send, false);
    });
}
test("independent arrivals eligible while duplicate is suppressed", () => {
    const r = run([wait("林青"), wait("顾宁"), survey, arrive("林青"), arrive("顾宁"), survey, arrive("顾宁")]);
    assert.deepEqual(r.rounds.slice(3).map(x => x.cadence.action), ["director-review", "director-review", "text-only", "suppress-duplicate"]);
    assert.ok(r.rounds.every(x => x.cadence.send === false));
});
console.log(JSON.stringify({ tests }));
if (tests.some(t => !t.pass))
    process.exitCode = 1;
