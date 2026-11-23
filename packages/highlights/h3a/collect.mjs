import { SemanticMemory } from "../h2r/semantics.mjs";
import { readRights } from "../v2/rights.mjs";
const owner = "所有权", income = "收益权";
const quotedOrReported = /[“”「」『』"]|据说|据传|听说|传闻|如果|假如|梦里|梦见|戏文|据称|旁人说/u;
const qualified = /暂(?:时|挂|存|记|列)|临时|挂名|借名|代持|代收|托管|代管|保管|保全|公示|供查阅|名义上|没有取得|尚未取得|不取得|未移转|未转移|未过户|无权(?:变卖|处置)|继续保有|(?:产权|产主|原主|实际|实权)仍(?:归|是|由|属)|不能凭此处置/u;
const authenticity = /冒签|仿刻|仿印|伪造|伪签|非本人|旁人.{0,4}(?:书|签)|出自旁人|从来没有签|不算数|并无授权|未经授权|不发生效力|自始无效|不成立|不能据以|已作废|文书作废|裁判撤销|撤回|裁定无效|赠契无效|效力待定|署名异议|没有同意/u;
const independent = /依据另|与.{0,8}(?:无关|没有关系)|另一次竞拍|另案判决/u;
const denyRecord = /从未过户|记载有误|从未登记|登记错误|登记有误|旧话.{0,8}刻错/u;
const ambiguousPerson = /另一个.{0,3}(?:名叫|叫)([\p{Script=Han}]{1,6}?)(?:的人|的人路过|到场)/u;
const namedRight = /开采权|管理权|使用权|控制权|经营权|收益权|所有权|产权|分红|分成/u;
const normalize = right => /收益|分红|分成/u.test(right ?? "") ? income : right === "产权" || !right ? owner : right;
function evidence(ctx, receipt, start, quote) {
    return { scope: ctx.scope, session: ctx.sessionId, sourceKey: receipt.source.key, revision: receipt.source.revision,
        sha256: receipt.narrativeSha256, start, end: start + quote.length, quote };
}
// Extraction is intentionally disposable: legacy parsers supply clause shapes,
// never their pending state, title updates, guesses, rankings or candidates.
function positiveFrames(text, receipt) {
    const simple = new SemanticMemory().advance(text, receipt).events;
    const legacy = readRights({ narrative: text }, receipt.source, receipt.narrativeSha256);
    const out = [];
    for (const e of simple) {
        if (!["title", "income", "gift", "waiver", "alias", "effective-title", "effective-income"].includes(e.type))
            continue;
        const kind = ({ income: "title", gift: "sign", waiver: "sign", "effective-title": "effect", "effective-income": "effect" })[e.type] ?? e.type;
        const right = ["income", "waiver", "effective-income"].includes(e.type) ? income : owner;
        const account = e.type === "effective-income" ? e.evidence.quote.match(/(?:汇入|进了|划入)(.+?公账)$/u)?.[1] : null;
        out.push({ kind, actor: e.actor, asset: e.asset, to: e.to, alias: e.alias, right, account, proof: e.evidence });
    }
    for (const e of legacy) {
        if (!e.confirmed || !["title", "signed", "effective", "restated", "identify", "homonym"].includes(e.kind))
            continue;
        const kind = ({ signed: "sign", effective: "effect" })[e.kind] ?? e.kind;
        if (out.some(v => v.kind === kind && v.proof.start === e.evidence.start))
            continue;
        out.push({ kind, actor: e.roles.actor, asset: e.roles.asset, to: e.roles.recipient, right: normalize(e.roles.right), proof: e.evidence });
    }
    return out;
}
export function collectRevision(ctx, row, receipt, socialProof = []) {
    const assertions = [], observations = [];
    for (const match of row.narrative.matchAll(/[^。！？；\n]+/gu)) {
        const text = match[0], ev = evidence(ctx, receipt, match.index, text);
        assertions.push(ev);
        function add(kind, fields = {}) { observations.push({ kind, evidence: ev, ...fields }); }
        // Quoted material is evidence of a statement only. A period inside a quote
        // must not resume factual parsing on a later segment of the same turn.
        if (quotedOrReported.test(row.narrative)) {
            add("reported");
            continue;
        }
        const cuts = [...text.matchAll(/[^，,]+/gu)].map(c => evidence(ctx, receipt, match.index + c.index, c[0]));
        const first = observations.length;
        for (const part of cuts) {
            const q = part.quote;
            if (/^(?:[\p{Script=Han}]{1,12}的)?(?:诉讼保全|保全措施|托管限制|代持安排)(?:已经|现已|已)(?:解除|终止)$/u.test(q)) {
                add("release-limit", { evidence: part });
                continue;
            }
            if (authenticity.test(q))
                add("challenge", { target: "document", why: "validity-challenged", right: null, evidence: part });
            if (qualified.test(q)) {
                const rights = new Set([...q.matchAll(new RegExp(namedRight.source, "gu"))].map(m => normalize(m[0])));
                for (const right of rights.size ? rights : [null])
                    add("challenge", { target: "substance", why: "limited-or-denied-entitlement", right, evidence: part,
                        ongoing: /临时|暂挂|代管|代持|借名|挂名|托管|保全|公示/u.test(q) });
            }
            if (independent.test(q))
                add("challenge", { target: "cause", why: "independent-basis", right: null, evidence: part });
            if (denyRecord.test(q))
                add("challenge", { target: "registry", why: "record-retracted", right: null, evidence: part });
            const person = ambiguousPerson.exec(q)?.[1];
            if (person)
                add("homonym", { actor: person, evidence: part });
        }
        const limitations = observations.slice(first);
        // A rectification can independently restate who retains title.
        const retained = /(?:产权仍归|原权属仍归)([\p{Script=Han}]{1,6})$/u.exec(text);
        if (retained)
            add("retain", { actor: retained[1], right: owner });
        const before = observations.length;
        for (const f of positiveFrames(text, receipt)) {
            const { proof, ...frame } = f;
            const quote = proof.quote;
            const grounded = evidence(ctx, receipt, match.index + proof.start, quote);
            if (limitations.some(l => l.kind === "challenge" && l.evidence.start < grounded.end && l.evidence.end > grounded.start))
                continue;
            if (frame.kind === "effect" && /登记|过户|换到.{1,16}名下/u.test(quote))
                add("registry", { asset: frame.asset, to: frame.to, right: frame.right, evidence: grounded });
            add(frame.kind, { ...frame, evidence: grounded });
        }
        if (!observations.slice(before).some(v => v.kind === "registry") &&
            /(?:登记在|登记到|登记为|名册.{0,8}(?:记为|列为)|登记本上是|列入名册)/u.test(text) && !denyRecord.test(text))
            add("registry", { right: normalize(text.match(namedRight)?.[0]) });
        const explained = observations.slice(first);
        for (const part of cuts)
            if (!explained.some(x => x.evidence.start <= part.start && part.end <= x.evidence.end)) {
                const separate = socialProof.find(x => x.evidence.some(e => e.revision === part.revision && e.start <= part.start && part.end <= e.end));
                if (separate)
                    add("relationship-context", { actors: [separate.roles.actor, separate.roles.other ?? separate.roles.beneficiary].filter(Boolean), evidence: part });
                else if (observations.some(x => x.kind === "homonym") && /^(?:这?两人|二人)(?:并非|不是|绝非)同一人$/u.test(part.quote))
                    add("identity-context", { evidence: part });
                else
                    add("unresolved", { why: "unclassified-clause", evidence: part });
            }
    }
    observations.sort((a, b) => a.evidence.start - b.evidence.start);
    return { assertions, observations };
}
