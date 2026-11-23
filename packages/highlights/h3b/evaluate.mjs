import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlights3A } from "../h3a/replay.mjs";
import { replayHighlights3B } from "./replay.mjs";
import { suggestNarrativeCandidates } from "./fixture.mjs";
import { proposal,sentences } from "./protocol.mjs";
assert.equal(process.permission?.has("net"),false);
export const lines=file=>readFileSync(file,"utf8").trim().split("\n").map(JSON.parse);
export function contexts(id,texts,permissions=[]) {
    const host=session(id);
    return texts.map(text=>{
        const c=host.append(text);
        return {...c,replayOnly:true,planningSnapshots:c.receipts.map((r,i)=>({scope:c.scope,revision:i+1,sourceKey:r.source.key,
            narrativeSha256:r.narrativeSha256,task:"idle",operation:"generate",enabled:true,planningAllowed:permissions[i]!=="revoked"}))};
    });
}
export function prefixes(contexts,full) {
    for (const ctx of contexts) {
        const n=ctx.revision,cut=replayHighlights3B(ctx,suggestNarrativeCandidates);
        assert.deepEqual(cut.rounds,full.rounds.slice(0,n));
        assert.deepEqual(cut.candidates,full.candidates.filter(c=>c.revision<=n));
        assert.deepEqual(cut.edges,full.edges.filter(e=>e.learnedAt<=n));
        const keys=new Set();
        for (const r of cut.rounds) {
            assert.equal(r.cadence.send,false);
            for (const s of r.proposals.suggestions) {
                assert.equal(s.learnedAt,r.revision);assert.ok(!keys.has(s.key));keys.add(s.key);
                assert.equal(s.send,false);
                for(const e of s.spans) {
                    const j=e.revision-1;assert.ok(j>=0 && j<r.revision);
                    assert.equal(e.session,ctx.sessionId);assert.equal(e.scope,ctx.scope);
                    assert.equal(e.sourceKey,ctx.receipts[j].source.key);
                    assert.equal(e.narrativeSha256,ctx.receipts[j].narrativeSha256);
                    assert.equal(e.quote,ctx.history[j].narrative.slice(e.start,e.end));
                }
            }
        }
    }
}
function evaluate(part) {
    const stories=lines("packages/highlights/test/h3b/"+part+".jsonl"), groups={},details=[],failures=[];
    for (const story of stories) {
        const cuts=contexts("h3b-"+part+story.id,story.rows.map(r=>r.text)),ctx=cuts.at(-1);
        // Evaluation-only oracle knows the review label but has zero admission authority.
        const oracle=v=>JSON.stringify(story.rows[v.length-1].review?[proposal(v,"petition",sentences(v.at(-1)))]:[]);
        const runs={h3a:replayHighlights3A(ctx),nullProvider:replayHighlights3B(ctx),fixture:replayHighlights3B(ctx,suggestNarrativeCandidates),
            oracleRouteOnly:replayHighlights3B(ctx,oracle)};
        prefixes(cuts,runs.fixture);
        for (const [method,out] of Object.entries(runs)) {
            const g=groups[method]??={reviewTP:0,reviewFP:0,reviewFN:0,factTP:0,factFP:0,factFN:0,quietTP:0,quietGold:0,rankGold:0,top1:0,top3:0,spans:0,
                textReview:0,linked:0,abstentions:0,invalidBatches:0,visualErrors:0,roleComplete:0,roleTargets:0};
            const ranked=out.rounds.at(-1).ranking.map(id=>out.candidates.find(c=>c.id===id).revision);
            if(story.rank.length){g.rankGold++;g.top1+=Number(ranked[0]===story.rank[0]);g.top3+=Number(ranked.slice(0,3).includes(story.rank[0]));}
            const revisions=[];
            for(const [i,r] of out.rounds.entries()) {
                const gold=story.rows[i],fact=r.candidateIds.length>0,s=r.proposals?.suggestions??[],review=fact||s.length>0;
                const tally=(prefix,actual,wanted)=>{if(actual||wanted) g[prefix+(wanted?(actual?"TP":"FN"):"FP")]++;};
                tally("review",review,gold.review);tally("fact",fact,gold.fact);
                if(gold.kind==="quiet"){g.quietGold++;g.quietTP+=Number(fact);}
                if(gold.fact){g.roleTargets++;g.roleComplete+=Number(s.some(p=>gold.entities.every(e=>Object.values(p.entities).includes(e))));}
                g.spans+=s.reduce((n,p)=>n+p.spans.length,0);g.abstentions+=Number(!fact);
                g.linked+=s.filter(p=>p.fact).length;g.textReview+=s.filter(p=>!p.fact).length;g.invalidBatches+=Number(!!r.proposals?.rejection);
                g.visualErrors+=Number(r.cadence.action==="director-review" || r.cadence.send!==false);
                revisions.push({r:i+1,review,fact,types:s.map(x=>x.type),rank:r.ranking.length,roles:s.map(x=>x.entities),anchors:s.map(x=>x.spans.map(e=>[e.revision,e.start,e.end]))});
                if(review!==gold.review||fact!==gold.fact) failures.push({story:story.id,r:i+1,method,expected:[gold.review,gold.fact],actual:[review,fact]});
            }
            details.push({story:story.id,method,ranked,revisions});
        }
    }
    console.log(JSON.stringify({part,groups,details,failures,prefixes:stories.reduce((n,s)=>n+s.rows.length,0)}));
}
if (["dev","held"].includes(process.argv[2])) evaluate(process.argv[2]);
