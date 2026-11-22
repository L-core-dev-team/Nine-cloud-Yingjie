import assert from "node:assert/strict";
import {test} from "node:test";
import {fork} from "node:child_process";
import {once} from "node:events";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {fixture,original,output} from "./fixture.mjs";
import {ImageTasks} from "../../image-tasks/index.mjs";
import {Originals,sha256} from "../../image-tasks/files.mjs";
import {reviewFixture} from "../../image-tasks/demo.mjs";
import {assessFixture} from "../../image-tasks/fixture-review.mjs";
import {chooseFrame} from "../../first-play/planner.mjs";
import {TestPool} from "./sqlite-pool.mjs";
import {readImageContext} from "../context.mjs";
import {eventKey,fromCardHistory} from "../../contracts/dist/index.js";
import {replaySaved} from "../prompt.mjs";
import {walkthrough} from "../../first-play/story.mjs";

const root=fileURLToPath(new URL("../../../",import.meta.url));
const code=fileURLToPath(new URL("worker.mjs",import.meta.url));
// Originals.sync requires the ordinary filesystem host. ONLY the no-network child runs provider code.
function start(dir){
  const child=fork(code,[join(dir,"reserve.sqlite")],{serialization:"advanced",windowsHide:true,
    execArgv:["--permission","--allow-fs-read="+root,"--allow-fs-read="+dir,"--allow-fs-write="+dir],
    env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:dir,TMP:dir},
    stdio:["ignore","ignore","inherit","ipc"]});
  const stopped=once(child,"exit").then(([exit])=>({exit}));
  const next=()=>Promise.race([once(child,"message",{signal:AbortSignal.timeout(10000)}).then(([m])=>m),stopped]);
  const ready=next().then(m=>assert.equal(m,"ready"));
  return {child,ready,next,async send(payload){
    await ready;
    const result=next();child.send(payload);const message=await result;await stopped;return message;
  }};
}
async function setup(t,operation){
  const f=fixture({operation}),pool=new TestPool(),dir=await mkdtemp(join(tmpdir(),"i1-host-"));
  t.after(async()=>{pool.close();f.ledger.close();await rm(dir,{recursive:true,force:true});});
  const files=new Originals(join(dir,"originals"));
  for(const row of f.ctx.history){
    const source=fromCardHistory(f.grant.owner,f.grant.sessionId,row).source;
    await pool.query("INSERT INTO event VALUES($1,$2,$3,$4)",[f.ctx.scope,source.revision,eventKey(source),sha256(row.narrative)]);
  }
  const request=(path,options)=>{
    assert.equal(options.headers["x-jiuxiao-account"],f.grant.owner);
    const base="/api/card-import/sessions/"+f.grant.sessionId+"/history?after=";
    assert.ok(path.startsWith(base));return Response.json(f.ctx.history.slice(Number(path.slice(base.length)),Number(path.slice(base.length))+1));
  };
  let sends=0;
  const adapter={capability:f.provider.capability,async prepare(claim,db){
    const ctx=await readImageContext({tasks,context:()=>f.ctx,request},claim,db);
    const w=start(dir);await w.ready;
    const prepared=w.next();w.child.send({claim,ctx,grant:f.grant,scenario:"prepare"});
    assert.equal(await prepared,"prepared");
    return async()=>{
      const done=w.next();w.child.send("committed");const m=await done;
      assert.equal(m.networkPermission,false);sends+=m.calls;return m.result;
    };
  }};
  const tasks=new ImageTasks(pool,files,adapter),permit=randomUUID();
  await tasks.permit(f.ctx,permit,1,true);
  return {f,tasks,pool,files,permit,dir,request,sends:()=>sends};
}
test("authenticated history reader rejects changed rows, lost access and foreign scope",async t=>{
  const {f,tasks,permit,request}=await setup(t,"generate");
  const read=(context,fn=request)=>readImageContext({tasks,context,request:fn},{...f.claim,permit,serial:1});
  await assert.rejects(read(()=>f.ctx,()=>Response.json([{...f.ctx.history[0],narrative:"different"}])),/history-mismatch/);
  await assert.rejects(read(()=>({...f.ctx,scope:"other"})),/inactive-card/);
  let calls=0;await assert.rejects(read(()=>({...f.ctx,authorized:++calls===1})),/inactive-card/);
  await assert.rejects(read(()=>f.ctx,()=>new Response(null,{status:403})),/inaccessible-history/);
  assert.equal(f.requests.length,0);
});
test("real ImageTasks generate / pending / duplicate / explicit review / disable",async t=>{
  const {f,tasks,pool,permit,sends}=await setup(t,"generate"),ctx=f.ctx;
  const id=await tasks.submit(ctx,permit,1,f.plan);
  assert.equal(await tasks.submit(ctx,permit,1,f.plan),id);
  assert.equal(await tasks.dispatch(()=>ctx,id,permit,1),"returned");
  assert.equal(await tasks.dispatch(()=>ctx,id,permit,1),"already-claimed");
  const row=(await pool.query("SELECT record FROM attempt")).rows[0].record;
  assert.deepEqual(row.usage,{quantity:9,unit:"tokens"});assert.equal(row.providerRequestId.value,"req_mock");
  assert.equal(row.cost,null);assert.equal(row.model,"gpt-image-2.6-sunburst");
  const file=await tasks.asset(pool,ctx.scope,row.attemptId);
  assert.equal(file.asset.sha256,sha256(output));assert.deepEqual(file.bytes,output);
  await reviewFixture(tasks,ctx,{id,plan:f.plan});assert.equal((await tasks.view(ctx,permit,1)).state,"review-pending");
  // Explicit reviewer rejects the synthetic blank output. No exhibition of the bad frame.
  await tasks.review(ctx,row.attemptId,{id:"human-fixture",status:"rejected",assessment:"contradicts",basis:"review",reason:"missing-people"});
  assert.equal((await tasks.view(ctx,permit,1)).state,"review-rejected");
  await tasks.permit(ctx,permit,2,false);assert.equal((await tasks.view(ctx,permit,2)).state,"disabled");
  assert.equal((await chooseFrame(tasks,{resolve:()=>({status:"matched"})},ctx,true)).action,"preset");assert.equal(sends(),1);
});

