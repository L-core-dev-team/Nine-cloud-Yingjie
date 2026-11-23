const world=/梦(?:中|里|境)|梦到|梦见|排练|排演|彩排|剧本|戏文|戏中|戏里|演习|推演|假设|假想|想象|传闻|转述|证词|旧信|旧事|往事|回忆|预言/u;
const framing=/以下|下文|下列|后文|接下来|后面几|随后几|一连几段|整(?:场|段|幕)|全(?:部|文)|开始|开场|开演|拉开序幕|现开/u;
const actual=/^(?:(?:[他她]醒了|[他她]醒来|幕布落下|排练结束|演出结束|梦醒了|(?:收起|合上|放下)(?:剧本|旧信|书册))[，。])?(?:叙述|故事|镜头|众人)?(?:重新)?(?:回到|返回|切回)(?:眼前的)?(?:现实|现场)[。！]$/u;
export const origin=()=>({world:"current",since:1,anchor:null,quarantined:false});
export function advanceScope(before,row){
    const text=row.text;
    // A fictional character saying "back in reality" is not a host boundary.
    if(before.world!=="current" && actual.test(text) &&
        !/[「」“”"：:]|据说|梦见|如果|假如|声称|谎称|角色说/u.test(text))
        return {world:"current",since:row.revision,anchor:row.sourceKey,quarantined:true};
    if(world.test(text)&&framing.test(text))
        return {world:"noncurrent-or-reported",since:row.revision,anchor:row.sourceKey,quarantined:true};
    return before;
}
