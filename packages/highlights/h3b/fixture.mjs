import { proposal, sentences } from "./protocol.mjs";
// Fixed local, deterministic source reader. Hypotheses have no authority.
// Only fill a role if a surface construction binds it. Never infer a recipient
// from an account name, or assign a collective's rights to its representative.
function readHypothesis(q) {
    if (/据说|听说|梦见|倘使|据传|「|」|[“”]|有人计划|打算|照旧|仍是|仍与|到明早|仍归|冒签|退回新契/u.test(q)) return;
    let m;
    if ((m=/(?:自此|从这日起，?)(.{1,12}?)由(.{1,12}?)共有/u.exec(q)))
        return ["collective",{asset:m[1],group:m[2]}];
    if ((m=/(.{1,12}?(?:红利|收益))由(.{1,12}?)(?:平分|均分)/u.exec(q)))
        return ["collective",{group:m[2]}];
    if ((m=/登记生效，(.{1,12}?)的(?:所有权|收益权|经营权|使用权)自今日起归(.{1,12}?)[。；]/u.exec(q)))
        return ["disposition",{asset:m[1],recipient:m[2]}];
    if ((m=/(.{1,12}?)的收益(?:固定|全部)(?:汇入|划入)(.{1,12}?公账)/u.exec(q)))
        return ["disposition",{asset:m[1].split("，").at(-1),account:m[2]}];
    if (/代领|经手栏/u.test(q) && /公账|总账|转入/u.test(q)) return ["agency",{}];
    if ((m=/([^，。]{1,8}?)(?:撤了逐徒令|撤销处分)，([^，。]{1,8}?)重新列入/u.exec(q)))
        return ["relationship",{actor:m[1],recipient:m[2]}];
    if (/(?:亲自接|解除了隔绝|打破沉默).*(?:恢复往来|重归于好)/u.test(q)) return ["relationship",{}];
    if (/(?:免去|不再负担|结清栏)/u.test(q) && /核销|销毁|签字/u.test(q)) return ["relief",{}];
    if (/承诺.{0,5}兑现|欠下.{0,8}还清/u.test(q)) return ["payoff",{}];
    if (/递交|交出|送去|交来|送到|寄给|塞进/u.test(q) && /待|尚未|没.{0,3}(?:答复|回音|回帖)|还在/u.test(q)) return ["petition",{}];
}
export function suggestNarrativeCandidates(view) {
    const out=[];
    for (const s of sentences(view.at(-1))) {
        const finding=readHypothesis(s.quote);
        if (!finding) continue;
        const [type,entities]=finding;
        // A repeated asset name offers context, never proof of ownership. Only
        // the independent transaction can authenticate a compatible disposition.
        const prior=[];
        if (type==="disposition" && entities.asset) {
            for (const row of view.slice(0,-1)) {
                for (const earlier of sentences(row))
                    if (earlier.quote.includes(entities.asset) && /原归|独享|亲笔签署|舍弃了/u.test(earlier.quote))
                        prior.push(earlier);
            }
        }
        out.push(proposal(view,type,[...prior.slice(-7),s],entities));
    }
    return JSON.stringify(out);
}
