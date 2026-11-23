import assert from "node:assert/strict";
import {readdirSync} from "node:fs";
import {contexts,lines} from "../h3b/evaluate.mjs";
import {replayHighlights3A} from "../h3a/replay.mjs";
import {replayHighlights3B} from "../h3b/replay.mjs";
import {suggestNarrativeCandidates} from "../h3b/fixture.mjs";
import {sourceRow} from "../h3b/protocol.mjs";
import {replayHighlights3B2} from "./replay.mjs";
import {envelope} from "./propositions.mjs";
assert.equal(process.permission?.has("net"),false);
const dir="packages/highlights/test/h3b2/";
export function stories(part){return readdirSync(dir).filter(n=>n.startsWith(part+"-")&&n.endsWith(".jsonl")).sort().flatMap(n=>lines(dir+n));}
const fields=["kind","actor","other","item","before","after","time","source","polarity","qualifier"];
const ref=e=>[e.revision,e.start,e.end,e.sourceKey,e.narrativeSha256??e.sha256];
const exact=(p,q)=>fields.every(k=>p[k]===q[k]);
function metrics(){return {review:[0,0,0],fact:[0,0,0],ranks:0,top1:0,top3:0,pairs:0,ordered:0,rows:0,abstained:0,
    matrix:{},rolePairs:[0,0],slots:[0,0],legalSpans:0,emitted:0,unsupported:0,visual:0,sends:0,candidateOnly:0};}
function count(triple,want,got){if(want||got)triple[want?(got?0:2):1]++;}
function ratios([tp,fp,fn]){return {precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null};}
function measure(part){
    const totals={},results=[];
    for(const story of stories(part)){
        const cs=contexts("ground-"+story.id,story.rows.map(r=>r.text)),ctx=cs.at(-1);
        // Isolated measurement-only oracle. Its batch contains quoted propositions
        // and their proposed premises, never effective/verified/gold verdict flags.
        const tape=story.rows.map((r,i)=>r.claim?JSON.stringify([envelope(r.claim,
            [...r.deps,i+1].map(n=>sourceRow(ctx,n-1)))]):"[]");
        const runs={h3a:replayHighlights3A(ctx),h3b:replayHighlights3B(ctx,suggestNarrativeCandidates),
            empty:replayHighlights3B2(ctx,"none"),local:replayHighlights3B2(ctx),oracle:replayHighlights3B2(ctx,"data",JSON.stringify(tape))};
        const output={id:story.id,rows:[],rank:{}};
        for(const [name,run] of Object.entries(runs)){
            const g=totals[name]??=metrics(),birth=new Map(run.candidates.map(c=>[c.id,c]));
            const rank=run.rounds.at(-1).ranking.map(id=>birth.get(id).revision);
            output.rank[name]={expected:story.rank,observed:rank};
            if(story.rank.length){
                g.ranks++;g.top1+=Number(rank[0]===story.rank[0]);g.top3+=Number(rank.slice(0,3).includes(story.rank[0]));
                for(const [j,a] of story.rank.entries())for(const b of story.rank.slice(j+1)){
                    g.pairs++;g.ordered+=Number(rank.includes(a)&&rank.includes(b)&&rank.indexOf(a)<rank.indexOf(b));
                }
            }
            for(const [i,r] of run.rounds.entries()){
                const gold=story.rows[i],expected=gold.claim,findings=r.grounding??[],facts=r.candidateIds.map(id=>birth.get(id));
                const rightFact=facts.some(e=>expected&&e.frame===expected.kind&&["actor","other","item"].every(k=>e.roles[k]===expected[k]));
                // Preserve legacy positive emissions, including incompatible frames,
                // as unverified comparisons rather than granting a TP by revision.
                const want=!!gold.event,any=facts.length>0,review=any||!!(r.proposals?.suggestions.length||r.inheritedReview||findings.length);
                g.rows++;count(g.review,!!gold.review,review);
                if(want&&!rightFact)g.fact[2]++;
                if(want&&rightFact)g.fact[0]++;
                if(any&&(!want||!rightFact))g.fact[1]++;
                g.abstained+=Number(!any);g.emitted+=findings.length;g.candidateOnly+=Number(review&&!any);
                g.visual+=Number(r.cadence.action==="director-review");g.sends+=Number(r.cadence.send!==false);
                const info=[];
                for(const {statement:q,verdict:v} of findings){
                    for(const s of q.spans){
                        assert.equal(s.session,ctx.sessionId);assert.equal(s.scope,ctx.scope);assert.ok(s.revision<=i+1);
                        assert.equal(s.narrativeSha256,ctx.receipts[s.revision-1].narrativeSha256);
                        assert.equal(s.sourceKey,ctx.receipts[s.revision-1].source.key);assert.equal(s.quote,story.rows[s.revision-1].text.slice(s.start,s.end));g.legalSpans++;
                    }
                    info.push({slots:fields.map(k=>q[k]),verdict:v.entailment,outcome:v.outcomeEntailment,effect:v.effective,cause:v.cause,reason:v.reason,
                        stated:q.spans.map(ref),support:v.support.map(ref),against:v.against.map(ref)});
                }
                const best=expected&&findings.find(f=>exact(f.statement,expected));
                if(expected&&r.grounding){
                    const predicted=best?.verdict.entailment??(findings.length?"wrong-fields":"missing");
                    const cell=gold.verdict+"/"+predicted;g.matrix[cell]=(g.matrix[cell]??0)+1;
                    g.rolePairs[1]++;g.rolePairs[0]+=Number(findings.some(({statement:q})=>["actor","other","item"].every(k=>q[k]===expected[k])));
                    g.slots[1]+=fields.length;
                    g.slots[0]+=Math.max(0,...findings.map(({statement:q})=>fields.filter(k=>q[k]===expected[k]).length));
                }
                const errors=[];
                if(review!==!!gold.review)errors.push(review?"extra-review":"not-proposed");
                if(any&&(!want||!rightFact))errors.push("unmatched-confirmation");
                if(want&&!rightFact)errors.push(!review?"not-proposed":!best?"missing-roles-or-consequence":best.verdict.reason);
                if(expected&&r.grounding&&!best)errors.push("missing-or-misbound-proposition");
                if(best&&best.verdict.entailment!==gold.verdict)errors.push("entailment-"+best.verdict.entailment);
                if(!gold.visual&&r.cadence.action==="director-review")errors.push("unauthorized-visual");
                if(!any && gold.event && best?.verdict.entailment==="supported")g.unsupported++;
                output.rows.push({n:i+1,arm:name,review,facts:facts.map(e=>({id:e.id,frame:e.frame,roles:e.roles})),info,errors,
                    ...(r.batchError?{rejection:r.batchError}:{})});
            }
        }
        results.push(output);
    }
    for(const g of Object.values(totals)){g.discovery=ratios(g.review);g.confirmation=ratios(g.fact);}
    console.log(JSON.stringify({part,totals,results}));
}
const split=process.argv[2]?.replace(/^--split=/u,"");
if(process.argv[2]?.startsWith("--split=")&&["dev","held","reserve"].includes(split)&&process.argv[1]?.endsWith("measure.mjs"))measure(split);
