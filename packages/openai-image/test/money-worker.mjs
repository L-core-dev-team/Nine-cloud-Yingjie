import assert from "node:assert/strict";
import {once} from "node:events";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {TestPool} from "./sqlite-pool.mjs";
import {fixture,answer,output} from "./fixture.mjs";
import {OpenAIImageProvider,fixtureCredential} from "../index.mjs";
import {MockImageMoney,approveMock,installMockBatch,livePreflight,maxChargeBound,mockTerms,officialSnapshot,revokeMock} from "../money.mjs";
import {readImageContext} from "../context.mjs";
import {Originals,sha256} from "../../image-tasks/files.mjs";
import {ImageTasks} from "../../image-tasks/index.mjs";
import {buildFrame} from "../prompt.mjs";
import {eventKey,fromCardHistory} from "../../contracts/dist/index.js";

assert.equal(process.permission?.has("net"),false);
const [mode,dir]=process.argv.slice(2), common=mode!=="suite";
const pool=new TestPool(common?join(dir,"authority.sqlite"):":memory:");
pool.db.exec(readFileSync(new URL("../money-schema.sql",import.meta.url),"utf8").replaceAll("yingjie_image.",""));
pool.db.exec("CREATE TABLE IF NOT EXISTS stream(scope text PRIMARY KEY, revision integer)");
assert.equal(pool.db.prepare("PRAGMA synchronous").get().synchronous,2);
const grantId="00000000-0000-4000-a000-000000000010",permit="00000000-0000-4000-a000-000000000020";
const fixed={session:"00000000-0000-4000-a000-000000000030",keys:["00000000-0000-4000-a000-000000000040",
  "00000000-0000-4000-a000-000000000041","00000000-0000-4000-a000-000000000042"]};
const counts=()=>({holds:pool.db.prepare("SELECT COUNT(*) AS n FROM image_money_hold").get().n,
  microUsd:pool.db.prepare("SELECT COALESCE(SUM(micro_usd),0) AS n FROM image_money_hold").get().n});
const cases=[],receipts=[];
const check=async(name,fn)=>{await fn();cases.push(name);};
const files=new Originals(join(dir,"originals"));
// The filesystem host only accepts the three known fixture digests. It performs the real fsync.
files.save=async bytes=>{
  const reply=once(process,"message");process.send({save:bytes});const [info]=await reply;
  if(!info.storageKey)throw Error("original-save-failed");
  assert.deepEqual(await files.read(info.storageKey,info.sha256),bytes);return info;
};
async function setup(operation="generate",{initialize=true,total=10000,approve=true,grant=grantId,session=fixed.session,access=permit,reviewed=null}={}){
  const f=fixture({operation,...fixed,session});f.ledger.close();
  const {ctx,plan}=f,source=plan.target.source;
  if(reviewed){
    ctx.asset=reviewed.asset;ctx.latestAcceptedId=ctx.asset.assetId;
    plan.reference={assetId:ctx.asset.assetId,reviewId:ctx.asset.review.id,sha256:ctx.asset.sha256,visualVersion:ctx.asset.target.visualVersion};
    f.claim.referenceBytes=reviewed.bytes;f.frame=buildFrame(f.claim,ctx);
  }
  const terms=mockTerms(f.frame,ctx,source,{approvalId:grant,approvedAt:Date.now()-1000,expiresAt:Date.now()+120000,
    referencePurpose:operation==="generate"?null:"upload-exact-png-for-this-edit",singleMicroUsd:5000,totalMicroUsd:total});
  let calls=0,returned,requestHistory=()=>Response.json(ctx.history);
  const provider=new OpenAIImageProvider({mode:"mock",credentialsProvider:()=>fixtureCredential,moneyGate:new MockImageMoney(grant),
    resolve:(claim,db)=>readImageContext({tasks,context:()=>ctx,request:requestHistory},claim,db),
    transport:async req=>{
      calls++;
      // The runner additionally reopens the authority in fresh processes after a forced exit.
      assert.ok(counts().holds>0);assert.equal(lastRecord().outcome.state,"waiting");assert.ok(lastRecord().sentAt);
      if(mode==="crash")process.exit(73);
      if(common)throw Error("synthetic-connection-lost");
      const form=operation==="generate"?null:await req.formData(),prompt=form?form.get("prompt"):(await req.json()).prompt;
      assert.equal(sha256(prompt),terms.request.promptSha256);
      if(form)assert.equal(sha256(Buffer.from(await form.get("image[]").arrayBuffer())),terms.request.reference.sha256);
      return returned?returned():answer();
    }});
  const tasks=new ImageTasks(pool,files,provider);
  const lastRecord=()=>JSON.parse(pool.db.prepare("SELECT record FROM attempt WHERE task=? ORDER BY ordinal DESC").get(taskId).record);
  let taskId;
  if(initialize){
    await installMockBatch(pool,total);
    if(approve)await approveMock(pool,terms);
    await tasks.permit(ctx,access,1,true);
    await pool.query("INSERT INTO stream VALUES($1,$2) ON CONFLICT(scope) DO UPDATE SET revision=$2",[ctx.scope,ctx.revision]);
    for(const row of ctx.history){
      const src=fromCardHistory(source.ownerId,source.sessionId,row).source;
      if(!pool.db.prepare("SELECT revision FROM event WHERE scope=? AND revision=?").get(ctx.scope,src.revision))
        await pool.query("INSERT INTO event VALUES($1,$2,$3,$4)",[ctx.scope,src.revision,eventKey(src),sha256(row.narrative)]);
    }
    if(operation!=="generate" && !reviewed){
      const a=ctx.asset, saved=await files.save(f.claim.referenceBytes);
      const previous=randomUUID();await pool.query("INSERT INTO task VALUES($1,$2,$3,$4,$5,$6)",[previous,ctx.scope,previous,"old",{target:a.target},access]);
      await pool.query("INSERT INTO attempt VALUES($1,$2,1,$3,NULL)",[a.assetId,previous,{localWait:"active"}]);
      await pool.query("INSERT INTO asset VALUES($1,$2,$3,$4)",[a.assetId,ctx.scope,a,saved.size]);
    }
    taskId=await tasks.submit(ctx,access,1,plan);
  }else taskId=(await tasks.taskFor(ctx)).id;
  return {terms,f,ctx,tasks,provider,last:lastRecord,taskId,calls:()=>calls,
    setResponse:fn=>{returned=fn;},loseHistory:()=>{requestHistory=()=>new Response(null,{status:404});},
    dispatch:(retry=false)=>tasks.dispatch(()=>ctx,taskId,access,1,{retry})};
}
const clear=()=>{for(const table of ["image_money_stage","image_money_hold","image_money_grant","image_money_batch","asset","attempt","task","permit","event","stream"])
  pool.db.exec("DELETE FROM "+table);};
