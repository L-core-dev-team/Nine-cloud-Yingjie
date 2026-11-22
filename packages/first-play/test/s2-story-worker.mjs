import assert from "node:assert/strict";
import {once} from "node:events";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {eventKey} from "../../contracts/dist/index.js";
import {ImageTasks} from "../../image-tasks/index.mjs";
import {Originals,sha256} from "../../image-tasks/files.mjs";
import {StoryPool} from "./s2-planner-pool.mjs";
import {chooseFrame} from "../planner.mjs";
import {S2ReplayProvider} from "../../openai-image/test/s2-replay-bridge.mjs";
import {fixtureCredential} from "../../openai-image/index.mjs";
import {buildFrame} from "../../openai-image/prompt.mjs";
import {readImageContext} from "../../openai-image/context.mjs";
import {approveMock,installMockBatch,MockImageMoney,mockTerms,livePreflight} from "../../openai-image/money.mjs";
import {reviewVisualHistory,reviewAssetUse} from "../visual-consistency.mjs";
import {session,editPlan} from "./s2-host.mjs";
import {initialPng,editedPng} from "./s2-png.mjs";

assert.equal(process.permission.has("net"),false);
const dir=process.argv[2],pool=new StoryPool(join(dir,"story.sqlite")),files=new Originals(join(dir,"originals"));
files.save=async bytes=>{
  const done=once(process,"message");process.send({save:bytes});const [info]=await done;
  assert.deepEqual(await files.read(info.storageKey,info.sha256),bytes);return info;
};
pool.db.exec(readFileSync(new URL("../../openai-image/money-schema.sql",import.meta.url),"utf8").replaceAll("yingjie_image.",""));
pool.db.exec("CREATE TABLE stream(scope text PRIMARY KEY,revision integer)");
await installMockBatch(pool,9000);
const story=session("continuous-slice"),permit="00000000-0000-4000-a000-000000000001";
const ids={generate:"00000000-0000-4000-a000-000000000002",edit:"00000000-0000-4000-a000-000000000003"};
const records=[],traffic=[],reviews=[],approvalEvidence=[];
const entered=Promise.withResolvers(),release=Promise.withResolvers();
let active,terms,firstId,editId,pendingEdit,editTask,editCtx;
const rawCtx=()=>story.context();
const gateCtx=()=>{
  const ctx=rawCtx(),checked=reviewVisualHistory(ctx);
  return checked.review.imageEligible?ctx:{...ctx,result:{status:"not-ready",reason:checked.review.reason}};
};
const provider=new S2ReplayProvider({mode:"mock",credentialsProvider:()=>fixtureCredential,moneyGate:new MockImageMoney(ids.generate),
  resolve:(claim,db)=>readImageContext({tasks,context:gateCtx,request:async(path,opts)=>{
    const ctx=rawCtx(),prefix="/api/card-import/sessions/"+ctx.sessionId+"/history?after=";
    assert.ok(path.startsWith(prefix));assert.equal(opts.headers["x-jiuxiao-account"],ctx.owner);
    return Response.json(ctx.history.slice(Number(path.slice(prefix.length))));
  }},claim,db),
  transport:async req=>{
    const edit=req.url.endsWith("/edits"),form=edit?await req.formData():null;
    const prompt=edit?form.get("prompt"):(await req.json()).prompt;
    assert.equal(sha256(prompt),terms.request.promptSha256);
    const content=JSON.parse(prompt.split("\r\n")[1]);
    assert.equal(content.在场总人数,edit?5:3);
    if(edit){
      assert.equal(sha256(Buffer.from(await form.get("image[]").arrayBuffer())),sha256(initialPng));
      const changes=JSON.parse(prompt.split("\r\n").at(-1));
      assert.deepEqual(changes.留存人物,["宋明","沈安","药师"]);assert.deepEqual(changes.到场,["林青","顾宁"]);
    }
    traffic.push({revision:rawCtx().revision,operation:edit?"edit":"generate",promptSha256:sha256(prompt),
      reference:edit?sha256(initialPng):null,people:content.在场总人数});
    if(edit){entered.resolve();await release.promise;}
    return Response.json({data:[{b64_json:(edit?editedPng:initialPng).toString("base64")}]});
  }});
