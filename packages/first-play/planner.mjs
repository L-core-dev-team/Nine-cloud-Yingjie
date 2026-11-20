import {assessUses} from "./consistency.mjs";
import {sameVisual,schemaVersion} from "../contracts/dist/index.js";
import {pictureIndex} from "../image-tasks/demo.mjs";

const fallbackReasons=new Set(["no-worldbook","no-preset","different-place","visual-mismatch"]);
export async function chooseFrame(tasks,world,ctx,enabled) {
  if(!ctx.authorized)throw Error("account-inaccessible");
  if(!enabled)return {action:"skip",reason:"disabled"};
  if(ctx.result.status!=="ready")return {action:"skip",reason:"not-ready"};
  const preset=await world.resolve(ctx);
  if(preset.status==="matched")return {action:"preset",reason:"reviewed-preset",preset};
  const miss=preset.reason;
  if(!fallbackReasons.has(miss) || (ctx.trigger && miss==="different-place"))return {action:"skip",reason:miss,miss};
  if(ctx.historicalImages)return {action:"skip",reason:"unreconciled-image-ledger",hold:"ledger-review",miss};
  // A request already recorded for this event owns its retry/unknown state.
  const existing=await tasks.taskFor(ctx);
  if(existing && ctx.trigger && !ctx.trigger.triggerCandidate && existing.request_key){
    const claimed=await tasks.pool.query("SELECT 1 FROM yingjie_image.attempt WHERE task=$1 LIMIT 1",[existing.id]);
    if(!claimed.rowCount)return {action:"skip",reason:ctx.trigger.reason,miss};
  }
  if(existing)return {action:existing.plan.action,reason:existing.plan.reason,miss,plan:existing.plan};
  const target=ctx.result.visual;
  const rows=(await tasks.pool.query(`SELECT a.id FROM yingjie_image.asset a JOIN yingjie_image.attempt t ON a.id=t.id
    WHERE a.scope=$1 AND a.record->'target'->>'sceneId'=$2 AND a.record->'review'->>'status'='accepted'
      AND (a.record->'target'->'source'->>'revision')::int <= $3 AND t.record->>'localWait'='active' ORDER BY (a.record->'target'->'source'->>'revision')::int DESC,a.id`,
    [ctx.scope,target.sceneId,ctx.revision])).rows;
  let edit,editUse;
  for(const {id} of rows){
    const file=await tasks.asset(tasks.pool,ctx.scope,id);
    if(!file?.bytes)continue;
    const a=file.asset;
    const access={source:target.source,authorized:true,observedSha256:a.sha256};
    const candidate=tasks.capability.referenceEdit==="supported"?{schemaVersion,target,action:"edit",reason:"visible-facts-changed",
        reference:{assetId:id,sha256:a.sha256,reviewId:a.review.id,visualVersion:a.target.visualVersion},
        preservePeople:target.people.filter(p=>a.target.people.includes(p)),
        preserveFeatures:target.features.filter(f=>a.target.features.includes(f)),change:"按已保存正文的当前视觉快照更新"}:null;
    const uses=assessUses(a,target,access,true,candidate,tasks.assess);
    if(uses.display==="eligible"){
      const plan={schemaVersion,target,action:"reuse",reason:"same-reviewed-visual",assetId:id};
      return {action:plan.action,reason:plan.reason,miss,plan,uses};
    }
    if(!edit && uses.reference==="eligible"){edit=candidate;editUse=uses;}
  }
  // A new text event can still describe exactly the same picture. Never duplicate an
  // unconfirmed send just because the event key changed. YJ-05 still owns the attempt.
  await tasks.recover();
  const unsettled=(await tasks.pool.query(`SELECT t.plan->'target' AS target,
      a.record->'outcome'->>'state' AS outcome,asset.record->'review'->>'status' AS review
    FROM yingjie_image.task t JOIN LATERAL
      (SELECT record,id FROM yingjie_image.attempt WHERE task=t.id ORDER BY ordinal DESC LIMIT 1) a ON true
    LEFT JOIN yingjie_image.asset asset ON asset.id=a.id
    WHERE t.scope=$1 AND t.plan->'target'->>'sceneId'=$2 AND t.plan->'target'->>'visualVersion'=$3
      AND (a.record->'outcome'->>'state' IN ('waiting','unknown') OR asset.record->'review'->>'status'='pending')
    ORDER BY (t.plan->'target'->'source'->>'revision')::int DESC`,[ctx.scope,target.sceneId,target.visualVersion])).rows;
  const pending=unsettled.find(row=>sameVisual(row.target,target));
  if(pending)return {action:"skip",reason:"prior-attempt",hold:pending.review==="pending"?"review-pending":pending.outcome,miss};
  if(ctx.trigger && !ctx.trigger.triggerCandidate)return {action:"skip",reason:ctx.trigger.reason,miss};
  if(tasks.capability.origin!=="mock" || pictureIndex(target)<0)return {action:"skip",reason:"outside-local-provider",miss};
  if(edit)return {action:edit.action,reason:edit.reason,miss,plan:edit,uses:editUse};
  if(tasks.capability.generate!=="supported")return {action:"skip",reason:"generation-unavailable",miss};
  const plan={schemaVersion,target,action:"generate",reason:"no-eligible-reference"};
  return {action:plan.action,reason:plan.reason,miss,plan};
}
