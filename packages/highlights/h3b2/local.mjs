import {transitions,envelope} from "./propositions.mjs";
// Deliberately permissive discovery. It can be wrong: corroboration lives in a
// separate module and reads the saved text, including material NOT cited here.
export function proposePropositions(view) {
    const last=view.at(-1), text=last.text, proposed=[];
    function add(kind,actor,other,item){
        const [before,after]=transitions[kind];
        const earlier=view.slice(0,-1).findLast(r=>[actor,other,item].every(x=>r.text.includes(x)) && /答应|许诺|承担担保责任|断绝往来/u.test(r.text));
        const rows=earlier?[earlier,last]:[last];
        proposed.push(envelope({kind,actor,other,item,before,after,source:"narrator",time:"current",qualifier:"unconditional",polarity:"positive"},rows));
    }
    const han="([\\p{Script=Han}]{1,8}?)";
    let m;
    m=new RegExp("^"+han+"尚未收到"+han+"的"+han+"。$","u").exec(text);
    if(m)add("delivery",m[2],m[1],m[3]);
    if (/签收|收下|收讫|交还/u.test(text)){
        m=new RegExp(han+"(?:把|将)"+han+"(?:交给|送到|交还)"+han+"(?:手中)?[。，]","u").exec(text);
        if(m)add("delivery",m[1],m[3],m[2]);
    }
    m=new RegExp(han+"(?:正式解除|解除了|免除了)"+han+"对"+han+"的担保责任","u").exec(text);
    if(m)add("release",m[1],m[2],m[3]);
    m=new RegExp(han+"登门，和"+han+"恢复了往来","u").exec(text);
    if(m)add("contact",m[1],m[2],"往来");
    m=new RegExp(han+"把"+han+"全数汇入"+han+"公账","u").exec(text);
    if(m)add("account",m[1],m[3]+"公账",m[2]);
    return JSON.stringify(proposed);
}
