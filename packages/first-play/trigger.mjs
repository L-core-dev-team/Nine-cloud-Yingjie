import {sameVisual} from "../contracts/dist/index.js";

// Compare the version actually committed for this event with the last confirmed snapshot of the same place.
const fields=["people","features","viewpoint","perspective","timeOfDay","lighting"];
function canonical(value){return Array.isArray(value)?JSON.stringify([...value].sort()):value;}

export function classifyTrigger(result,event){
  const target=result.visual;
  const evidence={revision:event?.source.revision??0,sourceKey:event?.source.key??null,
    narrativeSha256:event?.normalized_text_hash??null,extractor:event?.audit.method??null,
    sceneId:result.scene?.sceneId??null,visualVersion:target?.visualVersion??null};
  function decision(triggerCandidate,reason,changedFields=[],emphasis){
    return {policy:"visible-change/1",triggerCandidate,reason,evidence:{...evidence,changedFields,
      emphasisClause:emphasis?{rule:emphasis.rule,start:emphasis.start,length:emphasis.length}:null},
      narrativeEmphasis:emphasis?.rule??"unsupported"};
  }
  if(result.status!=="ready")return decision(false,"unknown-visible-state");
  if(!event || event.source.kind!=="card-history" || event.source.evidence!=="completed-history" ||
     event.source.key!==target.source.key || event.source.revision!==target.source.revision ||
     event.source.ownerId!==target.source.ownerId || event.source.sessionId!==target.source.sessionId)
    return decision(false,"unconfirmed-source");
  const change=event.versions.find(v=>v.visual.sceneId===target.sceneId && v.visual.visualVersion===target.visualVersion);
  if(!change)return decision(false,"unchanged-visual");
  if(!sameVisual(change.visual,target))return decision(false,"unconfirmed-source");
  if(change.previous===null)return decision(true,"new-place",fields);
  if(!event.previous || event.previous.visualVersion!=="V"+change.previous)return decision(false,"unconfirmed-baseline");
  const delta=fields.filter(f=>canonical(event.previous[f])!==canonical(target[f]));
  if(!delta.length)return decision(false,"unchanged-visual");
  const reason=delta.includes("people")?"people-changed":delta.includes("features")?"structure-changed":
    delta.includes("viewpoint") || delta.includes("perspective")?"view-changed":"light-or-time-changed";
  const arrivals=target.people.filter(person=>!event.previous.people.includes(person));
  const emphasis=event.audit.evidence?.find(c=>
    (arrivals.length>=2 && ["arrival","doorway-arrival"].includes(c.rule)) ||
    (delta.includes("lighting") && delta.includes("timeOfDay") && c.rule==="observed-dusk-lamps"));
  return decision(true,reason,delta,emphasis);
}

export function triggerReceipt(trigger,pick,view){
  let suppressedReason=null;
  if(view.state==="unknown")suppressedReason="prior-attempt-unknown";
  else if(pick.reason==="not-ready")suppressedReason="unknown-visible-state";
  else if(pick.action==="skip")suppressedReason=pick.hold??pick.reason;
  else if(["failed","refused","review-pending","review-rejected","file-missing","not-sent"].includes(view.state))
    suppressedReason=view.state;
  else if(!trigger.triggerCandidate)suppressedReason=trigger.reason;
  return {...trigger,triggerReason:trigger.reason,reason:pick.reason,selectionReason:pick.reason,chosenAction:pick.action,suppressedReason,frameState:view.state,
    uses:pick.uses??null,evaluatedAsset:view.auditAsset??null,displayedAsset:view.assetId??null};
}

export async function readTriggerEvent(pool,scope,revision){
  const {rows}=await pool.query(`SELECT e.source,e.normalized_text_hash,e.versions,x.audit,
    (SELECT p.result->'visual' FROM yingjie_scene.event p WHERE p.scope=e.scope AND p.revision<e.revision
      AND p.result->'visual'->>'sceneId'=e.result->'visual'->>'sceneId'
      ORDER BY p.revision DESC LIMIT 1) AS previous
    FROM yingjie_scene.event e JOIN yingjie_play.extraction x USING(scope,revision)
    WHERE e.scope=$1 AND e.revision=$2`,[scope,revision]);
  return rows[0];
}
