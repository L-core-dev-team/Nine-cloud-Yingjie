import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp,rm,readFile,writeFile,unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { withDatabase } from "../../scene-state/test/local-db.mjs";
import { consume,latest,cardScope } from "../../scene-state/store.mjs";
import { ImageTasks } from "../index.mjs";
import { Originals } from "../files.mjs";
import { TavernProvider,script,annotate,pictures,demoPlan } from "../demo.mjs";

const picture=async i=>readFile(new URL("../../../docs/reports/evidence/"+pictures[i].file,import.meta.url));
const worker=(...args)=>new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[fileURLToPath(new URL("worker.mjs",import.meta.url)),...args],{windowsHide:true});
  let out="";p.stdout.on("data",s=>out+=s);p.stderr.on("data",s=>out+=s);p.on("error",reject);
  p.on("close",code=>code===0 || [60,61,62,63].includes(code)?resolve({code,out}):reject(Error(out)));
});
async function fixture(fn){
 await withDatabase(async(pool,database)=>{
  await pool.query(await readFile(new URL("../schema.sql",import.meta.url),"utf8"));
  const root=await mkdtemp(join(tmpdir(),"yj-originals-"));
  const files=new Originals(root),provider=new TavernProvider(),tasks=new ImageTasks(pool,files,provider);
  async function turn(sessionId,revision,index,ownerId="test-owner"){
    const [action,rawNarrative]=script[index],scope=cardScope(ownerId,sessionId);
    const source={schemaVersion:"0.1",kind:"card-history",sessionId,ownerId,revision,key:randomUUID(),evidence:"completed-history"};
    await consume(pool,{source,revision,action,rawNarrative},annotate);
    return {authorized:true,scope,...await latest(pool,scope),action};
  }
  try {await fn({tasks,pool,database,root,files,provider,turn});}finally{await rm(root,{recursive:true,force:true});}
 });
}

test("independent senders, hard exits, timeout reconciliation and duplicate receipts",async t=>{
 await fixture(async({tasks,pool,database,root,files,turn})=>{
  for(const [mode,code] of [["after-file",63],["before-file",62],["claim-crash",61],["queued-crash",60]]){
   const ctx=await turn(randomUUID(),1,0),view=randomUUID();
   await tasks.permit(ctx,view,0,true);
   const child=(mode)=>worker(database,root,ctx.scope,view,mode);
   assert.equal((await child(mode)).code,code);
   const task=await tasks.taskFor(ctx),rows=()=>pool.query("SELECT record FROM yingjie_image.attempt WHERE task=$1",[task.id]);
   assert.equal(await tasks.submit(ctx,view,0,{schemaVersion:"0.1",target:ctx.result.visual,action:"skip",reason:"different plan"}),"event-conflict");
   if(mode==="queued-crash"){
     assert.equal((await rows()).rowCount,0);
     const race=await Promise.all([child("race"),child("race")]);
     assert.deepEqual(race.map(r=>JSON.parse(r.out).status).sort(),["already-claimed","returned"]);
     assert.equal(race.reduce((n,r)=>n+JSON.parse(r.out).calls,0),1);
   }else{
     assert.equal((await rows()).rows[0].record.outcome.state,"waiting");
     if(mode==="after-file")assert.deepEqual((await files.audit(pool)).unreferenced,[pictures[0].sha256+".png"]);
     await delay(115);await tasks.recover();
     const a=(await rows()).rows[0].record;
     assert.equal(a.outcome.state,"unknown");
     for(const field of ["providerRequestId","usage","cost","model","seed"])assert.equal(a[field],null);
     assert.equal(await tasks.dispatch(()=>ctx,task.id,view,0,{retry:true}),"already-claimed");
     await tasks.permit(ctx,view,1,false);
     await assert.rejects(tasks.permit(ctx,view,0,true),/stale-permit/);
     await assert.rejects(tasks.receive(a.attemptId,"wrong",{state:"failed"}),/wrong-attempt/);
     const reply={state:"returned",bytes:await picture(0)};
     assert.equal(await tasks.receive(a.attemptId,a.requestKey,reply),"returned");
     assert.equal(await tasks.receive(a.attemptId,a.requestKey,reply),"duplicate");
     assert.equal(await tasks.receive(a.attemptId,a.requestKey,{...reply,bytes:await picture(1)}),"result-conflict");
     await tasks.permit(ctx,view,2,true);
     assert.equal((await tasks.view(ctx,view,2)).state,"target-inactive");
   }
   assert.equal((await rows()).rowCount,1);
  }
  t.diagnostic("four child crash positions; two competing processes sent once; ambiguous dispatch never resent; original receipt reconciled");
 });
});

