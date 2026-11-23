import { performance } from "node:perf_hooks";
import { hash } from "../../scene-state/store.mjs";
import { replayHighlights3A } from "../h3a/replay.mjs";
import { emptyLedger, reviewRevision } from "../h3a/transaction.mjs";
import { sourceRow, validateBatch } from "./protocol.mjs";

export const method = "narrative-highlight/3b";
const property = c => ["durable-right","rights-transfer"].includes(c.frame);
const order = (a,b) => b.score-a.score || a.revision-b.revision || a.evidence.at(-1).start-b.evidence.at(-1).start;
const textOnly = reason => ({action:"text-only",reason,send:false});
// Closed grammar for a private opinion about intent. It consumes the WHOLE
// standalone sentence. No legal decision, limitation or unknown remainder is
// discarded. Only an explicitly identified, pending asset is in scope.
function typeOpinion(audit, state) {
    const {observations, assertions} = audit;
    if (observations.length!==1 || assertions.length!==1 || observations[0].kind!=="unresolved") return {observations,assertions};
    const e=observations[0].evidence;
    const marker=/(?:旁|边)(?:有人|有位路人|的路人|的旁观者)(?:表示|觉得|猜测|认为)(?:这|那张纸|此事)(?:只是|不过是|大概只是)(?:意向|客套|设想)$/u.exec(e.quote);
    if (!marker || ![...state.pending.values()].some(d=>d.asset===e.quote.slice(0,marker.index) && d.validity==="signed"))
        return {observations,assertions};
    return {assertions,observations:[{...observations[0],kind:"attributed-opinion",why:"identified-private-speaker-on-intent"}]};
}
function corroboration(c, facts) {
    // Empty/partial semantic slots, or an authentic quote assigned to the wrong
    // party, may enter textual review only. Link exclusively to existing facts.
    if (c.type!=="disposition" || !c.entities.asset || !(c.entities.account || c.entities.recipient)) return null;
    const eq = {actor:"actor",recipient:"beneficiary",asset:"asset",account:"account"};
    const matches=facts.filter(f=>property(f) && f.review?.causalSupport==="supported" &&
        Object.entries(c.entities).every(([k,v])=>eq[k] && f.roles[eq[k]]===v) &&
        f.evidence.every(e=>c.spans.some(s=>s.revision===e.revision && s.start<=e.start && s.end>=e.end)) &&
        c.spans.every(s=>f.evidence.some(e=>s.revision===e.revision && s.start<=e.start && s.end>=e.end)));
    return matches.length===1 ? matches[0].id : null;
}
export function replayHighlights3B(ctx, provider, timing) {
    const clock={causalMs:0, providerMs:0, validateMs:0, rankAuditMs:0};
    let tick=performance.now();
    const base=replayHighlights3A(ctx); // validates the entire host envelope before any disclosure
    clock.causalMs+=performance.now()-tick;
    const byId=new Map(base.candidates.map(c=>[c.id,c])), rows=[], candidates=[], edges=[], rounds=[], inherited=[];
    const reviewed=new Set(), reviewedDispositions=new Set(), previousIds=new Set();
    let state=emptyLedger(), focus=null;
    for (const [i,original] of base.rounds.entries()) {
        tick=performance.now();
        const input=typeOpinion(original.audit,state);
        const checked=reviewRevision(state,input,ctx.receipts[i],ctx,focus);
        state=checked.draft;
        focus=checked.focus;
        edges.push(...checked.audit.edges);
        clock.causalMs+=performance.now()-tick;
        tick=performance.now();
        const retained=original.candidateIds.map(id=>byId.get(id)).filter(c=>!property(c));
        inherited.push(...retained);
        const current=[...retained,...checked.candidates].sort(order);
        candidates.push(...current);
        const ranking=[...inherited,...[...state.candidates.values()].filter(c=>c.status==="active")].sort(order).map(c=>c.id);
        const ids=current.map(c=>c.id);
        let cadence=original.cadence;
        if (ids[0]!==original.candidateIds[0])
            cadence=textOnly("research-entry-without-independent-image-authorization");
        rows.push(sourceRow(ctx,i));
        const view=Object.freeze(rows.slice());
        clock.rankAuditMs+=performance.now()-tick;
        let batch=[], rejection=null, raw;
        if (provider) {
            tick=performance.now();
            try { raw=provider(view); } catch { rejection="provider-failed"; }
            clock.providerMs+=performance.now()-tick;
            tick=performance.now();
            if (!rejection) {
                try {
                    const valid=validateBatch(raw,view);
                    if (valid.some(c=>previousIds.has(c.id))) throw Error("reused-provider-id");
                    batch=valid;
                } catch (err) { rejection=err.message; }
            }
            clock.validateMs+=performance.now()-tick;
        }
        tick=performance.now();
        const suggestions=[], duplicates=[];
        for (const c of batch) {
            previousIds.add(c.id);
            const anchor=c.spans.at(-1);
            // Provider IDs, opinions and role names cannot mint a second proposal
            // for the same source moment. Identical restatements stay text-only.
            const key=hash(JSON.stringify([ctx.scope,anchor.quote]));
            const fact=corroboration(c,current);
            const sign=c.spans.findLast(s=>s.revision<i+1 && /签署|签了|舍弃了/u.test(s.quote));
            const recipient=c.entities.account??c.entities.recipient;
            // Rewording the same disposition and citing the same instrument is
            // not a second moment. Independent instruments have separate anchors.
            const disposition=c.type==="disposition" && sign && c.entities.asset && recipient
                ? JSON.stringify([sign.sourceKey,sign.start,c.entities.asset,recipient]) : null;
            if (reviewed.has(key) || disposition && reviewedDispositions.has(disposition) && !fact) {
                duplicates.push(c.id); continue;
            }
            reviewed.add(key);
            if (disposition) reviewedDispositions.add(disposition);
            suggestions.push({key,id:c.id,type:c.type,entities:c.entities,spans:c.spans,
                learnedAt:i+1,disposition:fact?"linked-existing-fact":"text-review",fact,send:false});
        }
        rounds.push({...original,state:ids.length?"confirmed-peak":original.state==="confirmed-peak"?"unverified":original.state,
            narrativeImportance:ids.length?"recognized":original.narrativeImportance,candidateIds:ids,ranking,cadence,
            audit:checked.audit, proposals:{rejection,suggestions,duplicates}});
        clock.rankAuditMs+=performance.now()-tick;
    }
    if (timing) Object.assign(timing,clock);
    return {method,replayOnly:true,scope:ctx.scope,through:ctx.revision,rounds,candidates,edges};
}
