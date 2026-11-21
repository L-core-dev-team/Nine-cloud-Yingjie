import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {catalog} from "../../world-assets/index.mjs";
import {sha256} from "../../image-tasks/files.mjs";
import {extractContinuity} from "../../first-play/continuity.mjs";
import {offlineAdapters} from "../offline.mjs";
import {Reservations} from "../reservations.mjs";
import {sampleGrant,target,claimFor} from "./fixture.mjs";

const privateMarker="仅用于拒绝检查的合成暗号";
function setup(t,scenario="return",ledger=new Reservations(":memory:")) {
  const grant=sampleGrant(),ctx={grant,authorized:true};
  const adapter=offlineAdapters({resolve:()=>ctx,ledger,scenario});
  t.after(()=>ledger.close());
  const call={owner:grant.owner,sessionId:grant.sessionId,key:randomUUID()};
  const input={action:"进入酒馆",character:{owner:"spoof",url:privateMarker},instructions:privateMarker,
    persona:{description:privateMarker},messages:[{role:"system",content:privateMarker}],
    worldbooks:[{note:privateMarker}],history:[{narrative:privateMarker}]};
  const act=(c=call)=>adapter.model(input,new AbortController().signal,c);
  return {grant,ctx,adapter,ledger,call,input,act};
}
test("offline contract runner has no network permission",()=>{
  assert.equal(process.permission?.has("net"),false);
});
test("CardModel sends only the cleared action and unsupported prose abstains",async t=>{
  const {input,act,adapter,ctx,call}=setup(t);
  input.action="观察雨幕";
  const narrative=await act();
  await assert.rejects(act({...call,key:call.key.toUpperCase()}),/already-claimed/);
  assert.deepEqual(adapter.observations,[{operation:"text",action:"观察雨幕"}]);
  const source={...target(ctx.grant,0).source,key:call.key};
  const result=extractContinuity({source,narrative,state:{places:[],current:null}});
  assert.equal(result.observations[0].operation.type,"unknown");
  assert.ok(result.audit.clauses?.length || JSON.stringify(result.audit).includes("unsupported"));
});
test("absent, revoked, expired, wrong scope and incomplete approvals never reach fake",async t=>{
  const {ctx,grant,act,call,input,adapter,ledger}=setup(t);
  for(const altered of [null,{...grant,provider:"external"},{...grant,expiresAt:Date.now()-1},
    ...["maxCalls","perCall","total","concurrent","units"].map(k=>({...grant,[k]:undefined})),
    {...grant,perCall:1,units:{text:2}},{...grant,total:1,units:{text:2}}]){
    ctx.grant=altered;await assert.rejects(act());
  }
  ctx.grant=grant;ctx.authorized=false;await assert.rejects(act(),/not-authorized/);
  ctx.authorized=true;
  for(const c of [{...call,owner:"other"},{...call,sessionId:randomUUID()}])await assert.rejects(act(c),/not-authorized/);
  await assert.rejects(adapter.model(input,new AbortController().signal),/missing-server-call/);
  input.action=privateMarker;await assert.rejects(act(),/text-not-cleared/);
  input.action="进入酒馆";await assert.rejects(adapter.model(input,AbortSignal.abort(),call));
  assert.deepEqual(adapter.observations,[]);assert.deepEqual(ledger.summary(),[]);
});
test("scope, current facts and explicit material rights gate generation and editing",async t=>{
  const {ctx,grant,adapter,ledger}=setup(t);
  const provider=adapter.provider,initial=target(grant,0),next=target(grant,1);
  const generate={schemaVersion:"0.1",action:"generate",reason:privateMarker,target:initial};
  ctx.visual=next;
  await assert.rejects(provider.send(claimFor(provider,generate)),/stale-visual/);
  const secretPlan={...generate,target:{...initial,features:[privateMarker]}};
  ctx.visual=secretPlan.target;
  await assert.rejects(provider.send(claimFor(provider,secretPlan)),/visual-not-cleared/);
  ctx.visual=initial;
  const gen=claimFor(provider,generate);
  const image=await provider.send(gen);
  assert.equal(image.state,"returned");assert.equal(sha256(image.bytes),catalog[0].reviewedSha256);
  const id=gen.attempt.attemptId;
  const asset={schemaVersion:"0.1",assetId:id,attemptId:id,requestKey:gen.attempt.requestKey,target:initial,
    reference:null,sha256:sha256(image.bytes),storageKey:"fixture.png",format:"png",width:catalog[0].pixels[0],height:catalog[0].pixels[1],invalidated:false,
    review:{id:"first-review",status:"accepted",assessment:"matches",reason:"fixture",basis:"local"}};
  const plan={schemaVersion:"0.1",action:"edit",reason:privateMarker,target:next,preservePeople:initial.people,
    preserveFeatures:initial.features,change:privateMarker,
    reference:{assetId:id,sha256:asset.sha256,visualVersion:"V1",reviewId:"first-review"}};
  const edit=claimFor(provider,plan,image.bytes);
  Object.assign(ctx,{visual:next,asset,referenceActive:true});
  await assert.rejects(provider.send(edit),/reference-not-cleared/);
  ctx.referencePermit={assetId:id,sha256:asset.sha256,use:"edit"};
  for(const patch of [{width:1},{invalidated:true},{review:{...asset.review,status:"rejected",assessment:"contradicts"}},
    {target:{...initial,source:{...initial.source,sessionId:randomUUID()}}}]){
    ctx.asset={...asset,...patch};await assert.rejects(provider.send(edit),/reference-ineligible/);
  }
  ctx.asset=asset;ctx.referenceActive=false;await assert.rejects(provider.send(edit),/reference-ineligible/);
  ctx.referenceActive=true;
  await assert.rejects(provider.send({...edit,referenceBytes:Buffer.from("bad")}),/reference-not-cleared/);
  const response=await provider.send(edit);
  assert.equal(sha256(response.bytes),catalog[1].reviewedSha256);
  assert.equal(adapter.observations.length,2);
  assert.equal(adapter.observations[1].referenceSha256,asset.sha256);
  assert.ok(!JSON.stringify(adapter.observations).includes(privateMarker));
  assert.deepEqual(ledger.summary().map(r=>[r.state,r.calls,r.reservedUnits]),[["returned",2,7]]);
});
test("two connections share slots and never exceed count or total reservations",async t=>{
  const dir=mkdtempSync(join(tmpdir(),"p01-budget-"));const path=join(dir,"fake.sqlite");
  const a=new Reservations(path),b=new Reservations(path);
  try{
    const grant=sampleGrant();grant.maxCalls=4;grant.total=2;
    const s={grant,authorized:true},x=offlineAdapters({resolve:()=>s,ledger:a}),y=offlineAdapters({resolve:()=>s,ledger:b});
    const act=adapter=>adapter.model({action:"进入酒馆"},new AbortController().signal,{owner:grant.owner,sessionId:grant.sessionId,key:randomUUID()});
    const race=await Promise.allSettled([act(x),act(y)]);
    assert.equal(race.filter(r=>r.status==="fulfilled").length,1);
    assert.match(race.find(r=>r.status==="rejected").reason.message,/slot-held/);
    await act(y);await assert.rejects(act(x),/budget-exhausted/);
    grant.total=5;await assert.rejects(act(x),/changed-grant/);
    assert.equal(x.observations.length+y.observations.length,2);
  }finally{a.close();b.close();rmSync(dir,{recursive:true,force:true});}
});
test("acknowledged failure keeps reservation and count boundary; refusal stays distinct",async t=>{
  for(const state of ["failed","refused"]){
    const {act,adapter,ledger,grant,call}=setup(t,state);grant.maxCalls=1;
    await assert.rejects(act(),new RegExp("fake-"+state));
    await assert.rejects(act(),/already-claimed/);
    await assert.rejects(act({...call,key:randomUUID()}),/budget-exhausted/);
    assert.equal(ledger.summary()[0].state,state);assert.equal(adapter.observations.length,1);
  }
});
test("unconfirmed image cannot be resent after closing and reopening the ledger",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"p01-unknown-")),path=join(dir,"fake.sqlite");
  const grant=sampleGrant(),visual=target(grant,0),ctx={grant,visual,authorized:true};
  const plan={schemaVersion:"0.1",action:"generate",reason:"fixture",target:visual};
  let ledger=new Reservations(path);
  try{
    const first=offlineAdapters({resolve:()=>ctx,ledger,scenario:"lost"});
    await assert.rejects(first.provider.send(claimFor(first.provider,plan)),/transport-unconfirmed/);
    assert.equal(first.observations.length,1);ledger.close();ledger=new Reservations(path);
    const reopened=offlineAdapters({resolve:()=>ctx,ledger});
    await assert.rejects(reopened.provider.send(claimFor(reopened.provider,plan)),/already-claimed/);
    assert.equal(reopened.observations.length,0);
    assert.deepEqual(ledger.summary().map(row=>[row.state,row.reservedUnits]),[["unknown",4]]);
    assert.equal(reopened.provider.capability.query,"unknown");assert.equal(reopened.provider.capability.cancel,"unknown");
  }finally{ledger.close();rmSync(dir,{recursive:true,force:true});}
});
