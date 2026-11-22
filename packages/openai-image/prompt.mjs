import {isDeepStrictEqual} from "node:util";
import {AssetSchema, DecisionSchema, eventKey, fromCardHistory, referenceEligibility, requestKey, sameVisual} from "../contracts/dist/index.js";
import {extractSceneEvidence} from "../first-play/scene-evidence.mjs";
import {extractContinuity} from "../first-play/continuity.mjs";
import {walkthrough} from "../first-play/story.mjs";
import {project} from "../scene-state/project.mjs";
import {cardScope} from "../scene-state/store.mjs";
import {sha256} from "../image-tasks/files.mjs";
import {staticPng} from "./png.mjs";

export const model = "gpt-image-2.6-sunburst";
export const specification = Object.freeze({model, n:1, size:"1536x864", quality:"medium", output_format:"png"});
const difference = (a,b) => a.filter(x => !b.includes(x)).sort();
const overlap = (a,b) => a.filter(x => b.includes(x)).sort();

// The host reads ordered rows from authenticated completed-history. No action enters extraction or the prompt.
export function replaySaved(owner,session,rows) {
  if(!Array.isArray(rows) || !rows.length) throw Error("missing-history");
  const state={current:null,places:[]};
  return rows.map((row,index)=>{
    const {source,narrative}=fromCardHistory(owner,session,row);
    if(source.revision!==index+1) throw Error("history-gap");
    // The reviewed YJ-02/first-play baseline predates scene-evidence/1. Its exact saved prose
    // explicitly enumerates all three people. Other initial narratives need the complete L3 survey.
    const extract=index===0 && narrative===walkthrough[0] ? extractContinuity : extractSceneEvidence;
    const {observations}=extract({source,narrative,state});
    return structuredClone(project(state,source,observations));
  });
}

function sameSnapshot(a,b) {
  return a && b && sameVisual(a,b) && isDeepStrictEqual(a.source,b.source);
}

// Shared formatting only. Authorization and saved-history replay stay in the respective callers.
export function visibleSurveyLines(scene,v,visibleTags) {
  const visible=new Set([scene.name,scene.parentSceneId,...v.people,...v.features]);
  const tags=visibleTags.filter(tag=>visible.has(tag)).sort();
  const frame={地点:scene.name,所属地点:scene.parentSceneId,观察位置:v.viewpoint,观察视角:v.perspective,
    在场总人数:v.people.length,完整名单:[...v.people].sort(),眼前结构:[...v.features].sort(),时段:v.timeOfDay,光照:v.lighting};
  if(tags.length) frame.已揭示标签=[...new Set(tags)];
  return ["绘制当前所见的一幅静态场景。人数和结构以所列事实为限，未揭示的人物、建筑与装饰留白。",JSON.stringify(frame)];
}

export function buildFrame(claim,ctx) {
  return frameFromHistory(claim,ctx,replaySaved);
}

// Common renderer and reference verifier. Each versioned caller fixes its own authenticated
// history reader; the normal provider never takes a replay implementation from the request.
export function frameFromHistory(claim,ctx,readHistory,lightingExplanation=null) {
  const plan=DecisionSchema.parse(claim.plan), v=plan.target, s=v.source;
  if(!["generate","edit"].includes(plan.action) || s.kind!=="card-history") throw Error("no-image-operation");
  if(ctx?.authorized!==true || ctx.enabled!==true || ctx.scope!==cardScope(s.ownerId,s.sessionId) ||
    ctx.result?.status!=="ready" || ctx.revision!==s.revision || ctx.history?.length!==s.revision) throw Error("inactive-target");
  const history=readHistory(s.ownerId,s.sessionId,ctx.history);
  const current=history.at(-1);
  if(current.status!=="ready" || !sameSnapshot(current.visual,v) || !sameSnapshot(ctx.result.visual,v) ||
    !isDeepStrictEqual(current.scene,ctx.result.scene)) throw Error("unconfirmed-visual");
  const scene=current.scene;
  const lines=visibleSurveyLines(scene,v,ctx.visibleTags??[]);
  if(lightingExplanation)lines.push(lightingExplanation);
  let referenceBytes,reference=null;
  if(plan.action==="edit"){
    const asset=AssetSchema.parse(ctx.asset);
    if(ctx.referenceActive!==true || ctx.latestAcceptedId!==asset.assetId || !Buffer.isBuffer(claim.referenceBytes) ||
      claim.referenceBytes.length>16*1024*1024)
      throw Error("inactive-reference");
    referenceBytes=Buffer.from(claim.referenceBytes);
    const digest=sha256(referenceBytes);
    if(referenceEligibility(asset,plan,{source:s,authorized:true,observedSha256:digest})!=="eligible" ||
       asset.storageKey!==digest+".png" || asset.format!=="png") throw Error("ineligible-reference");
    const before=asset.target, prior=history[before.source.revision-1];
    if(before.source.revision>=s.revision || prior?.status!=="ready" || !sameSnapshot(prior.visual,before)) throw Error("stale-reference");
    const info=staticPng(referenceBytes);
    if(info.width!==asset.width || info.height!==asset.height) throw Error("reference-dimensions");
    const retained=overlap(before.people,v.people), fixed=overlap(before.features,v.features);
    lines.push("编辑所附原图。保持下列留存人物的身份、服饰及无变化的可见位置，保持留存结构的布局。仅按当前证据更新画面。",
      JSON.stringify({留存人物:retained,留存结构:fixed,到场:difference(v.people,before.people),离场:difference(before.people,v.people),
        新增结构:difference(v.features,before.features),移除结构:difference(before.features,v.features),
        原时段:before.timeOfDay,当前时段:v.timeOfDay,原光照:before.lighting,当前光照:v.lighting}));
    reference={assetId:asset.assetId,sha256:digest,reviewId:asset.review.id};
  }else if(claim.referenceBytes!=null) throw Error("unexpected-reference");
  // Multipart serializes text line endings as CRLF. Bind exactly the same bytes for JSON and multipart.
  const prompt=lines.join("\r\n");
  const binding={scope:ctx.scope,eventKey:eventKey(s),requestKey:requestKey(plan),sceneId:v.sceneId,
    visualVersion:v.visualVersion,operation:plan.action,specification,promptSha256:sha256(prompt),reference};
  return {prompt,referenceBytes,binding,bindingSha256:sha256(JSON.stringify(binding))};
}
