import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {extractSaved,method} from "../extract.mjs";

const cases=JSON.parse(readFileSync(new URL("reference.json",import.meta.url)));
const source={schemaVersion:"0.1",kind:"card-history",ownerId:"fixture",sessionId:randomUUID(),key:randomUUID(),revision:1,evidence:"completed-history"};
const prose=JSON.parse(readFileSync(new URL("prose.json",import.meta.url)));
const state={current:"east",places:[{scene:{sceneId:"east"},facts:{people:["掌柜","蓝衣客","赭衣客"]}}]};
const empty={current:null,places:[]};
function label(op){
  if(op.field)return op.type+":"+op.field+"="+(op.values?.join("/")??op.value);
  return op.type+(op.sceneId?":"+op.sceneId:"");
}
test("saved-body observations against separately specified reference labels",t=>{
  for(const [id,narrative,expected] of cases){
    const input={source,narrative,state:id==="建立场景"?empty:state};
    const out=extractSaved({...input,action:"离开酒馆"});
    assert.deepEqual(out.observations.map(x=>label(x.operation)),expected,id);
    assert.deepEqual(out,extractSaved({...input,action:"迎接客人"}),id);
    assert.equal(out.audit.method,method);
    assert.ok(out.audit.evidence.every(e=>narrative.slice(e.start,e.start+e.length).length===e.length));
  }
  const out=extractSaved({source,narrative:"紫衣客走进大堂。",state:empty});
  assert.equal(out.observations[0].operation.reason,"missing-baseline");
  const lost={...state,current:null,reason:"unsupported-clause"};
  const incomplete=extractSaved({source,narrative:"你走进东村的青石酒馆。",state:lost});
  assert.equal(incomplete.observations[0].operation.reason,"incomplete-survey");
  const survey=extractSaved({source,narrative:cases[0][1],state:lost});
  assert.deepEqual(survey.observations.map(x=>label(x.operation)),["visit:east",...cases[0][2].slice(1)]);
  assert.throws(()=>extractSaved({source:{kind:"synthetic-fixture"},narrative:"",state}),/completed-card-history/);
  t.diagnostic(JSON.stringify({referencePassages:cases.length,exactAgreement:cases.length,actionSubstitutions:cases.length}));
});

test("additional prose against semantic reference, count abstentions separately",t=>{
  const counts={exact:0,abstained:0,incorrect:0};
  const before={current:"east",places:[{scene:{sceneId:"east"},facts:{people:["掌柜","紫衣客","蓝衣客"]}}]};
  for(const [narrative,expected] of prose){
    const ops=extractSaved({source,narrative,state:before}).observations.map(x=>label(x.operation));
    if(JSON.stringify(ops)===JSON.stringify(expected))counts.exact++;
    else if(ops.length===1 && ops[0]==="unknown")counts.abstained++;
    else counts.incorrect++;
  }
  t.diagnostic(JSON.stringify(counts));assert.equal(counts.incorrect,0);assert.ok(counts.exact>=4);
});
