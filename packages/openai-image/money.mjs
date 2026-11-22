import {isDeepStrictEqual} from "node:util";
import {sha256} from "../image-tasks/files.mjs";
import {model,specification} from "./prompt.mjs";

const batch="i2-mock-usd-v1", project="local-fake-image-project";
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const positive=n=>Number.isSafeInteger(n) && n>0;
const phases=new Set(["gate-checked","money-reserved","possible-sent","provider-response-seen","original-saved","pending-review","stop"]);
const one=async(db,sql,params)=>(await db.query(sql,params)).rows[0];
export const officialSnapshot=Object.freeze({model,checked:"2026-11-22",currency:"USD",tier:"standard",
  source:"https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst",
  textInputUsdPerMillion:5,imageInputUsdPerMillion:8,imageOutputUsdPerMillion:30,
  enforceableOutputLimit:null,enforceableReferenceCharge:null});
export const livePreflight=()=>({allowLiveSend:false,status:"LIVE_BLOCKED_COST_BOUND",reason:"COST_BOUND_UNVERIFIED",
  maxMicroUsd:null,projectAccess:"NOT_RUN",snapshot:officialSnapshot});

// This finite tariff defines our in-process fake service. It is never a quote for an API.
function fakeTariff(operation){
  return {version:"i2-fake-tariff/1",project,currency:"USD",tier:"fixture",operation,
    textInput:{tokens:1000,microUsdPerToken:1},imageInput:{tokens:operation==="edit"?500:0,microUsdPerToken:2},
    imageOutput:{tokens:1000,microUsdPerToken:3},otherCharges:0};
}
export function maxChargeBound(snapshot,operation){
  if(!["generate","edit"].includes(operation) || !isDeepStrictEqual(snapshot,fakeTariff(operation)))
    throw Error("COST_BOUND_UNVERIFIED");
  return [snapshot.textInput,snapshot.imageInput,snapshot.imageOutput].reduce((sum,line)=>sum+line.tokens*line.microUsdPerToken,0);
}

