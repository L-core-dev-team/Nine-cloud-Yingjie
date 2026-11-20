import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile,mkdir,mkdtemp,readFile,rm,writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath,pathToFileURL } from "node:url";
import { requireApi,withDatabase } from "../../scene-state/test/local-db.mjs";
import { cardScope,latest } from "../../scene-state/store.mjs";
import { withHost } from "../../ui-shell/test/host.mjs";
import { createPlayers } from "../../ui-shell/test/player.mjs";
import { sha256 } from "../../image-tasks/files.mjs";
import { catalog } from "../index.mjs";
import { readSources } from "../sources.mjs";
import { prepareTavern,book } from "./tavern.mjs";

test("saved ordinary session, pinned global version, scoped grants and reviewed presets through Chrome",async t=>{
 const dir=await mkdtemp(join(tmpdir(),"yj07-live-"));
 try {
  for (const a of catalog) await copyFile(new URL("../../../docs/reports/evidence/"+a.file,import.meta.url),join(dir,a.id+".png"));
  await withDatabase((pool,database)=>withHost(pool,async({origin,codes,tasks,world})=>{
  const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
  try {
    const client=await browser.newContext();
    const {cardId,login,first}=await createPlayers(client,origin,codes);
    const demo=await prepareTavern(client,origin,pool,cardId);
    const {id,owner,scope,api}=demo;
    const ctx=async()=>({authorized:true,scope,...await latest(pool,scope)});
    const unrelated=await demo.importBook(book("无关世界书"));
    // Even an explicit grant cannot bring an unrelated import into the session.
    await demo.grant(unrelated.id,book("无关世界书"));
    const changed=await api("POST","/imports/"+demo.snap.id+"/worldbook-versions",{changes:{name:"全局新版"}});
    await api("POST","/worldbooks/global/replace",{oldId:demo.snap.id,newId:changed.id});
    const nextId=randomUUID();await api("POST","/sessions",{id:nextId,cardId:demo.card.id});
    const page=await client.newPage();page.setDefaultTimeout(10000);
    await page.goto(origin+"/cards/session/"+id);
    await page.getByRole("button",{name:"进入映界"}).click();
    await page.getByLabel("画面来源").selectOption("preset");
    const frame=page.locator(".yj-figure");
    const state=s=>page.locator('.yj-figure[data-state="'+s+'"]').waitFor();
    await state("not-ready");
    let revision=0;
    const action=async name=>{
      await page.getByRole("textbox",{name:"角色卡行动"}).fill(name);
      await page.getByRole("button",{name:"提交行动"}).click();
      await page.getByText("独立会话 · 修订 "+(++revision),{exact:true}).waitFor();
    };
    const assertImage=async index=>{
      await state("display");await page.getByText("已审阅预设 · YJ-02 酒馆样例",{exact:true}).waitFor();
      await page.waitForFunction(()=>document.querySelector(".yj-figure img")?.naturalWidth>0);
      assert.equal(await frame.getAttribute("data-version"),"V"+(index+1));
      const url=await frame.locator("img").getAttribute("src");
      const r=await client.request.get(origin+url);assert.equal(r.status(),200);
      assert.equal(sha256(await r.body()),catalog[index].sha256);return url;
    };
    await action("走进酒馆");const initial=await assertImage(0);
    let match=await world.resolve(await ctx());
    assert.deepEqual(match.place.sources.map(s=>s.kind).sort(),["embedded","linked","snapshot"]);
    assert.ok(match.place.sources.some(s=>s.import===demo.snap.id));
    assert.ok(match.place.sources.every(s=>s.import!==changed.id && s.import!==unrelated.id));
    const saved=await ctx();assert.deepEqual(saved.result.visual.people.slice().sort(),["掌柜","蓝衣客","赭衣客"].sort());
    await action("与掌柜交谈");assert.equal(await assertImage(0),initial);
    await action("迎接两位旅人");const five=await assertImage(1);assert.equal((await client.request.get(origin+initial)).status(),404);
    await action("离开酒馆");await state("not-ready");
    await action("重返酒馆");assert.equal(await assertImage(1),five);
    await action("等到傍晚");const evening=await assertImage(2);
    await page.reload();assert.equal(await assertImage(2),evening);
    const bounds=await page.evaluate(()=>({
      caption:document.querySelector(".yj-figure figcaption").getBoundingClientRect().bottom,
      footer:document.querySelector("footer").getBoundingClientRect().top
    }));
    assert.ok(bounds.caption<=bounds.footer,"preset provenance must stay above footer");
    if(process.env.YJ07_EVIDENCE_DIR){
      await mkdir(process.env.YJ07_EVIDENCE_DIR,{recursive:true});
      await page.locator(".story-reading").evaluate(el=>el.scrollTop=el.scrollHeight);
      await page.screenshot({type:"jpeg",quality:68,path:join(process.env.YJ07_EVIDENCE_DIR,"preset.jpg")});
    }
    const file=join(dir,"I2.png"),intact=await readFile(file),damaged=Buffer.from(intact);
    damaged[100]^=1;await writeFile(file,damaged);
    assert.equal((await client.request.get(origin+evening)).status(),404);
    await page.getByText("预设原件校验失败。",{exact:true}).waitFor();
    await writeFile(file,intact);assert.equal(await assertImage(2),evening);
    const toggle=page.getByRole("switch",{name:"生成图片"});
    await toggle.click();await state("disabled");assert.equal(await frame.locator("img").count(),0);
    assert.equal((await client.request.get(origin+evening)).status(),404);
    await action("继续饮茶");await toggle.click();
    const restored=await assertImage(2);
    const child=JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL("restart.mjs",import.meta.url)),database,scope],{encoding:"utf8",windowsHide:true}));
    match=await world.resolve(await ctx());assert.deepEqual(child,{status:"matched",handle:match.handle,sha256:catalog[2].sha256});
    const foreign=await browser.newContext();await login(foreign.request);
    assert.equal((await foreign.request.get(origin+restored,{headers:{"x-jiuxiao-account":owner}})).status(),403);await foreign.close();

    async function openOther(session) {
      await api("POST","/sessions/"+session+"/actions",{action:"走进酒馆",expectedRevision:0,idempotencyKey:randomUUID()});
      const endpoint=origin+"/api/yingjie/"+session+"?view="+randomUUID()+"&seq=0&source=preset";
      const response=await client.request.post(endpoint,{data:{enabled:true},headers:{Origin:origin}});
      assert.equal(response.status(),200);return {frame:await response.json(),endpoint};
    }
    assert.equal((await openOther(first)).frame.reason,"no-worldbook");
    const other=await openOther(nextId);assert.equal(other.frame.reason,"no-grant");
    const nextScope=cardScope(owner,nextId);
    const next={authorized:true,scope:nextScope,...await latest(pool,nextScope)};
    const refs=await readSources(world.cards,pool,next);
    assert.ok(refs.sources.find(s=>s.kind==="snapshot" && s.id===changed.id));
    assert.ok(refs.sources.every(s=>s.book===null && s.id!==demo.snap.id));
    await demo.grant(demo.link.id,demo.linked,nextScope);
    const allowed=await (await client.request.get(other.endpoint)).json();assert.equal(allowed.state,"display");
    assert.notEqual(allowed.assetId,initial.split("/preset/")[1].split("?")[0]);
    const swapped=new URL(origin+initial);swapped.pathname=swapped.pathname.replace(id,nextId);swapped.search=new URL(other.endpoint).search;
    assert.equal((await client.request.get(swapped.href)).status(),404);
    const changedCard=await api("POST","/cards/"+demo.card.id+"/versions",{changes:{character_book:book("新版卡内图志")},links:[]});
    assert.notEqual(changedCard.id,demo.card.id);
    assert.ok((await world.resolve(await ctx())).place.sources.every(s=>s.card===demo.card.id));
    await pool.query("UPDATE yingjie_world.binding SET import_sha='obsolete' WHERE scope=$1",[scope]);
    const stale=await readSources(world.cards,pool,await ctx());
    assert.ok(stale.sources.every(s=>s.book===null));
    assert.equal((await world.resolve(await ctx())).reason,"book-version");
    await pool.query("DELETE FROM yingjie_world.binding WHERE scope=$1",[scope]);
    assert.equal((await client.request.get(origin+restored)).status(),404);
    await state("no-match");assert.equal(await frame.locator("img").count(),0);
    await action("继续饮茶");await state("no-match");assert.equal(await frame.getAttribute("data-reason"),"no-grant");
    await api("DELETE","/sessions/"+id);assert.equal((await client.request.get(origin+restored)).status(),403);
    assert.equal(tasks.provider.calls,0);assert.equal((await pool.query("SELECT count(*)::int n FROM yingjie_image.task")).rows[0].n,0);
    t.diagnostic(JSON.stringify({sources:["embedded","linked","snapshot"],oldGlobalPinned:true,newSessionNewGlobal:true,
      images:["I0","I0","I1","not-ready","I1","I2"],childReload:true,revokedDownload:404,deletedSession:403,
      wrongAccount:403,matchedSends:0,chrome:browser.version()}));
  } finally {await browser.close();}
 },{directory:pathToFileURL(dir+"/")}));
 } finally {await rm(dir,{recursive:true,force:true});}
});
