import {randomUUID,createHash} from "node:crypto";
import {eventKey,historyEligibility} from "../contracts/dist/index.js";
import {cardScope} from "../scene-state/store.mjs";

export const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const digest=value=>createHash("sha256").update(value).digest("hex");
const categories=new Set(["people","place","structure","light","view","secret","other"]);
const rows=async(db,sql,args)=>(await db.query(sql,args)).rows;
const first=async(db,sql,args)=>(await rows(db,sql,args))[0];
const generation=async(db,scope,kind,id)=>(await first(db,"SELECT COALESCE(max(seq),0)::text AS v FROM yingjie_history.review_event WHERE scope=$1 AND kind=$2 AND target=$3",[scope,kind,id])).v;
function scoped(ctx){if(!ctx.authorized || !ctx.scope)throw Error("account-inaccessible");}
function summary(row){
  return {revision:row.revision,sourceKey:row.source.key,sceneId:row.result.scene?.sceneId??null,
    name:row.result.scene?.name??null,version:row.result.visual?.visualVersion??null,
    action:row.choice?.action??null,reason:row.choice?.reason??null,state:row.choice?.frameState??null};
}
function choice(c){return {action:c.action??null,reason:c.reason??null,trigger:c.triggerReason??null,
  state:c.frameState??null,when:c.when,handle:c.handle??null};}
async function transaction(pool,fn){
  const db=await pool.connect();
  try{await db.query("BEGIN");const result=await fn(db);await db.query("COMMIT");return result;}
  catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
}
export function replacementStatus(){return {status:"blocked",reason:"contract-adapter-required"};}

