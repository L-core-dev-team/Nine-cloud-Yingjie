import {isDeepStrictEqual as equal} from "node:util";
import {readFileSync} from "node:fs";
import {contexts,lines} from "../h3b/evaluate.mjs";
import {replayHighlights3B} from "../h3b/replay.mjs";
import {suggestNarrativeCandidates} from "../h3b/fixture.mjs";
import {stories} from "../h3b2/measure.mjs";
import {corpus} from "./measure.mjs";
import {replayHighlights3B2S as replay} from "./replay.mjs";
const read=f=>JSON.parse(readFileSync(f)),dir="packages/highlights/test/",evidence="docs/reports/evidence/";
const counts={},problems=[],targeted=[],changed=[],publicMisses=[];
const prior=new Map(read(evidence+"YJ-P04-H3B/baseline.json").prior.map(v=>[v.id,v.revision]));
let checkedSpans=0,director=0,sends=0;
function audit(group,id,texts,permissions){
    const cuts=contexts("scope-prefix-"+group+id,texts,permissions),full=replay(cuts.at(-1));
    const old=replayHighlights3B(cuts.at(-1),suggestNarrativeCandidates);
    counts[group]=(counts[group]??0)+cuts.length;
    let sameTrace=true,sameRanks=true;
    for(const [i,ctx] of cuts.entries()){
        const r=full.rounds[i],base=old.rounds[i],n=i+1,cut=replay(ctx);
        function verify(ok,rule){if(!ok)problems.push({group,id,n,rule});}
        verify(equal(cut.rounds,full.rounds.slice(0,n)),"as-of scope, ledger, status and ranking");
        for(const key of ["events","candidates","edges"])verify(equal(cut[key],full[key].filter(e=>e.learnedAt<=n)),key+" as-of");
        function trusted(e){
            const src=ctx.receipts[e.revision-1];
            return src&&e.revision<=n&&e.scope===ctx.scope&&e.session===ctx.sessionId&&e.sourceKey===src.source.key&&
                (e.narrativeSha256??e.sha256)===src.narrativeSha256&&e.start>=0&&e.end>e.start&&e.quote===texts[e.revision-1].slice(e.start,e.end);
        }
        function checkSpan(e){checkedSpans++;verify(trusted(e),"unbound source");}
        const scope=r.scope;verify(scope.asOf===n&&scope.learnedAt===n,"scope chronology");
        let end=0;
        for(const s of scope.spans){checkSpan(s);verify(s.start===end,"scope gap");end=s.end;}
        verify(end===texts[i].length,"incomplete scope");
        for(const c of scope.changes){checkSpan(c.evidence);verify(c.asOf===n&&c.learnedAt===n,"transition chronology");}
        for(const f of r.grounding)for(const e of [...f.claim.spans,...f.support??[],...f.against??[]])checkSpan(e);
        for(const e of cut.events.filter(e=>e.revision===n)){
            for(const source of e.evidence){
                checkSpan(source);
                const parts=cut.rounds[source.revision-1].scope.spans.filter(s=>s.start<source.end&&source.start<s.end);
                verify(parts.length&&parts.every(s=>s.world==="current-reality"&&s.frameId===e.frameId&&s.epoch===e.epoch),"cross-world event");
            }
        }
        verify(new Set(cut.events.map(e=>e.id)).size===cut.events.length,"duplicate identity");
        if(r.cadence.send!==false)sends++;
        if(r.cadence.action==="director-review"){director++;verify(base.cadence.action==="director-review"&&permissions?.[i]!=="revoked","director authority");}
        if(!equal(r.transaction,base.audit))sameTrace=false;
        if(!equal(r.ranking,base.ranking)||!equal(r.candidateIds,base.candidateIds)){
            sameRanks=false;if(group==="targeted")changed.push({id,n,text:texts[i],old:base.candidateIds,now:r.candidateIds,oldRank:base.ranking,newRank:r.ranking});
        }
        if(group.startsWith("public-")&&prior.get(id)===n)publicMisses.push({group,id,n,confirmed:r.candidateIds.length,oldConfirmed:base.candidateIds.length});
    }
    if(group==="targeted")targeted.push({id,revisions:cuts.length,sameTrace,sameRanks});
}
const h3a=evidence+"YJ-P04-H3A/";
for(const s of [...read(h3a+"pre-fix.json").replay.results.map(s=>({id:s.label,texts:s.texts})),...read(h3a+"new-corpus-freeze.json").files.flatMap(f=>lines(f.file))])audit("targeted",s.id,s.texts);
if(!process.argv.includes("--targeted-only")){
    for(const set of ["h1","h2","h2r-dev","h2r-held-public"]){
        const xs=set==="h1"?lines(dir+"locked.jsonl"):set==="h2"?lines(dir+"h2-locked.jsonl"):
            Array.from({length:18},(_,i)=>read(dir+"h2r/"+(set==="h2r-dev"?"dev":"held")+"/"+String(i+1).padStart(2,"0")+".json"));
        for(const s of xs)audit("public-"+set,s.id,s.history??(s.turns??s.rows).map(t=>t.text),s.rows?.map(t=>t.permission));
    }
    for(const part of ["dev","held"]){
        for(const s of lines(dir+"h3b/"+part+".jsonl"))audit("h3b-"+part,s.id,s.rows.map(r=>r.text));
        for(const s of corpus(part))audit("h3b2s-"+part,s.id,s.rows.map(r=>r.text));
    }
    for(const part of ["dev","held","reserve"])for(const s of stories(part))audit("h3b2-"+part,s.id,s.rows.map(r=>r.text));
}
console.log(JSON.stringify({counts,checkedSpans,problems,targeted,changed,publicMisses,director,sends}));
if(problems.length||changed.length||sends)process.exitCode=1;
