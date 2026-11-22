"use strict";
const fixture = JSON.parse(document.getElementById("record").textContent);
const byId = id => document.getElementById(id);
const showText = (id, text) => { byId(id).textContent = text; };
const options = (select, items) => select.replaceChildren(...items.map(([value, text]) => new Option(text, value)));
const lines = (id, items) => byId(id).replaceChildren(...items.map(text => {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
}));
const { turns, reviews, stages } = fixture;
const state = { revision: 1, filter: "*", enabled: true, phase: "final", broken: false };
const labels = { eligible: "可入画", "needs-review": "需复核", conflict: "事实冲突", "not-ready": "证据不足" };
const reasons = { consistent: "当前可见事实相互一致。", "temporal-lighting-ambiguity": "时段与光照的组合缺少当前剧情解释。", "incomplete-evidence": "当前调查不足以确认整幅画面。" };
const choices = { generate: "生成候选", edit: "参考编辑候选", reuse: "复用", hide: "隐藏" };
const unknownPlace = "地点待核实";
const selected = () => turns[state.revision - 1];
const filtered = () => turns.filter(t => state.filter === "*" || (t.scene ?? "?") === state.filter);
const atReview = t => reviews.find(r => r.reviewedDuring === t.revision);
function imageState(t) {
    if (!state.enabled)
        return ["disabled", "生图已关", "文字与历史记录仍可继续查看。"];
    const event = atReview(t);
    if (event && state.phase === "pending") {
        return ["pending-review", "原件待审", "修订 " + event.sourceRevision + " 的模拟原件已返回，等待本次记录中的审阅。"];
    }
    if (t.displaySha256) {
        const asset = reviews.find(r => r.sha256 === t.displaySha256 && r.scene === t.scene && r.reviewedDuring <= t.revision && r.to === "accepted");
        if (!asset || asset.sha256 !== fixture.mock.sha256 || state.broken)
            return ["file-missing", "原件不可用", "原件缺失、损坏或引用不符，已隐藏画面。"];
        return [t.choice === "reuse" ? "reuse" : "accepted", t.choice === "reuse" ? "复用已审原件" : "模拟首图已接受",
            t.choice === "reuse" ? "当前画面与首回合一致，读取同一格式测试件，本回合新增发送 0 次。" : "模拟生成 → 原件待审 → 已接受。空白 PNG 只验证格式，不描绘酒馆。"];
    }
    if (event?.to === "rejected")
        return ["rejected", "迟到原件已拒审", "修订 " + event.sourceRevision + " 的酒馆编辑在本回合返回，归原请求。此地点没有已接受的对应画面。"];
    if (t.choice === "hide")
        return [t.fieldReady ? "hidden" : "unknown", t.fieldReady ? "旧图已隐藏" : "现场未确认 · 已隐藏", reasons[t.reason]];
    if (t.fakeSends)
        return ["waiting", "已记录模拟编辑", "参考来自修订 1 已接受的原件。这里回放发送时的状态，文字可继续。"];
    return ["unscheduled", "暂无经审阅的对应画面", choices[t.choice] + "已记录，本回合未分派新请求。"];
}
function renderHistory(t) {
    const entries = [];
    for (const a of reviews) {
        if (a.sourceRevision > t.revision)
            continue;
        const prefix = "修订 " + a.sourceRevision + " · " + turns[a.sourceRevision - 1].name + " · ";
        entries.push(prefix + (a.operation === "edit" ? "模拟参考编辑（修订 1 已审原件）" : "模拟生成格式测试件"));
        if (a.reviewedDuring <= t.revision) {
            entries.push("修订 " + a.reviewedDuring + " 收到原件 · 待审" + (a.reviewedDuring > a.sourceRevision ? " · 迟到，归属修订 " + a.sourceRevision : ""));
            if (a.reviewedDuring !== t.revision || state.phase === "final")
                entries.push(prefix + (a.to === "accepted" ? "模拟审阅已接受" : "模拟审阅已拒绝，禁止展示及参考"));
        }
    }
    lines("events", entries);
}
function render() {
    const t = selected(), subset = filtered(), pos = subset.indexOf(t);
    showText("placeTitle", t.name ?? unknownPlace);
    showText("placeMeta", (t.area ?? "未定位") + "　/　" + (t.scene ?? "尚无可信地点身份"));
    showText("folio", String(t.revision).padStart(2, "0"));
    showText("timeTag", t.time ?? "时段未确认");
    showText("prose", t.text);
    const facts = [["在场人物", t.roster ? t.roster.length + " 人 · " + t.roster.join("、") : "完整名单未确认"], ["观察视角", t.position ? [t.position, t.direction].join(" · ") : "未确认"], ["场景结构", t.features?.join("、") ?? "未确认"], ["时段与光照", t.time ? t.time + " · " + t.light : "未确认"]];
    byId("facts").replaceChildren(...facts.map(([label, value]) => {
        const div = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
        div.className = "fact";
        dt.textContent = label;
        dd.textContent = value;
        div.append(dt, dd);
        return div;
    }));
    const names = { place: "地点", viewpoint: "位置", perspective: "朝向", people: "名单", features: "结构", timeOfDay: "时段", lighting: "光照" };
    const sources = Object.entries(t.fieldSources).map(([key, field]) => {
        const quotes = field.spans.map(([start, end]) => "「" + t.text.slice(start, end) + "」").join("、");
        const inherited = field.priorRevision ? "核对自修订 " + field.priorRevision : "";
        return names[key] + "　" + [quotes, inherited].filter(Boolean).join(" · ");
    });
    lines("proof", ["S2 已保存合成正文 · 修订 " + t.revision + " · 固定行动「" + t.action + "」",
        "字面字段" + (t.fieldReady ? "完整" : "不足") + " · 图片资格 " + labels[t.verdict] + " (" + t.verdict + ") · " + (t.visualVersion ?? "无视觉版本"),
        reasons[t.reason] + " 判定 " + t.reason, ...sources, "正文 SHA-256　" + t.narrativeSha256]);
    const [code, title, why] = imageState(t), visible = ["accepted", "reuse"].includes(code);
    byId("visualBox").dataset.state = code;
    byId("sample").hidden = !visible;
    if (visible && !byId("sample").hasAttribute("src"))
        byId("sample").src = fixture.mock.url;
    showText("plateLabel", visible ? "PNG 格式测试件 · 非剧情实际出图" : title);
    showText("imgStatus", title);
    showText("imgOrigin", visible ? "原件 · 修订 01" : (t.visualVersion ?? "无当前画面"));
    showText("why", why);
    byId("toggle").setAttribute("aria-checked", String(state.enabled));
    showText("toggleText", state.enabled ? "生图已开" : "生图已关");
    byId("phaseWrap").hidden = !atReview(t) || !state.enabled;
    byId("phase").value = state.phase;
    byId("prev").disabled = pos <= 0;
    byId("next").disabled = pos === subset.length - 1;
    options(byId("turnSelect"), subset.map(row => [row.revision, String(row.revision).padStart(2, "0") + " · " + row.action + " · " + row.text.slice(0, 12) + "…"]));
    byId("turnSelect").value = String(t.revision);
    byId("placeFilter").value = state.filter;
    // Keep the active keyboard button when only the selected revision changes.
    const steps = byId("steps");
    if (steps.dataset.filter !== state.filter) {
        steps.replaceChildren(...subset.map(row => {
            const b = document.createElement("button");
            b.textContent = String(row.revision).padStart(2, "0");
            b.dataset.rev = row.revision;
            b.setAttribute("aria-label", "修订 " + row.revision + "，" + (row.name ?? unknownPlace));
            b.onclick = () => go(row.revision);
            return b;
        }));
        steps.dataset.filter = state.filter;
    }
    for (const b of steps.children) {
        if (+b.dataset.rev === t.revision)
            b.setAttribute("aria-current", "step");
        else
            b.removeAttribute("aria-current");
    }
    renderHistory(t);
    showText("announce", "第 " + t.revision + " 回合，" + (t.name ?? unknownPlace) + "，" + title);
}
function go(revision) { state.revision = revision; state.phase = "final"; render(); }
function move(delta) { const rows = filtered(), next = rows[rows.indexOf(selected()) + delta]; if (next)
    go(next.revision); }
