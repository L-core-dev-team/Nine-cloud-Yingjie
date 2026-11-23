import {performance} from "node:perf_hooks";
import {hash} from "../../scene-state/store.mjs";
import {sourceRow} from "../h3b/protocol.mjs";
import {suggestNarrativeCandidates} from "../h3b/fixture.mjs";
import {replayHighlights3B} from "../h3b/replay.mjs";
import {validate} from "./propositions.mjs";
import {proposePropositions} from "./local.mjs";
import {challenge,ground} from "./grounding.mjs";
import {origin,advanceScope} from "./discourse.mjs";

export const method="narrative-highlight/3b2";
export function replayHighlights3B2(ctx,mode="local",wire=null,timing={}) {
    if (!["local","data","none"].includes(mode)) throw Error("unknown-offline-mode");
    let tape=[];
    if(mode==="data"){
        if(typeof wire!=="string"||wire.length>2*1024*1024)throw Error("tape-limit");
        tape=JSON.parse(wire);
        if(!Array.isArray(tape)||tape.length>ctx.revision||!tape.every(s=>typeof s==="string"))throw Error("inert-strings-required");
    }
    let start=performance.now();
    const legacy=replayHighlights3B(ctx,mode==="none"?undefined:suggestNarrativeCandidates);
    Object.assign(timing,{legacy:performance.now()-start,extract:0,validation:0,ground:0,transaction:0,rankAudit:0});
    const byId=new Map(legacy.candidates.map(c=>[c.id,c])),history=[],events=[],rounds=[],edges=[],consumed=new Set();
    let active=new Map(),scope=origin(),legacyCut=null;
    for(const [i,r] of legacy.rounds.entries()) {
        const row=sourceRow(ctx,i);history.push(row);
        scope=advanceScope(scope,row);
        if(scope.quarantined && legacyCut===null)legacyCut=i+1;
        const legacyIds=scope.quarantined?[]:r.candidateIds;
        const view=history.slice(-64), bounded=view.reduce((n,r)=>n+r.text.length,0)<=65536;
        let raw="[]",batch=[],error=null;
        start=performance.now();
        if(!bounded) error="context-limit";
        else if(mode==="local")raw=proposePropositions(view);
        else if(mode==="data")raw=tape[i]??"[]";
        timing.extract+=performance.now()-start;
        start=performance.now();
        if(!error){try{batch=validate(raw,view);}catch(e){error=e.message;}}
        timing.validation+=performance.now()-start;
        start=performance.now();
        const old={audit:scope.quarantined?{asOfRevision:i+1,observations:[],judgments:[],changes:{},withheld:"unscoped-legacy-ledger"}:r.audit,
            facts:legacyIds.map(id=>byId.get(id))};
        const findings=batch.map(q=>({statement:q,verdict:ground(q,history,old,scope)}));
        timing.ground+=performance.now()-start;
        start=performance.now();
        // Positive events and their causal edges publish together. Independent
        // host corrections still withdraw live ranks when a provider is absent.
        const draft=new Map(active), born=[],changes=[];
        for(const [id,e] of active) if(scope.world==="current" && challenge({...e.roles,kind:e.frame},row.text)){
            draft.delete(id);changes.push({type:"suspended",id,asOf:i+1,sourceKey:row.sourceKey});
        }
        for(const {statement:q,verdict:v} of findings){
            if(v.cause!=="supported"||v.effective!=="supported"||v.baseEvent)continue;
            const identity=[ctx.scope,q.kind,q.actor,q.other,q.item,v.antecedent],id=hash(JSON.stringify(identity));
            if(consumed.has(id))continue;
            const event={id,revision:i+1,learnedAt:i+1,source:r.source,kind:"quiet",frame:q.kind,
                roles:{actor:q.actor,other:q.other,item:q.item},evidence:v.support,antecedent:v.antecedent,
                score:8+Math.min(3,(i+1-v.support[0].revision)/4)+(q.kind==="release"?1:0)};
            born.push(event);draft.set(id,event);
            changes.push({type:"admitted",id,asOf:i+1,sourceKey:row.sourceKey});
        }
        for(const e of born) {
            consumed.add(e.id);events.push(e);
            edges.push({type:"evidenced-outcome",from:e.antecedent,to:e.id,learnedAt:i+1,sourceKey:row.sourceKey});
        }
        active=draft;
        timing.transaction+=performance.now()-start;
        start=performance.now();
        const inheritedRanks=scope.quarantined?[]:r.ranking.map(id=>byId.get(id));
        const ranks=[...inheritedRanks,...active.values()].sort((a,b)=>b.score-a.score||a.revision-b.revision);
        const ids=[...legacyIds,...born.map(e=>e.id)];
        const cadence=born.length||scope.quarantined?{action:"text-only",reason:"semantic-event-without-visual-qualification",send:false}:r.cadence;
        rounds.push({revision:i+1,sourceKey:row.sourceKey,state:ids.length?"confirmed-peak":scope.quarantined?"unverified":r.state,candidateIds:ids,ranking:ranks.map(e=>e.id),cadence,
            grounding:findings,batchError:error,changes,scope,inheritedReview:r.proposals.suggestions.length,transaction:old.audit});
        timing.rankAudit+=performance.now()-start;
    }
    const admissible=(n)=>legacyCut===null||n<legacyCut;
    return {method,replayOnly:true,scope:ctx.scope,through:ctx.revision,rounds,events,
        candidates:[...legacy.candidates.filter(c=>admissible(c.revision)),...events],
        edges:[...legacy.edges.filter(e=>admissible(e.learnedAt)),...edges]};
}
