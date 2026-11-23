import {transitions} from "./propositions.mjs";
import {sentences} from "../h3b/protocol.mjs";
const nonactual=/[“”「」『』"？]|听说|传闻|据说|据传|有人说|表示|猜测|误以为|以为|梦见|梦里|如果|假若|倘若|讥笑|反讽|假称|回忆|十年前|曾经以为|戏文|排演/u;
const defect=/冒签|临时挂名|同名|签名系伪|未经授权|作废|从未生效|撤销|撤回|更正|取消|实为|实则|误记|冲销|系误|已废|实际尚未|拒收/u;
const uncertainReference=/此约|原约|前约|旧约|约定|另一个|先前的|其人|此事|那件事|那笔|那份|原来的说法/u;
const roleName=/^[\p{Script=Han}]{1,12}$/u;
const nonName=/^我$|^他$|^她$|有人|据|说|声称|猜|如果|梦|否认|未曾|尚未|过去|不曾|假装|听闻|并非|并未|只是|难道|仿佛|没有|打算|将要|曾经|本想|假如|计划|假设|拟让|不是|昨天|当年|以为|误传|戏中|传称/u;
function model(q) {
    const {actor:a,other:b,item:x}=q;
    // Bound slots are literal strings. Test role orientation, completed acts
    // and independent consequences; no provider-supplied expression is executed.
    if(q.kind==="delivery") return {
        before:[a+"答应把"+x+"交给"+b+"。",a+"曾向"+b+"许诺交付"+x+"。"],
        acts:[a+"把"+x+"交给"+b+"。",a+"将"+x+"交给"+b+"。",a+"将"+x+"送到"+b+"手中。"],
        effects:[b+"当场签收了"+x+"。",b+"当面收下了"+x+"。"],
        neg:[b+"尚未收到"+a+"的"+x+"。"]};
    if(q.kind==="release") return {
        before:[b+"为"+x+"向"+a+"承担担保责任。"],
        acts:[a+"正式解除"+b+"对"+x+"的担保责任。",a+"解除了"+b+"对"+x+"的担保责任。",a+"免除了"+b+"对"+x+"的担保责任。"],
        effects:[b+"领回了"+x+"的保证金。",b+"收回了"+x+"的保证金。"],
        neg:[a+"只对"+b+"暂缓追偿，"+x+"的担保责任仍在。"]};
    if(q.kind==="contact"&&x==="往来") return {
        before:[a+"与"+b+"已经断绝往来。"],acts:[a+"登门，和"+b+"恢复了往来。"],
        effects:["两人当面互换了新住址。"],neg:[]};
}
function covers(q,refs){return refs.every(e=>q.spans.some(s=>s.revision===e.revision&&s.start===e.start&&s.end===e.end));}
function affected(q,text){
    const domain={release:/免责|保结|保证金|担保/u,delivery:/承诺|交付|原件/u,contact:/双方关系|往来/u};
    return [q.actor,q.other,q.item].some(s=>text.includes(s)) || uncertainReference.test(text) || !!domain[q.kind]?.test(text);
}
export function challenge(q,text){
    return affected(q,text) && defect.test(text);
}
export function ground(q,history,old,scope) {
    const view=history.slice(scope.since-1);
    const last=view.at(-1),now=sentences(last),text=last.text;
    const v={asOf:last.revision,sourceValid:true,entailment:"unresolved",outcomeEntailment:"unresolved",effective:"unresolved",cause:"unresolved",
        reason:"unrecognized-construction",support:[],against:[],antecedent:null,baseEvent:null};
    function hold(reason){return {...v,reason};}
    if(scope.world!=="current")return hold("noncurrent-or-reported-discourse");
    if(q.spans.some(e=>e.revision<scope.since))return hold("premise-from-another-discourse-epoch");
    function contrary(reason,refs){return {...v,entailment:"contradicted",outcomeEntailment:"contradicted",effective:"contradicted",reason,against:refs};}
    const names=[q.actor,q.other,q.item];
    if(!names.every(s=>roleName.test(s)&&!nonName.test(s)) || q.actor===q.other) return hold("roles-unbound");
    const pair=transitions[q.kind];
    if(q.polarity!=="positive"||q.source!=="narrator"||q.time!=="current"||q.qualifier!=="unconditional"||
        q.before!==pair[0]||q.after!==pair[1]) return hold("unsupported-scope-or-transition");
    const t=model(q);
    if(t?.neg.includes(text)) return contrary("explicit-negative-outcome",now);
    if(nonactual.test(text))return hold("reported-modal-or-noncurrent");
    if(defect.test(text))return hold("identity-validity-or-correction");
    // A saved revision is not necessarily a new narrator. Incomplete quoted
    // speech or a prior lead-in prevents treating this turn as a fresh assertion.
    let depth=0;
    for(const row of view.slice(0,-1)) for(const ch of row.text) {
        if("「『“".includes(ch))depth++;
        if("」』”".includes(ch))depth=Math.max(0,depth-1);
    }
    if(depth || /[：:]\s*$/u.test(view.at(-2)?.text??""))return hold("unresolved-speaker-scope");
    if(view.slice(0,-1).some(r=>/同名|名字相同/u.test(r.text)&&[q.actor,q.other].some(name=>r.text.includes(name))))
        return hold("ambiguous-party-in-history");
    // Recorded ownership is never promoted here. Only use the legacy admitted
    // transaction with the same old/new right holders, object and right type.
    if(q.kind==="ownership"){
        const match=old.facts.find(c=>c.review?.causalSupport==="supported"&&c.roles.right==="所有权"&&
            c.roles.actor===q.actor&&c.roles.beneficiary===q.other&&c.roles.asset===q.item);
        const contains=(s,e)=>s.revision===e.revision&&s.start<=e.start&&s.end>=e.end;
        if(!match || !match.evidence.every(e=>q.spans.some(s=>contains(s,e))) ||
            !q.spans.every(s=>match.evidence.some(e=>contains(s,e))))return hold("property-transaction-not-supported");
        return {...v,entailment:"supported",outcomeEntailment:"supported",effective:"supported",cause:"supported",support:match.evidence,reason:"existing-property-transaction",baseEvent:match.id};
    }
    if(q.kind==="account" && text===q.actor+"把"+q.item+"全数汇入"+q.other+"，柜上出具了到账凭据。" && q.other.endsWith("公账") && covers(q,now))
        return {...v,outcomeEntailment:"supported",effective:"supported",reason:"account-credit-only",support:now};
    const limited={
        signed:q.actor+"签了把"+q.item+"赠给"+q.other+"的契书。",
        registry:q.actor+"将"+q.item+"登记在"+q.other+"名下。",
        common:q.actor+"放弃独占"+q.item+"。从这日起"+q.item+"由"+q.other+"共有。"
    };
    if(limited[q.kind]===text && covers(q,now))
        return {...v,outcomeEntailment:"supported",support:now,reason:"record-or-collective-statement-only"};
    if(!t)return hold("no-independent-domain-proof");
    if(now.length!==2 || !t.acts.includes(now[0].quote)||!t.effects.includes(now[1].quote)||
        now.map(e=>e.quote).join("")!==text || !covers(q,now))return hold("outcome-or-roles-unproven");
    v.outcomeEntailment="supported";v.effective="supported";v.support=now;
    const at=view.findLastIndex(r=>r.revision<last.revision && t.before.includes(r.text));
    if(at<0)return hold("compatible-antecedent-missing");
    const pre=sentences(view[at]);
    if(!covers(q,pre)||q.spans.length!==pre.length+now.length)return hold("causal-citations-not-exact");
    for (const r of view.slice(at+1,-1)){
        if(challenge(q,r.text) || (affected(q,r.text) && /其实|已被|不再有效|不作数|失效|换约|另立|同名/u.test(r.text)))
            return {...v,reason:"intervening-challenge",against:sentences(r)};
        // A denial of delivery describes its status then, not a cancellation
        // of the promise. Other opaque interventions about this line suspend it.
        const privateOpinion=/^[^。，；：！？]{1,15}(?:的人说|旁人猜|只说也许)[^。，；：！？]+。$/u.test(r.text) ||
            /^旁人猜[^。，；：！？]+。$/u.test(r.text);
        if(affected(q,r.text) && !nonactual.test(r.text) && !privateOpinion && !t.neg.includes(r.text) && !t.before.includes(r.text))
            return {...v,reason:"unresolved-intervening-context",against:sentences(r)};
    }
    if(old.audit.judgments.some(j=>j.against.length) || old.audit.observations.some(o=>o.kind==="challenge"||o.kind==="homonym"))
        return hold("legacy-causal-veto");
    return {...v,entailment:"supported",cause:"supported",reason:"bound-prior-act-and-observed-consequence",support:[...pre,...now],antecedent:view[at].sourceKey};
}
