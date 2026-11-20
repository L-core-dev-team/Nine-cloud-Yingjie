import {displayEligibility,referenceEligibility,sameVisual,eventKey} from "../contracts/dist/index.js";

// Internal YJ-11 consumer. The host supplies live authorization, file digest, current
// visual and an actual edit plan. An old accepted review alone grants neither use.
export function assessUses(asset,target,access,active,editPlan,inspect){
  const review={id:asset.review.id,status:asset.review.status,assessment:asset.review.assessment};
  const blocked=!access.authorized?"access-revoked":!target?"unknown-visible-state":!active?"target-inactive":null;
  let display=blocked??displayEligibility(asset,target,access,active);
  let reference=blocked??"no-edit-plan";
  if(!blocked && editPlan){
    const sameTarget=editPlan.action==="edit" && sameVisual(editPlan.target,target) &&
      eventKey(editPlan.target.source)===eventKey(target.source) && editPlan.target.source.revision===target.source.revision;
    reference=sameTarget?referenceEligibility(asset,editPlan,access):"wrong-target";
  }
  if(inspect && (display==="eligible" || reference==="eligible")){
    const elements=inspect(asset.sha256,asset.target);
    if(elements.status!=="accepted"){
      if(display==="eligible")display=elements.reason;
      if(reference==="eligible")reference=elements.reason;
    }
  }
  return {assetId:asset.assetId,review,display,reference};
}

export function visibleSpecification(visual){
  const {sceneId,people,features,timeOfDay,lighting,viewpoint,perspective}=visual;
  return {sceneId,people:[...people],features:[...features],timeOfDay,lighting,viewpoint,perspective};
}