const stages=id=>pool.db.prepare("SELECT stage FROM image_money_stage WHERE run_hash=? ORDER BY rowid").all(sha256(id)).map(r=>r.stage);
async function suite(){
  await check("official price snapshot has no enforceable upper bound",()=>{
    assert.equal(livePreflight().allowLiveSend,false);assert.equal(livePreflight().maxMicroUsd,null);
    for(const op of ["generate","edit"])assert.throws(()=>maxChargeBound(officialSnapshot,op),/UNVERIFIED/);
  });
  const negatives={
    "missing USD approval":async()=>{},
    "changed model":t=>t.request.specification.model="other","changed size":t=>t.request.specification.size="auto",
    "changed quality":t=>t.request.specification.quality="auto","changed project":t=>t.request.project="another",
    "wrong currency":t=>t.currency="CNY","different scope":t=>t.request.scopeHash="other",
    "different prompt":t=>t.request.promptSha256="other","different endpoint":t=>t.request.endpoint="other",
    "future approval":t=>t.approvedAt=Date.now()+10000,"expired approval":t=>t.expiresAt=Date.now()-1,
    "expired tariff version":t=>t.tariff.version="obsolete","official rates without hard bound":t=>t.tariff=officialSnapshot,
    "per-call cap too small":t=>t.singleMicroUsd=1,"multiple calls":t=>t.maxCalls=2,
    "wrong operation":t=>t.request.operation="edit","edit without PNG processing rights":t=>t.referencePurpose=null,
    "unknown reference input cost":t=>t.tariff.imageInput.tokens=null,"different original SHA":t=>t.request.reference.sha256="wrong"
  };
  for(const [name,change] of Object.entries(negatives))await check(name,async()=>{
    clear();const edit=/PNG|reference input|original SHA/.test(name),s=await setup(edit?"edit":"generate",{approve:false});
    if(name!=="missing USD approval"){
      change(s.terms);
      // Corrupt even a provisioned row to exercise dispatch-time fail-closed checks.
      await pool.query("INSERT INTO image_money_grant(id,batch,operation,terms) VALUES($1,$2,$3,$4)",
        [grantId,s.terms.batch,edit?"edit":"generate",JSON.stringify(s.terms)]);
    }
    assert.equal(await s.dispatch(),"not-sent");assert.equal(s.last().sentAt,null);assert.equal(s.calls(),0);
    assert.deepEqual(counts(),{holds:0,microUsd:0});assert.deepEqual(stages(s.last().attemptId),["gate-checked","stop"]);
  });
  for(const which of ["revoked grant","missing history","stale stream","revoked reference","failed attempt insert"])await check(which,async()=>{
    clear();const s=await setup(which==="revoked reference"?"edit":"generate");
    if(which==="revoked grant")await revokeMock(pool,grantId);
    if(which==="missing history")s.loseHistory();
    if(which==="stale stream")pool.db.exec("UPDATE stream SET revision=revision+1");
    if(which==="revoked reference")pool.db.exec("UPDATE asset SET record=json_set(record,'$.invalidated',json('true'))");
    if(which==="failed attempt insert"){
      pool.db.exec("CREATE TRIGGER fail_attempt BEFORE INSERT ON attempt BEGIN SELECT RAISE(ABORT,'injected'); END");
      await assert.rejects(s.dispatch(),/injected/);pool.db.exec("DROP TRIGGER fail_attempt");
      assert.equal(pool.db.prepare("SELECT count(*) n FROM image_money_stage").get().n,0);
    }else{assert.equal(await s.dispatch(),"not-sent");assert.equal(s.last().sentAt,null);}
    assert.equal(s.calls(),0);assert.equal(counts().holds,0);
  });
  for(const operation of ["generate","edit","evening"])await check(operation+" committed PNG and review",async()=>{
    clear();const s=await setup(operation);assert.equal(await s.dispatch(),"returned");
    const a=s.last(),saved=await s.tasks.asset(pool,s.ctx.scope,a.attemptId);
    assert.equal(saved.asset.review.status,"pending");assert.deepEqual(saved.bytes,output);
    assert.equal((await s.tasks.view(s.ctx,permit,1)).state,"review-pending");
    assert.equal(a.cost,null);assert.equal(a.usage,null);assert.equal(a.providerRequestId,null);
    assert.deepEqual(stages(a.attemptId),["gate-checked","money-reserved","possible-sent","provider-response-seen","original-saved","pending-review","stop"]);
    await s.tasks.review(s.ctx,a.attemptId,{...saved.asset.review,id:"fixture-reject",status:"rejected",assessment:"contradicts"});
    assert.equal((await s.tasks.view(s.ctx,permit,1)).state,"review-rejected");
    assert.equal(await s.dispatch(true),"already-claimed");assert.equal(s.calls(),1);
    receipts.push({operation:s.f.plan.action,revision:s.ctx.revision,sourceSha256:s.terms.request.sourceSha256,
      promptSha256:s.terms.request.promptSha256,referenceSha256:s.terms.request.reference?.sha256??null,
      pngSha256:saved.asset.sha256,reviewOnArrival:"pending",afterReview:"rejected",...counts(),audit:pool.db.prepare(
        "SELECT run_hash,grant_hash,utc,stage FROM image_money_stage WHERE run_hash=? ORDER BY rowid").all(sha256(a.attemptId))});
  });
  await check("separate edit grant cannot exceed aggregate budget",async()=>{
    clear();const a=await setup("generate",{total:7000});assert.equal(await a.dispatch(),"returned");
    const b=await setup("edit",{grant:randomUUID(),total:7000});assert.equal(await b.dispatch(),"not-sent");
    assert.equal(b.last().sentAt,null);assert.deepEqual(counts(),{holds:1,microUsd:4000});assert.equal(b.calls(),0);
    await assert.rejects(installMockBatch(pool,9000),/changed/);
    await assert.rejects(approveMock(pool,{...a.terms,approvalId:randomUUID()}));
  });
  await check("reviewed mock generation requires separate scoped edit approval",async()=>{
    clear();const a=await setup();assert.equal(await a.dispatch(),"returned");
    const id=a.last().attemptId,pending=await a.tasks.asset(pool,a.ctx.scope,id);
    await a.tasks.review(a.ctx,id,{...pending.asset.review,id:"mock-review-only",status:"accepted",assessment:"matches",basis:"synthetic-contract-test"});
    const reviewed=await a.tasks.asset(pool,a.ctx.scope,id), second=randomUUID();
    const b=await setup("edit",{grant:second,approve:false,reviewed});
    assert.equal(await b.dispatch(),"not-sent");assert.equal(b.last().sentAt,null);assert.equal(b.calls(),0);
    await approveMock(pool,b.terms);assert.equal(await b.dispatch(true),"returned");
    const edited=await b.tasks.asset(pool,b.ctx.scope,b.last().attemptId);
    assert.equal(edited.asset.reference.assetId,id);assert.equal(edited.asset.review.status,"pending");
    assert.deepEqual(counts(),{holds:2,microUsd:9000});
  });
  await check("reissued UUID and changed session cannot reopen the operation slot",async()=>{
    clear();const s=await setup();s.setResponse(()=>{throw Error("lost");});
    assert.equal(await s.dispatch(),"unknown");
    const other=fixture();other.ledger.close();
    const grant=mockTerms(other.frame,other.ctx,other.plan.target.source,{...s.terms,approvalId:randomUUID()});
    await assert.rejects(approveMock(pool,grant));assert.equal(counts().microUsd,4000);
    assert.equal((await s.provider.send(s.f.claim)).state,"refused");assert.equal(s.calls(),1);
  });
  await check("price proof expiry and explicit outbound purpose",async()=>{
    clear();const s=await setup("edit",{approve:false});
    await assert.rejects(approveMock(pool,{...s.terms,priceValidUntil:Date.now()-1}));
    await assert.rejects(approveMock(pool,{...s.terms,origin:"live",allowLiveSend:true}));
    assert.equal(counts().holds,0);
  });
  for(const [code,state] of [[400,"failed"],[401,"refused"],[403,"refused"],[422,"failed"],[429,"failed"],[503,"unknown"]])
    await check("HTTP "+code+" keeps full hold",async()=>{
      clear();const s=await setup();s.setResponse(()=>new Response(null,{status:code}));
      assert.equal(await s.dispatch(),state);assert.ok(s.last().sentAt);assert.equal(s.calls(),1);
      await s.dispatch(true);assert.equal(s.calls(),1);assert.equal(counts().microUsd,4000);
    });
  await check("failed original save preserves budget and cannot replay",async()=>{
    clear();const s=await setup();s.tasks.files={save:async()=>{throw Error("disk-full");}};
    await assert.rejects(s.dispatch(),/disk-full/);assert.equal(await s.dispatch(true),"already-claimed");
    assert.ok(stages(s.last().attemptId).includes("provider-response-seen"));assert.equal(s.calls(),1);
    assert.equal(pool.db.prepare("SELECT COUNT(*) n FROM asset").get().n,0);assert.equal(counts().holds,1);
  });
  await check("late edit after revocation remains pending on original attempt",async()=>{
    clear();const s=await setup("edit"),seen=Promise.withResolvers(),release=Promise.withResolvers();
    s.setResponse(async()=>{seen.resolve();await release.promise;return answer();});
    const run=s.dispatch();await Promise.race([seen.promise,run.then(v=>{throw Error("early-"+v);})]);
    await s.tasks.permit(s.ctx,permit,2,false);await revokeMock(pool,grantId);release.resolve();
    assert.equal(await run,"returned");assert.equal(s.last().localWait,"stopped");
    assert.equal((await s.tasks.asset(pool,s.ctx.scope,s.last().attemptId)).asset.review.status,"pending");
    assert.equal((await s.tasks.view(s.ctx,permit,2)).state,"disabled");assert.equal(s.calls(),1);
  });
}
try{
  if(mode==="suite"){await suite();process.send({cases,receipts});}
  else{
    const edit=mode.endsWith("-edit"),seed=mode.startsWith("seed");
    const options=edit?{grant:"00000000-0000-4000-a000-000000000011",session:"00000000-0000-4000-a000-000000000031",
      access:"00000000-0000-4000-a000-000000000021"}:{};
    const s=await setup(edit?"edit":"generate",{...options,initialize:seed,total:mode.includes("aggregate")?7000:10000});
    if(seed)process.send({seeded:true});
    else{
      const go=once(process,"message");process.send({ready:true});await go;
      if(mode==="lost-task-record")pool.db.prepare("DELETE FROM attempt WHERE task=?").run(s.taskId);
      const state=await s.dispatch(true);
      process.send({state,calls:s.calls(),...counts(),sentAtPresent:Boolean(s.last().sentAt),stages:stages(s.last().attemptId)});
    }
  }
}finally{pool.close();process.disconnect();}
