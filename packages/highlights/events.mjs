// Closed, literal Chinese predicate frames. Every emitted node points to the whole
// attested clause, including its grammatical subject; modifiers never supply a score.
const person = "(?<actor>[\\p{Script=Han}]{1,5}?)";
const item = "(?<object>[\\p{Script=Han}]{1,12}?)";
const other = "(?<other>[\\p{Script=Han}]{1,5})";
const aim = "(?<verb>归还|交还|保住|守住|保全|交回|守护)";
const pattern = body => new RegExp("^" + body + "$", "u");
const frames = [
    ["goal", person + "(?:一心想|一直想|希望|想要|立志)" + aim + item],
    ["abandon", person + "(?:已经|正式)?(?:放弃|撤回)了" + aim + item + "的(?:打算|决定|计划)"],
    ["conflict", person + "(?:封住|封锁|扣住|扣押)了" + item],
    ["prohibition", "(?<authority>[\\p{Script=Han}]{1,8})(?:不许|禁止)" + person + aim + item],
    ["cost", person + "(?:舍弃|放弃|交出)了(?<cost>[\\p{Script=Han}]{1,12})"],
    ["choice", "(?:转而|选择|决定)" + aim + item],
    ["restitution", item + "(?:终于|已经)?(?:回到|回到了)失主手里"],
    ["withdrawal", person + "(?:撤出|退出|撤离)了" + item],
    ["engagement", "(?:交锋结束|战罢|交战结束|交手过后)"],
    ["passage", "(?:(?:从此|自此)(?<beneficiary>[\\p{Script=Han}]{1,8})恢复通行|(?<travellers>[\\p{Script=Han}]{1,10})(?:终于|从此)得以通过)"],
    ["estranged", person + "(?:一直|始终)不肯(?<attitude>原谅|相信|信任)" + other],
    ["release", person + "放下了对" + other + "的(?:怨恨|成见|怀疑)"],
    ["release", person + "不再(?:怀疑|怨恨|埋怨)" + other],
    ["bond", "(?:两人|二人|她们俩|他们俩)(?:从此|终于)(?<change>重归于好|彼此信任|和解|互相信任)"],
    ["fear", person + "(?:一直害怕|始终畏惧)" + item],
    ["avoid", person + "(?:总是|每次都)(?:绕开|避开)" + item],
    ["affect", person + "的(?<before>恐惧|畏惧|不安)变成了(?<after>平静|坚定|坦然)"],
    ["approach", person + "(?:第一次|首次)主动(?:走上|走近|走进)" + item],
    ["plant", person + "(?:留下|藏下)了(?:一枚|一把|一张)?" + item],
    ["purpose", "约定日后用它(?:开启|打开)(?<target>[\\p{Script=Han}]{1,12})"],
    ["use", person + "(?:拿出|取出)(?:那枚|那把|那张)" + item],
    ["opening", "(?:打开|开启)了(?<target>[\\p{Script=Han}]{1,12})"],
    ["discovery", item + "(?:终于|得以)重见天日"],
    ["promise", person + "答应" + other + "回到(?<target>[\\p{Script=Han}]{1,12})"],
    ["await", person + "一直在(?<target>[\\p{Script=Han}]{1,12})等" + other + "归来"],
    ["arrival", person + "(?:走了进来|进了门|走进门来)"]
].map(([type, rule]) => [type, pattern(rule)]);
// Deliberately abstain on a compound turn when the end of a reported/imagined
// passage is uncertain. Ordinary goal and explicit negative attitude have frames.
const nonActual = /[「」『』“”"‘’]|如果|假如|倘若|要是|传闻|谣言|听说|据说|盛传|旁人说|梦见|梦里|演练|演习|舞台上演|谢幕|本打算|想象|想起|回忆|打个比方|并未|原来并没|没有发生|收回了这句话|说笑|戏文/u;
export function extractEvents(narrative, source, digest) {
    // A stand-alone, explicit correction retracts an earlier factual obstacle. A
    // quoted or conditional correction won't match this full-turn construction.
    const correction = /^(?:更正[，：])?(?<actor>[\p{Script=Han}]{1,5}?)(?:从未|并未|并没有)(?:封住|扣住|封锁|扣押)(?<object>[\p{Script=Han}]{1,12})[。！]?$/u.exec(narrative);
    if (correction) {
        return {events: [{id: source.revision + "@0", type: "retract-conflict", roles: {...correction.groups},
            sentence: 0, ordinal: 0, evidence: {revision: source.revision, sourceKey: source.key,
                sha256: digest, start: 0, end: narrative.length, quote: narrative}}], abstention: null};
    }
    if (nonActual.test(narrative))
        return { events: [], abstention: "nonactual-or-reported-scope" };
    const events = [];
    let sentence = 0, ordinal = 0;
    for (const match of narrative.matchAll(/([^，,；;。！？!?\n]+)([，,；;。！？!?\n]*)/gu)) {
        const quote = match[1].trim();
        const start = match.index + match[1].indexOf(quote);
        for (const [type, rule] of frames) {
            const found = rule.exec(quote);
            if (!found)
                continue;
            const roles = Object.fromEntries(Object.entries(found.groups ?? {}).filter(([, v]) => v !== undefined));
            events.push({ id: source.revision + "@" + start, type, roles, sentence, ordinal,
                evidence: { revision: source.revision, sourceKey: source.key, sha256: digest, start, end: start + quote.length, quote } });
            break;
        }
        ordinal++;
        if (/[；;。！？!?\n]/u.test(match[2]))
            sentence++;
    }
    return { events, abstention: null };
}
