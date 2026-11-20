import assert from "node:assert/strict";
import { test } from "node:test";
import { createPlayers } from "./player.mjs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { requireApi,withDatabase } from "../../scene-state/test/local-db.mjs";
import { pictures,script } from "../../image-tasks/demo.mjs";
import { sha256 } from "../../image-tasks/files.mjs";
import { withHost } from "./host.mjs";

test("ordinary CardSession → saved text → scene → PostgreSQL task → reviewed original → browser",async t=>{
 await withDatabase(pool=>withHost(pool,async({origin,codes,tasks})=>{
  const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:["--disable-gpu"]});
  try {
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    const {first,second,login}=await createPlayers(context,origin,codes);
    const page=await context.newPage();page.setDefaultTimeout(10000);
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    const go=async id=>{await page.goto(origin+"/cards/session/"+id);await page.getByRole("button",{name:"进入映界"}).click();};
    const state=s=>page.locator('.yj-figure[data-state="'+s+'"]').waitFor();
    let revision=0;
    const action=async name=>{
      await page.getByRole("textbox",{name:"角色卡行动"}).fill(name);
      await page.getByRole("button",{name:"提交行动"}).click();
      await page.getByText("独立会话 · 修订 "+(++revision),{exact:true}).waitFor();
      await page.getByText(script.find(step=>step[0]===name)[1],{exact:true}).last().waitFor({state:"attached"});
    };
    const original=async(index)=>{
      await state("display");
      await page.waitForFunction(()=>document.querySelector(".yj-figure img")?.naturalWidth>0);
      const url=await page.locator(".yj-figure img").getAttribute("src");
      const r=await context.request.get(origin+url);
      assert.equal(r.status(),200);assert.equal(sha256(await r.body()),pictures[index].sha256);
      return url;
    };
    const capture=async name=>{
      if(process.env.YJ_EVIDENCE_DIR){
        await mkdir(process.env.YJ_EVIDENCE_DIR,{recursive:true});
        await page.screenshot({type:"jpeg",quality:65,path:join(process.env.YJ_EVIDENCE_DIR,name+".jpg")});
      }
    };
    await go(first);await state("not-ready");
    await action("走进酒馆");const initial=await original(0);
    await action("与掌柜交谈");assert.equal(await original(0),initial);assert.equal(tasks.provider.calls,1);
    await action("迎接两位旅人");const five=await original(1);
    assert.equal((await context.request.get(origin+initial)).status(),404);
    await action("离开酒馆");await state("not-ready");
    await action("重返酒馆");assert.equal(await original(1),five);
    await action("等到傍晚");const evening=await original(2);assert.equal(tasks.provider.calls,3);
    await page.locator(".story-reading").evaluate(el=>el.scrollTop=el.scrollHeight);
    await capture("desktop");
    await page.reload();assert.equal(await original(2),evening);assert.equal(tasks.provider.calls,3);
    await page.setViewportSize({width:390,height:844});
    const toggle=page.getByRole("switch",{name:"生成图片"});
    await toggle.focus();await page.keyboard.press("Space");await state("disabled");
    await action("继续饮茶");assert.equal(tasks.provider.calls,3);
    await toggle.click();await original(2);
    await action("演练失败");await state("failed");
    await action("继续饮茶");await original(2);
    await action("演练拒绝");await state("refused");
    await action("演练未知");await state("unknown");
    const unknownCalls=tasks.provider.calls;await page.reload();await state("unknown");assert.equal(tasks.provider.calls,unknownCalls);
    await action("演练待审");await state("review-pending");assert.equal(await page.locator(".yj-figure img").count(),0);
    await action("演练跳过");await state("skip");
    await action("继续饮茶");await original(2);
    const geometry=await page.evaluate(()=>{
      const history=document.querySelector(".story-reading"),box=document.querySelector("#card-action").getBoundingClientRect();
      history.scrollTop=history.scrollHeight;
      return {width:document.documentElement.scrollWidth,viewport:innerWidth,historyScroll:history.scrollTop>0,
        inputWidth:box.width,imageFit:getComputedStyle(document.querySelector(".yj-figure img")).objectFit};
    });
    assert.ok(geometry.width<=geometry.viewport);assert.ok(geometry.inputWidth>100);assert.ok(geometry.historyScroll);assert.equal(geometry.imageFit,"contain");
    await capture("mobile");
    await action("演练迟到");await state("waiting");
    await go(second);revision=0;await state("not-ready");await action("走进酒馆");const other=await original(0);
    assert.notEqual(other,initial);
    const lateId=await pool.query("SELECT id FROM yingjie_image.task WHERE plan->>'reason'='演练迟到'");
    const late=async()=>pool.query("SELECT id FROM yingjie_image.asset WHERE id IN (SELECT id FROM yingjie_image.attempt WHERE task=$1)",[lateId.rows[0].id]);
    for(let i=0;i<60 && !(await late()).rowCount;i++)await new Promise(r=>setTimeout(r,100));
    assert.equal((await late()).rowCount,1);assert.equal(await original(0),other);
    const ownerHint="impostor";
    assert.equal((await context.request.get(origin+other,{headers:{"x-jiuxiao-account":ownerHint}})).status(),403);
    await page.route("**/original/**",route=>route.abort());
    await page.reload();await page.getByText("原图加载失败。").waitFor();
    await action("与掌柜交谈");
    await page.unroute("**/original/**");await page.reload();await original(0);
    const intruder=await browser.newContext();await login(intruder.request);
    assert.equal((await intruder.request.get(origin+other)).status(),403);
    await intruder.close();
    const decisions=(await pool.query("SELECT plan->>'action' AS decision,count(*)::int AS count FROM yingjie_image.task GROUP BY 1 ORDER BY 1")).rows;
    assert.deepEqual(decisions.map(r=>r.decision),["edit","generate","reuse","skip"]);
    const edits=(await pool.query("SELECT plan->'reference'->>'sha256' AS digest FROM yingjie_image.task WHERE plan->>'reason' IN ('迎接两位旅人','等到傍晚')")).rows;
    assert.deepEqual(edits.map(x=>x.digest).sort(),pictures.slice(0,2).map(x=>x.sha256).sort());
    assert.deepEqual(errors,[]);
    t.diagnostic(JSON.stringify({decisions,mockCalls:tasks.provider.calls,geometry,originals:pictures.map(x=>x.sha256),browser:browser.version()}));
  } finally {await browser.close();}
 }));
});
