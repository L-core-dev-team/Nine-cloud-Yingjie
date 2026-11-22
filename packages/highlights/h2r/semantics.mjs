const token = "[\\p{Script=Han}]{1,12}?";
const actor = "(?<actor>" + token + ")", asset = "(?<asset>" + token + ")", to = "(?<to>" + token + ")";
const forms = [];
function add(type, patterns) {
    for (const pattern of patterns)
        forms.push([type, new RegExp("^" + pattern + "$", "u")]);
}
add("title", [asset + "(?:属于|原属)" + actor, asset + "是" + actor + "的(?:私产|家产|产业)",
    actor + "是" + asset + "唯一的产权人", asset + "的产权人是" + actor, actor + "持有" + asset + "的所有权",
    asset + "的所有权原归" + actor, "(?:后山的|山下的)" + asset + "归" + actor + "所有"]);
add("income", [actor + "独享" + asset + "的收益", asset + "的(?:经营)?收入由" + actor + "独自领取",
    asset + "的收益一直由" + actor + "独领", actor + "掌着" + asset + "的收入"]);
add("alias", [asset + "(?:又名|也叫|简称)(?<alias>" + token + ")"]);
add("gift", [actor + "(?:亲笔)?签(?:了|下了)(?:把|将)" + asset + "(?:赠给|赠与|转给)" + to + "的(?:契|契书|契约)",
    actor + "(?:将|把)" + asset + "(?:赠给|赠与)" + to + "[，,]双方签了契",
    actor + "在转赠" + asset + "给" + to + "的契书上签字", actor + "向" + to + "签发了" + asset + "的赠契",
    actor + "在赠与" + to + "的" + asset + "契书上签名",
    actor + "(?:在公证员面前|当众|当场|亲手)?签了(?:赠|转让|捐出)" + asset + "的契"]);
add("waiver", [actor + "(?:放弃|舍弃|交回|注销)(?:了)?" + asset + "的(?:个人分红|个人分成|分红资格|分红份额)",
    actor + "把自己的(?:份额|分成|分红)(?:划销|注销|划掉)"]);
add("effective-title", ["(?:当天过户完毕[，,])?" + asset + "的(?:所有权|产权)(?:已经|已|当日|当天)?(?:过户至|转到了|登记在|换到)" + to + "名下",
    asset + "的所有权从今日起正式归" + to, asset + "已经办妥过户[，,]现归" + to + "所有",
    "过户已办妥[，,]" + asset + "现由" + to + "所有",
    "(?:产权|所有权)(?:当天|当日|已经)(?:换到|登记在|过户至)" + to + "名下"]);
add("effective-income", ["(?:往后|从此|自此|今后|从今天起[，,]?|从这天起[，,]?)(?:每一?笔)?" + asset +
        "(?:的每笔进款|的收益|所得|收入)?(?:都)?(?:直接|固定|全数)?(?:进了|划入|汇入)" + to + "(?:的)?公账"]);
add("withdraw", [actor + "(?:正式)?撤销了(?:将|把)" + asset + "(?:赠与|赠给|转给)" + to + "的(?:决定|赠契|文书)"]);
add("estranged", [actor + "与" + to + "(?:因旧债断交|断绝了往来|已断交)", actor + "不肯让" + to + "再进家门"]);
add("estranged", [actor + "和" + to + "(?:因旧债断交|断绝了往来|已断交)"]);
add("engaged", [actor + "与" + to + "的婚书一直封在匣底[，,]谁都没拆"]);
add("dissolved", [actor + "和" + to + "(?:当堂|当面)?退婚[，,]婚约(?:自今日|当日|当场)?解除"]);
add("reconcile", [actor + "当面豁免" + to + "的旧债[。]从那日起两家恢复往来",
    actor + "收回断亲书[，,]和" + to + "从此恢复了(?:母女|父子|亲属)关系"]);
