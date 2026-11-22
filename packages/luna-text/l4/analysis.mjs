import assert from "node:assert/strict";
import {digest} from "../../provider-readiness/reservations.mjs";
import {bindMethod} from "../../first-play/extract.mjs";
import {extractSceneEvidence} from "../../first-play/scene-evidence.mjs";

const expected={place:{sceneId:"east",name:"青石酒馆",parentSceneId:"东村"},viewpoint:"正门",perspective:"玩家向北所见",
  people:["掌柜","蓝衣客","赭衣客"],features:["柜台","双窗"],timeOfDay:"正午",lighting:"日光"};
function agrees(field,value,precision){
  const target=expected[field];
  if(Array.isArray(target))return Array.isArray(value) && value.every(v=>target.includes(v)) &&
    (precision==="partial" || value.length===target.length);
  if(field==="place")return Object.keys(target).every(k=>value[k]===target[k]);
  return target===value;
}
// The fixed scenario can veto a conflicting observation. It never supplies missing facts.
export const extract=bindMethod(input=>{
  const out=extractSceneEvidence(input);
  const conflicts=Object.entries(out.audit.fields??{}).filter(([f,item])=>
    item.precision!=="unknown" && !agrees(f,item.value,item.precision)).map(([field])=>field);
  const audit={...out.audit,method:"l4-scene-review/1",baseMethod:out.audit.method,conflicts};
  if(!conflicts.length)return {...out,audit};
  audit.status="not-ready";
  audit.blockers=[...(audit.blockers??[]),"scenario-conflict"];
  return {audit,observations:[{basis:"current-story",playerKnown:true,operation:{type:"unknown",reason:"scenario-conflict"}}]};
},"l4-scene-review/1",{replayOnly:true});

// Only SELECTs. No narrative or raw identity is returned in the public receipt.
export async function inspectSaved(pool,history,source){
  const rows=(await pool.query(`SELECT e.source,e.raw_text_hash,e.normalized_text_hash,e.result,x.audit
    FROM yingjie_scene.event e JOIN yingjie_play.extraction x USING(scope,revision)
    WHERE e.source=$1::jsonb AND e.revision=$2`,[source,source.revision])).rows;
  assert.equal(rows.length,1);
  const [{audit,result,raw_text_hash,normalized_text_hash}]=rows;
  assert.equal(source.key,history.key);assert.equal(source.revision,history.resulting_revision);
  assert.equal(raw_text_hash,digest(history.narrative));assert.equal(normalized_text_hash,audit.narrativeSha256);
  assert.deepEqual(audit.source,source);assert.equal(audit.replayOnly,true);assert.equal(result.status,audit.status);
  const normalized=history.narrative.trim();
  const evidence=audit.evidence.map(({start,length,rule,scope,playerKnown})=>{
    assert.ok(start>=0 && length>0 && start+length<=normalized.length);
    return {start,length,rule,scope,playerKnown,spanHash:digest(normalized.slice(start,start+length))};
  });
  return {method:audit.method,status:result.status,reason:result.reason??null,blockers:audit.blockers,conflicts:audit.conflicts,
    fields:Object.fromEntries(Object.entries(audit.fields).map(([field,{precision,evidenceIndex}])=>[field,{precision,evidenceIndex}])),
    evidence,semanticReview:result.status==="ready"?"all-bounded-claims-match":audit.conflicts.length?"recognized-contradiction":"unsupported-or-incomplete"};
}
