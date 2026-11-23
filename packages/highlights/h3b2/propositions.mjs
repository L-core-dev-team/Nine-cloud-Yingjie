import {sentences} from "../h3b/protocol.mjs";
export const transitions=Object.freeze({
    delivery:["promised","delivered"],release:["liable","released"],contact:["apart","in-contact"],
    common:["exclusive","collective"],ownership:["old-holder","transferred"],account:["personal","credited"],
    waiver:["entitled","waived"],signed:["unsigned","signed"],registry:["unrecorded","recorded"]
});
const equalKeys=(obj,keys)=>obj && typeof obj==="object" && !Array.isArray(obj) &&
    Object.keys(obj).sort().join("|")===keys.slice().sort().join("|");
function check(ok,reason){if(!ok)throw Error(reason);}
export function envelope(claim,rows) {
    const row=rows.at(-1);
    return {...claim,scope:row.scope,session:row.session,asOf:row.revision,learnedAt:row.revision,spans:rows.flatMap(sentences)};
}
export function validate(raw,view) {
    check(typeof raw==="string" && raw.length<=65536,"payload-limit");
    let batch;
    try {batch=JSON.parse(raw);} catch {throw Error("invalid-json");}
    check(Array.isArray(batch)&&batch.length<=12,"batch-limit");
    const now=view.at(-1),seen=new Set(),sources=new Map(view.map(r=>[r.revision,r]));
    for(const q of batch){
        check(equalKeys(q,["kind","actor","other","item","before","after","polarity","source","time","qualifier","scope","session","asOf","learnedAt","spans"]),"proposition-fields");
        check(q.scope===now.scope&&q.session===now.session&&q.asOf===now.revision&&q.learnedAt===now.revision,"wrong-context");
        check(Object.hasOwn(transitions,q.kind),"unknown-kind");
        for(const k of ["actor","other","item","before","after","polarity","source","time","qualifier"])
            check(typeof q[k]==="string" && q[k].length>0 && q[k].length<=40,"invalid-slot");
        check(Array.isArray(q.spans)&&q.spans.length>=1&&q.spans.length<=12,"span-count");
        let prior;
        for(const e of q.spans) {
            check(equalKeys(e,["scope","session","revision","sourceKey","narrativeSha256","start","end","quote"]),"span-fields");
            const r=sources.get(e.revision);
            check(r&&r.scope===e.scope&&r.session===e.session&&r.sourceKey===e.sourceKey&&r.narrativeSha256===e.narrativeSha256,"wrong-source");
            check(sentences(r).some(s=>s.start===e.start&&s.end===e.end&&s.quote===e.quote),"not-whole-source-sentence");
            check(!prior||e.revision>prior.revision||e.revision===prior.revision&&e.start>=prior.end,"span-order");
            prior=e;
        }
        check(prior.revision===now.revision,"stale-anchor");
        const identity=JSON.stringify([q.kind,q.actor,q.other,q.item,q.before,q.after,q.polarity,q.time,q.source,q.qualifier]);
        check(!seen.has(identity),"duplicate-proposition");seen.add(identity);
    }
    return batch;
}
