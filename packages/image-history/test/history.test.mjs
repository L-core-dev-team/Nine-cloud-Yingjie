import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {promisify} from "node:util";
import {execFile} from "node:child_process";
import {fileURLToPath} from "node:url";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join} from "node:path";
import {withDatabase,requireApi} from "../../scene-state/test/local-db.mjs";
import {latest} from "../../scene-state/store.mjs";
import {createPlayers} from "../../ui-shell/test/player.mjs";
import {withHost} from "../../ui-shell/test/host.mjs";
import {prepareTavern} from "../../world-assets/test/tavern.mjs";
import {catalog} from "../../world-assets/index.mjs";
import {TavernProvider,reviewFixture} from "../../image-tasks/demo.mjs";
import {extractContinuity} from "../../first-play/continuity.mjs";
import {walkthrough as story} from "../../first-play/story.mjs";

test("original card history, protected originals and append-only correction across processes",{timeout:130000},async t=>{
  let body="",mode="normal",sends=0,refuse;
  const delayedRefusal=new Promise(resolve=>{refuse=()=>resolve({state:"refused"});});
  const provider=new TavernProvider(),normal=provider.send.bind(provider);
  provider.send=async claim=>{
    sends++;
    if(mode==="waiting")return delayedRefusal;
    if(mode==="failed")return {state:"failed"};
    if(mode==="unknown")throw Error("unconfirmed");
    if(mode==="wrong")return {state:"returned",bytes:await readFile(new URL("../../../docs/reports/evidence/YJ-02/I1.png",import.meta.url))};
    return normal(claim);
  };
  await withDatabase((pool,database)=>withHost(pool,async({origin,codes,tasks,history})=>{
    const browser=await requireApi("playwright").chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
    try{
      const client=await browser.newContext(),{cardId,second,login}=await createPlayers(client,origin,codes);
      const demo=await prepareTavern(client,origin,pool,cardId),page=await client.newPage();
      const path=origin+"/api/yingjie/"+demo.id,context=async()=>({authorized:true,scope:demo.scope,...await latest(pool,demo.scope)});
      const child=async(rev,id)=>{const args=[database,demo.scope,tasks.files.root,String(rev)];if(id)args.push(id);
        return (await promisify(execFile)(process.execPath,[fileURLToPath(new URL("restart.mjs",import.meta.url)),...args],{windowsHide:true})).stdout.trim();};
      const detail=async rev=>{const r=await client.request.get(path+"/history/"+rev);assert.equal(r.status(),200,await r.text());return r.json();};
      const original=m=>path+"/history/"+m.revision+"/"+m.kind+"/"+m.id;
      const get=async url=>(await client.request.get(url)).status();
      const submit=data=>client.request.post(path+"/feedback",{headers:{Origin:origin},data});
      const feedback=m=>({command:randomUUID(),generation:m.generation,revision:m.revision,kind:m.kind,id:m.id,category:"light",note:""});
      const taskCount=async()=>Number((await pool.query("SELECT count(*) FROM yingjie_image.task WHERE scope=$1",[demo.scope])).rows[0].count);
      let revision=0;
      page.setDefaultTimeout(11000);
      await page.goto(origin+"/cards/session/"+demo.id);
      await page.getByRole("button",{name:"进入映界"}).click();
      await page.locator('.yj-figure[data-state="not-ready"]').waitFor();
      async function turn(text,state){
        body=text;revision++;
        await page.getByRole("textbox",{name:"角色卡行动"}).fill("继续观察");
        await page.getByRole("button",{name:"提交行动"}).click();
        await page.getByText("独立会话 · 修订 "+revision,{exact:true}).waitFor();
        const figure=page.locator('.yj-figure[data-revision="'+revision+'"][data-state="'+state+'"]');
        try{await figure.waitFor();}catch(e){throw Error("turn "+revision+" expected "+state+" got "+await page.locator(".yj-figure").getAttribute("data-state"),{cause:e});}
        return figure;
      }
      const first=await turn(story[0],"display"),presetCurrent=origin+await first.locator("img").getAttribute("src");
      const presetDetail=await detail(1),preset=presetDetail.media[0];
      assert.equal(preset.kind,"preset");assert.equal(presetDetail.task,null);assert.equal(presetDetail.attempts.length,0);
      assert.equal(await get(original(preset)),200);
      mode="failed";await turn(story[2],"failed");const ctx2=await context(),task=await tasks.taskFor(ctx2);
      const permit=(await pool.query("SELECT serial FROM yingjie_image.permit WHERE id=$1",[task.permit])).rows[0];
      mode="normal";assert.equal(await tasks.dispatch(()=>ctx2,task.id,task.permit,Number(permit.serial),{retry:true}),"returned");
      await reviewFixture(tasks,ctx2,task);
      let two=await detail(2);assert.deepEqual(two.attempts.map(a=>[a.ordinal,a.outcome]),[[1,"failed"],[2,"returned"]]);
      const good=two.media[0];assert.equal(await get(original(good)),200);
      await turn(story[1],"display");const reuse=await detail(3);
      assert.equal(reuse.action,"reuse");assert.equal(reuse.media[0].id,good.id);assert.equal(reuse.attempts.length,0);
      mode="wrong";await turn(story[6],"review-rejected");
      const wrong=(await detail(4)).media[0];assert.equal(wrong.sha256,good.sha256);assert.notEqual(wrong.id,good.id);
      assert.equal(await get(original(wrong)),404);assert.equal(await get(original(good)),200);
      const wrongReport=await history.report(await context(),feedback(wrong));
      await history.decide(await context(),wrongReport.id,"invalidated","local-fixture-review");
      assert.equal(await get(original(good)),200);
      mode="normal";const now=await turn("此时是白日，日光照入堂内。","display");
      const current=origin+await now.locator("img").getAttribute("src"),active=(await detail(5)).media[0];
      assert.notEqual(active.id,good.id);assert.equal(active.sha256,good.sha256);
      const tasksBeforeFeedback=await taskCount(),sendsBeforeFeedback=sends;
      const panel=page.getByRole("region",{name:"本会话图片历史"});
      await panel.getByRole("button",{name:"本会话图片历史"}).focus();await page.keyboard.press("Enter");
      await panel.getByRole("button",{name:/第 5 轮/}).click();
      await panel.getByRole("button",{name:"查看历史原图"}).click();
      await page.waitForFunction(()=>document.querySelector('.yj-history img')?.naturalWidth>0);
      await page.setViewportSize({width:390,height:844});
      assert.ok(await panel.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));
      await panel.getByRole("button",{name:"反馈图片问题"}).click();
      await panel.getByLabel("问题类别").selectOption("light");
      const nextReport=page.waitForRequest(r=>r.url()===path+"/feedback" && r.method()==="POST");
      await panel.getByRole("button",{name:"提交图片反馈"}).click();
      const posted=(await nextReport).postDataJSON();
      await panel.getByText("反馈已记录，等待审阅。").waitFor();
      const uiId=(await detail(5)).media[0].reports[0].id;
      const repeats=await Promise.all(Array.from({length:14},(_,i)=>submit(i%2?posted:{...posted,id:posted.id.toUpperCase(),command:posted.command.toUpperCase()})));
      for(const reply of repeats)assert.equal((await reply.json()).id,uiId);
      assert.equal((await submit({...posted,category:"people"})).status(),409);
      assert.equal((await submit({...posted,actor:"reviewer"})).status(),400);
      assert.equal(await get(current),200);
      const evidence=process.env.YJ11_EVIDENCE_DIR;
      if(evidence){await mkdir(evidence,{recursive:true});await panel.screenshot({path:join(evidence,"history.jpg"),type:"jpeg",quality:65});}
      const other=await history.report(await context(),feedback(active));
      await pool.query("CREATE TRIGGER injected_failure BEFORE UPDATE ON yingjie_image.asset FOR EACH ROW EXECUTE FUNCTION yingjie_history.immutable()");
      await assert.rejects(history.decide(await context(),uiId,"invalidated","local-fixture-review"),/append-only-history/);
      assert.equal((await pool.query("SELECT 1 FROM yingjie_history.decision WHERE report=$1",[uiId])).rowCount,0);
      await pool.query("DROP TRIGGER injected_failure ON yingjie_image.asset");
      const results=await Promise.all([child(5,uiId),child(5,other.id)]);
      assert.deepEqual(results.sort(),["invalidated","stale-review"]);
      // Read the committed decision independently of child completion order.
      const row=(await pool.query("SELECT report FROM yingjie_history.decision WHERE report=ANY($1::uuid[])",[[uiId,other.id]])).rows;
      assert.equal(row.length,1);assert.equal(await history.decide(await context(),row[0].report,"invalidated","local-fixture-review"),"invalidated");
      assert.equal((await submit({...posted,command:randomUUID()})).status(),409);
      assert.equal(await get(current),404);assert.equal(await get(original(active)),404);
      assert.equal(await get(original({...active,id:active.id.toUpperCase()})),404);assert.equal(await get(original(good)),200);
      const corrected=(await detail(5)).media[0];
      assert.deepEqual(corrected.changes.map(c=>c.status),["pending","accepted","rejected"]);
      const ctx5=await context(),reference={assetId:active.id,sha256:active.sha256,visualVersion:ctx5.result.visual.visualVersion,reviewId:active.reviewId};
      assert.equal((await tasks.reference(pool,ctx5,{action:"edit",reference,target:ctx5.result.visual})).reason,"invalidated");
      await panel.getByText(/经审阅撤下/).first().waitFor();
      await panel.getByRole("button",{name:"本会话图片历史"}).click();
      assert.equal(await taskCount(),tasksBeforeFeedback);assert.equal(sends,sendsBeforeFeedback);
      await turn("紫衣客离开了大堂。","skip");
      mode="unknown";await turn("紫衣客走进大堂。","unknown");
      await turn(story[1],"unknown");const before=sends;
      await page.reload();await page.locator('.yj-figure[data-state="unknown"]').waitFor();
      const restart=JSON.parse(await child(7));
      assert.deepEqual(restart,{outcomes:["unknown"],media:0,replacement:"contract-adapter-required",sends:0});
      await turn("紫衣客离开了大堂。","skip");await turn(story[1],"skip");
      const unknown=(await detail(7)).attempts[0],pending=(await pool.query("SELECT record FROM yingjie_image.attempt WHERE id=$1",[unknown.id])).rows[0];
      assert.equal(await tasks.receive(unknown.id,pending.record.requestKey,{state:"returned",bytes:await readFile(new URL("../../../docs/reports/evidence/YJ-02/I1.png",import.meta.url))}),"returned");
      const late=(await detail(7)).media[0];assert.equal(late.status,"review-pending");assert.equal(await get(original(late)),404);
      assert.equal((await detail(10)).media.length,0);assert.equal(sends,before);
      await pool.query("INSERT INTO yingjie_play.choice(scope,revision,permit,serial,record) VALUES($1,10,$2,0,$3)",[demo.scope,task.permit,{action:"skip"}]);
      assert.ok((await detail(10)).choices.some(c=>c.trigger===null&&c.reason===null));
      mode="waiting";await turn("紫衣客走进大堂。","waiting");
      assert.equal((await detail(11)).attempts[0].outcome,"waiting");refuse();
      await page.locator('.yj-figure[data-revision="11"][data-state="refused"]').waitFor();
      assert.equal((await detail(11)).attempts[0].outcome,"refused");
      const p1=await (await client.request.get(path+"/history")).json(),p2=await (await client.request.get(path+"/history?before="+p1.next)).json();
      assert.deepEqual([...p1.items,...p2.items].map(i=>i.revision),[11,10,9,8,7,6,5,4,3,2,1]);assert.equal(p2.next,null);
      await panel.getByRole("button",{name:"本会话图片历史"}).click();
      await panel.getByRole("button",{name:"更早回合"}).click();
      await panel.getByRole("button",{name:/第 1 轮/}).click();await panel.getByText(/预设原件/).waitFor();
      const outsider=await browser.newContext();await login(outsider.request);
      assert.equal((await outsider.request.get(original(good))).status(),403);
      assert.equal(await get(original(good).replace(demo.id,second)),404);
      const saved=join(tasks.files.root,good.sha256+".png"),bytes=await readFile(saved);
      try{await writeFile(saved,Buffer.from("corrupt disposable file"));assert.equal(await get(original(good)),404);}
      finally{await writeFile(saved,bytes);}
      const maintained=await history.report(await context(),feedback(good));
      assert.equal(await history.decide(await context(),maintained.id,"dismissed","local-fixture-match"),"dismissed");
      assert.equal(await get(original(good)),200);
      assert.equal((await detail(2)).media[0].reports[0].status,"dismissed");
      const pr=await history.report(await context(),feedback(preset));
      await history.decide(await context(),pr.id,"invalidated","local-fixture-review");
      assert.equal((await detail(1)).media[0].status,"invalidated");
      assert.equal(await get(original(preset)),404);assert.equal(await get(presetCurrent),404);
      await pool.query("DELETE FROM yingjie_world.binding WHERE scope=$1",[demo.scope]);assert.equal(await get(original(good)),404);
      assert.equal((await submit(feedback(good))).status(),404);
      let release,intercepted;
      const gate=new Promise(r=>{release=r;}),seen=new Promise(r=>{intercepted=r;});
      await page.route(path+"/history*",async route=>{
        const old=await route.fetch();intercepted();await gate;
        await route.fulfill({response:old}).catch(()=>{}); // Navigation may already have cancelled the old read.
      });
      await panel.getByRole("button",{name:"较新回合"}).click();await seen;
      try{await page.goto(origin+"/cards/session/"+second);}finally{release();}
      await page.getByRole("button",{name:"进入映界"}).click();
      await panel.getByRole("button",{name:"本会话图片历史"}).click();
      await panel.getByText("暂无可读取的历史回合。").waitFor();
      assert.equal(await panel.getByRole("button",{name:/第 .* 轮/}).count(),0);
      assert.equal(await page.getByAltText("历史原图").count(),0);
      await demo.api("DELETE","/sessions/"+demo.id);assert.equal(await get(path+"/history"),403);assert.equal(await get(original(good)),403);
      const receipt={browser:browser.version(),viewport:[390,844],turns:revision,pages:[8,3],refusal:["waiting","refused"],delayedSessionRead:"discarded",attempts:two.attempts.map(a=>a.outcome),
        mockSends:sends,sameDigestDistinctAssets:3,unknownRestart:restart,lateOriginalStatus:late.status,tasksAddedByFeedback:0,feedbackSends:0,dismissedKeepsOriginal:200,duplicateCommands:repeats.length,concurrentDecisions:results,
        audit:corrected.changes.map(c=>c.status),withdrawnCurrent:404,withdrawnHistorical:404,withdrawnReference:"invalidated",
        digestFailure:404,revoked:404,deleted:403,otherAccount:403,otherSession:404,realProviderCalls:0};
      if(evidence)await writeFile(join(evidence,"run.json"),JSON.stringify(receipt,null,2)+"\n");
      t.diagnostic(JSON.stringify(receipt));
    }finally{await browser.close();}
  },{assets:[catalog[0]]},{model:()=>body,provider,extractor:extractContinuity}));
});