function archive() {
    const s = stages[Number(byId("archiveStage").value)], img = byId("legacyImage");
    byId("archiveError").hidden = true;
    img.hidden = false;
    img.alt = "YJ-02 已审旧图 " + s.id + "，" + s.people + " 人";
    img.src = "media/" + s.id + ".png";
    showText("archiveTitle", s.text);
    showText("archiveCaption", s.id + " · " + s.people + " 人 · " + (s.reuse ? "复用旧原件" : "原工具实验已审原件") + " · 独立于本次 20 回合");
}
function mode(isArchive) {
    byId("archive").hidden = !isArchive;
    byId("story").hidden = isArchive;
    byId("storyTab").setAttribute("aria-pressed", String(!isArchive));
    byId("archiveTab").setAttribute("aria-pressed", String(isArchive));
    if (isArchive)
        archive();
}
options(byId("placeFilter"), [["*", "全部地点"], ...new Map(turns.filter(t => t.scene).map(t => [t.scene, t.area + " · " + t.name])), ["?", unknownPlace]]);
options(byId("archiveStage"), stages.map((s, i) => [i, s.stage + " · " + s.id + (s.reuse ? " 复用" : "")]));
byId("next").onclick = () => move(1);
byId("prev").onclick = () => move(-1);
byId("placeFilter").onchange = e => { state.filter = e.target.value; go(filtered()[0].revision); };
byId("turnSelect").onchange = e => go(Number(e.target.value));
byId("toggle").onclick = () => { state.enabled = !state.enabled; render(); };
byId("phase").onchange = e => { state.phase = e.target.value; render(); };
byId("reset").onclick = () => {
    Object.assign(state, { filter: "*", enabled: true, broken: false });
    byId("sample").removeAttribute("src");
    byId("history").open = false;
    byId("evidence").open = false;
    go(1);
};
byId("sample").onerror = () => { state.broken = true; render(); };
byId("legacyImage").onerror = () => { byId("legacyImage").hidden = true; byId("archiveError").hidden = false; };
byId("storyTab").onclick = () => mode(false);
byId("archiveTab").onclick = () => mode(true);
byId("archiveStage").onchange = archive;
byId("archiveStage").value = "0";
render();
