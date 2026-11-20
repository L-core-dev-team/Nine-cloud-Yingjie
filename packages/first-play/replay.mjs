import {syncCardHistory} from "../scene-state/index.mjs";
import {cardScope} from "../scene-state/store.mjs";
import {bindMethod} from "./extract.mjs";
import {sameVisual} from "../contracts/dist/index.js";

// Reads through the same authenticated ordinary-card HTTP adapter as the live projection.
// The audit marker survives restart. Live image routes and live appends reject this stream.
export async function replayHistory({pool,request,sessionId,signal,extract}) {
  const shadow=bindMethod(input=>extract(input),extract.method,{replayOnly:true});
  const result=await syncCardHistory({pool,request,sessionId,signal,extract:shadow});
  const account=await request("/api/auth/session",{signal,cache:"no-store"});
  if(!account.ok)throw Error("account-inaccessible");
  const owner=(await account.json()).account?.id;
  const scope=cardScope(owner,sessionId);
  if(result.revision){
    const audit=(await pool.query("SELECT audit FROM yingjie_play.extraction WHERE scope=$1 AND revision=$2",[scope,result.revision])).rows[0]?.audit;
    if(!audit?.replayOnly || audit.method!==extract.method)throw Error("incompatible-projection");
  }
  return result;
}

export async function compareReplay(oldPool,newPool,scope) {
  const journal=async pool=>(await pool.query(`SELECT revision,event_key,raw_text_hash,result,audit
    FROM yingjie_scene.event JOIN yingjie_play.extraction USING(scope,revision) WHERE scope=$1 ORDER BY revision`,[scope])).rows;
  const [old,fresh]=await Promise.all([journal(oldPool),journal(newPool)]);
  if(old.length!==fresh.length)throw Error("replay-length-mismatch");
  return old.map((a,i)=>{
    const b=fresh[i];
    if(a.revision!==b.revision || a.event_key!==b.event_key || a.raw_text_hash!==b.raw_text_hash || !b.audit.replayOnly)
      throw Error("replay-source-mismatch");
    const describe=r=>({method:r.audit.method,place:r.result.scene?.sceneId??null,reason:r.result.reason??null,
      visual:r.result.visual?.visualVersion??null,people:r.result.visual?.people??null,lighting:r.result.visual?.lighting??null});
    return {revision:a.revision,sha256:a.raw_text_hash,previous:describe(a),replayed:describe(b),
      sameTarget:Boolean(a.result.visual && b.result.visual && sameVisual(a.result.visual,b.result.visual))};
  });
}