test("ImageTasks.reference reads the reviewed YJ-02 original; late edit stays private",async t=>{
  const {f,tasks,pool,files,permit,sends}=await setup(t,"edit"),ctx=f.ctx,asset=ctx.asset;
  // Load a previously reviewed YJ-02 asset, not an I1 output. Assert the historical visual inspection.
  assert.equal(assessFixture(asset.sha256,asset.target).status,"accepted");
  const saved=await files.save(original);
  const oldTask=randomUUID();
  await pool.query("INSERT INTO task VALUES($1,$2,$3,$4,$5,$6)",[oldTask,ctx.scope,"prior",asset.requestKey,
    {target:asset.target},permit]);
  await pool.query("INSERT INTO attempt VALUES($1,$2,1,$3,NULL)",[asset.assetId,oldTask,{localWait:"active"}]);
  await pool.query("INSERT INTO asset VALUES($1,$2,$3,$4)",[asset.assetId,ctx.scope,asset,saved.size]);
  const id=await tasks.submit(ctx,permit,1,f.plan);
  const originalPrepare=tasks.provider.prepare;
  const received=Promise.withResolvers(),release=Promise.withResolvers();
  tasks.provider.prepare=async(...args)=>{const send=await originalPrepare(...args);
    return async()=>{const reply=await send();received.resolve();await release.promise;return reply;};};
  const run=tasks.dispatch(()=>ctx,id,permit,1);
  await Promise.race([received.promise,run.then(v=>{throw Error("early dispatch "+v);})]);
  const next=fixture({operation:"evening",session:ctx.result.visual.source.sessionId,
    keys:[...ctx.history.map(r=>r.key),randomUUID()]});t.after(()=>next.ledger.close());
  await tasks.permit(ctx,permit,2,false);
  release.resolve();assert.equal(await run,"returned");
  assert.equal((await tasks.view(next.ctx,permit,2)).state,"disabled");
  await tasks.permit(next.ctx,permit,3,true);
  assert.equal((await tasks.view(next.ctx,permit,3)).state,"unscheduled");
  const newAsset=(await pool.query("SELECT record FROM asset WHERE id<>$1",[asset.assetId])).rows[0].record;
  assert.equal(newAsset.review.status,"pending");assert.equal(newAsset.reference.sha256,asset.sha256);
  assert.equal(sends(),1);
});
test("accepted original can be reused; skip has no provider attempt",async t=>{
  const {f,tasks,pool,files,permit,sends}=await setup(t,"generate");
  const {ctx}=f,asset=ctx.asset,info=await files.save(original);
  const previous=await tasks.submit(ctx,permit,1,f.plan);
  await pool.query("INSERT INTO attempt VALUES($1,$2,1,$3,NULL)",[asset.assetId,previous,{localWait:"active"}]);
  await pool.query("INSERT INTO asset VALUES($1,$2,$3,$4)",[asset.assetId,ctx.scope,asset,info.size]);
  for(const action of ["reuse","skip"]){
    ctx.history.push({action:"交谈",narrative:walkthrough[1],key:randomUUID(),resulting_revision:++ctx.revision});
    ctx.result=replaySaved(f.grant.owner,f.grant.sessionId,ctx.history).at(-1);
    const plan={schemaVersion:"0.1",action,target:ctx.result.visual,reason:"same-place"};
    if(action==="reuse")plan.assetId=asset.assetId;
    const id=await tasks.submit(ctx,permit,1,plan);assert.equal(await tasks.dispatch(()=>ctx,id,permit,1),"no-call");
    assert.equal((await tasks.view(ctx,permit,1)).state,action==="reuse"?"display":"skip");
  }
  assert.equal(sends(),0);
});
test("legacy fixture reviewer checks the recorded provider, including after a host change",async t=>{
  const {f,tasks,pool,files,permit}=await setup(t,"generate"),ctx=f.ctx;
  const id=await tasks.submit(ctx,permit,1,f.plan),asset=structuredClone(ctx.asset);
  const info=await files.save(original);
  asset.review={...asset.review,status:"pending",assessment:"indeterminate"};
  await pool.query("INSERT INTO attempt VALUES($1,$2,1,$3,NULL)",[asset.assetId,id,{capability:tasks.capability}]);
  await pool.query("INSERT INTO asset VALUES($1,$2,$3,$4)",[asset.assetId,ctx.scope,asset,info.size]);
  for(const entry of ["yj02-local-png","p01-local-fake"]){
    const legacy=new ImageTasks(pool,files,{capability:{...tasks.capability,entry}});
    await reviewFixture(legacy,ctx,{id,plan:f.plan});
    assert.equal((await legacy.asset(pool,ctx.scope,asset.assetId)).asset.review.status,"pending");
  }
  for(const entry of ["yj02-local-png","p01-local-fake"]){
    const legacy=new ImageTasks(pool,files,{capability:{...tasks.capability,entry}});
    await pool.query("UPDATE attempt SET record=$1 WHERE id=$2",[{capability:legacy.capability},asset.assetId]);
    await pool.query("UPDATE asset SET record=$1 WHERE id=$2",[asset,asset.assetId]);
    await reviewFixture(legacy,ctx,{id,plan:f.plan});
    assert.equal((await legacy.asset(pool,ctx.scope,asset.assetId)).asset.review.status,"accepted");
  }
});
for(const scenario of ["race","crash"])test("durable reservation / "+scenario,async t=>{
  const {f,dir}=await setup(t,"generate");
  const payload={ctx:f.ctx,claim:f.claim,grant:f.grant};
  if(scenario==="race"){
    const workers=[start(dir),start(dir)];await Promise.all(workers.map(w=>w.ready));
    const results=await Promise.all(workers.map(w=>w.send(payload)));
    assert.equal(results.reduce((sum,m)=>sum+m.calls,0),1);
    assert.deepEqual(results.map(m=>m.result.state).sort(),["returned","unknown"]);
  }else{
    const crashed=await start(dir).send({...payload,scenario:"crash"});assert.equal(crashed.exit,73);
  }
  f.claim.attempt.attemptId=randomUUID();
  const reopened=await start(dir).send(payload);assert.equal(reopened.calls,0);assert.equal(reopened.result.state,"unknown");
});
