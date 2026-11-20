import {test} from "node:test";
import assert from "node:assert/strict";
import {classifyTrigger} from "../trigger.mjs";
import {assessUses,visibleSpecification} from "../consistency.mjs";
import {assessFixture} from "../../image-tasks/fixture-review.mjs";
import {catalog} from "../../world-assets/index.mjs";
import {extractContinuity} from "../continuity.mjs";
import {chooseFrame} from "../planner.mjs";

const source={kind:"card-history",evidence:"completed-history",ownerId:"fixture",sessionId:"s",key:"k",revision:2};
const visual={...catalog[0].facts,sceneId:"east",visualVersion:"V2",source};
const result={status:"ready",visual,scene:{sceneId:"east"}};
const event={source,normalized_text_hash:"test",audit:{method:extractContinuity.method},versions:[{visual,previous:1}]};

test("confirmed visual changes, no-op and unsupported emphasis",()=>{
  for(const [field,old,reason] of [["people",["掌柜"],"people-changed"],["features",["双窗"],"structure-changed"],
    ["viewpoint","后门","view-changed"],["perspective","门外","view-changed"],["lighting","夜色","light-or-time-changed"],
    ["timeOfDay","傍晚","light-or-time-changed"]]){
    const pick=classifyTrigger(result,{...event,previous:{...visual,visualVersion:"V1",[field]:old}});
    assert.equal(pick.triggerCandidate,true);assert.equal(pick.reason,reason);assert.deepEqual(pick.evidence.changedFields,[field]);
  }
  assert.equal(classifyTrigger(result,{...event,versions:[{visual,previous:null}]}).reason,"new-place");
  assert.equal(classifyTrigger(result,{...event,versions:[]}).triggerCandidate,false);
  assert.equal(classifyTrigger({status:"not-ready"},event).reason,"unknown-visible-state");
  assert.equal(classifyTrigger(result,{...event,source:{...source,key:"other"}}).reason,"unconfirmed-source");
  assert.equal(classifyTrigger(result,{...event,versions:[]}).narrativeEmphasis,"unsupported");
});

test("review, current display and reference use have separate verdicts",()=>{
  const a={assetId:"I0",sha256:catalog[0].sha256,storageKey:"fixture.png",target:{...visual,visualVersion:"V1"},
    review:{id:"r",status:"accepted",assessment:"matches"}};
  const current={...visual,...catalog[1].facts};
  const edit={action:"edit",target:current,reference:{assetId:a.assetId,sha256:a.sha256,reviewId:"r",visualVersion:"V1"},preservePeople:[],preserveFeatures:[]};
  const access={source,authorized:true,observedSha256:a.sha256};
  const check=(asset=a,permit=access)=>assessUses(asset,current,permit,true,edit,assessFixture);
  assert.deepEqual([check().display,check().reference],["visual-mismatch","eligible"]);
  assert.equal(assessUses(a,null,access,true,edit,assessFixture).reference,"unknown-visible-state");
  assert.equal(assessUses(a,current,access,false,edit,assessFixture).reference,"target-inactive");
  assert.equal(assessUses(a,current,access,true,{...edit,target:a.target},assessFixture).reference,"wrong-target");
  for(const [asset,permit,reason] of [[{...a,review:{...a.review,status:"pending"}},access,"review-pending"],
    [a,{...access,authorized:false},"access-revoked"],[a,{...access,observedSha256:"damaged"},"digest-mismatch"],
    [a,{...access,source:{...source,sessionId:"other"}},"wrong-scope"],[{...a,invalidated:true},access,"invalidated"]]){
    assert.deepEqual([check(asset,permit).display,check(asset,permit).reference],[reason,reason]);
  }
  for(const patch of [{people:["潜伏剑客"]},{features:["柜台","暗门"]},{lighting:"日光和暗室灯火"},
    {timeOfDay:"夜半"},{viewpoint:"密室内"},{perspective:"全知视角"},{sceneId:"west"}]){
    const v=assessFixture(a.sha256,{...visual,...patch});assert.equal(v.status,"rejected");assert.match(v.reason,/mismatch:/);
  }
  assert.equal(assessFixture("unlisted",visual).status,"pending");
  const sourceOnly=visibleSpecification({...visual,worldbook:"暗门",action:"强制生成",secret:"未揭示"});
  assert.deepEqual(Object.keys(sourceOnly),["sceneId","people","features","timeOfDay","lighting","viewpoint","perspective"]);
});
test("rumor, reported speech, dreams and unseen narrators cannot add a present character",()=>{
  const state={current:"east",places:[{scene:{sceneId:"east"},facts:visual}]};
  for(const narrative of ["听说紫衣客走进大堂。","掌柜说：“紫衣客走进大堂。”","你梦见紫衣客走进大堂。",
    "你想起上次紫衣客走进大堂的情形。","你打算明天重返酒馆。","你不知道，紫衣客正藏在密室里。"]){
    const ops=extractContinuity({source,state,narrative}).observations.map(n=>n.operation);
    assert.ok(ops.every(o=>["unknown","hold"].includes(o.type)));
  }
  assert.equal(extractContinuity({source,state,narrative:"紫衣客走进大堂。"}).observations[0].operation.type,"add");
});
test("provider capability cannot override authorization or a suppressed trigger",async()=>{
  const tasks={pool:{query:async()=>({rows:[]})},taskFor:async()=>null,recover:async()=>{},
    capability:{origin:"mock",generate:"unsupported",referenceEdit:"unsupported"}};
  const ctx={authorized:true,scope:"test",revision:2,result,trigger:{triggerCandidate:true}};
  const world={resolve:async()=>({reason:"no-preset"})};
  assert.equal((await chooseFrame(tasks,world,ctx,true)).reason,"generation-unavailable");
  assert.equal((await chooseFrame(tasks,world,{...ctx,trigger:{triggerCandidate:false,reason:"unchanged-visual"}},true)).reason,"unchanged-visual");
  assert.equal((await chooseFrame(tasks,{resolve:async()=>({reason:"no-grant"})},ctx,true)).reason,"no-grant");
  assert.equal((await chooseFrame(tasks,world,ctx,false)).reason,"disabled");
});
