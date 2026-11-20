import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {pathToFileURL} from "node:url";
import {copyFile,mkdtemp,mkdir,readFile,writeFile,rm} from "node:fs/promises";
import {withDatabase,requireApi} from "../../scene-state/test/local-db.mjs";
import {hash} from "../../scene-state/store.mjs";
import {withHost} from "../../ui-shell/test/host.mjs";
import {createPlayers} from "../../ui-shell/test/player.mjs";
import {prepareTavern} from "../../world-assets/test/tavern.mjs";
import {catalog} from "../../world-assets/index.mjs";
import {TavernProvider} from "../../image-tasks/demo.mjs";
import {sha256} from "../../image-tasks/files.mjs";
import {walkthrough as story} from "../story.mjs";
import {method} from "../extract.mjs";

test("automatic first play from completed text through original CardSession and scoped image bytes",{timeout:90000},async t=>{
 const dir=await mkdtemp(join(tmpdir(),"yj08-play-"));
 const local=new TavernProvider(), sends=[],release=Promise.withResolvers(),lateEntered=Promise.withResolvers();
 let body="",fault="none";
 const provider={capability:local.capability,async send(claim){
   const mode=fault;fault="none";
   sends.push({mode,action:claim.plan.action,version:claim.plan.target.visualVersion,
     ref:claim.plan.reference?.sha256??null,attempt:claim.attempt.attemptId});
   if(mode==="fail")return {state:"failed"};
   if(mode==="unknown")throw Error("unconfirmed-local-transport");
   if(mode==="late"){lateEntered.resolve();await release.promise;}
   return local.send(claim);
 }};
 try {
  const file=join(dir,"I0.png");
  await copyFile(new URL("../../../docs/reports/evidence/YJ-02/I0.png",import.meta.url),file);
  await withDatabase(pool=>withHost(pool,async({origin,codes})=>{
   const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
   try{
    const client=await browser.newContext({viewport:{width:1280,height:800}});
    const {cardId,second}=await createPlayers(client,origin,codes);
    const demo=await prepareTavern(client,origin,pool,cardId);
    const replacement=await demo.api("POST","/imports/"+demo.snap.id+"/worldbook-versions",{changes:{name:"新地志"}});
    await demo.api("POST","/worldbooks/global/replace",{oldId:demo.snap.id,newId:replacement.id});
    const later=randomUUID();await demo.api("POST","/sessions",{id:later,cardId:demo.card.id});
    const page=await client.newPage();page.setDefaultTimeout(12000);
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    const go=async id=>{await page.goto(origin+"/cards/session/"+id);await page.getByRole("button",{name:"进入映界"}).click();};
    const state=async(s,action)=>{
      try{
        await page.locator('.yj-figure[data-state="'+s+'"]'+(action?'[data-decision="'+action+'"]':'')).waitFor();
      }catch(error){
        const scope=JSON.stringify(["card-history",demo.owner,session.toLowerCase()]);
        const journal=(await pool.query(`SELECT e.revision,e.result->>'status' AS scene,
          t.plan->>'action' AS plan,a.record->'outcome'->>'state' AS outcome FROM yingjie_scene.event e
          LEFT JOIN yingjie_image.task t USING(scope,event_key) LEFT JOIN yingjie_image.attempt a ON a.task=t.id
          WHERE e.scope=$1 ORDER BY e.revision DESC LIMIT 3`,[scope])).rows;
        const panel=await page.locator(".yj-figure").evaluateAll(nodes=>nodes.map(el=>({...el.dataset})));
        t.diagnostic(JSON.stringify({expected:s,action,revision,panel,journal,mockAttempts:sends.length}));
        throw error;
      }
    };
    let revision=0,session=demo.id;
    const play=async narrative=>{
      body=narrative;
      await page.getByRole("textbox",{name:"角色卡行动"}).fill("继续观察");
      await page.getByRole("button",{name:"提交行动"}).click();
      await page.getByText("独立会话 · 修订 "+(++revision),{exact:true}).waitFor();
      const history=await demo.api("GET","/sessions/"+session+"/history?after="+(revision-1));
      assert.equal(history[0].action,"继续观察");assert.equal(history[0].narrative,narrative);
    };
    const image=async(i,choice)=>{
      await state("display",choice);
      await page.waitForFunction(()=>document.querySelector(".yj-figure img")?.naturalWidth>0);
      const url=await page.locator(".yj-figure img").getAttribute("src");
      const res=await client.request.get(origin+url);assert.equal(res.status(),200);
      assert.equal(sha256(await res.body()),catalog[i].sha256);return url;
    };
    await go(session);await state("not-ready","skip");
    assert.equal(await page.getByLabel("画面来源").count(),0);
    await play(story[0]);const initial=await image(0,"preset");assert.equal(sends.length,0);
    const trusted=await readFile(file),damaged=Buffer.from(trusted);damaged[100]^=1;await writeFile(file,damaged);
    assert.equal((await client.request.get(origin+initial)).status(),404);await page.reload();await state("skip","skip");
    assert.equal(await page.locator(".yj-figure").getAttribute("data-reason"),"invalid-original");
    await writeFile(file,trusted);assert.equal(await image(0,"preset"),initial);
    await play(story[1]);assert.equal(await image(0,"preset"),initial);
    await play(story[2]);const five=await image(1,"generate");assert.equal(sends.length,1);
    assert.equal((await client.request.get(origin+initial)).status(),404);
    await play(story[3]);assert.equal(await image(1,"reuse"),five);
    await play(story[4]);await state("not-ready","skip");
    await play(story[5]);assert.equal(await image(1,"reuse"),five);
    const toggle=page.getByRole("switch",{name:"生成图片"});
    await toggle.click();await state("disabled");
    await play("你端起茶盏。");await state("disabled");assert.equal(sends.length,1);
    await toggle.click();await image(1,"reuse");
    fault="fail";await play(story[6]);await state("failed","edit");
    await page.reload();await state("failed","edit");assert.equal(sends.length,2);
    await play("掌柜说：“绿衣客离开了大堂。”");const evening=await image(2,"edit");
    assert.equal(sends[2].ref,catalog[1].sha256);
    await page.reload();assert.equal(await image(2,"edit"),evening);assert.equal(sends.length,3);
    if(process.env.YJ08_EVIDENCE_DIR){
      await mkdir(process.env.YJ08_EVIDENCE_DIR,{recursive:true});
      await page.locator(".story-reading").evaluate(el=>el.scrollTop=el.scrollHeight);
      await page.screenshot({type:"jpeg",quality:65,path:join(process.env.YJ08_EVIDENCE_DIR,"first-play.jpg")});
    }
    await pool.query("DELETE FROM yingjie_world.binding WHERE scope=$1",[demo.scope]);
    assert.equal((await client.request.get(origin+evening)).status(),404);
    await state("skip","skip");await play("你与掌柜闲谈茶价。");await state("skip","skip");assert.equal(sends.length,3);
    await demo.grant(demo.link.id,demo.linked);
    await play("紫衣客离开了大堂。");await state("skip","skip");
    assert.equal(await page.locator(".yj-figure").getAttribute("data-reason"),"outside-local-provider");
    fault="late";await play("紫衣客走进大堂。");await state("waiting","edit");
    await lateEntered.promise;
    await play("你端起茶盏。");await state("waiting","skip");
    assert.equal(sends.at(-1).mode,"late");const late=sends.at(-1).attempt;
    session=second;revision=0;await go(session);await state("not-ready","skip");
    await play(story[0]);const other=await image(0,"generate");
    release.resolve();
    for(let i=0;i<100;i++){
      if((await pool.query("SELECT id FROM yingjie_image.asset WHERE id=$1 AND scope=$2",[late,demo.scope])).rowCount)break;
      await page.waitForTimeout(50);
    }
    assert.equal((await pool.query("SELECT id FROM yingjie_image.asset WHERE id=$1 AND scope=$2",[late,demo.scope])).rowCount,1);
    assert.equal(await image(0,"generate"),other);
    fault="unknown";await play(story[2]);await state("unknown","edit");
    const unresolved=sends.length;
    await play(story[1]);await state("unknown","skip");await page.reload();await state("unknown","skip");
    assert.equal(sends.length,unresolved);
    session=later;revision=0;await go(session);await play(story[0]);await state("skip","skip");
    assert.equal(await page.locator(".yj-figure").getAttribute("data-reason"),"no-grant");
    const unsupported="堂里的人纷纷起身告辞。门一合，只剩掌柜独自守店。";
    await play(unsupported);await state("not-ready","skip");
    await play(story[0]);await state("skip","skip");
    assert.equal(await page.locator(".yj-figure").getAttribute("data-version"),"V1");
    const history=await demo.api("GET","/sessions/"+demo.id+"/history?after=0");
    const journal=(await pool.query(`SELECT e.revision,e.raw_text_hash,e.source,e.observations,e.result,x.audit
      FROM yingjie_scene.event e JOIN yingjie_play.extraction x USING(scope,revision)
      WHERE e.scope=$1 ORDER BY e.revision`,[demo.scope])).rows;
    assert.equal(journal.length,history.length);
    journal.forEach((r,i)=>{
      assert.equal(r.raw_text_hash,hash(history[i].narrative));assert.equal(r.source.key,history[i].key);
      assert.equal(r.audit.method,method);assert.ok(r.audit.evidence.length);
    });
    assert.deepEqual(journal.map(r=>r.result.visual?.people.length??null),[3,3,5,5,null,5,5,5,5,5,4,5,5]);
    assert.deepEqual(journal.map(r=>r.result.visual?.visualVersion??null),
      ["V1","V1","V2","V2",null,"V2","V2","V3","V3","V3","V4","V5","V5"]);
    assert.equal(journal[7].result.visual.lighting,"灯笼亮起");
    const choices=(await pool.query("SELECT DISTINCT record->>'action' AS action FROM yingjie_play.choice WHERE scope=$1 ORDER BY action",[demo.scope])).rows;
    assert.deepEqual(choices.map(r=>r.action),["edit","generate","preset","reuse","skip"]);
    if(process.env.YJ08_EVIDENCE_DIR){
      const decisions=(await pool.query("SELECT revision,serial,record FROM yingjie_play.choice WHERE scope=$1 ORDER BY revision,observed_at",[demo.scope])).rows;
      const receipt={input:"local synthetic narrative saved by ordinary CardSession; every action = 继续观察",method,
        browser:browser.version(),realTextModelCalls:0,realImageApiCalls:0,
        mockSends:sends.map(({attempt,...send})=>send),
        primarySession:journal.map((r,i)=>({revision:r.revision,narrative:history[i].narrative,sha256:r.raw_text_hash,
          evidence:r.audit.evidence,rulesOutput:r.observations.map(o=>o.operation.type),
          people:r.result.visual?.people??null,version:r.result.visual?.visualVersion??null,
          choices:decisions.filter(d=>d.revision===r.revision).map(({record})=>({
            action:record.action,reason:record.reason,presetReason:record.presetReason,hold:record.hold,enabled:record.enabled}))})),
        additionalSavedAbstention:unsupported,screenshotSha256:sha256(await readFile(join(process.env.YJ08_EVIDENCE_DIR,"first-play.jpg")))};
      await writeFile(join(process.env.YJ08_EVIDENCE_DIR,"run.json"),JSON.stringify(receipt,null,2)+"\n");
    }
    assert.deepEqual(errors,[]);
    t.diagnostic(JSON.stringify({savedTurns:journal.length,versions:journal.map(r=>r.result.visual?.visualVersion??null),
      choices:choices.map(r=>r.action),sends:sends.map(({attempt,...receipt})=>receipt),browser:browser.version()}));
   } finally {release.resolve();await browser.close();}
  },{assets:catalog.slice(0,1),directory:pathToFileURL(dir+"/")},{model:()=>body,provider,archivedSelection:true}));
 } finally {await rm(dir,{recursive:true,force:true});}
});