const tasks=new ImageTasks(pool,files,provider);
async function append(text){
  const ctx=story.append(text),r=ctx.revision,src=ctx.receipts.at(-1).source;
  await pool.query("INSERT INTO stream VALUES($1,$2) ON CONFLICT(scope) DO UPDATE SET revision=$2",[ctx.scope,r]);
  await pool.query("INSERT INTO event VALUES($1,$2,$3,$4)",[ctx.scope,r,eventKey(src),sha256(text)]);
  const reviewed=reviewVisualHistory(ctx),v=ctx.result.visual;
  active={revision:r,narrativeSha256:sha256(text),scene:v?.sceneId??null,visualVersion:v?.visualVersion??null,people:v?.people.length??null,
    fieldReady:reviewed.review.fieldReady,verdict:reviewed.review.verdict,reason:reviewed.review.reason};
  records.push(active);return ctx;
}
async function currentChoice(){
  const ctx=rawCtx(),checked=reviewVisualHistory(ctx);
  const pick=await chooseFrame(tasks,{resolve:async()=>({reason:"no-worldbook"})},gateCtx(),true);
  active.plannerReason=pick.reason;
  if(pick.plan){
    const id=pick.plan.assetId??pick.plan.reference?.assetId;
    if(!id)return pick.plan;
    const stored=await tasks.asset(pool,ctx.scope,id);
    return reviewAssetUse(checked,pick.plan,{...stored,active:true}).imageEligible?pick.plan:{action:"hide"};
  }
  // The ordinary demo recognises only its three fixed fixture pictures. Extend this one
  // outcome for the S2 test provider; honour pending, unknown and every other planner stop.
  if(pick.reason!=="outside-local-provider")return {action:"hide"};
  const target=ctx.result.visual;
  let edit;
  for(const {id} of pool.db.prepare(`SELECT a.id FROM asset a JOIN attempt t ON a.id=t.id WHERE a.scope=?
      AND json_extract(t.record,'$.localWait')='active' ORDER BY a.rowid DESC`).all(ctx.scope)){
    const stored={...await tasks.asset(pool,ctx.scope,id),active:true};
    const reuse={schemaVersion:"0.1",action:"reuse",target,assetId:id,reason:"current-reviewed-original"};
    if(reviewAssetUse(checked,reuse,stored).imageEligible)return reuse;
    const candidate=editPlan(target,stored.asset);
    if(!edit && reviewAssetUse(checked,candidate,stored).imageEligible)edit=candidate;
  }
  return edit??{schemaVersion:"0.1",action:"generate",target,reason:"no-eligible-original"};
}
async function show(expected){
  const choice=await currentChoice();assert.equal(choice.action,expected,"choice at "+active.revision);
  active.choice=choice.action;
  if(choice.action==="reuse"){
    await tasks.submit(gateCtx(),permit,1,choice);
    const view=await tasks.view(gateCtx(),permit,1);assert.equal(view.state,"display");assert.equal(view.asset.assetId,firstId);
    active.displaySha256=sha256(view.bytes);
  }else{
    const state=(await tasks.view(gateCtx(),permit,1)).state;
    assert.notEqual(state,"display");active.displaySha256=null;
  }
  return choice;
}
async function approve(plan,ctx){
  const op=plan.action;provider.moneyGate=new MockImageMoney(ids[op]);
  const stored=op==="edit"?await tasks.asset(pool,ctx.scope,plan.reference.assetId):null;
  const claim={plan,referenceBytes:stored?.bytes};
  const preparedCtx=stored?{...ctx,asset:stored.asset,latestAcceptedId:stored.asset.assetId,referenceActive:true}:ctx;
  const frame=provider.buildFrame(claim,preparedCtx);
  assert.throws(()=>buildFrame(claim,preparedCtx),/unconfirmed/);
  terms=mockTerms(frame,ctx,plan.target.source,{approvalId:ids[op],approvedAt:Date.now()-1,expiresAt:Date.now()+60000,
    singleMicroUsd:op==="generate"?4000:5000,totalMicroUsd:9000,referencePurpose:stored?"upload-exact-png-for-this-edit":null});
  await approveMock(pool,terms);approvalEvidence.push({operation:op,idHash:sha256(ids[op]),reference:terms.request.reference?.sha256??null,
    sourceSha256:terms.request.sourceSha256,purpose:terms.request.purpose,allowLiveSend:terms.allowLiveSend});
}
async function review(ctx,id,verdict){
  const file=await tasks.asset(pool,ctx.scope,id);
  assert.equal(file.asset.review.status,"pending");
  assert.deepEqual(file.bytes,verdict==="accepted"?initialPng:editedPng);
  await tasks.review(ctx,id,{id:"s2-mock-review-"+verdict,status:verdict,assessment:verdict==="accepted"?"matches":"contradicts",
    basis:"simulated-reviewer",reason:"scripted-format-fixture"},{onlyPending:true});
  reviews.push({attemptHash:sha256(id),sourceRevision:file.asset.target.source.revision,reviewedDuring:rawCtx().revision,
    sha256:file.asset.sha256,from:"pending",to:verdict});
}
const three="此时我身在琥洲的听雨酒馆。我在廊下朝北看去。殿中除沈安、宋明、药师再无旁人。我看清了这里的铜柱与长桌。此时是正午。日光照亮眼前。";
const second="此时我身在芦湾的听潮台。我在桥头朝西看去。眼前只有林青与顾宁两人。我看清了这里的木栏与石阶。此时是傍晚。灯光照亮眼前。";
const third=second.replace("芦湾的听潮台","沙洲的南星庭").replace("桥头","栏边");
const leave="我离开了这里。",chat="你们谈了谈茶价。",back="我回到琥洲的雨廊酒肆。",same="我重新环顾，人物、结构、时段、光照、观察位置和朝向全与离开时相同。";
const other="观察位置、朝向、结构、时段和光照均未改变。", arrival=n=>n+"走了进来，原来的人都还在，除此再无旁人。"+other;
const scenes=[three,chat,leave,second,second.replace("傍晚","夜间").replace("灯光","日光"),chat,back+same,"雾起之后，谁还在已看不清。",back,
  three,arrival("林青"),arrival("顾宁"),leave,third,back+same,"林青离开了这里，其余在场的人都没动，也没有新人到场。"+other,
  three.replace("正午","傍晚").replace("日光","灯光"),three.replace("正午","夜间"),chat,three];
