import {fromCardHistory,eventKey} from "../contracts/dist/index.js";
import {cardScope,hash} from "../scene-state/store.mjs";

// context() is the host's authenticated ordinary-card context (including group rejection).
// request is bound to that same owner's Nine-cloud host. Neither is supplied by an image request.
export async function readImageContext({tasks,context,request},claim) {
  const ctx=await context(), source=claim.plan.target.source;
  const active=c=>c.authorized===true && c.result.status==="ready" && source.kind==="card-history" &&
    c.scope===cardScope(source.ownerId,source.sessionId) && c.revision===source.revision &&
    eventKey(c.result.visual.source)===eventKey(source) && !c.historicalImages;
  if(!active(ctx) || !await tasks.allowed(tasks.pool,ctx,claim.permit,claim.serial))throw Error("inactive-card");
  const {rows:events}=await tasks.pool.query(
    "SELECT revision,event_key,raw_text_hash FROM yingjie_scene.event WHERE scope=$1 AND revision<=$2 ORDER BY revision",
    [ctx.scope,ctx.revision]);
  if(events.length!==ctx.revision)throw Error("projection-gap");
  const history=[];
  while(history.length<ctx.revision){
    const path="/api/card-import/sessions/"+source.sessionId+"/history?after="+history.length;
    const response=await request(path,{cache:"no-store",headers:{"x-jiuxiao-account":source.ownerId}});
    if(!response.ok)throw Error("inaccessible-history");
    const rows=await response.json();
    if(!Array.isArray(rows) || !rows.length || rows.length>100)throw Error("incomplete-page");
    for(const row of rows){
      const saved=fromCardHistory(source.ownerId,source.sessionId,row);
      const event=events[history.length];
      if(!event || saved.source.revision!==history.length+1 || event.revision!==saved.source.revision ||
        event.event_key!==eventKey(saved.source) || event.raw_text_hash!==hash(row.narrative))throw Error("history-mismatch");
      history.push(row);
    }
  }
  let reference;
  if(claim.plan.action==="edit"){
    const {rows}=await tasks.pool.query(`SELECT a.id FROM yingjie_image.asset a JOIN yingjie_image.attempt t ON t.id=a.id
      WHERE a.scope=$1 AND a.record->'target'->>'sceneId'=$2 AND a.record->'review'->>'status'='accepted'
      AND t.record->>'localWait'='active' ORDER BY (a.record->'target'->'source'->>'revision')::int DESC,a.id LIMIT 1`,
      [ctx.scope,claim.plan.target.sceneId]);
    if(rows[0]?.id!==claim.plan.reference.assetId)throw Error("superseded-reference");
    const file=await tasks.asset(tasks.pool,ctx.scope,rows[0].id);
    if(!file?.bytes || tasks.assess && tasks.assess(file.asset.sha256,file.asset.target)?.status!=="accepted")throw Error("unavailable-reference");
    reference={asset:file.asset,latestAcceptedId:rows[0].id,referenceActive:true};
  }
  const fresh=await context();
  if(!active(fresh) || !await tasks.allowed(tasks.pool,fresh,claim.permit,claim.serial))throw Error("inactive-card");
  return {...fresh,enabled:true,history,...reference};
}
