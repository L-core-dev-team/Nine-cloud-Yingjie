import {hash} from "../../scene-state/store.mjs";

export const REAL="current-reality";
const speech=new Map([["「","」"],["『","』"],["“","”"],['"','"']]);
const closers=new Set(speech.values());
const kinds=[
    ["hypothetical",/假设|假想|设想|预案|推演|推想|预演|推算|另一种可能|如果/u],
    ["retrospective",/回忆|往事|旧事|年前|追忆|旧日|昔年/u],
    ["reported",/证词|口供|转述|引述|陈词|证言|来信|旧信|读信|朗读|念道|读道|拆信|供述|传说|一面之词/u],
    ["staged-performance",/排练|排演|彩排|演出|幕布|开演|舞台|试演|剧本|戏中|戏里|影戏|皮影|戏文|开场|剧中/u],
    ["dream",/梦|入睡|睡着|合眼|梦乡|睡意/u],
];
const framing=/以[下后]|下[文面一]|后[文面续]|(?:此后|接下来|接着|随后|余下|后几|这几|下几)|全[是部]|都是|一连|整[场段幕]|开始|开[场演]|占满|转入|回到|进入|写[着的]|记的是|逐页|读道|念道|朗读|所述|演的是|[：:]$/u;
const indefinite=/不明|难辨|辨不|辨认不|分不清|无法确定|莫辨|无从分辨/u;
const speechAct=/声称|谎称|猜想|如果|假如|说道|喊道|自称|角色说|以为|否认|据说|听说|谣传|想象着/u;
const exitTokens=[
    ["dream",/^(?:(?:[他她]|剧中人|梦中人)?(?:终于|猛然|忽然)?(?:从梦中|从睡梦中)?(?:醒来|醒了|惊醒)|梦醒了|[^，。]{1,15}把[他她]从梦里(?:叫醒|惊醒))$/u],
    ["staged-performance",/^(?:幕布落下|落幕|(?:排练|排演|彩排|试演|演出|影戏|皮影)(?:结束|散场|完毕)|(?:剧终|散戏)|卸妆后)$/u],
    ["reported",/^(?:证词|口供|证言|来信|旧信|信|引文|转述)(?:已)?(?:读毕|读完了|录毕|结束|念完了)$|^(?:收起|合上)(?:证词|信纸|来信)$/u],
    ["hypothetical",/^(?:推演|推想|假设|预案)(?:结束|到此为止|作罢)|^删去草案$/u],
    ["retrospective",/^(?:往事讲完|旧卷合拢|回忆结束|碑文至此)$/u]
];
const back=/^(?:(?:旁白|叙述|故事|镜头|众人|叙事|笔锋|编者)(?:明确|重新|才又)?|明确)?(?:重返|重回|回到|切回|转回|返回)(?:眼前的|当下的|当下)?(?:现实|现场|今日|此时|此刻)$/u;
function instruction(raw,top){
    const q=raw.trim().replace(/[。！？；]$/u,"");
    if(!q)return null;
    const clauses=q.split(/[，,]/u);
    const end=exitTokens.find(([,re])=>re.test(clauses[0]));
    if(!speechAct.test(q) && (end||back.test(q))){
        const complete=clauses.length===1 || clauses.length===2 && (back.test(clauses[1]) || /^眼前(?:仍|已|正|是)/u.test(clauses[1]));
        if(complete)return {op:"close",kind:end?.[0]??top.kind,reason:"narrated-return"};
    }
    if(indefinite.test(q)&&/来历|来源|叙述|记录者|谁的话|出处|抄|时间/u.test(q))
        return {op:"open",kind:"unknown",reason:"unattributed-passage"};
    // In a transition the object of the change selects the new layer.
    // The name of the current actor or medium may describe its parent.
    const transition=q.match(/(?:进入|转入|开始|沉入|现在)([^，。]{1,24})/u);
    const kind=(transition && kinds.find(([,re])=>re.test(transition[1])))?.[0] ?? kinds.find(([,re])=>re.test(q))?.[0];
    if(kind){
        if(framing.test(q)||transition||/(?:入梦了|进入梦乡|排演开始|睡着了|沉入梦乡)$|^第.{1,6}幕|^场记/u.test(q))
            return {op:"open",kind,reason:"scoped-narrative-declaration"};
        if(/^(?:听说|据说|据传|如果|倘若)|梦见(?:自己|他|她)|梦到(?:自己|他|她)/u.test(q))
            return {op:"local",kind,reason:"embedded-claim"};
        // A change of medium or viewpoint without a dependable endpoint stays
        // suspended. A later narrated return may resolve only this level.
        if(/睡意|梦乡|梦里|梦中|念给|开卷|登台|影子.{0,8}幕|写的是|契入|合眼|一面之词/u.test(q))
            return {op:"open",kind,reason:"viewpoint-change"};
    }
    if(/[：:]$/u.test(q)||/下一[节章幕]|以下数段|后文|接管了下文/u.test(q))
        return {op:"open",kind:"unknown",reason:"unresolved-narrative-introduction"};
    return null;
}
export function origin(scope){
    const root={id:hash(JSON.stringify(["world-root",scope])),parent:null,kind:REAL,open:null,quoteEnd:null};
    return {stack:[root],epoch:root.id};
}
function receipt(row,start,end){
    return {scope:row.scope,session:row.session,revision:row.revision,sourceKey:row.sourceKey,narrativeSha256:row.narrativeSha256,
        start,end,quote:row.text.slice(start,end)};
}
export function parseRevision(before,row){
    const stack=before.stack.slice(),spans=[],changes=[];let epoch=before.epoch;
    const top=()=>stack.at(-1);
    function note(op,frame,source,reason,old){
        changes.push({op,id:frame.id,parent:frame.parent,kind:frame.kind,before:old,after:top().id,reason,evidence:source,
            asOf:row.revision,learnedAt:row.revision});
    }
    function enter(kind,s,reason,quoteEnd=null){
        const parent=top().id,id=hash(JSON.stringify([parent,s.sourceKey,s.start,kind]));
        const f={id,parent,kind,open:s,quoteEnd};stack.push(f);note("open",f,s,reason,parent);
    }
    function leave(s,reason){
        if(stack.length===1)return;
        const f=stack.pop();note("close",f,s,reason,f.id);
        if(top().kind===REAL)epoch=hash(JSON.stringify([f.id,s.sourceKey,s.end,"reentry"]));
    }
    function cover(s,control,reason){
        const f=top();
        spans.push({...s,frameId:f.id,parent:f.parent,world:f.kind,epoch,depth:stack.length-1,control,reason,
            voice:f.kind===REAL?"host-narrative":f.kind==="reported"?"attributed-voice":"within-frame",
            path:stack.map(v=>v.kind)});
    }
    function consume(s){
        const ch=s.quote,f=top();
        if(f.quoteEnd===ch){cover(s,true,"quote-close");leave(s,"quote-close");return;}
        if(speech.has(ch)){enter("reported",s,"quote-open",speech.get(ch));cover(s,true,"quote-open");return;}
        if(closers.has(ch)){
            enter("unknown",s,"unmatched-quotation");cover(s,true,"unmatched-quotation");return;
        }
        if(f.quoteEnd){cover(s,false,"quoted-content");return;}
        if(/[：:]$/u.test(ch)&&speech.has(row.text[s.end])){
            cover(s,true,"speaker-introduces-delimited-quotation");return;
        }
        const d=instruction(ch,f);
        if(d?.op==="close"){
            if(stack.length>1&&(f.kind===d.kind||f.kind==="unknown"))leave(s,d.reason);
            cover(s,true,"return-boundary");return;
        }
        if(d){
            enter(d.kind,s,d.reason);cover(s,true,d.reason);
            if(d.op==="local")leave(s,"end-of-embedded-clause");
        } else cover(s,false,"inherited");
    }
    // JS offsets are UTF-16. Quotes are standalone tokens so a quoted reset
    // cannot pop its parent; punctuation-delimited changes work within a turn.
    for(const m of row.text.matchAll(/[「」『』“”"]|[^「」『』“”"。！？；\n]+[。！？；\n]?|[。！？；\n]/gu))
        consume(receipt(row,m.index,m.index+m[0].length));
    return {state:{stack,epoch},spans,changes,asOf:row.revision,learnedAt:row.revision};
}
