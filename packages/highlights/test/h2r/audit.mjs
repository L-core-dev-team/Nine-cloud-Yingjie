import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {session} from "../../../first-play/test/s2-host.mjs";
import {reviewVisualHistory} from "../../../first-play/visual-consistency.mjs";
import {replayHighlightsV2} from "../../v2/replay.mjs";
assert.equal(process.permission?.has("net"),false);
const stories=readFileSync(new URL("../h2-locked.jsonl",import.meta.url),"utf8").trim().split("\n").map(JSON.parse);
const matrix=[];
for(const s of stories){
  if(!s.turns.some(t=>t.expected.cadence==="director-review"))continue;
  const host=session(s.id);
  const contexts=s.turns.map(t=>host.append(t.text));
  for(const [i,t] of s.turns.entries()){
    if(t.expected.cadence!=="director-review")continue;
    const ctx={...contexts[i],replayOnly:true};
    ctx.planningSnapshots=ctx.receipts.map(r=>({scope:ctx.scope,revision:r.source.revision,sourceKey:r.source.key,narrativeSha256:r.narrativeSha256,planningAllowed:true,enabled:true,operation:"generate",task:"idle"}));
    const run=replayHighlightsV2(ctx),checked=reviewVisualHistory(ctx);
    const round=run.rounds.at(-1),survey=checked.turns[2].audit,first=s.turns[t.expected.depends[0]-1].text;
    const destination=first.match(/回到([^。]+)/u)[1],ambiguous=!ctx.registry.resolve(destination).place;
    matrix.push({story:s.id,revision:i+1,original:t.expected.cadence,narrativeDetected:round.kind!=="ordinary",
      sceneEvidenceComplete:checked.review.imageEligible,sourceAuthorized:ctx.authorized,visualReviewEligible:round.cadence.action==="director-review",
      auditVerdict:ambiguous?"ambiguous-location":"text-only-incomplete-visual",originalAction:round.cadence.action,
      surveyRevision:3,surveySource:survey.narrativeSha256,surveyFields:Object.fromEntries(Object.entries(survey.fields).map(([k,v])=>[k,v.precision])),
      blockers:checked.turns.at(-1).audit.blockers,sourceGap:ambiguous?"original promise omits region of nonunique place":null,
      extractionGap:"explicit named roster in preceding full survey and continuity in arrival text did not yield eligible S2 Visual",
      permission:"synthetic idle planning snapshot, no sending authority",send:false});
  }
}
assert.equal(matrix.length,12);console.log(JSON.stringify(matrix));
