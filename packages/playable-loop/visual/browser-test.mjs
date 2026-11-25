// Drive the two dedicated local visual saves. Readback never submits an action.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import {hash} from "../data.mjs";
import {catalog} from "./pictures.mjs";

const phase=process.argv[2];
assert.ok(["first","resume","continue-r6","readback","reader"].includes(phase));
const name=phase==="reader"?"visual-reader":"visual-demo";
const directory=join(process.env.LOCALAPPDATA,"NineCloud-P05",name);
const cfg=JSON.parse(readFileSync(join(directory,"private.json")));
const output=new URL("../../../docs/reports/evidence/YJ-P05-VISUAL-LOOP-01/",import.meta.url);
const save=(name,data)=>writeFileSync(new URL(name,output),JSON.stringify(data,null,2)+"\n");
const {chromium}=createRequire(resolve(cfg.upstream,"package.json"))("playwright");
const exe=process.env.CHROME_PATH||["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser=await chromium.launch({executablePath:exe,headless:true,chromiumSandbox:true});
try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.route("**/*",r=>{
    const u=new URL(r.request().url());
    return u.protocol==="file:" || u.origin==="http://127.0.0.1:"+cfg.httpPort?r.continue():r.abort();
  });
  const page=await context.newPage();
  const game=()=>page.evaluate(async()=>await (await fetch("/game")).json());
  const ready=()=>page.waitForFunction(()=>document.querySelector("#where")?.textContent.startsWith("当前"));
  await page.goto(pathToFileURL(join(directory,"open.html")).href);await ready();
  const status=url=>page.evaluate(async url=>(await fetch(url)).status,url);
  const results=[],images=[null,"I01",null,"I02","I02","I03",null,null,"I03"];
  const snapshot=g=>({scope:g.scope,history:g.history,current:g.current,visual:g.visual,slots:g.slots});
  if(phase==="reader"){
    const g=await game(),formal=JSON.parse(readFileSync(new URL("readback.json",output)));
    assert.equal(g.current.revision,0);assert.notEqual(g.scope,formal.scope);assert.deepEqual(g.visual.frames,{});
    const foreignStatus=await status("/pictures/history/5/"+formal.frameKey);
    assert.equal(foreignStatus,404);assert.ok(await page.locator('[data-action="scan"]').isVisible());
    await page.locator("#toggle").click();await page.waitForFunction(()=>document.querySelector("#toggle").textContent==="开启配图");
    const off=await game();assert.equal(off.visual.enabled,false);
    assert.ok(await page.locator('[data-action="scan"]').isEnabled());
    await page.reload();await ready();assert.equal(await page.locator("#toggle").getAttribute("aria-pressed"),"false");
    await page.locator("#toggle").click();await page.waitForFunction(()=>document.querySelector("#toggle").textContent==="关闭配图");
    save("reader.json",{scope:g.scope,revision:0,available:g.current.actions.map(a=>a.id),foreignStatus,disabledActionsAvailable:true,disabledSurvivesReload:true,restoredEnabled:true,browser:browser.version()});
  }else if(phase==="readback"){
    await page.reload();await ready();
    const g=await game();assert.equal(g.current.revision,8);
    for(const revision of [1,3,4,5,6,7,8]){
      await page.locator('[data-rev="'+revision+'"]').click();
      const h=g.history[revision-1];
      assert.equal(await page.locator("#text").textContent(),h.text);
      if(images[revision]){
        await page.locator("#sheet img").waitFor();
        assert.match(await page.locator("#caption").textContent(),/历史画面/);
      }else assert.equal(await page.locator("#sheet img").count(),0);
    }
    await page.locator("#current").click();await page.locator("#sheet img").waitFor();
    save("readback.json",{scope:g.scope,revision:8,frameKey:g.visual.frames[5].key,browser:browser.version(),history:[1,3,4,5,6,7,8],returnedToCurrent:true});
  }else{
    let g=await game();
    if(phase==="first")assert.equal(g.current.revision,0);
    else if(phase==="resume") {
      assert.deepEqual(snapshot(g),JSON.parse(readFileSync(new URL("restart-before.json",output))));
      assert.equal(g.visual.enabled,false);assert.equal(g.current.quest.rewardClaimed,true);
      assert.equal(await page.locator('[data-action="quest:claim"]').count(),0);
      save("restart-after.json",snapshot(g));
      await page.locator("#toggle").click();await page.locator("#sheet img").waitFor();
    }
    if(phase==="continue-r6"){
      assert.equal(g.current.revision,6);
      const earlier=JSON.parse(readFileSync(new URL("resume.json",output))).results;
      assert.equal(earlier.at(-1).revision,5);
      assert.equal(earlier.at(-1).h.scope,g.scope);
      assert.equal(earlier.at(-1).h.canonicalReceiptSha,g.history[4].canonicalReceiptSha);
      results.push(...earlier);
      const stale=await status("/pictures/current/5/"+g.visual.frames[5].key);
      assert.equal(stale,409);assert.equal(g.visual.frames[6],null);
      assert.equal(await page.locator("#sheet img").count(),0);
      assert.equal(await page.locator("#text").textContent(),g.history[5].text);
      results.push({revision:6,action:"loc_luhuadu",h:g.history[5],frame:null,lateCurrentStatus:stale,readbackAfterFailedAssertion:true});
    }
    for(let r=phase==="first"?1:phase==="continue-r6"?7:5;r<=(phase==="first"?4:8);r++){
      const action=catalog.route[r-1].id;
      const accepted=page.waitForResponse(x=>x.url().endsWith("/act") && x.request().method()==="POST");
      await page.locator('[data-action="'+action+'"]').click();
      assert.equal((await accepted).status(),200);
      await page.waitForFunction(r=>document.querySelector("#where").textContent.includes("第 "+r+" 回合"),r);
      g=await game();assert.equal(g.current.revision,r);assert.deepEqual(g.slots,[]);
      const h=g.history.at(-1),frame=g.visual.frames[r];
      assert.equal(await page.locator("#text").textContent(),h.text);
      assert.equal(frame?.asset??null,images[r]);
      const row={revision:r,action,h,frame};
      if(frame){
        await page.locator("#sheet img").waitFor();
        const evidence=await page.locator("#sheet img").evaluate(async img=>{
          await img.decode();const bytes=await (await fetch(img.src)).arrayBuffer();
          const hash=await crypto.subtle.digest("SHA-256",bytes);
          return {sha:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join(""),width:img.naturalWidth,height:img.naturalHeight,paintWidth:img.getBoundingClientRect().width};
        });
        assert.equal(evidence.sha,catalog.assets[frame.asset].sha256);assert.ok(evidence.paintWidth>0);
        assert.equal(evidence.width,1536);row.decoded=evidence;
        if(r===4)assert.match(await page.locator("#caption").textContent(),/上次所见/);
      }else assert.equal(await page.locator("#sheet img").count(),0);
      if([1,3,5,6,8].includes(r))await page.screenshot({path:new URL("r"+r+".png",output).pathname.replace(/^\/([A-Z]:)/i,"$1")});
      if(r===1){
        assert.deepEqual(Object.keys(g.visual.frames),["1"]);
        row.futureStatus=await status("/pictures/history/5/"+frame.key);assert.equal(row.futureStatus,404);
      }
      if(r===5){
        const url="/pictures/current/5/"+frame.key;
        await page.route("**"+url,route=>route.request().method()==="GET"?route.fulfill({status:404,body:""}):route.continue());
        await page.reload();await ready();await page.waitForFunction(()=>document.querySelector("#caption").textContent.includes("暂不可读"));
        assert.equal(await page.locator("#text").textContent(),h.text);
        assert.ok(await page.locator('[data-action="loc_luhuadu"]').isEnabled());
        row.injectedImageFailure="browser GET 404; text and next action available";
      }
      if(r===6){
        const oldUrl="/pictures/current/5/"+g.visual.frames[5].key;
        await page.unroute("**"+oldUrl);
        const stale=await status(oldUrl);assert.equal(stale,409);row.lateCurrentStatus=stale;
      }
      results.push(row);
      save(phase+".json",{browser:browser.version(),results});
    }
    if(phase==="first"){
      await page.locator("#toggle").click();await page.waitForFunction(()=>document.querySelector("#toggle").textContent==="开启配图");
      g=await game();assert.equal(g.visual.enabled,false);save("restart-before.json",snapshot(g));
    }
  }
  console.log(phase,"PASS",browser.version());
}finally{await browser.close()}
