import {hash} from "../../scene-state/store.mjs";
import {ground,challenge} from "../h3b2/grounding.mjs";
import {proposePropositions} from "../h3b2/local.mjs";
import {validate} from "../h3b2/propositions.mjs";
import {REAL} from "./scope.mjs";

const premise=/答应把|曾向.{1,12}许诺交付|承担担保责任|已经断绝往来/u;
function excerpts(row,scope){
    const lists=[];
    for(const s of scope.spans){
        if(s.control)continue;
        const last=lists.at(-1);
        if(last && last.end===s.start && last.epoch===s.epoch && last.frameId===s.frameId && !premise.test(last.text) && !premise.test(s.quote)){
            last.end=s.end;last.text+=s.quote;
        } else lists.push({...s,text:s.quote});
    }
    return lists;
}
function excerpt(block,row){
    // Local coordinates are private scratch data. Only evidence rebound to the
    // complete original narrative is published.
    return {...row,text:block.text,sourceKey:hash(JSON.stringify([row.sourceKey,block.start,block.frameId])),
        narrativeSha256:hash(block.text),original:row,offset:block.start,frameId:block.frameId,epoch:block.epoch};
}
function toOriginal(e,byKey){
    const v=byKey.get(e.sourceKey),s=v.original,start=v.offset+e.start,end=v.offset+e.end;
    if(s.text.slice(start,end)!==e.quote)throw Error("excerpt-rebinding-failed");
    return {...e,revision:s.revision,sourceKey:s.sourceKey,narrativeSha256:s.narrativeSha256,start,end,frameId:v.frameId,epoch:v.epoch};
}
export class SemanticLedger{
    constructor(){this.context=[];this.active=new Map();this.used=new Set();}
    advance(row,scope,old,external){
        const draft=new Map(this.active),staged=[],findings=[],changes=[];
        const blocks=excerpts(row,scope);
        for(const b of blocks){
            const clip=excerpt(b,row);
            if(this.context.at(-1)?.epoch!==clip.epoch || this.context.at(-1)?.frameId!==clip.frameId)this.context=[];
            clip.revision=this.context.length+1;
            this.context.push(clip);
            const view=this.context.slice(-64);
            const byKey=new Map(view.map(v=>[v.sourceKey,v]));
            let batch;
            if(external===null)batch=JSON.parse(proposePropositions(view));
            else {
                batch=[];
                for(const supplied of external){
                    const anchor=supplied.spans.at(-1);
                    if(anchor.start<b.start||anchor.end>b.end)continue;
                    const spans=supplied.spans.map(e=>{
                        const loc=view.find(v=>v.original.sourceKey===e.sourceKey && v.offset<=e.start && v.offset+v.text.length>=e.end);
                        return loc?{...e,revision:loc.revision,sourceKey:loc.sourceKey,narrativeSha256:loc.narrativeSha256,start:e.start-loc.offset,end:e.end-loc.offset}:null;
                    });
                    if(spans.some(s=>!s)){
                        findings.push({claim:supplied,frameId:b.frameId,world:b.world,reason:"evidence-outside-frame-or-epoch",effective:false});continue;
                    }
                    batch.push({...supplied,spans});
                }
            }
            if(b.world===REAL){
                for(const [id,e] of draft)if(challenge({...e.roles,kind:e.frame},b.text)){
                    draft.delete(id);changes.push({op:"suspend",id,frameId:b.frameId,evidence:b});
                }
            }
            for(const q of batch){
                const claim={...q,asOf:row.revision,learnedAt:row.revision,spans:q.spans.map(s=>toOriginal(s,byKey))};
                const finding={claim,frameId:b.frameId,epoch:b.epoch,world:b.world,assertion:true,observedInFrame:false,effective:false};
                findings.push(finding);
                // ground() reads its own before/action/consequence roles from text.
                // Scratch rows are ordered by position; source revisions stay intact.
                const v=ground(q,view,{audit:old,facts:[]},{since:1,world:"current"});
                finding.observedInFrame=v.outcomeEntailment==="supported";
                finding.reason=b.world!==REAL?"noncurrent-or-unresolved-frame":v.reason;
                finding.support=v.support.map(e=>toOriginal(e,byKey));finding.against=v.against.map(e=>toOriginal(e,byKey));
                if(b.world!==REAL||v.cause!=="supported")continue;
                const pre=byKey.get(v.antecedent);
                if(!pre || pre.frameId!==b.frameId || pre.epoch!==b.epoch)throw Error("frame-cause-mismatch");
                const roles={actor:q.actor,other:q.other,item:q.item};
                const id=hash(JSON.stringify([row.scope,b.frameId,b.epoch,roles,q.kind,pre.original.sourceKey,pre.offset]));
                if(this.used.has(id)||staged.some(e=>e.id===id)){finding.reason="duplicate";continue;}
                const veto=blocks.some(z=>z.world===REAL && z.start>b.end-1 && challenge({...roles,kind:q.kind},z.text));
                if(veto){finding.reason="later-real-challenge";continue;}
                finding.effective=true;
                const event={id,sourceKey:row.sourceKey,revision:row.revision,learnedAt:row.revision,start:b.start,end:b.end,frame:q.kind,
                    frameId:b.frameId,epoch:b.epoch,roles,evidence:finding.support,score:8,kind:"quiet",send:false};
                staged.push(event);draft.set(id,event);changes.push({op:"admit",id,frameId:b.frameId});
            }
        }
        const born=staged.filter(e=>draft.has(e.id));
        for(const e of born)this.used.add(e.id);
        this.active=draft;
        return {born,findings,changes,active:[...draft.values()]};
    }
}
export function readBatch(raw,history){return validate(raw,history.slice(-64));}
