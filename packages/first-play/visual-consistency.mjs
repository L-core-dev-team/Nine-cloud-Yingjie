import {isDeepStrictEqual as equal} from "node:util";
import {AssetSchema, DecisionSchema, displayEligibility, referenceEligibility} from "../contracts/dist/index.js";
import {createEvidenceReplay} from "./scene-evidence-v2.mjs";
import {staticPng} from "../openai-image/png.mjs";
import {cardScope,hash} from "../scene-state/store.mjs";

export const method="visual-consistency/1";
const decision=(fieldReady,verdict,reason,evidence=[])=>({method,fieldReady,imageEligible:verdict==="eligible",verdict,reason,evidence});
const digestSpan=(audit,start,end)=>({revision:audit.revision,sha256:audit.narrativeSha256,start,end});

// Only a first-person observation explicitly lasting through the very next survey is
// considered. The location and viewpoint must match, and the named emitter must be visible.
function localDisclosure(previous,current,text,registry){
  if(!previous)return null;
  const match=/^我站在([\p{Script=Han}]+)的([\p{Script=Han}]+)的([\p{Script=Han}]+)，亲眼确认([^。]+)。我留在原位，此情形持续到下一次环顾结束。$/u.exec(text);
  if(!match || registry.resolve(match[2],match[1]).place?.sceneId!==current.sceneId || match[3]!==current.viewpoint)return null;
  const observation=match[4],span=digestSpan(previous.audit,0,text.length);
  if(observation==="四壁严密封闭，连一丝外界天光也照不进来")return {kind:"sealed",span};
  if(observation==="这里是露天平台，四周没有屋舍")return {kind:"outdoors",span};
  for(const feature of current.features){
    if(observation===feature+"上的引日阵正把夜间的日光投到我眼前")return {kind:"night-sun",feature,span};
    if(observation===feature+"上的映月阵正把正午的月光投到我眼前")return {kind:"noon-moon",feature,span};
    if(observation===feature+"位于我正北方，我背向它时便看不见它")return {kind:"north",span};
    if(observation===feature+"只在远山背面，这里完全看不见它")return {kind:"distant",span};
  }
  return {kind:"unclassified",span};
}

function judgeTurn(turn,previous,history,reviews,turns,registry){
  const {audit,result}=turn;
  if(result.status!=="ready"){
    const clash=audit.blockers.some(x=>x.startsWith("conflict:") || x==="location-after-observations");
    return decision(false,clash?"conflict":"not-ready",clash?"contradictory-observation":"incomplete-evidence",
      audit.evidence.map(e=>digestSpan(audit,e.start,e.end)));
  }
  const v=result.visual, text=history[audit.revision-1].narrative;
  const evidence=[],dependencies=new Set();
  for(const [field,record] of Object.entries(audit.fields)){
    const expected=field==="place"?v.sceneId:v[field];
    if(record.precision!=="complete" || record.admitted===false || !equal(record.value,expected))
      return decision(false,"not-ready","invalid-field-lineage");
    for(const i of [...record.spans,...(record.contextSpans??[])]){
      const e=audit.evidence[i];
      if(!e || e.start<0 || e.end<=e.start || e.end>text.length)return decision(false,"not-ready","invalid-span");
      evidence.push({...digestSpan(audit,e.start,e.end),field});
    }
    if(record.confirmedFrom){
      const prior=turns[record.confirmedFrom.revision-1];
      if(!prior || prior.result.visual?.sceneId!==v.sceneId || !equal(prior.audit.source,record.confirmedFrom))
        return decision(false,"not-ready","invalid-field-lineage");
      dependencies.add(prior.audit.revision);
      evidence.push({field,priorRevision:prior.audit.revision,sha256:prior.audit.narrativeSha256});
    }
  }
  const location=audit.evidence[audit.fields.place.spans[0]];
  const inPlace=location?.rule==="registered-location" && /^此时[我你]身在/u.test(text.slice(location.start,location.end));
  const proof=inPlace?localDisclosure(previous,v,history[audit.revision-2]?.narrative,registry):null;
  if(proof)evidence.push({...proof.span,rule:proof.kind});
  const verdict=(state,reason)=>decision(true,state,reason,evidence);
  const light=v.lighting;
  if(proof?.kind==="sealed" && ["日光","月光"].includes(light))return verdict("conflict","enclosed-daylight");
  if(proof?.kind==="outdoors" && audit.fields.lighting.spans.some(i=>{
    const e=audit.evidence[i];return text.slice(e.start,e.end).endsWith("照亮屋内");
  }))return verdict("conflict","outside-interior");
  if(proof?.kind==="north" && v.perspective==="玩家向南所见")return verdict("conflict","opposite-facing");
  if(proof?.kind==="north" && v.perspective!=="玩家向北所见")return verdict("needs-review","view-angle-undetermined");
  if(proof?.kind==="unclassified")return verdict("needs-review","unverified-local-observation");
  if(proof?.kind==="distant")return verdict("conflict","out-of-view");
  const exception=v.timeOfDay==="夜间" && light==="日光"?"night-sun":v.timeOfDay==="正午" && light==="月光"?"noon-moon":null;
  if(["night-sun","noon-moon"].includes(proof?.kind) && exception!==proof.kind)
    return verdict("needs-review","light-source-disagrees-with-survey");
  if(exception && proof?.kind!==exception)return verdict("needs-review","temporal-lighting-ambiguity");
  if([...dependencies].some(rev=>!reviews[rev-1]?.imageEligible))return verdict("needs-review","unresolved-prior-observation");
  if(exception)return {...verdict("eligible","revealed-light-source"),lightSource:{kind:exception,feature:proof.feature}};
  return verdict("eligible","consistent");
}

