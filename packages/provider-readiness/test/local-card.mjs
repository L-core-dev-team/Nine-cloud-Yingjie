import assert from "node:assert/strict";
import {join} from "node:path";
import {rm,writeFile} from "node:fs/promises";
import {fresh,stop} from "../../local-demo/cluster.mjs";
import {latest} from "../../scene-state/store.mjs";
import {catalog} from "../../world-assets/index.mjs";
import {walkthrough} from "../../first-play/story.mjs";
import {extractContinuity} from "../../first-play/continuity.mjs";
import {sha256} from "../../image-tasks/files.mjs";
import {Reservations} from "../reservations.mjs";
import {offlineAdapters} from "../offline.mjs";
import {sampleGrant} from "./fixture.mjs";

const {dir}=await fresh();
process.env.YJ13_CLUSTER=dir;
const ledger=new Reservations(join(dir,"p01.sqlite"));
try {
  const {withDatabase,requireApi}=await import("../../scene-state/test/local-db.mjs");
  const {withHost}=await import("../../ui-shell/test/host.mjs");
  const {createPlayers}=await import("../../ui-shell/test/player.mjs");
  const {prepareTavern}=await import("../../world-assets/test/tavern.mjs");
  await withDatabase(async pool=>{
    let session,grant,referencePermit;
    const adapters=offlineAdapters({ledger,async resolve(plan){
      const card=await session.api("GET","/sessions/"+session.id);
      const ctx={grant,authorized:card.owner_id===grant.owner && card.id===grant.sessionId};
      if(!plan)return ctx;
      ctx.visual=(await latest(pool,session.scope)).result.visual;
      if(plan.action==="edit"){
        const {rows}=await pool.query(`SELECT a.record,t.record->>'localWait' AS wait
          FROM yingjie_image.asset a JOIN yingjie_image.attempt t ON t.id=a.id WHERE a.scope=$1 AND a.id=$2`,
          [session.scope,plan.reference.assetId]);
        ctx.asset=rows[0]?.record;ctx.referenceActive=rows[0]?.wait==="active";ctx.referencePermit=referencePermit;
      }
      return ctx;
    }});
    await withHost(pool,async({origin,codes})=>{
      const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
      try{
        const client=await browser.newContext({serviceWorkers:"block"});
        await client.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
        const {cardId}=await createPlayers(client,origin,codes);
        session=await prepareTavern(client,origin,pool,cardId);
        grant=sampleGrant(session.owner,session.id);
        const page=await client.newPage();page.setDefaultTimeout(10000);
        await page.goto(origin+"/cards/session/"+session.id);
        await page.getByRole("button",{name:"进入映界"}).click();
        const turns=[];
        for(const [i,[action,state,decision]] of [
          ["进入酒馆","display","generate"],["迎接旅人","display","edit"],["观察雨幕","not-ready",null]].entries()){
          const revision=i+1;
          await page.getByRole("textbox",{name:"角色卡行动"}).fill(action);
          await page.getByRole("button",{name:"提交行动"}).click();
          const figure=page.locator('.yj-figure[data-revision="'+revision+'"][data-state="'+state+'"]');
          await figure.waitFor();
          const history=await session.api("GET","/sessions/"+session.id+"/history?after="+i);
          assert.equal(history.length,1);assert.equal(history[0].resulting_revision,revision);
          assert.equal(history[0].action,action);
          const event=(await pool.query("SELECT raw_text_hash,source,result FROM yingjie_scene.event WHERE scope=$1 AND revision=$2",
            [session.scope,revision])).rows[0];
          assert.equal(event.source.evidence,"completed-history");
          assert.equal(event.raw_text_hash,sha256(Buffer.from(history[0].narrative)));
          if(i<2){
            assert.equal(history[0].narrative,walkthrough[i*2]);
            assert.equal(await figure.getAttribute("data-decision"),decision);
            await page.waitForFunction(()=>document.querySelector(".yj-figure img")?.naturalWidth>0);
            const url=await figure.locator("img").getAttribute("src"),download=await client.request.get(origin+url);
            assert.equal(download.status(),200);assert.equal(sha256(await download.body()),catalog[i].reviewedSha256);
            const asset=(await pool.query("SELECT record FROM yingjie_image.asset WHERE scope=$1 AND record->>'sha256'=$2",
              [session.scope,catalog[i].reviewedSha256])).rows[0].record;
            assert.equal(asset.review.status,"accepted");
            if(i===0)referencePermit={assetId:asset.assetId,sha256:asset.sha256,use:"edit"};
            else assert.equal(asset.reference.assetId,referencePermit.assetId);
          }else{
            assert.equal(event.result.reason,"unsupported-clause");assert.equal(await figure.locator("img").count(),0);
          }
          turns.push({revision,source:event.source.evidence,bodyHash:event.raw_text_hash,state,decision});
        }
        const attempts=(await pool.query("SELECT record FROM yingjie_image.attempt ORDER BY ordinal")).rows.map(r=>r.record);
        assert.equal(attempts.length,2);
        for(const a of attempts){assert.equal(a.outcome.state,"returned");for(const k of ["usage","cost","providerRequestId"])assert.equal(a[k],null);}
        const operations=adapters.observations.map(o=>o.operation);
        assert.deepEqual(operations,["text","generate","text","edit","text"]);
        assert.equal(adapters.observations[3].referenceSha256,catalog[0].reviewedSha256);
        const result={status:"OFFLINE_PASS",browser:browser.version(),node:process.version,turns,operations,
          referenceSha256:referencePermit.sha256,attempts:attempts.length,reservations:ledger.summary(),
          realTextCalls:0,realImageCalls:0,providerRequestId:null,usage:null,cost:null};
        if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+"\n",{flag:"wx"});
        console.log(JSON.stringify(result));
      }finally{await browser.close();}
    },{assets:[]},{model:adapters.model,provider:adapters.provider,extractor:extractContinuity});
  });
}finally{ledger.close();stop(dir);await rm(dir,{recursive:true,force:true});}