function binding(frame,ctx,source){
  const b=frame.binding,edit=b.operation==="edit";
  if(!isDeepStrictEqual(b.specification,specification) || !["generate","edit"].includes(b.operation))throw Error("invalid-image-spec");
  return {operation:b.operation,method:"POST",endpoint:"https://api.openai.com/v1/images/"+(edit?"edits":"generations"),
    project,scopeHash:sha256(b.scope),ownerHash:sha256(source.ownerId),sessionHash:sha256(source.sessionId),
    sceneId:b.sceneId,visualVersion:b.visualVersion,eventHash:sha256(b.eventKey),requestHash:sha256(b.requestKey),
    revision:source.revision,sourceSha256:sha256(ctx.history.at(-1).narrative),promptSha256:b.promptSha256,
    specification:{...specification},reference:b.reference?{...b.reference}:null,
    purpose:edit?"synthetic-tavern-reference-edit":"synthetic-tavern-opening"};
}
// For the trusted fixture author only. Deliberately no production origin or live-enabled constructor.
export function mockTerms(frame,ctx,source,{approvalId,approvedAt,expiresAt,singleMicroUsd,totalMicroUsd,referencePurpose}){
  return {approvalId,batch,origin:"mock",allowLiveSend:false,currency:"USD",maxCalls:1,approvedAt,expiresAt,
    priceValidUntil:approvedAt+86400000,singleMicroUsd,totalMicroUsd,referencePurpose,request:binding(frame,ctx,source),tariff:fakeTariff(frame.binding.operation)};
}
function validate(terms,time){
  if(!terms || !uuid.test(terms.approvalId) || terms.batch!==batch || terms.origin!=="mock" || terms.allowLiveSend!==false ||
    terms.currency!=="USD" || terms.maxCalls!==1 || !positive(terms.approvedAt) || !positive(terms.expiresAt) ||
    terms.approvedAt>time || terms.expiresAt<=time || !positive(terms.singleMicroUsd) || !positive(terms.totalMicroUsd) ||
    terms.singleMicroUsd>terms.totalMicroUsd)throw Error("invalid-image-approval");
  if(!Number.isSafeInteger(terms.priceValidUntil) || terms.priceValidUntil!==terms.approvedAt+86400000 ||
    time>=terms.priceValidUntil)throw Error("COST_BOUND_UNVERIFIED");
  const r=terms.request,edit=r.operation==="edit";
  if(r.project!==project || !isDeepStrictEqual(r.specification,specification) ||
    (edit?(!r.reference || terms.referencePurpose!=="upload-exact-png-for-this-edit"):terms.referencePurpose!==null || r.reference!==null))
    throw Error("image-rights-or-spec");
  const upper=maxChargeBound(terms.tariff,r.operation);
  if(upper>terms.singleMicroUsd)throw Error("per-call-budget");
  return upper;
}
export async function installMockBatch(db,totalMicroUsd){
  if(!positive(totalMicroUsd))throw Error("invalid-total");
  await db.query("INSERT INTO yingjie_image.image_money_batch VALUES($1,$2) ON CONFLICT DO NOTHING",[batch,totalMicroUsd]);
  const row=await one(db,"SELECT total_micro_usd FROM yingjie_image.image_money_batch WHERE id=$1",[batch]);
  if(Number(row.total_micro_usd)!==totalMicroUsd)throw Error("batch-limit-changed");
}
export async function approveMock(db,terms){
  validate(terms,Date.now());
  const row=await one(db,"SELECT total_micro_usd FROM yingjie_image.image_money_batch WHERE id=$1",[batch]);
  if(Number(row?.total_micro_usd)!==terms.totalMicroUsd)throw Error("wrong-batch");
  await db.query("INSERT INTO yingjie_image.image_money_grant(id,batch,operation,terms) VALUES($1,$2,$3,$4)",
    [terms.approvalId,batch,terms.request.operation,JSON.stringify(terms)]);
}
export async function revokeMock(db,id){
  await db.query("UPDATE yingjie_image.image_money_grant SET revoked=1 WHERE id=$1",[id]);
}
export class MockImageMoney {
  constructor(approvalId){
    if(!uuid.test(approvalId))throw Error("missing-image-approval");
    this.id=approvalId;Object.freeze(this);
  }
  async stage(db,id,stage){
    if(!uuid.test(id)||!phases.has(stage))throw Error("invalid-stage");
    const runHash=sha256(id);
    const hold=await one(db,"SELECT grant_id FROM yingjie_image.image_money_hold WHERE run_hash=$1",[runHash]);
    await db.query("INSERT INTO yingjie_image.image_money_stage VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [runHash,sha256(hold?.grant_id??this.id),new Date().toISOString(),stage]);
  }
  // Caller holds the task/permit/reference locks. Use the SAME transaction as the attempt.
  async reserve(db,claim,frame,ctx){
    const funds=await one(db,"SELECT total_micro_usd FROM yingjie_image.image_money_batch WHERE id=$1 FOR UPDATE",[batch]);
    const row=await one(db,"SELECT terms,revoked FROM yingjie_image.image_money_grant WHERE id=$1 FOR UPDATE",[this.id]);
    if(!row || Number(row.revoked)!==0)throw Error("missing-or-revoked-grant");
    const terms=JSON.parse(row.terms);
    const expected=binding(frame,ctx,claim.plan.target.source);
    if(terms.approvalId!==this.id || !isDeepStrictEqual(terms.request,expected) ||
      Number(funds?.total_micro_usd)!==terms.totalMicroUsd)throw Error("image-binding-mismatch");
    const stream=await one(db,"SELECT revision FROM yingjie_scene.stream WHERE scope=$1 FOR SHARE",[ctx.scope]);
    const event=await one(db,"SELECT event_key,raw_text_hash FROM yingjie_scene.event WHERE scope=$1 AND revision=$2",
      [ctx.scope,expected.revision]);
    if(stream?.revision!==expected.revision || event?.event_key!==frame.binding.eventKey ||
      event?.raw_text_hash!==expected.sourceSha256)throw Error("saved-source-changed");
    const used=await one(db,"SELECT COALESCE(SUM(micro_usd),0) AS held FROM yingjie_image.image_money_hold",[]);
    const upper=validate(terms,Date.now());
    if(upper>terms.totalMicroUsd-Number(used.held))throw Error("batch-budget-exhausted");
    await db.query("INSERT INTO yingjie_image.image_money_hold VALUES($1,$2,$3,$4)",
      [this.id,expected.eventHash,sha256(claim.attempt.attemptId),upper]);
    await this.stage(db,claim.attempt.attemptId,"money-reserved");
    await this.stage(db,claim.attempt.attemptId,"possible-sent");
  }
}
