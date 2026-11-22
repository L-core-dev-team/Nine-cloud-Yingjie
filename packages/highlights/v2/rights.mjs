// A recorded intention, signature, or possession of paper cannot change title by itself.
const name = "[\\p{Script=Han}]{1,12}?";
const who = "(?<actor>" + name + ")";
const whom = "(?<recipient>" + name + ")";
const asset = "(?<asset>" + name + ")";
const right = "(?<right>所有权|使用权|控制权|管理权|开采权|居住权|经营权|继承权|收益权|分配权)";
const subject = asset + "的" + right;
const frames = [
    ["title", who + "原本持有" + subject], ["title", subject + "原归" + who], ["title", asset + "属于" + who],
    ["promise", who + "与" + whom + "约定移交" + subject], ["promise", who + "提交了将" + subject + "转给" + whom + "的申请"],
    ["signed", who + "签署了向" + whom + "移交" + subject + "的文书"], ["signed", who + "在移交" + subject + "给" + whom + "的文书上署名"],
    ["signed", "由" + who + "亲笔签署：将" + subject + "交给" + whom],
    ["cancel", who + "撤销了向" + whom + "移交" + subject + "的申请"],
    ["void", who + "签署的向" + whom + "移交" + subject + "的文书已作废"],
    ["effective", "自今日起，" + subject + "正式归" + whom], ["effective", "登记生效，" + subject + "自今日起归" + whom],
    ["restated", "现行登记仍是" + subject + "归" + whom],
    ["homonym", "另一个名叫" + who + "的人路过了" + asset], ["identify", "经身份核验，刚才署名的是原权利人" + who],
    ["alias", who + "又名" + whom], ["redirect", who + "改为向" + whom + "移交" + subject],
    ["renounce", who + "把自己的名字从(?<ledger>[\\p{Script=Han}]{1,8}(?:册|簿))上划去"],
    ["delivery", "(?<instrument>[\\p{Script=Han}]{1,6}(?:契|券|印))落在" + whom + "掌心"],
    ["common", "自此" + asset + "由" + whom + "共有"],
    ["revoke-meeting", who + "取消了与" + whom + "在(?<place>" + name + ")见面的约定"],
    ["revoke-meeting", who + "撤回了向" + whom + "作出的回到(?<place>" + name + ")的承诺"]
].map(([kind, pattern]) => [kind, new RegExp("^" + pattern + "$", "u")]);
const uncertain = /[“”「」『』"‘’]|梦见|梦里|听说|据说|传闻|有人宣称|据传|假如|倘若|如果|玩笑|反话|排演|想起|回忆|伪造|误登|登记错误|未生效|尚未生效|待生效|暂借|代为保管|只.{0,6}借|暂交|草案|已作废|已经作废|并未|并非属实/u;
const vague = new Set(["他", "她", "他们", "她们", "其", "对方", "此人", "那个人", "前者", "后者"]);
export function readRights(row, source, digest) {
    const text = row.narrative, events = [];
    const emit = (kind, roles, start, quote, confirmed = true, why = null) => events.push({
        id: source.revision + "#" + start, kind, roles, confirmed, known: "saved-narrative", uncertainty: why,
        evidence: { revision: source.revision, sourceKey: source.key, sha256: digest, start, end: start + quote.length, quote }
    });
    const voided = frames.find(([k]) => k === "void")[1].exec(text.replace(/[。]$/u, ""));
    if (voided && !/[“”「」『』"‘’]|听说|据说|假如|如果|梦见|传闻|假设|据传|回忆|想起/u.test(text)) {
        emit("void", { ...voided.groups }, 0, voided[0]);
        return events;
    }
    if (uncertain.test(text)) {
        emit("unverified", {}, 0, text, false, "nonactual-disputed-or-custody");
        return events;
    }
    for (const sentence of text.matchAll(/[^。！？!?；;\n]+/gu)) {
        // Certain dispositions describe two acts within one sentence. Keep their exact offsets.
        const full = sentence[0].trim(), base = sentence.index + sentence[0].indexOf(full);
        const parse = (s, start) => {
            for (const [kind, pattern] of frames) {
                const m = pattern.exec(s);
                if (!m)
                    continue;
                const roles = { ...m.groups };
                const clear = ![roles.actor, roles.recipient].some(x => vague.has(x));
                emit(kind, roles, start, s, clear, clear ? null : "unresolved-person");
                return true;
            }
            return false;
        };
        if (!parse(full, base)) {
            const halves = [...full.matchAll(/[^，]+/gu)];
            if (halves.length === 2 && frames.find(([k]) => k === "renounce")[1].test(halves[0][0]) &&
                frames.find(([k]) => k === "delivery")[1].test(halves[1][0])) {
                for (const part of halves)
                    parse(part[0], base + part.index);
            }
        }
    }
    return events;
}
const tuple = (...a) => JSON.stringify(a);
export class ArcMemory {
    constructor() {
        this.titles = new Map();
        this.pending = new Map();
        this.settled = new Map();
        this.aliases = new Map();
        this.aliasProof = new Map();
        this.ambiguous = new Set();
    }
    person(n) { return this.aliases.get(n) ?? n; }
    ingest(events, priorGoals, text) {
        const candidates = [], edges = [], decisions = [], notes = [];
        const link = (a, b, relation) => edges.push({ from: a.id, to: b.id, relation });
        for (const e of events) {
            if (!e.confirmed) {
                // A disputed document may suspend an open disposition, never establish a new title.
                if (/伪造|误登|登记错误|作废/u.test(e.evidence.quote)) {
                    for (const [key, claim] of this.pending) {
                        if (claim.signed && e.evidence.quote.includes(JSON.parse(key)[0]))
                            claim.contested = true;
                    }
                }
                continue;
            }
            const r = e.roles;
            if (e.kind === "alias") {
                const a = this.person(r.actor), b = r.recipient;
                if (this.aliases.has(b) && this.aliases.get(b) !== a || this.ambiguous.has(a)) {
                    this.ambiguous.add(b);
                }
                else if (a !== b) {
                    this.aliases.set(b, a);
                    this.aliasProof.set(b, e);
                }
                continue;
            }
            const actor = this.person(r.actor), to = this.person(r.recipient);
            const key = tuple(r.asset, r.right ?? "所有权");
            if (e.kind === "homonym") {
                this.ambiguous.add(actor);
                for (const v of this.pending.values())
                    if (v.actor === actor)
                        v.verified = false;
                continue;
            }
            if (e.kind === "identify") {
                const matches = [...this.pending.values()].filter(v => v.actor === actor && v.signed);
                if (matches.length === 1) {
                    matches[0].verified = true;
                    matches[0].identity = e;
                    link(matches[0].signed, e, "verified-signer");
                }
                continue;
            }
            if (e.kind === "revoke-meeting")
                continue;
            const title = this.titles.get(key), open = this.pending.get(key), settled = this.settled.get(key);
            if (e.kind === "title") {
                if (title?.actor === actor)
                    continue;
                if (title && title.actor !== actor) {
                    this.pending.delete(key);
                    this.settled.delete(key);
                }
                this.titles.set(key, { actor, event: e });
                continue;
            }
            if (e.kind === "cancel" || e.kind === "redirect" || e.kind === "void") {
                if (open && actor === open.actor && (e.kind === "redirect" || open.to === to)) {
                    link(open.anchor, e, e.kind === "redirect" ? "redirected" : "abandoned");
                    this.pending.delete(key);
                    if (e.kind === "redirect" && to !== actor && !this.ambiguous.has(actor) && !this.ambiguous.has(to))
                        this.pending.set(key, { actor, to, anchor: e, signed: null, verified: true });
                }
                continue;
            }
            if ((actor && this.ambiguous.has(actor)) || (to && this.ambiguous.has(to)))
                continue;
            if (e.kind === "promise" || e.kind === "signed") {
                if (!title || title.actor !== actor || actor === to) {
                    notes.push("unbound-title-or-actor");
                    continue;
                }
                if (open && (open.actor !== actor || open.to !== to)) {
                    open.contested = true;
                    notes.push("competing-recipient");
                    continue;
                }
                const mem = open ?? { actor, to, anchor: e, signed: null, verified: true };
                if (e.kind === "signed")
                    mem.signed = e;
                this.pending.set(key, mem);
                link(title.event, e, "setup");
                if (mem.anchor !== e)
                    link(mem.anchor, e, "commitment");
                decisions.push({ action: "defer", reason: "await-effective-outcome", event: e.id });
                continue;
            }
            if (e.kind === "effective" || e.kind === "restated") {
                if (settled && title?.actor === to && settled.to === to) {
                    decisions.push({ action: "suppress-duplicate", reason: "same-settled-right", original: settled.id, event: e.id });
                    continue;
                }
                if (e.kind !== "effective" || !open?.signed || !open.verified || open.contested || !title || open.actor !== title.actor || open.to !== to) {
                    notes.push("effect-without-matched-disposition");
                    continue;
                }
                link(open.signed, e, "confirmed-effect");
                const roles = { actor: open.actor, asset: r.asset, right: r.right, before: title.actor, after: to };
                const acts = [title.event, open.anchor, open.signed, open.identity, e].filter(Boolean);
                const identities = acts.flatMap(v => [v.roles.actor, v.roles.recipient].map(n => this.aliasProof.get(n)).filter(Boolean));
                const proof = [...identities, ...acts];
                const links = [{ from: title.event.id, to: open.signed.id, relation: "setup" },
                    { from: open.signed.id, to: e.id, relation: "confirmed-effect" }];
                if (open.anchor !== open.signed)
                    links.push({ from: open.anchor.id, to: open.signed.id, relation: "commitment" });
                if (open.identity)
                    links.push({ from: open.identity.id, to: e.id, relation: "verified-disposition" });
                candidates.push({ kind: "quiet", frame: "rights-transfer", arc: open.anchor.id, moment: e.id, roles, links,
                    evidence: [...new Set(proof)].map(v => v.evidence), reason: "权益、原持有人、签署受让者与生效后的归属相符。" });
                this.pending.delete(key);
                this.titles.set(key, { actor: to, event: e });
                this.settled.set(key, { to, id: e.id });
            }
            if (e.kind === "common") {
                const index = events.indexOf(e), give = events[index - 1], exit = events[index - 2];
                if (give?.kind !== "delivery" || exit?.kind !== "renounce" || !give.confirmed || !exit.confirmed ||
                    this.person(give.roles.recipient) !== to || this.ambiguous.has(this.person(exit.roles.actor)))
                    continue;
                const between = (left, right) => text.slice(left.evidence.end, right.evidence.start);
                if (!/^[，。；\s]+$/u.test(between(exit, give)) || !/^[，。；\s]+$/u.test(between(give, e)))
                    continue;
                const owner = this.person(exit.roles.actor), goals = priorGoals.filter(g => g.type === "goal" && this.person(g.roles.actor) === owner);
                // The ledger has no explicit asset label. Do not borrow an ambiguous object
                // from a different objective. Require the instrument and the named asset to agree.
                const latest = goals.at(-1);
                const stem = give.roles.instrument.slice(0, -1);
                if (!latest || new Set(goals.map(g => g.roles.object)).size !== 1 || latest.roles.object !== r.asset ||
                    !stem || !r.asset.includes(stem) || owner === to || !/分成|分红|收益|股权|受益/u.test(exit.roles.ledger))
                    continue;
                const previous = this.settled.get(key);
                if (previous?.to === to) {
                    decisions.push({ action: "suppress-duplicate", reason: "same-collective-right", original: previous.id });
                    continue;
                }
                const roles = { actor: owner, asset: r.asset, right: "共有权", before: "退出前有分成资格", after: to };
                const links = [{ from: latest.id, to: exit.id, relation: "stake" }, { from: exit.id, to: give.id, relation: "sacrifice" },
                    { from: give.id, to: e.id, relation: "confirmed-effect" }];
                candidates.push({ kind: "quiet", frame: "rights-transfer", arc: latest.id, moment: e.id, roles, links,
                    evidence: [latest.evidence, exit.evidence, give.evidence, e.evidence], reason: "有前文标的、退出分成、向受益群体交付凭证和明确共有结果。" });
                this.settled.set(key, { to, id: e.id });
            }
        }
        return { candidates, edges, decisions, notes };
    }
}
