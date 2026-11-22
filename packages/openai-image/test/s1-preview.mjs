import {cardScope,hash} from "../../scene-state/store.mjs";
import {createEvidenceReplay} from "../../first-play/scene-evidence-v2.mjs";
import {visibleSurveyLines,specification} from "../prompt.mjs";

// No provider, credential, grant, reference loader or transport is in this preview's interface.
export function previewInitialFrame({owner,sessionId,scope,authorized,rows,receipts,visibleTags=[],action="generate"}){
  if(authorized!==true || scope!==cardScope(owner,sessionId) || !Array.isArray(rows) || !rows.length ||
     rows.length!==receipts?.length)throw Error("unauthorized-or-incomplete-history");
  const replay=createEvidenceReplay({owner,sessionId,replayOnly:true});
  const history=rows.map((row,i)=>{
    if(row.resulting_revision!==i+1)throw Error("history-order");
    return replay.append(row,receipts[i]).result;
  });
  const current=history.at(-1);
  if(current.status!=="ready")return {status:"not-ready"};
  if(action!=="generate" || history.slice(0,-1).some(x=>x.visual?.sceneId===current.scene.sceneId))
    return {status:"no-new-initial-frame"};
  const prompt=visibleSurveyLines(current.scene,current.visual,visibleTags).join("\r\n");
  return {status:"offline-preview",prompt,promptSha256:hash(prompt),specification,reference:null};
}
