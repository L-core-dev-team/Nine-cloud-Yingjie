import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlights2R } from "./replay.mjs";
assert.equal(process.permission?.has("net"), false);
const tests = [], publicCases = [];
function check(label, fn) { try {
    fn();
    tests.push({ label, pass: true });
}
catch (e) {
    tests.push({ label, pass: false, detail: String(e) });
} }
function input(texts, name = "guard") {
    const h = session(name);
    for (const t of texts)
        h.append(t);
    const ctx = { ...h.context(), replayOnly: true };
    ctx.planningSnapshots = ctx.receipts.map(({ source, narrativeSha256 }) => ({ scope: ctx.scope, revision: source.revision, sourceKey: source.key, narrativeSha256, permission: "plan", enabled: true, planningAllowed: true, operation: "generate", task: "idle" }));
    return ctx;
}
const run = texts => replayHighlights2R(input(texts));
const history = readFileSync(new URL("../test/h2-locked.jsonl", import.meta.url), "utf8").trim().split("\n").map(JSON.parse);
for (const [name, r] of [["书屋", 2], ["渡税", 2], ["两次赴约-辛竹", 4], ["两次赴约-辛竹", 5]]) {
    const s = history.find(x => x.id === name), o = run(s.turns.slice(0, r).map(v => v.text)), row = o.rounds.at(-1);
    publicCases.push({ name, r, original: s.turns[r - 1].expected, actual: row, candidates: o.candidates.filter(c => c.revision === r) });
    check(name + "-" + r, () => assert.equal(row.state, name.startsWith("两次") ? "unknown" : "confirmed-peak"));
}
const title = "老画阁属于钟纯。", gift = "钟纯当众签了赠画阁的契，产权当日登记在画会名下。";
const stream = "陆妍掌着井费的收入。", waiver = "她把自己的分红注销，往后每笔井费都直接进了公塾公账。";
for (const [label, rows, n] of [
    ["asset abbreviation, matching deed and registration", [title, gift], 1], ["without title", [gift], 0],
    ["competing same abbreviation", [title, "新画阁属于岑芳。", gift], 0], ["custody only", [title, "钟纯把画阁的房契暂交画会保管。产权当日登记在画会名下。"], 0],
    ["different adjacent document", [title, "钟纯当众签了赠画阁的契。另一座园子也开过门。产权当日登记在画会名下。"], 0],
    ["later title cannot repair past event", [gift, title], 0], ["pronoun with established single topic", [stream, waiver], 1],
    ["unresolved pronoun after another participant", [stream, "阮迟来到柜前。", waiver], 0],
    ["two participants in previous text", ["陆妍掌着井费的收入。林铃也有分红。", waiver], 0],
    ["coordinated subjects cannot be a singular antecedent", ["陆妍和林铃掌着井费的收入。", waiver], 0],
    ["wrong recurring asset", [stream, waiver.replace("井费", "市租")], 0], ["putative disposition", [title, "如果" + gift], 0],
    ["correction in same turn", [title, gift + "登记有误。"], 0],
    ["signature alone", [title, "钟纯签了把画阁赠给画会的契书。"], 0],
    ["revoked then effect", [title, "钟纯签了把画阁赠给画会的契书。", "钟纯撤回画阁的赠契。", "画阁的产权当日登记在画会名下。"], 0],
    ["different named beneficiary", [title, "钟纯签了把画阁赠给画会的契书。", "画阁的产权当日登记在山学名下。"], 0],
    ["object given in another scope cannot satisfy a vow", [title, "钟纯把画阁的钥匙送给画会。", "画阁的产权当日登记在画会名下。"], 0],
    ["explicit social repair", ["苗冰与顾荷断绝了往来。", "苗冰当面豁免顾荷的旧债。从那日起两家恢复往来。"], 1],
    ["unrelated relationship", ["苗冰与虞容断绝了往来。", "苗冰当面豁免顾荷的旧债。从那日起两家恢复往来。"], 0],
])
    check(label, () => assert.equal(run(rows).candidates.length, n));
const a = input([title, gift], "alpha"), b = input([title, gift], "beta");
check("separate sessions separate IDs", () => assert.notEqual(replayHighlights2R(a).candidates[0].id, replayHighlights2R(b).candidates[0].id));
for (const [name, edit] of Object.entries({ crossSession: c => { c.receipts[0] = b.receipts[0]; }, crossOwner: c => { c.owner = "other"; }, noAuthorization: c => { c.authorized = false; }, production: c => { c.replayOnly = false; }, sourceMismatch: c => { c.history[1].narrative = "无此事。"; } })) {
    check(name, () => { const c = input([title, gift], "alpha"); edit(c); assert.throws(() => replayHighlights2R(c)); });
}
const survey = "此时我身在琥洲的听雨酒馆。我在廊下朝北看去。殿中除沈安、宋明、药师再无旁人。我看清了这里的铜柱与长桌。此时是正午。日光照亮眼前。";
const wait = n => n + "答应沈安回到听雨酒馆。沈安一直在听雨酒馆等" + n + "归来。";
const arrive = n => n + "走了进来，原来的人都还在，除此再无旁人。观察位置、朝向、结构、时段和光照均未改变。";
const adjacent = [wait("林青"), wait("顾宁"), survey, arrive("林青"), arrive("顾宁"), survey, arrive("林青")];
check("two warranted adjacent reviews, one old payoff suppressed", () => assert.deepEqual(run(adjacent).rounds.slice(3).map(r => r.cadence.action), ["director-review", "director-review", "text-only", "suppress-duplicate"]));
for (const [label, edit] of Object.entries({ disabled: c => { c.enabled = false; }, revoked: c => { c.planningSnapshots.at(-1).planningAllowed = false; }, unknown: c => { c.planningSnapshots.at(-1).task = "unknown"; }, editDenied: c => { c.planningSnapshots.at(-1).operation = "edit"; } })) {
    check(label, () => {
        const c = input([wait("林青"), survey, arrive("林青")]);
        edit(c);
        const r = replayHighlights2R(c).rounds.at(-1);
        assert.equal(r.state, "confirmed-peak");
        assert.equal(r.cadence.action, "text-only");
        assert.equal(r.cadence.send, false);
    });
}
console.log(JSON.stringify({ tests, publicCases }));
if (tests.some(t => !t.pass))
    process.exitCode = 1;
