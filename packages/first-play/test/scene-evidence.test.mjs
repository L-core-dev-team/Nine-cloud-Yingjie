import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import {extractSceneEvidence as extract} from "../scene-evidence.mjs";
import {project} from "../../scene-state/project.mjs";
import {hash} from "../../scene-state/store.mjs";
import {east,tower,prose,rejected,partial} from "./scene-evidence-fixtures.mjs";

const source = {schemaVersion:"0.1",kind:"card-history",evidence:"completed-history",ownerId:"fixture",
  sessionId:"00000000-0000-4000-8000-000000000010",key:"00000000-0000-4000-8000-000000000011",revision:1};
function inspect(narrative) {
  const state = {current:null,places:[]};
  const input = {source,narrative,state};
  const out = extract(input);
  assert.deepEqual(extract({...input,action:prose(east),oldImage:"accepted",modelJson:{complete:true},worldbook:prose(tower)}),out);
  assert.equal(out.audit.narrativeSha256,hash(narrative));
  assert.deepEqual(out.audit.source,source);
  return {...out,result:project(state,source,out.observations),state};
}

test("two districts and observatory resolve from text; evidence is addressable in UTF-16",()=>{
  for (const [clauses,id,people,fixed,time,light,position,direction] of [
    [east,"east",["掌柜","蓝衣客","赭衣客"],["柜台","双窗"],"正午","日光","正门","北"],
    [east.with(0,"你走进西村的青石酒馆"),"west",["掌柜","蓝衣客","赭衣客"],["柜台","双窗"],"正午","日光","正门","北"],
    [tower,"north-observatory",["值守人","学徒"],["石阶","星盘座"],"傍晚","灯光","石阶上","西"]
  ]) {
    const text = prose(clauses);
    const {audit,result} = inspect(text);
    assert.equal(result.status,"ready");assert.equal(result.scene.sceneId,id);
    assert.deepEqual(result.scene.fixedFeatures,fixed);assert.deepEqual(result.visual.people,people.toSorted());
    assert.deepEqual(result.visual.features,fixed.toSorted());
    assert.deepEqual([result.visual.timeOfDay,result.visual.lighting,result.visual.viewpoint,result.visual.perspective],
      [time,light,position,"玩家向"+direction+"所见"]);
    assert.equal(result.decision.action,"skip");assert.equal(result.visual.visualVersion,"V1");
    for (const [field,i] of Object.entries({place:0,viewpoint:1,perspective:1,people:2,features:3,timeOfDay:4,lighting:5})) {
      const f=audit.fields[field], e=audit.evidence[f.evidenceIndex];
      assert.equal(f.precision,"complete");assert.equal(e.scope,"explicit-current");assert.ok(e.playerKnown);
      assert.equal(text.slice(e.start,e.start+e.length),clauses[i]);
    }
  }
});
for (const [label,text] of Object.entries(rejected)) test("abstain: "+label,()=>{
  const {audit,result,state}=inspect(text);
  assert.equal(audit.status,"not-ready");assert.ok(audit.blockers.length);
  assert.deepEqual(result,{status:"not-ready",reason:"incomplete-or-ambiguous-initial-survey"});
  assert.deepEqual(state.places,[]);
  if (audit.blockers.some(reason=>reason.startsWith("unverified-scope:") || reason.startsWith("repeated-field:"))) {
    assert.ok(audit.evidence.every(e=>!e.playerKnown));
    assert.ok(Object.values(audit.fields).every(f=>f.precision==="unknown"));
  }
});
test("local facts survive in the audit without implying time, location, or an exhaustive roster",()=>{
  const {fields}=inspect(partial).audit;
  assert.equal(fields.people.precision,"partial");assert.equal(fields.people.value.length,3);
  assert.equal(fields.lighting.precision,"complete");assert.equal(fields.features.precision,"complete");
  for(const f of ["viewpoint","perspective","timeOfDay","place"])assert.deepEqual(fields[f],{precision:"unknown"});
  assert.throws(()=>extract({source:{kind:"synthetic-fixture",schemaVersion:"0.1",fixtureId:"a",eventId:"b"}}),/completed-card/);
});
test("candidate prompt permits incomplete observation and conversation without fixture-specific answers",async()=>{
  const template=await readFile(new URL("../scene-survey-prompt.md",import.meta.url),"utf8");
  for (const term of ["所属区域","观察方向","时段","光源","完整名单","留白","普通交谈","复访","自然叙事"])assert.ok(template.includes(term),term);
  for (const term of ["青石酒馆","观星楼","蓝衣客","正午","柜台"])assert.ok(!template.includes(term));
});