// Internal trusted-host interface. Every S1 audit is recomputed from the authenticated
// receipts; client assertions, action, images and worldbook metadata are never evidence.
export function reviewVisualHistory(ctx){
  const {owner,sessionId,registry,history,receipts}=ctx??{};
  if(typeof owner!=="string" || !owner.trim() || typeof sessionId!=="string" || !sessionId.trim() || ctx.authorized!==true || ctx.enabled!==true || ctx.scope!==cardScope(owner,sessionId))
    return {review:decision(false,"not-ready","access-denied")};
  if(!Array.isArray(history) || !history.length || ctx.revision!==history.length || receipts?.length!==history.length)
    return {review:decision(false,"not-ready","source-mismatch")};
  const turns=[],reviews=[];
  try{
    const replay=createEvidenceReplay({owner,sessionId,registry,replayOnly:true});
    for(const [i,row] of history.entries()){
      if(row.resulting_revision!==i+1)throw Error("revision-order");
      const turn=replay.append(row,receipts[i]);
      const verdict=judgeTurn(turn,turns.at(-1),history,reviews,turns,registry);
      const {registryDigest,revision,narrativeSha256,source}=turn.audit;
      const reviewSha256=hash(JSON.stringify([registryDigest,source,turn.result,verdict]));
      reviews.push({...verdict,revision,narrativeSha256,reviewSha256});
      turns.push(turn);
    }
  }catch{return {review:decision(false,"not-ready","source-mismatch")};}
  const current=turns.at(-1);
  if(ctx.result && !equal(ctx.result,current.result) || ctx.audit && !equal(ctx.audit,current.audit))
    return {review:decision(false,"not-ready","source-mismatch")};
  return {turns,reviews,review:reviews.at(-1)};
}

export function reviewAssetUse(checked,plan,stored){
  if(!checked.review.imageEligible)return checked.review;
  const denied=()=>decision(true,"not-ready","reference-ineligible");
  const parsed=DecisionSchema.safeParse(plan), asset=AssetSchema.safeParse(stored?.asset);
  if(!parsed.success || !asset.success || stored.active!==true || !Buffer.isBuffer(stored.bytes) || !equal(plan.target,checked.turns.at(-1).result.visual))return denied();
  const a=asset.data,prior=a.target.source.revision;
  if(a.format!=="png" || a.storageKey!==a.sha256+".png")return denied();
  try{
    const actual=staticPng(stored.bytes);
    if(actual.width!==a.width || actual.height!==a.height)return denied();
  }catch{return denied();}
  if(!checked.reviews[prior-1]?.imageEligible || !equal(a.target,checked.turns[prior-1]?.result.visual))return denied();
  if(plan.action==="reuse" && !equal(checked.reviews[prior-1].lightSource,checked.review.lightSource))return denied();
  if(plan.action==="edit"){
    const retained=(before,after)=>before.filter(x=>after.includes(x)).sort();
    if(!equal([...plan.preservePeople].sort(),retained(a.target.people,plan.target.people)) ||
       !equal([...plan.preserveFeatures].sort(),retained(a.target.features,plan.target.features)))return denied();
  }
  const access={authorized:true,source:plan.target.source,observedSha256:hash(stored.bytes)};
  const ok=plan.action==="reuse" && plan.assetId===a.assetId && displayEligibility(a,plan.target,access,true)==="eligible" ||
    plan.action==="edit" && prior<plan.target.source.revision && referenceEligibility(a,plan,access)==="eligible";
  return ok?checked.review:denied();
}