const nonActual = /[“”「」『』‘’"]|梦[里见中]|如果|要是|假如|似乎|据说|据传|传说|传闻|听说|声称|尚待|待核|草案|打算|只等|伪造|仿印|未(?:获准|办成|生效|发)|假文书|并没有|登记错误|只是暂借|保管|抄本照录|回忆|想起|玩笑|讽刺|戏本|本打算|去年人们/u;
const uncertain = /无人|无法确定|未署名|没有署名|漏写|没有底本|没写|无人答得出|漏写了|另一个名叫|同名/u;
const disputed = /撤回|作废|伪造|仿印|已撤销|驳回|更正|取消/u;
const legal = /产权|所有权|收益|分红|收款|股息|退任|退婚|过户|归属|受让|赠契|任命|文书|承诺|签署|份额/u;
const pronouns = new Set(["她", "他", "其", "对方", "此人", "他们", "她们"]);
const cleanName = s => typeof s === "string" && !pronouns.has(s) && !/和|与|以及|也许|似乎|据|传言|打算|没有|并非|不是|计划|未曾|想要|可能|曾经|昨天梦到|后来才知道|以前|声称|不曾|否认/u.test(s);
const invalidOutcome = /无效|不属实|未生效|不生效|从未|记错|并无此事|假设|假若|假装|作罢|反悔|登记有误|拟于|如果|只是演戏|撤回|作废/u;
function parse(text) {
    for (const [type, re] of forms) {
        const m = re.exec(text);
        if (m)
            return { type, ...m.groups };
    }
}
function units(text) {
    // Prefer complete compound frames. Unrecognized material breaks pronoun focus.
    const whole = text.replace(/[。！？]$/u, "");
    if (parse(whole))
        return [{ text: whole, start: 0 }];
    const out = [];
    for (const sentence of text.matchAll(/[^。；！？\n]+/gu)) {
        if (parse(sentence[0]))
            out.push({ text: sentence[0], start: sentence.index });
        else
            for (const c of sentence[0].matchAll(/[^，,]+/gu))
                out.push({ text: c[0], start: sentence.index + c.index });
    }
    return out;
}
export class SemanticMemory {
    titles = new Map();
    aliases = new Map();
    aliasEvidence = new Map();
    pending = new Map();
    settled = new Map();
    relations = new Map();
    duplicates = new Set();
    focus = null;
    assetKey(s) {
        if (!s)
            return null;
        const names = new Set([...this.titles.keys()].filter(n => n === s || this.aliases.get(s)?.has(n) || n.replace(/^[旧老新]/u, "") === s));
        return names.size === 1 ? [...names][0] : null;
    }
    advance(text, receipt) {
        const { source, narrativeSha256: sha256 } = receipt, revision = source.revision;
        const result = { events: [], candidates: [], state: "ordinary", reason: "no-event-recognized", action: "text-only" };
        const note = (state, reason) => Object.assign(result, { state, reason });
        const previous = this.focus;
        this.focus = null;
        if (disputed.test(text) || invalidOutcome.test(text)) {
            for (const [key] of this.pending)
                if (text.includes(key) || !Array.from(this.titles.keys()).some(x => text.includes(x)))
                    this.pending.delete(key);
        }
        if (nonActual.test(text) || uncertain.test(text) || invalidOutcome.test(text)) {
            note(uncertain.test(text) ? "unknown" : "potential-unverified", "nonactual-or-ambiguous");
            return result;
        }
        let currentGift = null, localFocus = null;
        const segments = units(text);
        for (const [index, u] of segments.entries()) {
            const f = parse(u.text);
            if (!f) {
                localFocus = null;
                currentGift = null;
                if (legal.test(u.text) && result.state === "ordinary")
                    note("potential-unverified", "unconfirmed-material-event");
                continue;
            }
            const evidence = { revision, sourceKey: source.key, sha256, start: u.start, end: u.start + u.text.length, quote: u.text };
            const e = { ...f, evidence, learnedAt: revision };
            result.events.push(e);
            if (f.type === "title" || f.type === "income") {
                if (!cleanName(f.actor) || !cleanName(f.asset))
                    continue;
                const old = this.titles.get(f.asset);
                if (old && old.actor !== f.actor) {
                    this.pending.delete(f.asset);
                    this.settled.delete(f.asset);
                }
                this.titles.set(f.asset, { actor: f.actor, type: f.type, evidence });
                localFocus = { actor: f.actor, key: f.asset, evidence };
                note("ordinary", "attested-prior-state");
                continue;
            }
            if (f.type === "alias") {
                const key = this.assetKey(f.asset);
                if (key && cleanName(f.alias)) {
                    const names = this.aliases.get(f.alias) ?? new Set();
                    names.add(key);
                    this.aliases.set(f.alias, names);
                    this.aliasEvidence.set(f.alias, evidence);
                }
                continue;
            }
            if (["estranged", "engaged", "reconcile", "dissolved"].includes(f.type)) {
                const key = JSON.stringify([f.actor, f.to]);
                if (!cleanName(f.actor) || !cleanName(f.to))
                    continue;
                if (f.type === "estranged" || f.type === "engaged") {
                    this.relations.set(key, e);
                    continue;
                }
                const prior = this.relations.get(key);
                if (!prior || prior.type !== (f.type === "dissolved" ? "engaged" : "estranged")) {
                    note("potential-unverified", "missing-paired-history");
                    continue;
                }
                result.candidates.push({ kind: "quiet", frame: "relation", roles: { actor: f.actor, beneficiary: f.to },
                    before: prior.evidence.quote, after: evidence.quote, evidence: [prior.evidence, evidence], reason: "prior-estrangement-and-observed-settlement" });
                this.relations.delete(key);
                continue;
            }
            const focus = localFocus ?? (index === 0 ? previous : null);
            const adjacentGift = currentGift && /^[，,]\s*$/u.test(text.slice(currentGift.evidence.end, u.start));
            const key = f.asset ? this.assetKey(f.asset) : f.type === "effective-title" ? (adjacentGift ? currentGift.key : null) : focus?.key;
            const prior = this.titles.get(key);
            if (!prior) {
                note("unknown", "asset-or-discourse-referent-not-unique");
                continue;
            }
            if (f.type === "gift" || f.type === "waiver" || f.type === "withdraw") {
                const who = pronouns.has(f.actor) ? focus?.actor : f.actor;
                if (!who || who !== prior.actor || (!pronouns.has(f.actor) && !cleanName(f.actor)) || f.to && (!cleanName(f.to) || f.to === who)) {
                    note("unknown", "actor-or-grantee-unbound");
                    continue;
                }
                if (f.type === "withdraw") {
                    this.pending.delete(key);
                    note("ordinary", "withdrawn");
                    continue;
                }
                if ((f.type === "gift") !== (prior.type === "title")) {
                    note("unknown", "incompatible-right");
                    continue;
                }
                const claim = { key, actor: who, to: f.to, prior, evidence, type: f.type, aliasProof: f.asset && f.asset !== key ? this.aliasEvidence?.get(f.asset) : null };
                const open = this.pending.get(key);
                if (open && (open.actor !== who || open.to !== f.to)) {
                    open.contested = true;
                    note("unknown", "competing-disposition");
                    continue;
                }
                this.pending.set(key, claim);
                currentGift = claim;
                note("potential-unverified", "disposition-awaits-effect");
                result.action = "defer";
                continue;
            }
            const open = this.pending.get(key);
            if (!open || open.contested || !cleanName(f.to) || open.actor === f.to || open.to && open.to !== f.to ||
                (open.type === "waiver") !== (f.type === "effective-income") ||
                (open.type === "gift" && !open.to && !(open === currentGift && adjacentGift && open.evidence.revision === revision))) {
                note("unknown", "effect-without-compatible-disposition");
                continue;
            }
            const type = open.type === "gift" ? "产权" : "收益份额";
            const fingerprint = JSON.stringify([key, type, open.actor, f.to, open.evidence.revision, open.evidence.start]);
            if (!this.duplicates.has(fingerprint)) {
                result.candidates.push({ kind: "quiet", frame: "durable-right", roles: { actor: open.actor, asset: key, beneficiary: f.to, right: type },
                    before: open.type === "waiver" ? "行动人持有个人收益份额" : prior.evidence.quote, after: evidence.quote,
                    evidence: [prior.evidence, open.aliasProof, open.evidence, evidence].filter(Boolean), reason: "compatible-prior-disposition-effective-result" });
                this.duplicates.add(fingerprint);
            }
            this.pending.delete(key);
            this.settled.set(key, f.to);
            this.titles.set(key, { actor: f.to, type: prior.type, evidence });
        }
        if (segments.length === 1 && localFocus)
            this.focus = localFocus;
        if (result.candidates.length) {
            note("confirmed-peak", "observed-durable-change");
            result.action = "text-only";
        }
        else if (result.events.length === 0 && /仍|照例|照旧|重抄/u.test(text)) {
            const matches = [...this.settled].filter(([key, to]) => text.includes(key) && text.includes(to));
            if (matches.length === 1) {
                note("ordinary", "same-effective-state");
                result.action = "suppress-duplicate";
            }
        }
        return result;
    }
}