test("reference eligibility, explicit retry, live scope and file integrity",async t=>{
 await fixture(async({tasks,pool,root,provider,turn,files})=>{
  const id=randomUUID(),view=randomUUID(),first=await turn(id,1,0);
  await tasks.permit(first,view,0,true);
  const plan=await demoPlan(tasks,first);
  const ids=await Promise.all(Array.from({length:5},()=>tasks.submit(first,view,0,plan)));
  assert.equal(new Set(ids).size,1);
  await tasks.dispatch(()=>first,ids[0],view,0);
  assert.equal((await tasks.view(first,view,0)).state,"review-pending");
  const a=(await pool.query("SELECT record FROM yingjie_image.asset")).rows[0].record;
  const original=await picture(0),path=join(root,a.storageKey);
  const review={...a.review,status:"accepted",assessment:"matches"};
  const next=await turn(id,2,2),base={schemaVersion:"0.1",target:next.result.visual,reason:"reference check",action:"edit",
    reference:{assetId:a.assetId,sha256:a.sha256,visualVersion:a.target.visualVersion,reviewId:a.review.id},
    preservePeople:a.target.people,preserveFeatures:a.target.features,change:"two arrivals"};
  const task=await tasks.submit(next,view,0,base);
  const attempt=()=>tasks.dispatch(()=>next,task,view,0,{retry:true});
  assert.equal(await attempt(),"not-sent");
  await tasks.review(first,a.assetId,{...review,status:"rejected",assessment:"contradicts"});
  assert.equal(await attempt(),"not-sent");
  await tasks.review(first,a.assetId,review);
  await writeFile(path,Buffer.from("damaged"));
  assert.deepEqual((await files.audit(pool)).broken,[a.assetId]);
  assert.equal((await tasks.view(first,view,0)).state,"file-missing");
  assert.equal(await attempt(),"not-sent");await unlink(path);
  assert.equal(await attempt(),"not-sent");await files.save(original);
  await pool.query("UPDATE yingjie_image.asset SET record=jsonb_set(record,'{invalidated}','true') WHERE id=$1",[a.assetId]);
  assert.equal(await attempt(),"not-sent");
  await pool.query("UPDATE yingjie_image.asset SET record=jsonb_set(record,'{invalidated}','false') WHERE id=$1",[a.assetId]);
  const wrongRef={...base,reference:{...base.reference,sha256:"0".repeat(64)}};
  assert.equal((await tasks.reference(pool,next,wrongRef)).ok,false);
  assert.equal((await tasks.reference(pool,next,{...base,target:{...base.target,sceneId:"other"}})).ok,false);
  assert.equal(await tasks.dispatch(()=>first,task,view,0),"stale-target");
  await assert.rejects(tasks.dispatch(()=>({...next,authorized:false}),task,view,0),/access-revoked/);
  const foreign=await turn(randomUUID(),1,0,"other-owner");
  assert.equal(await tasks.asset(pool,foreign.scope,a.assetId),null);
  assert.equal((await tasks.reference(pool,foreign,base)).ok,false);
  assert.equal(provider.calls,1);
  const send=provider.send.bind(provider);provider.send=async()=>({state:"failed"});
  assert.equal(await attempt(),"failed");assert.equal(await tasks.dispatch(()=>next,task,view,0),"already-claimed");
  provider.send=send;assert.equal(await attempt(),"returned");assert.equal(provider.calls,2);
  const attempts=(await pool.query("SELECT record FROM yingjie_image.attempt WHERE task=$1 ORDER BY ordinal",[task])).rows.map(r=>r.record);
  assert.equal(new Set(attempts.map(a=>a.attemptId)).size,attempts.length);
  assert.equal(new Set(attempts.map(a=>a.requestKey)).size,1);
  assert.deepEqual(await files.audit(pool),{unreferenced:[],broken:[]});
  await assert.rejects(files.save(Buffer.from("not PNG")),/invalid-png/);
  assert.equal(await files.read("../outside",a.sha256),null);
  t.diagnostic("five concurrent submissions → one task; five blocked reference attempts → zero sends; explicit failed retry kept request key");
 });
});
