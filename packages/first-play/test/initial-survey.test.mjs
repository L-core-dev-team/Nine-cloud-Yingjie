import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {extractInitialSurvey as v3} from "../initial-survey.mjs";
import {extractContinuity as v2} from "../continuity.mjs";
const source={kind:"card-history",evidence:"completed-history"};
const empty={current:null,places:[]};
const input=(narrative,state=empty)=>({source,narrative,state});
const sample="屋内阳光充足，双窗与柜台均可见。红衣客与白衣客在店内。";
test("partial initial survey records only bounded evidence without creating a visual",()=>{
  const original=v2(input(sample)),out=v3(input(sample));
  assert.equal(original.audit.method,"zh-visible-clause/2");assert.equal(original.observations[0].operation.reason,"unsupported-clause");
  assert.equal(out.audit.method,"zh-visible-clause/3");
  assert.deepEqual(out.audit.evidence.map(s=>sample.slice(s.start,s.start+s.length)),["屋内阳光充足","双窗与柜台均可见","红衣客与白衣客在店内"]);
  assert.deepEqual(out.audit.partialFacts.map(f=>[f.field,f.values]),[["lighting",["日光"]],["observedFeatures",["柜台","双窗"]],
    ["observedPeople",["红衣客","白衣客"]]]);
  assert.deepEqual(out.observations.map(f=>f.operation),[{type:"unknown",reason:"incomplete-initial-survey",unresolvedPlaces:true}]);
  assert.deepEqual(v3({...input(sample),action:"隐藏世界书提供了地点",worldbook:"秘密",oldImage:"revoked"}),out);
  assert.throws(()=>v3({...input(sample),source:{kind:"synthetic-fixture"}}),/completed-card-history/);
});
test("mixed scope, weak or negative claims cannot leave partial facts behind",()=>{
  for(const phrase of ["你计划明天再来","你梦见厅内日光明朗","据说紫衣客在厅内","掌柜说：“黑衣客在堂内”",
    "青衣客没有在店内","有人好像走了","双窗与柜台均可见？","另一个村子也有同名酒馆","密室里有一名未露面的人",
    "只有红衣客在厅内","黑衣客与黑衣客在屋内"]){
    const i=input("屋内阳光充足。"+phrase),next=v3(i);
    assert.equal(next.audit.partialFacts,undefined);
    assert.deepEqual(next.observations,v2(i).observations);
  }
});
test("all 65 existing /2 corpus cases retain their rule evidence and observations",async()=>{
  const json=async f=>JSON.parse(await readFile(new URL(f,import.meta.url)));
  const [reference,prose,corpus]=await Promise.all(["reference.json","prose.json","continuity-corpus.json"].map(json));
  const baseline=people=>({current:"east",places:[{scene:{sceneId:"east",name:"青石酒馆",aliases:[],parentSceneId:"东村"},
    facts:{...corpus.baseline,people}}]});
  const cases=[...reference.map(([id,n])=>input(n,id==="建立场景"?empty:baseline(["掌柜","蓝衣客","赭衣客"]))),
    ...prose.map(([n])=>input(n,baseline(["掌柜","紫衣客","蓝衣客"]))),...corpus.cases.map(c=>input(c.text,baseline(corpus.baseline.people)))];
  assert.equal(cases.length,65);
  for(const i of cases){const old=v2(i),next=v3(i);assert.deepEqual(next,{...old,audit:{...old.audit,method:v3.method}});}
});
