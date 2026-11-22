import { randomUUID } from "node:crypto";
import { AssetSchema, AttemptSchema, CapabilitySchema, DecisionSchema, SceneSchema, VisualSchema,
  classifyDelivery, classifyResult, deliveryEligibility, referenceEligibility, reuseEligibility,
  eventKey, nextAttemptAction, requestKey, sameVisual, schemaVersion } from "../contracts/dist/index.js";
import { cardScope } from "../scene-state/store.mjs";
import { sha256 } from "./files.mjs";

const now = () => new Date().toISOString();
async function transaction(pool, fn) {
  const db=await pool.connect();
  try { await db.query("BEGIN"); const result=await fn(db); await db.query("COMMIT"); return result; }
  catch(e) { await db.query("ROLLBACK"); throw e; } finally { db.release(); }
}
const one = async (db,sql,args) => (await db.query(sql,args)).rows[0];
function checked(ctx) {
  if (!ctx.authorized) throw Error("access-revoked");
  if (ctx.result.status!=="ready") return null;
  const scene=SceneSchema.parse(ctx.result.scene), v=VisualSchema.parse(ctx.result.visual);
  for (const source of [scene.source,v.source]) {
    if(source.kind!=="card-history" || cardScope(source.ownerId,source.sessionId)!==ctx.scope) throw Error("wrong-scope");
  }
  if(scene.sceneId!==v.sceneId) throw Error("wrong-scene");
  return v;
}
async function conflict(db,task,kind,details) {
  await db.query("INSERT INTO yingjie_image.conflict VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [task,kind,sha256(JSON.stringify(details))]);
}

export class ImageTasks {
  constructor(pool, files, provider, {timeoutMs=30000,assess=null}={}) {
    this.pool=pool; this.files=files; this.provider=provider; this.timeoutMs=timeoutMs; this.assess=assess;
    this.capability=CapabilitySchema.parse(provider.capability);
  }
  async permit(ctx, id, serial, enabled) {
    checked(ctx);
    if (!Number.isSafeInteger(serial) || serial<0 || typeof enabled!=="boolean") throw Error("invalid-permit");
    return transaction(this.pool,async db=>{
      await db.query("INSERT INTO yingjie_image.permit VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",[id,ctx.scope,serial,enabled]);
      const row=await one(db,"SELECT * FROM yingjie_image.permit WHERE id=$1 FOR UPDATE",[id]);
      if(row.scope!==ctx.scope || Number(row.serial)>serial || (Number(row.serial)===serial && row.enabled!==enabled))
        throw Error("stale-permit");
      await db.query("UPDATE yingjie_image.permit SET serial=$2,enabled=$3 WHERE id=$1",[id,serial,enabled]);
      if(!enabled) await db.query(`UPDATE yingjie_image.attempt a SET record=jsonb_set(record,'{localWait}','"stopped"')
        FROM yingjie_image.task t WHERE t.id=a.task AND t.permit=$1 AND (record->'outcome'->>'state' IN ('waiting','unknown') OR EXISTS
          (SELECT 1 FROM yingjie_image.asset asset WHERE asset.id=a.id AND asset.record->'review'->>'status'='pending'))`,[id]);
    });
  }
  async allowed(db,ctx,id,serial,lock=false) {
    const row=await one(db,"SELECT * FROM yingjie_image.permit WHERE id=$1 AND scope=$2"+(lock?" FOR UPDATE":""),[id,ctx.scope]);
    return row?.enabled===true && Number(row.serial)===serial;
  }
  async taskFor(ctx) {
    const v=checked(ctx);
    return v && await one(this.pool,"SELECT * FROM yingjie_image.task WHERE scope=$1 AND event_key=$2",[ctx.scope,eventKey(v.source)]);
  }
  async asset(db,scope,id) {
    if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))return null;
    const row=await one(db,"SELECT record FROM yingjie_image.asset WHERE scope=$1 AND id=$2",[scope,id]);
    if(!row)return null;
    const a=AssetSchema.parse(row.record);
    const bytes=await this.files.read(a.storageKey,a.sha256);
    return {asset:a,bytes};
  }
  async submit(ctx, permit, serial, decision) {
    const v=checked(ctx);
    if(!v)return "not-ready";
    const plan=DecisionSchema.parse(decision);
    if(!sameVisual(v,plan.target) || eventKey(v.source)!==eventKey(plan.target.source) ||
       v.source.revision!==plan.target.source.revision) throw Error("wrong-target");
    return transaction(this.pool,async db=>{
      if(!await this.allowed(db,ctx,permit,serial,true))return "disabled";
      const inserted=await one(db,`INSERT INTO yingjie_image.task(id,scope,event_key,request_key,plan,permit)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING RETURNING id`,
        [randomUUID(),ctx.scope,eventKey(v.source),requestKey(plan),plan,permit]);
      if(inserted)return inserted.id;
      const prior=await one(db,"SELECT * FROM yingjie_image.task WHERE event_key=$1",[eventKey(v.source)]);
      if(classifyDelivery(plan,prior.plan)==="duplicate")return prior.id;
      await conflict(db,prior.id,"event-conflict",plan);
      return "event-conflict";
    });
  }
  async reference(db,ctx,plan) {
    if(plan.action!=="edit")return {ok:true};
    const file=await this.asset(db,ctx.scope,plan.reference.assetId);
    if(!file)return {ok:false,reason:"reference-missing"};
    const review=this.assess?.(file.asset.sha256,file.asset.target);
    if(review && review.status!=="accepted")return {ok:false,reason:review.reason};
    const reason=referenceEligibility(file.asset,plan,{source:ctx.result.visual.source,authorized:ctx.authorized,
      observedSha256:file.bytes?file.asset.sha256:null});
    return {ok:reason==="eligible",reason,bytes:file.bytes};
  }
  async dispatch(authorize,taskId,permit,serial,{retry=false}={}) {
    const ctx=await authorize(),v=checked(ctx);
    if(!v)return "not-ready";
    const claim=await transaction(this.pool,async db=>{
      if(!await this.allowed(db,ctx,permit,serial,true))return "disabled";
      const task=await one(db,"SELECT * FROM yingjie_image.task WHERE id=$1 AND scope=$2 FOR UPDATE",[taskId,ctx.scope]);
      if(!task || !sameVisual(v,task.plan.target) || eventKey(v.source)!==task.event_key)return "stale-target";
      if(!task.request_key)return "no-call";
      const prior=await one(db,"SELECT * FROM yingjie_image.attempt WHERE task=$1 ORDER BY ordinal DESC LIMIT 1",[taskId]);
      if(prior && !(retry && nextAttemptAction(prior.record,true)==="eligible-for-policy-review"))return "already-claimed";
      const capability=task.plan.action==="generate"?this.capability.generate:this.capability.referenceEdit;
      if(task.plan.action==="edit")await db.query("SELECT id FROM yingjie_image.asset WHERE scope=$1 AND id=$2 FOR SHARE",[ctx.scope,task.plan.reference.assetId]);
      const ref=capability==="supported"?await this.reference(db,ctx,task.plan):{ok:false,reason:"capability-unverified"};
      const time=now(),id=randomUUID();
      const attempt=AttemptSchema.parse({schemaVersion,attemptId:id,requestKey:task.request_key,capability:this.capability,
        sentAt:ref.ok?time:null,observedAt:time,localWait:"active",outcome:ref.ok?{state:"waiting"}:{state:"not-sent",reason:ref.reason},
        model:null,seed:null,usage:null,cost:null,providerRequestId:null});
      await db.query("INSERT INTO yingjie_image.attempt VALUES($1,$2,$3,$4,$5)",[id,taskId,(prior?.ordinal??0)+1,attempt,
        ref.ok?new Date(Date.now()+this.timeoutMs):null]);
      await db.query("UPDATE yingjie_image.task SET permit=$2 WHERE id=$1",[taskId,permit]);
      return ref.ok?{attempt,plan:task.plan,referenceBytes:ref.bytes,permit,serial}:"not-sent";
    });
    if(typeof claim==="string")return claim;
    // From here the dispatch may already have reached a provider. Never replay on an ambiguous outcome.
    let response;
    try { response=await this.provider.send(claim); }
    catch { response={state:"unknown",reason:"transport-unconfirmed"}; }
    return this.receive(claim.attempt.attemptId,claim.attempt.requestKey,response);
  }
  async recover() {
    return this.pool.query(`UPDATE yingjie_image.attempt SET record=jsonb_set(record,'{outcome}',
      '{"state":"unknown","reason":"dispatch-deadline"}'),deadline=NULL
      WHERE deadline<=now() AND record->'outcome'->>'state'='waiting'`);
  }
  // Internal provider receiver. The attempt and task determine ownership, never callback-supplied metadata.
  async receive(id,key,response) {
    return transaction(this.pool,async db=>{
      const row=await one(db,`SELECT a.record,t.id AS task,t.plan,t.scope FROM yingjie_image.attempt a
        JOIN yingjie_image.task t ON t.id=a.task WHERE a.id=$1 FOR UPDATE OF a`,[id]);
      if(!row || row.record.requestKey!==key || !row.record.sentAt)throw Error("wrong-attempt");
      const original=row.record.outcome.state;
      let outcome,asset,info;
      if(response.state==="returned"){
        info=await this.files.save(response.bytes);
        outcome={state:"returned",assetId:id,sha256:info.sha256};
        asset=AssetSchema.parse({schemaVersion,assetId:id,target:row.plan.target,requestKey:key,attemptId:id,
          reference:row.plan.reference??null,sha256:info.sha256,format:info.format,width:info.width,height:info.height,
          storageKey:info.storageKey,invalidated:false,review:{id:"review-"+id,status:"pending",assessment:"indeterminate",
            reason:"待审阅",basis:"provider-return"}});
      }else{
        if(!["unknown","failed","refused"].includes(response.state))throw Error("invalid-provider-outcome");
        const reason=["local-gate","LIVE_DISABLED","prior-reservation","http-400","http-401","http-403","http-422","http-429"].includes(response.reason)
          ?response.reason:response.state==="unknown"?"transport-unconfirmed":"provider-"+response.state;
        outcome={state:response.state,reason};
      }
      const meta=response.state==="returned"?response.metadata:null;
      const attempt=AttemptSchema.parse({...row.record,...(meta?{model:meta.model,usage:meta.usage,
        providerRequestId:meta.providerRequestId,cost:null}:{}),observedAt:now(),outcome});
      if(asset) {
        const previous=await one(db,"SELECT record FROM yingjie_image.asset WHERE id=$1",[id]);
        const link=classifyResult(row.plan,attempt,asset,previous?.record);
        if(link==="duplicate")return link;
        if(link!=="record-once" || !["waiting","unknown"].includes(original)) {
          await conflict(db,row.task,"result-conflict",outcome);return "result-conflict";
        }
        await db.query("INSERT INTO yingjie_image.asset VALUES($1,$2,$3,$4)",[id,row.scope,asset,info.size]);
      }else if(!["waiting","unknown"].includes(original)) {
        if(original===outcome.state)return "duplicate";
        await conflict(db,row.task,"result-conflict",outcome);return "result-conflict";
      }
      await db.query("UPDATE yingjie_image.attempt SET record=$2,deadline=NULL WHERE id=$1",[id,attempt]);
      return outcome.state;
    });
  }
  async review(ctx,id,review,{onlyPending=false}={}) {
    checked(ctx);
    return transaction(this.pool,async db=>{
      const row=await one(db,"SELECT record FROM yingjie_image.asset WHERE id=$1 AND scope=$2 FOR UPDATE",[id,ctx.scope]);
      if(!row)throw Error("asset-inaccessible");
      if(onlyPending && (row.record.invalidated || row.record.review.status!=="pending"))return "already-reviewed";
      const asset=AssetSchema.parse({...row.record,review});
      if(review.status==="accepted" && !await this.files.read(asset.storageKey,asset.sha256))throw Error("file-integrity");
      await db.query("UPDATE yingjie_image.asset SET record=$2 WHERE id=$1",[id,asset]);
    });
  }
  async view(ctx,permit,serial) {
    const v=checked(ctx);
    if(!await this.allowed(this.pool,ctx,permit,serial))return {state:"disabled"};
    if(!v)return {state:"not-ready"};
    await this.recover();
    const task=await this.taskFor(ctx);
    if(!task)return {state:"unscheduled"};
    const plan=task.plan;
    if(!sameVisual(plan.target,v) || plan.target.source.revision!==v.source.revision)return {state:"stale-target"};
    if(plan.action==="skip")return {state:"skip"};
    const row=await one(this.pool,"SELECT record FROM yingjie_image.attempt WHERE task=$1 ORDER BY ordinal DESC LIMIT 1",[task.id]);
    const attempt=row?.record;
    if(attempt?.localWait==="stopped")return {state:"target-inactive"};
    if(plan.action!=="reuse" && attempt?.outcome.state!=="returned")return {state:attempt?.outcome.state??"queued"};
    const id=plan.action==="reuse"?plan.assetId:attempt.outcome.assetId;
    const file=await this.asset(this.pool,ctx.scope,id);
    if(!file)return {state:"file-missing"};
    const access={source:v.source,authorized:true,observedSha256:file.bytes?file.asset.sha256:null};
    const verdict=plan.action==="reuse"?reuseEligibility(file.asset,plan,access,true):
      deliveryEligibility(plan,attempt,file.asset,v,access,true);
    const auditAsset={id:file.asset.assetId,reviewId:file.asset.review.id,status:file.asset.review.status,
      assessment:file.asset.review.assessment};
    if(verdict!=="eligible")return {state:verdict,auditAsset};
    const reviewed=this.assess?.(file.asset.sha256,file.asset.target);
    if(reviewed && reviewed.status!=="accepted")return {state:"review-"+reviewed.status,auditAsset};
    return {state:"display",...file,auditAsset};
  }
}