export class ImageHistory {
  constructor(tasks,world){
    this.tasks=tasks;this.pool=tasks.pool;this.world=world;
    world.presetWithdrawn=async(scope,id,db=this.pool)=>(await db.query(
      "SELECT 1 FROM yingjie_history.review_event WHERE scope=$1 AND kind='preset' AND target=$2 AND current->>'invalidated'='true' LIMIT 1",[scope,id])).rowCount>0;
  }
  async list(ctx,before=null){
    scoped(ctx);
    const page=await rows(this.pool,`SELECT e.revision,e.source,e.result,
      (SELECT record FROM yingjie_play.choice c WHERE c.scope=e.scope AND c.revision=e.revision
       ORDER BY observed_at DESC,record::text DESC LIMIT 1) AS choice
      FROM yingjie_scene.event e WHERE e.scope=$1 AND e.revision<=$2 AND ($3::int IS NULL OR e.revision<$3)
      ORDER BY e.revision DESC LIMIT 9`,[ctx.scope,ctx.revision,before]);
    const items=page.slice(0,8).map(summary);
    return {items,next:page.length>8?items.at(-1).revision:null};
  }
  async event(ctx,revision,db=this.pool){
    scoped(ctx);
    if(!Number.isSafeInteger(revision)||revision<1||revision>ctx.revision)throw Error("missing");
    const row=await first(db,"SELECT revision,event_key,source,result FROM yingjie_scene.event WHERE scope=$1 AND revision=$2",[ctx.scope,revision]);
    if(!row || row.source.kind!=="card-history" || row.source.evidence!=="completed-history" ||
      cardScope(row.source.ownerId,row.source.sessionId)!==ctx.scope || eventKey(row.source)!==row.event_key)throw Error("missing");
    return row;
  }
  async target(ctx,revision,kind,id,db=this.pool){
    if(!(kind==="asset"?uuid.test(id):kind==="preset" && /^[a-f0-9]{64}$/.test(id)))throw Error("missing");
    if(kind==="asset")id=id.toLowerCase();
    const event=await this.event(ctx,revision,db);
    if(event.result.status!=="ready")throw Error("missing");
    const original={...ctx,revision,result:event.result};
    const match=await this.world.resolve(original,ctx.revision,db);
    let bytes=null,review,invalidated=false,sha256=null,status,sourceRef;
    if(kind==="preset"){
      const recorded=await first(db,"SELECT 1 FROM yingjie_play.choice WHERE scope=$1 AND revision=$2 AND record->>'action'='preset' AND record->>'handle'=$3",[ctx.scope,revision,id]);
      if(!recorded)throw Error("missing");
      if(match.handle!==id && match.withdrawn!==id)throw Error("media-forbidden");
      invalidated=match.withdrawn===id;
      sourceRef={handle:id,catalog:match.asset?.catalog??null,preset:match.asset?.id??null};
      review=invalidated?(await first(db,"SELECT current->'review' AS review FROM yingjie_history.review_event WHERE scope=$1 AND kind='preset' AND target=$2 ORDER BY seq DESC LIMIT 1",[ctx.scope,id])).review:{id,status:"accepted",reason:"reviewed-preset"};
      status=invalidated?"invalidated":"eligible";bytes=match.bytes??null;sha256=match.asset?.sha256??null;
    }else{
      if(match.reason==="no-worldbook"){
        const storyOnly=await first(db,"SELECT 1 FROM yingjie_play.choice WHERE scope=$1 AND revision=$2 AND record->>'presetReason'='no-worldbook' AND record->>'action' IN ('generate','edit')",[ctx.scope,revision]);
        if(!storyOnly)throw Error("media-forbidden");
      }else if(match.status!=="matched" && !match.withdrawn && !["visual-mismatch","no-preset"].includes(match.reason))throw Error("media-forbidden");
      const file=await this.tasks.asset(db,ctx.scope,id);
      const asset=file?.asset;
      if(!asset || asset.target.source.revision!==revision || eventKey(asset.target.source)!==event.event_key)throw Error("missing");
      sourceRef={assetId:id,attemptId:asset.attemptId};
      review=asset.review;invalidated=asset.invalidated;sha256=asset.sha256;
      status=historyEligibility(asset,{source:event.source,authorized:true,observedSha256:file.bytes?sha256:null});
      if(status==="eligible" && this.tasks.assess && this.tasks.assess(sha256,asset.target).status!=="accepted")status="review-ineligible";
      if(status==="eligible")bytes=file.bytes;
    }
    return {kind,id,revision,scene:event.result.scene.sceneId,version:event.result.visual.visualVersion,
      sourceRef,generation:await generation(db,ctx.scope,kind,id),review,invalidated,status,sha256,bytes};
  }
  async detail(ctx,revision){
    const row=await this.event(ctx,revision),args=[ctx.scope,revision];
    const choices=await rows(this.pool,`SELECT record,observed_at FROM yingjie_play.choice WHERE scope=$1 AND revision=$2 ORDER BY observed_at,record::text`,args);
    const task=await first(this.pool,"SELECT id,plan,request_key FROM yingjie_image.task WHERE scope=$1 AND event_key=$2",[ctx.scope,row.event_key]);
    const attempts=task?await rows(this.pool,`SELECT a.id,a.ordinal,a.record->'outcome'->>'state' AS outcome,a.record->>'sentAt' AS sent,
      f.id AS asset FROM yingjie_image.attempt a LEFT JOIN yingjie_image.asset f ON f.id=a.id AND f.scope=$2
      WHERE task=$1 ORDER BY ordinal`,[task.id,ctx.scope]):[];
    const refs=new Map();
    for(const a of attempts)if(a.asset)refs.set(a.asset,{kind:"asset",id:a.asset,revision});
    if(task?.plan.action==="reuse"){
      const id=task.plan.assetId;
      const asset=await first(this.pool,"SELECT record->'target'->'source'->>'revision' AS rev FROM yingjie_image.asset WHERE scope=$1 AND id=$2",[ctx.scope,id]);
      if(asset)refs.set(id,{kind:"asset",id,revision:Number(asset.rev)});
    }
    for(const {record} of choices)if(record.action==="preset" && record.handle)refs.set(record.handle,{kind:"preset",id:record.handle,revision});
    const media=[];
    for(const ref of refs.values()){
      try{
        const item=await this.target(ctx,ref.revision,ref.kind,ref.id);
        const parameters=[ctx.scope,ref.kind,ref.id];
        const reports=await rows(this.pool,`SELECT r.id,r.category,r.created_at,coalesce(d.outcome,'pending-review') AS status
          FROM yingjie_history.report r LEFT JOIN yingjie_history.decision d ON d.report=r.id
          WHERE r.scope=$1 AND r.kind=$2 AND r.target=$3 ORDER BY r.created_at,r.id`,parameters);
        const changes=await rows(this.pool,`SELECT seq::text,created_at,previous->'review'->>'status' AS prior,
          current->'review'->>'status' AS status,current->>'invalidated' AS invalidated,report FROM yingjie_history.review_event
          WHERE scope=$1 AND kind=$2 AND target=$3 ORDER BY yingjie_history.review_event.seq`,parameters);
        media.push({...ref,status:item.status,reviewId:item.review.id,review:item.review.status,
          rejection:item.review.reason?.match(/^mismatch:[a-zA-Z,]+$/)?.[0]??null,
          generation:item.generation,sha256:item.sha256,readable:!!item.bytes,reports,changes});
      }catch(error){
        if(!["missing","media-forbidden"].includes(error.message))throw error;
        media.push({...ref,status:"unavailable",readable:false,reports:[],changes:[]});
      }
    }
    return {...summary({...row,choice:choices.at(-1)?.record}),choices:choices.map(c=>choice({...c.record,when:c.observed_at})),
      task:task?{id:task.id,action:task.plan.action,requestKeyDigest:task.request_key?digest(task.request_key):null}:null,attempts,media,replacement:replacementStatus()};
  }
  async receipt(ctx,command,fingerprint){
    scoped(ctx);
    if(!uuid.test(command) || !/^[0-9a-f]{64}$/.test(fingerprint??""))throw Error("invalid-feedback");
    const row=await first(this.pool,"SELECT * FROM yingjie_history.report WHERE scope=$1 AND command=$2",[ctx.scope,command]);
    if(!row)return {status:"unconfirmed"};
    const expected=digest(JSON.stringify([row.command,row.kind,row.target,row.revision,row.generation,row.category,row.note]));
    if(expected!==fingerprint)throw Error("command-conflict");
    return {status:"committed",id:row.id};
  }
  async report(ctx,input){
    scoped(ctx);
    if(!input || typeof input!=="object" || Array.isArray(input) || typeof input.command!=="string" ||
      typeof input.id!=="string" || !["asset","preset"].includes(input.kind) || !Number.isSafeInteger(input.revision) || input.revision<1 || Object.keys(input).some(k=>!["command","revision","kind","id","generation","category","note"].includes(k)) ||
      !uuid.test(input.command) || !categories.has(input.category) || typeof input.note!=="string" || input.note.length>180 ||
      /[\u0000-\u001f]/.test(input.note) || typeof input.generation!=="string" || !/^\d{1,19}$/.test(input.generation))throw Error("invalid-feedback");
    input={...input,command:input.command.toLowerCase(),id:input.kind==="asset"?input.id.toLowerCase():input.id};
    return transaction(this.pool,async db=>{
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[ctx.scope+input.command]);
      const prior=await first(db,"SELECT * FROM yingjie_history.report WHERE scope=$1 AND command=$2",[ctx.scope,input.command]);
      if(prior){
        if(prior.target!==input.id || prior.kind!==input.kind || prior.revision!==input.revision || prior.category!==input.category || prior.note!==input.note || prior.generation!==input.generation)throw Error("command-conflict");
        return {id:prior.id};
      }
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[ctx.scope+input.kind+input.id]);
      if(input.kind==="asset" && uuid.test(input.id))await db.query("SELECT id FROM yingjie_image.asset WHERE scope=$1 AND id=$2 FOR UPDATE",[ctx.scope,input.id]);
      const t=await this.target(ctx,input.revision,input.kind,input.id,db);
      if(t.generation!==input.generation || t.invalidated)throw Error("stale-review");
      const id=randomUUID();
      await db.query(`INSERT INTO yingjie_history.report(id,scope,command,kind,target,revision,scene,visual_version,review_id,generation,category,note,actor,source_ref)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'session-owner',$13)`,[id,ctx.scope,input.command,t.kind,t.id,t.revision,t.scene,t.version,t.review.id,t.generation,input.category,input.note,t.sourceRef]);
      return {id};
    });
  }
  // Trusted host-only reviewer. No HTTP route takes an outcome, actor or review basis from a player.
  async decide(ctx,reportId,outcome,basis){
    scoped(ctx);
    if(!uuid.test(reportId)||!["invalidated","dismissed"].includes(outcome)||typeof basis!=="string"||!basis.trim()||basis.length>240)throw Error("invalid-decision");
    return transaction(this.pool,async db=>{
      const r=await first(db,"SELECT * FROM yingjie_history.report WHERE scope=$1 AND id=$2 FOR UPDATE",[ctx.scope,reportId]);
      if(!r)throw Error("missing");
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[ctx.scope+r.kind+r.target]);
      if(r.kind==="asset")await db.query("SELECT id FROM yingjie_image.asset WHERE scope=$1 AND id=$2 FOR UPDATE",[ctx.scope,r.target]);
      const t=await this.target(ctx,r.revision,r.kind,r.target,db);
      const prior=await first(db,"SELECT * FROM yingjie_history.decision WHERE report=$1",[r.id]);
      if(prior){if(prior.outcome!==outcome||prior.basis!==basis)throw Error("decision-conflict");return outcome;}
      if(r.generation!==t.generation)throw Error("stale-review");
      await db.query("INSERT INTO yingjie_history.decision(report,outcome,actor,basis) VALUES($1,$2,'trusted-reviewer',$3)",[r.id,outcome,basis]);
      if(outcome==="dismissed")return outcome;
      const review={id:randomUUID(),status:"rejected",assessment:"contradicts",reason:"confirmed-correction",basis};
      if(r.kind==="asset"){
        await db.query("SELECT set_config('yingjie_history.report_id',$1,true)",[r.id]);
        await db.query("UPDATE yingjie_image.asset SET record=record || $3::jsonb WHERE scope=$1 AND id=$2",[ctx.scope,r.target,{review,invalidated:true}]);
      }else{
        await db.query("INSERT INTO yingjie_history.review_event(scope,kind,target,previous,current,report) VALUES($1,'preset',$2,$3,$4,$5)",
          [ctx.scope,r.target,{review:t.review,invalidated:false},{review,invalidated:true},r.id]);
      }
      return outcome;
    });
  }
}
