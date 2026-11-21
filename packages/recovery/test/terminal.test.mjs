import {test} from "node:test";
import {promisify} from "node:util";
import {execFile} from "node:child_process";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join} from "node:path";
import {latest} from "../../scene-state/store.mjs";
import {restoreDrill} from "./restore-drill.mjs";
import {withDatabase,requireApi} from "../../scene-state/test/local-db.mjs";
import {withHost} from "../../ui-shell/test/host.mjs";
import {createPlayers} from "../../ui-shell/test/player.mjs";
import {prepareTavern} from "../../world-assets/test/tavern.mjs";
import {TavernProvider} from "../../image-tasks/demo.mjs";
import {extractContinuity} from "../../first-play/continuity.mjs";
import {walkthrough} from "../../first-play/story.mjs";

test("a competing pg_ctl verification wrapper cannot stop the active cluster",{skip:!process.env.CARD_DEMO_POSTGRES_BIN},async()=>{
  const verifier=fileURLToPath(new URL("../../scene-state/test/verify-local.mjs",import.meta.url));
  await assert.rejects(promisify(execFile)(process.execPath,[verifier,"unreachable-test-file"],{windowsHide:true}),
    error=>error.code!==0 && error.stderr.includes("validation-owner-active"));
});

test("lost feedback acknowledgement after media withdrawal, browser recovery and isolation",{timeout:90000},async()=>{
  const provider=new TavernProvider(),normal=provider.send.bind(provider);
  let narrative=walkthrough[0],mode="normal",sends=0,finishUnknown;
  const held=new Promise(resolve=>{finishUnknown=resolve;});
  provider.send=async claim=>{
    sends++;
    if(mode==="wrong")return {state:"returned",bytes:await readFile(new URL("../../../docs/reports/evidence/YJ-02/I0.png",import.meta.url))};
    if(mode==="unknown"){await held;throw Error("unconfirmed");}
    return normal(claim);
  };
  await withDatabase((pool,database)=>withHost(pool,async({origin,codes,tasks,world,history})=>{
    const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,ignoreDefaultArgs:["--disable-back-forward-cache"]});
    try{
      const client=await browser.newContext({viewport:{width:1280,height:800},hasTouch:true});
      const {cardId,second,login}=await createPlayers(client,origin,codes),demo=await prepareTavern(client,origin,pool,cardId);
      const page=await client.newPage(),path=origin+"/api/yingjie/"+demo.id;
      page.setDefaultTimeout(10000);
      await page.goto(origin+"/cards/session/"+demo.id);
      await page.getByRole("button",{name:"进入映界"}).click();
      const input=page.getByRole("textbox",{name:"角色卡行动"});
      async function turn(n,state){
        await input.fill("继续观察");await page.getByRole("button",{name:"提交行动"}).click();
        await page.locator('.yj-figure[data-revision="'+n+'"][data-state="'+state+'"]').waitFor();
      }
      await turn(1,"display");
      const button=n=>page.getByRole("button",{name:n,exact:true});
      const panel=page.locator(".yj-history");
      async function openForm(){
        await panel.getByRole("button",{name:/第 1 轮/}).click();
        await button("反馈图片问题").click();
        await panel.getByLabel("补充说明").fill("local-only fixture note");
      }
      await button("本会话图片历史").click();await openForm();
      const counts=async()=>Object.fromEntries(await Promise.all(["yingjie_history.report","yingjie_image.task","yingjie_image.attempt"].map(async t=>[t,Number((await pool.query("SELECT count(*) FROM "+t)).rows[0].count)])));
      const initial=await counts(),key="yj-feedback:"+demo.owner+":/api/yingjie/"+demo.id;
      let firstCommand,posted,reportId;
      await page.route(path+"/feedback",async route=>{firstCommand=route.request().postDataJSON().command;await route.abort("internetdisconnected");});
      await button("提交图片反馈").click();await panel.getByText(/反馈未确认/).waitFor();
      assert.deepEqual(await counts(),initial);
      const stored=await page.evaluate(key=>sessionStorage.getItem(key),key);
      assert.deepEqual(Object.keys(JSON.parse(stored)[0]).sort(),["command","fingerprint"]);
      assert.ok(!stored.includes("fixture note"));
      await client.setOffline(true);
      await page.waitForFunction(()=>!document.querySelector(".yj-figure img"));
      await client.setOffline(false);await page.reload();
      await button("本会话图片历史").click();await panel.getByText(/尚未查到回执/).waitFor();
      await page.unroute(path+"/feedback");await openForm();
      await page.route(path+"/feedback",async route=>{
        posted=route.request().postDataJSON();
        const response=await route.fetch();assert.equal(response.status(),200);reportId=(await response.json()).id;
        await route.abort("connectionfailed");
      });
      await button("提交图片反馈").click();await panel.getByText(/反馈未确认/).waitFor();
      assert.equal(posted.command,firstCommand);
      const currentUrl=await page.locator(".yj-figure img").getAttribute("src");
      const original=path+"/history/1/asset/"+posted.id;
      await pool.query("DELETE FROM yingjie_world.binding WHERE scope=$1",[demo.scope]);
      const submit=data=>client.request.post(path+"/feedback",{headers:{Origin:origin},data});
      const replay=await submit(posted);
      assert.equal(replay.status(),200,"committed receipt remains available after media withdrawal");
      assert.deepEqual(await replay.json(),{id:reportId});await page.unroute(path+"/feedback");
      const digest=createHash("sha256").update(JSON.stringify([posted.command,posted.kind,posted.id,posted.revision,posted.generation,posted.category,posted.note])).digest("hex");
      const headers={"x-yj-fingerprint":digest},receipt=path+"/feedback/"+posted.command;
      assert.equal((await submit({...posted,note:"changed"})).status(),409);
      assert.equal((await submit({...posted,command:randomUUID()})).status(),404);
      assert.equal((await client.request.get(origin+currentUrl)).status(),404);
      assert.equal((await client.request.get(original)).status(),404);
      await page.reload();await button("本会话图片历史").click();
      await panel.getByText("已核对原反馈，提交记录已保存。").waitFor();
      assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),key),null);
      assert.deepEqual(await (await client.request.get(receipt,{headers})).json(),{status:"committed",id:reportId});
      assert.deepEqual(await (await client.request.get(receipt.replace(demo.id,second),{headers})).json(),{status:"unconfirmed"});
      assert.equal((await client.request.get(receipt,{headers:{"x-yj-fingerprint":"1".repeat(64)}})).status(),409);
      const peer=await client.newPage();await peer.goto(origin+"/cards/session/"+demo.id);
      const duplicate=await peer.evaluate(async({path,posted})=>{
        const r=await fetch(path+"/feedback",{method:"POST",headers:{"content-type":"application/json"},
          body:JSON.stringify({...posted,command:posted.command.toUpperCase(),id:posted.id.toUpperCase()})});return r.json();
      },{path,posted});
      assert.equal(duplicate.id,reportId);await peer.close();
      await button("本会话图片历史").click();await button("本会话图片历史").click();
      const after=await counts();assert.deepEqual(after,{...initial,"yingjie_history.report":1});assert.equal(sends,1);
      await demo.grant(demo.link.id,demo.linked);
      const mobile={width:390,height:844};await page.setViewportSize(mobile);
      await panel.getByRole("button",{name:/第 1 轮/}).tap();
      await button("查看历史原图").tap();await page.waitForFunction(()=>document.querySelector(".yj-history img")?.naturalWidth>0);
      const evidence=process.env.YJ12_EVIDENCE_DIR;
      const sample=async(label)=>{
        const shape=await page.evaluate(()=>{
          const field=document.querySelector(".yj-figure img"),list=document.querySelector(".yj-history-body");
          list.scrollTop=list.scrollHeight;
          return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
            imageFit:field?getComputedStyle(field).objectFit:null,scrolled:list.scrollTop>0};
        });
        assert.equal(shape.overflow,false);assert.equal(shape.imageFit,"contain");
        if(evidence){await mkdir(evidence,{recursive:true});await panel.screenshot({path:join(evidence,label+".jpg"),type:"jpeg",quality:65});}
        return shape;
      };
      await page.locator('.yj-figure[data-state="display"] img').waitFor();
      const portrait=await sample("portrait");assert.ok(portrait.scrolled);
      await page.setViewportSize({width:844,height:390});const landscape=await sample("landscape");
      const devtools=await client.newCDPSession(page);
      await devtools.send("Emulation.setPageScaleFactor",{pageScaleFactor:1.25});
      const zoom=await page.evaluate(()=>visualViewport.scale);assert.ok(zoom>=1.2);
      await devtools.send("Emulation.setPageScaleFactor",{pageScaleFactor:1});
      await page.setViewportSize({width:1280,height:800});const desktop=await sample("desktop");
      await input.fill("继续观察".repeat(35));await input.focus();assert.ok(await input.evaluate(e=>e===document.activeElement));
      const tab=await client.newPage();await tab.addInitScript(()=>window.addEventListener("storage",e=>{
        if(window.missSetting && e.key?.startsWith("yj-demo-view:")){e.stopImmediatePropagation();window.missSetting=false;}
      },true));await tab.goto(page.url());await tab.getByRole("button",{name:"进入映界"}).click();
      await tab.locator('.yj-figure[data-state="display"]').waitFor();
      await tab.evaluate(()=>{window.missSetting=true;});
      const toggle=page.getByRole("switch",{name:"生成图片"});
      const disableAck=page.waitForResponse(r=>r.url().startsWith(path+"?") && r.request().method()==="POST" && r.request().postDataJSON()?.enabled===false);
      await toggle.click();assert.equal((await disableAck).status(),200);
      // This tab missed the storage event. Its stale click may only adopt the newer setting.
      await tab.getByRole("switch",{name:"生成图片",checked:true}).click();await tab.locator('.yj-figure[data-state="disabled"]').waitFor();
      assert.equal((await client.request.post(origin+currentUrl.split("/original/")[0]+new URL(origin+currentUrl).search,{headers:{Origin:origin},data:{enabled:true}})).status(),409);
      await tab.getByRole("switch",{name:"生成图片"}).click();await page.locator('.yj-figure[data-state="display"]').waitFor();
      assert.equal(sends,1);await tab.close();
      // Suspend the document, revoke access while hidden and revalidate on return.
      await page.evaluate(()=>{window.observedLifecycle=[];for(const name of ["freeze","resume","pageshow"])
        window.addEventListener(name,e=>window.observedLifecycle.push(name==="pageshow"?(e.persisted?"cached-return":"reload"):name),true);});
      await page.waitForLoadState("networkidle");
      await page.goto(origin+"/cards/session/"+second);
      await pool.query("DELETE FROM yingjie_world.binding WHERE scope=$1",[demo.scope]);
      await page.goBack({waitUntil:"commit"});
      await page.waitForURL(origin+"/cards/session/"+demo.id,{waitUntil:"commit"});
      await page.locator('.yj-figure[data-revision="1"][data-state="skip"]').waitFor();
      const lifecycle=await page.evaluate(()=>window.observedLifecycle??["history-navigation-reloaded"]);
      if(!lifecycle.includes("history-navigation-reloaded"))assert.ok(lifecycle.includes("freeze") && lifecycle.includes("resume") && lifecycle.includes("cached-return"),JSON.stringify(lifecycle));
      assert.equal(await page.locator(".yj-history img,.yj-figure img").count(),0);
      await demo.grant(demo.link.id,demo.linked);
      mode="wrong";narrative=walkthrough[2];await turn(2,"review-rejected");
      const ctx=async()=>({scope:demo.scope,authorized:true,...await latest(pool,demo.scope)});
      const wrong=(await history.detail(await ctx(),2)).media[0];
      const report=await history.report(await ctx(),{...posted,revision:2,id:wrong.id,generation:wrong.generation,command:randomUUID()});
      await history.decide(await ctx(),report.id,"invalidated","synthetic mismatch");
      mode="unknown";narrative=walkthrough[6];await turn(3,"waiting");
      const worker=async()=>JSON.parse((await promisify(execFile)(process.execPath,
        [fileURLToPath(new URL("./reconcile-worker.mjs",import.meta.url)),database,demo.scope,tasks.files.root],{windowsHide:true})).stdout);
      const waiting=await worker();
      assert.deepEqual(waiting,{attempts:1,state:"waiting",retry:"already-claimed",sent:true,cost:null,remote:null,sends:0});
      // Advance only the held mock attempt's deadline in this disposable database.
      const heldTask=await tasks.taskFor(await ctx());await pool.query("UPDATE yingjie_image.attempt SET deadline=now() WHERE task=$1",[heldTask.id]);
      const unknown=await worker();assert.deepEqual(unknown,{...waiting,state:"unknown"});finishUnknown();
      await page.locator('.yj-figure[data-state="unknown"]').waitFor();
      await page.reload();await page.locator('.yj-figure[data-state="unknown"]').waitFor();assert.equal(sends,3);
      await page.goto(origin+"/cards/session/"+second);await page.goBack({waitUntil:"commit"});
      await page.locator('.yj-figure[data-state="unknown"]').waitFor();assert.equal(sends,3);
      await button("本会话图片历史").click();
      let intercepted,release;const seen=new Promise(r=>{intercepted=r;}),gate=new Promise(r=>{release=r;});
      await page.route(path+"/history/1",async route=>{const response=await route.fetch();intercepted();await gate;await route.fulfill({response}).catch(()=>{});});
      await panel.getByRole("button",{name:/第 1 轮/}).click();await seen;
      await login(client.request);
      await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true})));
      release();await page.locator('.yj-figure[data-state="unavailable"]').waitFor();
      assert.equal(await page.locator(".yj-history img,.yj-figure img,.yj-history article").count(),0);
      assert.equal((await client.request.get(receipt,{headers})).status(),403);
      await client.clearCookies();assert.equal((await client.request.get(original)).status(),403);
      await client.close();
      const restored=await restoreDrill({pool,database,tasks,world,scope:demo.scope,originalId:posted.id,wrongId:wrong.id,unknownRevision:3});
      if(evidence)await writeFile(join(evidence,"run.json"),JSON.stringify({browser:browser.version(),node:process.version,portrait,landscape,desktop,zoom,lifecycle,waiting,unknown,
        beforeCommit:"unconfirmed",afterCommit:"same-command-confirmed",withdrawnDownload:404,wrongAccount:403,parameterConflict:409,
        receiptRows:1,feedbackSends:0,mockSends:sends,physicalMobile:"NOT_RUN",realProvider:"NOT_RUN",restored},null,2)+"\n");
    }finally{await browser.close();}
  },{assets:[]},{model:()=>narrative,provider,extractor:extractContinuity}));
});