const choices=["generate","reuse","hide","generate","hide","hide","reuse","hide","hide","reuse","edit","edit","hide","generate","edit","edit","edit","hide","hide","edit"];
try{
  for(const [i,text] of scenes.entries()){
    const ctx=await append(text),r=i+1,before=traffic.length;
    if(r===1)await tasks.permit(ctx,permit,1,true);
    const plan=await show(choices[i]);
    if(r===1){
      await approve(plan,ctx);const id=await tasks.submit(ctx,permit,1,plan);
      assert.equal(await tasks.dispatch(gateCtx,id,permit,1),"returned");
      let view=await tasks.view(ctx,permit,1);assert.equal(view.state,"review-pending");
      firstId=view.auditAsset.id;await review(ctx,firstId,"accepted");view=await tasks.view(ctx,permit,1);
      assert.equal(view.state,"display");active.displaySha256=sha256(view.bytes);
    }
    if(r===12){
      editCtx=ctx;editTask=await tasks.submit(ctx,permit,1,plan);
      assert.equal(await tasks.dispatch(gateCtx,editTask,permit,1),"not-sent");
      assert.equal(traffic.length,before);
      const denied=JSON.parse(pool.db.prepare("SELECT record FROM attempt WHERE task=?").get(editTask).record);
      assert.equal(denied.sentAt,null);active.generateGrantDeniedEdit=true;
      await approve(plan,ctx);
      pendingEdit=tasks.dispatch(gateCtx,editTask,permit,1,{retry:true});
      await Promise.race([entered.promise,pendingEdit.then(x=>{throw Error("edit-ended-before-delay:"+x);})]);
      assert.equal((await tasks.view(ctx,permit,1)).state,"waiting");
    }
    if(r===14){
      release.resolve();assert.equal(await pendingEdit,"returned");
      editId=pool.db.prepare("SELECT id FROM attempt WHERE task=? ORDER BY ordinal DESC").get(editTask).id;
      const stored=await tasks.asset(pool,ctx.scope,editId);
      assert.equal(stored.asset.target.sceneId,"amber-tavern");assert.equal(stored.asset.target.source.revision,12);
      assert.equal(stored.asset.reference.assetId,firstId);assert.equal(stored.asset.review.status,"pending");
      assert.notEqual((await tasks.view(ctx,permit,1)).state,"display");
      await review(ctx,editId,"rejected");
      assert.equal((await tasks.view(editCtx,permit,1)).state,"review-rejected");
      active.lateOriginalRevision=12;
    }
    if(r===15 || r===16){
      assert.equal(plan.reference.assetId,firstId);
      const stored=await tasks.asset(pool,ctx.scope,editId);
      const use=reviewAssetUse(reviewVisualHistory(ctx),editPlan(ctx.result.visual,stored.asset),{...stored,active:true});
      assert.equal(use.imageEligible,false);active.rejectedOriginalExcluded=true;
    }
    active.fakeSends=traffic.length-before;
    if(r!==1 && r!==12)assert.equal(active.fakeSends,0);
  }
  const foreign=session("foreign-session").append(three),first=await tasks.asset(pool,rawCtx().scope,firstId);
  assert.equal(await tasks.asset(pool,foreign.scope,firstId),null);
  assert.equal(reviewAssetUse(reviewVisualHistory(foreign),{schemaVersion:"0.1",action:"reuse",reason:"foreign",target:foreign.result.visual,assetId:firstId},{...first,active:true}).imageEligible,false);
  const spoof={...rawCtx(),owner:"other-owner"};
  assert.equal(reviewVisualHistory(spoof).review.reason,"access-denied");
  assert.equal(await tasks.asset(pool,JSON.stringify(["card-history","other-owner",spoof.sessionId]),firstId),null);
  const held=pool.db.prepare("SELECT count(*) n,sum(micro_usd) amount FROM image_money_hold").get();
  assert.deepEqual([held.n,held.amount,traffic.length],[2,9000,2]);
  const summary={mode:"MOCK_ONLY",authority:"file SQLite FULL",turns:records,traffic,reviews,approvalEvidence,
    heldMicroUsd:held.amount,heldCount:held.n,foreignDisplay:false,live:livePreflight().status,networkPermission:false,actualUsd:0};
  process.send({summary});
}finally{release.resolve();pool.close();process.disconnect();}
