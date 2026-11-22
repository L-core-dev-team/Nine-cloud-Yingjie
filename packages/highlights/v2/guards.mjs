import assert from "node:assert/strict";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlightsV2 } from "./replay.mjs";
assert.equal(process.permission?.has("net"), false);
const checks = [];
function test(label, fn) {
    try {
        fn();
        checks.push({ label, pass: true });
    }
    catch (e) {
        checks.push({ label, pass: false, detail: String(e).slice(0, 400) });
    }
}
function context(texts, label = "guards") {
    const host = session(label);
    for (const t of texts)
        host.append(t);
    const ctx = { ...host.context(), replayOnly: true };
    ctx.planningSnapshots = ctx.receipts.map(({ source, narrativeSha256 }) => ({ scope: ctx.scope,
        sourceKey: source.key, revision: source.revision, narrativeSha256, enabled: true, planningAllowed: true, task: "idle", operation: "generate" }));
    return ctx;
}
const replay = (texts) => replayHighlightsV2(context(texts));
const title = "旧桥的使用权原归河伯。", signed = "河伯签署了向柳社移交旧桥的使用权的文书。", effective = "登记生效，旧桥的使用权自今日起归柳社。";
const grant = [title, signed, effective];
test("title plus matching executed and effective right", () => assert.deepEqual(replay(grant).candidates[0].roles, { actor: "河伯", asset: "旧桥", right: "使用权", before: "河伯", after: "柳社" }));
for (const [label, texts] of Object.entries({
    "receipt without prior title": [signed, effective], "no actual disposition": [title, effective], "no effective outcome": [title, signed],
    "custody only": [title, "河伯把权证交给柳社代为保管。", effective],
    "document forged": [title, signed, "关于旧桥的转让书系伪造。", effective],
    "void signature": [title, signed, "河伯签署的向柳社移交旧桥的使用权的文书已作废。", effective],
    "merely planned": [title, "如果" + signed, effective], "quoted signature": [title, "“" + signed + "”", effective],
    "cancellation": [title, signed, "河伯撤销了向柳社移交旧桥的使用权的申请。", effective],
    "redirect needs new signature": [title, signed, "河伯改为向山社移交旧桥的使用权。", effective.replace("柳社", "山社")],
    "nonowner signer": [title, signed.replace("河伯", "地伯"), effective],
    "different instrument": [title, signed, effective.replace("旧桥", "新桥")],
    "wrong right": [title, signed, effective.replace("使用权", "控制权")],
    "wrong beneficiary": [title, signed, effective.replace("柳社", "柳家")],
    "name collision": [title, signed, "另一个名叫河伯的人路过了木桥。", effective],
    "relinquishment alone": ["柏安一直想保住商船。", "柏安把自己的名字从分红簿上划去，船契落在客商掌心。"],
    "instrument temporarily held": ["柏安一直想保住商船。", "柏安暂交船契给客商。自此商船由客商共有。"],
    "wrong collective beneficiary": ["柏安一直想保住商船。", "柏安把自己的名字从分红簿上划去，船契落在掌柜掌心。自此商船由客商共有。"]
}))
    test(label, () => assert.equal(replay(texts).candidates.length, 0));
test("explicit alias binds a signer", () => assert.equal(replay([title, "河伯又名石翁。", signed.replace("河伯", "石翁"), effective]).candidates.length, 1));
test("redirect has new beneficiary, new document and result", () => assert.equal(replay([title, signed, "河伯改为向山社移交旧桥的使用权。", signed.replace("柳社", "山社"), effective.replace("柳社", "山社")]).candidates[0].roles.after, "山社"));
test("alternate collective transaction with distinct actors/assets", () => assert.equal(replay(["柏安一直想保住商船。", "柏安把自己的名字从分红簿上划去，船契落在客商掌心。自此商船由客商共有。"]).candidates[0].roles.after, "客商"));
const waiting = n => n + "答应沈安回到听雨酒馆。沈安一直在听雨酒馆等" + n + "归来。";
const survey = "此时我身在琥洲的听雨酒馆。我在廊下朝北看去。殿中除沈安、宋明、药师再无旁人。我看清了这里的铜柱与长桌。此时是正午。日光照亮眼前。";
const arrival = n => n + "走了进来，原来的人都还在，除此再无旁人。观察位置、朝向、结构、时段和光照均未改变。";
const two = [waiting("林青"), waiting("顾宁"), survey, arrival("林青"), arrival("顾宁"), survey, arrival("顾宁")];
const natural = replay(two);
test("two adjacent independent witnessed arrivals; same payoff retold", () => {
    assert.deepEqual(natural.rounds.slice(3).map(r => r.cadence.action), ["director-review", "director-review", "text-only", "suppress-duplicate"]);
    assert.equal(new Set(natural.candidates.map(c => c.arc)).size, 2);
});
test("canceled meeting cannot pay off", () => assert.equal(replay([waiting("林青"), "林青取消了与沈安在听雨酒馆见面的约定。", survey, arrival("林青")]).candidates.length, 0));
test("ambiguous destination cannot be bound retrospectively", () => assert.equal(replay([waiting("林青").replaceAll("听雨酒馆", "候星庭"), survey.replace("琥洲的听雨酒馆", "雪原的候星庭"), arrival("林青")]).candidates.length, 0));
test("another session cannot use a previous session's promise", () => {
    const ctx = context([survey, arrival("林青")], "other");
    assert.equal(replayHighlightsV2(ctx).candidates.length, 0);
    ctx.receipts[0] = context([survey], "original").receipts[0];
    assert.throws(() => replayHighlightsV2(ctx));
});
for (const [label, mod] of Object.entries({
    disabled: ctx => { ctx.enabled = false; }, missing: ctx => { delete ctx.planningSnapshots; },
    unknown: ctx => { ctx.planningSnapshots.at(-1).task = "unknown"; }, revoked: ctx => { ctx.planningSnapshots.at(-1).planningAllowed = false; },
    invalidReference: ctx => { Object.assign(ctx.planningSnapshots.at(-1), { operation: "edit", reference: { active: false } }); },
    foreignRevision: ctx => { ctx.planningSnapshots.at(-1).revision = 1; }
})) {
    test("director held: " + label, () => {
        const ctx = context([waiting("林青"), survey, arrival("林青")]);
        mod(ctx);
        const r = replayHighlightsV2(ctx);
        assert.equal(r.candidates.length, 1);
        assert.equal(r.rounds.at(-1).cadence.action, "text-only");
    });
}
for (const [label, change] of Object.entries({
    unauthorized: c => { c.authorized = false; }, production: c => { c.replayOnly = false; }, wrongHash: c => { c.receipts[0].narrativeSha256 = "0".repeat(64); },
    order: c => { c.history.reverse(); }, forgedAudit: c => { c.audit = {}; }
}))
    test("source rejected: " + label, () => { const c = context(grant); change(c); assert.throws(() => replayHighlightsV2(c)); });
test("user action cannot supply a missing disposition", () => { const c = context([title, effective]); c.history[0].action = signed; assert.equal(replayHighlightsV2(c).candidates.length, 0); });
console.log(JSON.stringify({ checks, adjacentExample: natural.rounds.map(r => ({ revision: r.revision, kind: r.kind, cadence: r.cadence })), networkPermission: false }));
if (checks.some(v => !v.pass))
    process.exitCode = 1;
