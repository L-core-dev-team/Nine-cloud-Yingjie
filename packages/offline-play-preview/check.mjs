import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
assert.equal(process.permission?.has("net"), false, "run with Node --permission");
const read = name => readFile(new URL(name, import.meta.url));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const html = (await read("dist/index.html")).toString(), source = JSON.parse(await read("../../docs/reports/evidence/YJ-P03-S2/story-slice.json"));
const fixtureText = html.match(/<script type="application\/json" id="record">([\s\S]+?)<\/script>/)[1];
const fixture = JSON.parse(fixtureText), script = html.match(/<script>([\s\S]+?)<\/script>/)[1];
assert.match(html, /connect-src 'none'/);
assert.doesNotMatch(html, /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|serviceWorker|localStorage|sessionStorage|document\.cookie)\b|https?:\/\/|[A-Z]:\\Users\\|sk-[\w-]{16,}/i);
assert.doesNotMatch(html, /<(?:iframe|form|object|embed|link)\b|<script[^>]+src=/i);
assert.equal(fixture.sourceSha, hash(await read("../../docs/reports/evidence/YJ-P03-S2/story-slice.json")));
assert.equal(hash(Buffer.from(fixture.mock.url.split(",")[1], "base64")), source.reviews[0].sha256);
const old = JSON.parse(await read("../../docs/reports/evidence/YJ-02-image-runs.json"));
for (const c of old.calls)
    assert.equal(hash(await read("dist/media/" + c.id + ".png")), c.output.sha256);
// Run the shipped classic script against a minimal DOM event harness. This checks the
// generated page/handlers; layout, native keyboard and image decoding need a browser.
class Element {
    children = [];
    dataset = {};
    attributes = new Map();
    hidden = false;
    open = false;
    disabled = false;
    textContent = "";
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    hasAttribute(k) { return this.attributes.has(k); }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    removeAttribute(k) { this.attributes.delete(k); }
    set src(v) { this.setAttribute("src", v); }
    get src() { return this.attributes.get("src"); }
    click() { assert.ok(!this.disabled); this.onclick(); }
    select(value) { this.value = String(value); this.onchange({ target: this }); }
}
const nodes = new Map([...html.matchAll(/<[\w-]+\b[^>]*\sid="([^"]+)"[^>]*>/g)].map(([tag, id]) => {
    const el = new Element();
    el.hidden = /\shidden\b/.test(tag);
    return [id, el];
}));
function el(id) { assert.ok(nodes.has(id), id); return nodes.get(id); }
el("record").textContent = fixtureText;
const document = { getElementById: el, createElement: () => new Element() };
class Option {
    constructor(text, value) { this.textContent = text; this.value = value; }
}
runInNewContext(script, { document, Option }, { timeout: 2000 });
const revision = () => Number(el("folio").textContent);
const status = () => el("visualBox").dataset.state;
const jump = n => el("turnSelect").select(n);
const expected = ["accepted", "reuse", "unknown", "unscheduled", "hidden", "hidden", "reuse", "unknown", "unknown", "reuse", "unscheduled", "waiting", "unknown", "rejected", "unscheduled", "unscheduled", "unscheduled", "hidden", "hidden", "unscheduled"];
const turns = [];
for (const [i, row] of source.turns.entries()) {
    if (i)
        el("next").click();
    assert.equal(revision(), row.revision);
    assert.equal(status(), expected[i]);
    assert.equal(hash(el("prose").textContent), row.narrativeSha256);
    assert.equal(!el("sample").hidden, Boolean(row.displaySha256));
    assert.equal(el("proof").children.some(p => p.textContent.includes("(" + row.verdict + ")")), true);
    turns.push({ revision: revision(), state: status(), display: !el("sample").hidden, scene: row.scene });
}
const checks = [];
function test(name, fn) { fn(); checks.push(name); }
test("last next disabled, previous works", () => { assert.ok(el("next").disabled); el("prev").click(); assert.equal(revision(), 19); });
test("reset restores first and bounds", () => { el("reset").click(); assert.equal(revision(), 1); assert.ok(el("prev").disabled); });
test("saved action and revision buttons jump", () => { jump(10); el("steps").children[11].click(); assert.equal(revision(), 12); });
test("location filter restricts next/previous to that place", () => { el("placeFilter").select("reed"); assert.equal(revision(), 4); el("next").click(); assert.equal(revision(), 5); el("next").click(); assert.ok(el("next").disabled); });
test("unknown location has no old image or roster", () => { el("placeFilter").select("?"); assert.equal(status(), "unknown"); assert.ok(el("sample").hidden); assert.match(el("facts").children[0].children[1].textContent, /未确认/); });
test("pending image stays hidden before acceptance", () => { el("reset").click(); el("phase").select("pending"); assert.equal(status(), "pending-review"); assert.ok(el("sample").hidden); assert.ok(!el("events").children.some(x => x.textContent.includes("审阅已接受"))); el("phase").select("final"); assert.equal(status(), "accepted"); });
test("image off preserves text navigation, history and review", () => { el("toggle").click(); el("next").click(); assert.equal(revision(), 2); assert.equal(status(), "disabled"); assert.ok(el("sample").hidden); el("toggle").click(); assert.equal(status(), "reuse"); });
test("reuse has no new sends", () => { for (const n of [2, 7, 10]) {
    jump(n);
    assert.equal(status(), "reuse");
    assert.equal(source.turns[n - 1].fakeSends, 0);
} });
test("edit without separate sending authorization shows no original", () => { jump(11); assert.equal(status(), "unscheduled"); assert.ok(el("sample").hidden); });
test("edit waits without revealing future history", () => { jump(12); assert.equal(status(), "waiting"); assert.ok(!el("events").children.some(x => x.textContent.includes("已拒绝"))); });
test("late pending and rejected belong to original scene", () => { jump(14); el("phase").select("pending"); assert.equal(status(), "pending-review"); el("phase").select("final"); assert.equal(status(), "rejected"); assert.match(el("why").textContent, /修订 12/); assert.ok(el("sample").hidden); assert.equal(el("placeTitle").textContent, "候星庭"); });
test("rejected result cannot appear on revisit", () => { jump(15); assert.ok(el("sample").hidden); assert.equal(source.turns[14].rejectedOriginalExcluded, true); });
test("unexplained lighting hides picture and fixed dialogue cannot revive it", () => { jump(18); el("next").click(); assert.equal(status(), "hidden"); assert.ok(el("sample").hidden); });
test("corrupt mock shows placeholder", () => { el("reset").click(); el("sample").onerror(); assert.equal(status(), "file-missing"); assert.ok(el("sample").hidden); });
test("historical archive is separate; missing media stays blank", () => { el("archiveTab").click(); assert.ok(el("story").hidden); assert.equal(el("legacyImage").src, "media/I0.png"); el("archiveStage").select(4); assert.equal(el("legacyImage").src, "media/I2.png"); el("legacyImage").onerror(); assert.ok(el("legacyImage").hidden && !el("archiveError").hidden); el("storyTab").click(); assert.ok(el("archive").hidden); });
test("reset clears panels, filter, switch and recovers original", () => { el("evidence").open = el("history").open = true; el("toggle").click(); el("reset").click(); assert.ok(!el("evidence").open && !el("history").open); assert.equal(el("placeFilter").value, "*"); assert.equal(status(), "accepted"); });
console.log(JSON.stringify({ method: "built HTML + classic script / Node DOM harness", networkPermission: false, htmlSha256: hash(html), fixtureSha256: hash(fixtureText), sourceSha: fixture.sourceSha, archiveOriginals: 3, turns, checks, externalRequests: 0 }, null, 2));
