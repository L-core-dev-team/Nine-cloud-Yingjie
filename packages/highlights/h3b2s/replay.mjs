import {performance} from "node:perf_hooks";
import {replayHighlights3B} from "../h3b/replay.mjs";
import {sourceRow} from "../h3b/protocol.mjs";
import {emptyLedger,reviewRevision} from "../h3a/transaction.mjs";
import {origin,parseRevision,REAL} from "./scope.mjs";
import {SemanticLedger,readBatch} from "./semantic.mjs";

export const method="narrative-highlight/3b2s";
const property=c=>["durable-right","rights-transfer"].includes(c.frame);
function attribution(e,scopes,rows){
    const src=rows[e.revision-1],parts=scopes[e.revision-1]?.spans.filter(s=>s.start<e.end&&e.start<s.end);
    if(!src || src.sourceKey!==e.sourceKey || (e.sha256??e.narrativeSha256)!==src.narrativeSha256 ||
        e.scope!==src.scope || e.session!==src.session || src.text.slice(e.start,e.end)!==e.quote || !parts?.length)return null;
    const first=parts[0];
    if(parts.some(s=>s.control||s.frameId!==first.frameId||s.epoch!==first.epoch||s.world!==REAL))return null;
    return {...e,frameId:first.frameId,epoch:first.epoch};
}
export function replayHighlights3B2S(ctx,wire=null,timing={}){
    let start=performance.now();
    const base=replayHighlights3B(ctx); // authorized completed history, including per-row digest
    const tape=wire===null?null:typeof wire==="string" && wire.length<=2*1024*1024?JSON.parse(wire):false;
    if(tape!==null&&(!Array.isArray(tape)||tape.length>ctx.revision||!tape.every(r=>typeof r==="string")))throw Error("inert-json-tape-required");
    Object.assign(timing,{host:performance.now()-start,scope:0,ground:0,transaction:0,rankAudit:0});
    const baseByID=new Map(base.candidates.map(c=>[c.id,c])),rows=[],scopes=[],rounds=[],events=[],edges=[],catalog=new Map(),social=new Map();
    const semantics=new SemanticLedger();
    let cursor=origin(ctx.scope),financial=emptyLedger(),focus=null;
    for(const [i,old] of base.rounds.entries()){
        start=performance.now();
        const row=sourceRow(ctx,i),layer=parseRevision(cursor,row);
        cursor=layer.state;rows.push(row);scopes.push(layer);
        const root=cursor.stack[0],bind=e=>attribution(e,scopes,rows);
        const allReal=layer.spans.every(s=>s.world===REAL&&!s.control);
        timing.scope+=performance.now()-start;
        start=performance.now();
        // Keep previously established titles, restrictions, contested identities
        // and historical events. A new epoch needs its own disposition.
        const reentered=layer.changes.some(change=>change.op==="close"&&change.after===root.id);
        const interruptedPending=reentered?[...financial.pending.keys()]:[];
        if(reentered)financial={...financial,pending:new Map()};
        if(layer.changes.length)focus=null;
        const collection=allReal?old.audit:{
            assertions:old.audit.assertions.filter(bind),
            observations:old.audit.observations.filter(o=>bind(o.evidence)&&["challenge","unresolved"].includes(o.kind))
        };
        const reviewed=reviewRevision(financial,collection,ctx.receipts[i],ctx,focus);
        financial=reviewed.draft;focus=allReal?reviewed.focus:null;
        const legacy=[];
        for(const c of [...reviewed.candidates,...old.candidateIds.map(id=>baseByID.get(id)).filter(c=>!property(c))]){
            const evidence=c.evidence.map(bind);
            if(!evidence.length || evidence.some(e=>!e) || new Set(evidence.map(e=>e.epoch)).size!==1)continue;
            const f={...c,learnedAt:c.learnedAt??c.revision,frameId:root.id,epoch:evidence.at(-1).epoch,evidence};
            legacy.push(f);if(!property(f))social.set(f.id,f);
        }
        timing.transaction+=performance.now()-start;
        start=performance.now();
        let external=null,batchError=null;
        if(tape!==null){try{external=readBatch(tape[i]??"[]",rows);}catch(e){external=[];batchError=e.message;}}
        const data=semantics.advance(row,layer,reviewed.audit,external);
        timing.ground+=performance.now()-start;
        start=performance.now();
        const born=[...legacy,...data.born];
        for(const e of born){events.push(e);catalog.set(e.id,e);}
        const active=[...social.values(),...[...financial.candidates.values()].filter(c=>c.status==="active"&&catalog.has(c.id)).map(c=>catalog.get(c.id)),...data.active];
        const order=(a,b)=>b.score-a.score||a.revision-b.revision||(a.evidence.at(-1).start-b.evidence.at(-1).start);
        const ranks=active.sort(order);
        for(const edge of reviewed.audit.edges)edges.push({...edge,frameId:root.id});
        for(const e of data.born)edges.push({relation:"effective-under",from:e.evidence[0],to:e.id,frameId:e.frameId,epoch:e.epoch,learnedAt:i+1});
        const cadence=allReal&&!data.born.length && old.candidateIds[0]===born.slice().sort(order)[0]?.id ?old.cadence:
            {action:"text-only",reason:"independent-visual-evidence-required",send:false};
        rounds.push({revision:i+1,scope:layer,candidateIds:born.sort(order).map(c=>c.id),ranking:ranks.map(c=>c.id),batchError,
            interruptedPending,grounding:data.findings,semanticChanges:data.changes,transaction:reviewed.audit,cadence:{...cadence,send:false}});
        timing.rankAudit+=performance.now()-start;
    }
    return {method,replayOnly:true,scope:ctx.scope,through:ctx.revision,rounds,events,candidates:events,edges};
}
