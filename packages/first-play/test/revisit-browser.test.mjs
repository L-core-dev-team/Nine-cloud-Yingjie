import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join} from "node:path";
import {promisify} from "node:util";
import {execFile} from "node:child_process";
import {withDatabase,requireApi} from "../../scene-state/test/local-db.mjs";
import {withHost} from "../../ui-shell/test/host.mjs";
import {createPlayers} from "../../ui-shell/test/player.mjs";
import {prepareTavern} from "../../world-assets/test/tavern.mjs";
import {catalog} from "../../world-assets/index.mjs";
import {TavernProvider} from "../../image-tasks/demo.mjs";
import {sha256} from "../../image-tasks/files.mjs";
import {syncCardHistory} from "../../scene-state/index.mjs";
import {checkpoint,hash} from "../../scene-state/store.mjs";
import {extractSaved} from "../extract.mjs";
import {extractContinuity} from "../continuity.mjs";
import {replayHistory,compareReplay} from "../replay.mjs";
import {route as originalRoute} from "./revisit-story.mjs";
import {extend,ledgerCounts,verifyTurn} from "../../local-demo/journey.mjs";
import {restoreDrill} from "../../recovery/test/restore-drill.mjs";

test("original CardSession across two villages, ambiguity, full survey and isolated replays",{timeout:150000},async t=>{
 const extended=Boolean(process.env.YJ13_DETAIL),route=extended?extend(originalRoute):originalRoute;
 let body="",failUnknown=false;
 const sends=[],local=new TavernProvider();
 const provider={capability:local.capability,async send(claim){
   sends.push({action:claim.plan.action,version:claim.plan.target.visualVersion,reference:claim.plan.reference?.sha256??null,unknown:failUnknown});
   if(failUnknown)throw Error("unknown-local-transport");
   return local.send(claim);
 }};
 await withDatabase(async(pool,database)=>withHost(pool,async({origin,codes,tasks,world})=>{
  const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
  try{
   const client=await browser.newContext();
   const {cardId,second}=await createPlayers(client,origin,codes);
   const demo=await prepareTavern(client,origin,pool,cardId);
   const page=await client.newPage();page.setDefaultTimeout(10000);
   await page.goto(origin+"/cards/session/"+demo.id);
   await page.getByRole("button",{name:"进入映界"}).click();
   await page.locator('.yj-figure[data-state="not-ready"]').waitFor();
   // Delay one projected revision at the HTTP response boundary without altering the saved story or ledger.
   let staleReply=false;
   await page.route("**/api/yingjie/"+demo.id+"?**",async route=>{
     if(staleReply || route.request().method()!=="POST")return route.continue();
     const res=await route.fetch();
     const frame=await res.json();
     if(frame.revision===7){staleReply=true;return route.fulfill({response:res,json:{...frame,revision:6}});}
     return route.fulfill({response:res});
   });
   const baseline=extended?await ledgerCounts(pool):null;
   const steps=[];
   const trace=async phase=>{if(extended)await writeFile(process.env.YJ13_DETAIL,JSON.stringify({phase,completedChecks:steps.length,steps,sends},null,2)+"\n");};
   await trace("opened");
   let previousUrl,firstCompletedAt,quotaPauseMs=0;
   for(const [index,[text,place,version,count,panel,picture]] of route.entries()){
    body=text;const revision=index+1;
    failUnknown=revision>=24;
    if(extended && revision===31){
      // The original card endpoint budgets 30 actions per owner in a 60-second PG window.
      quotaPauseMs=Math.max(0,firstCompletedAt+61000-Date.now());
      await trace("waiting for original account quota window");
      await new Promise(resolve=>setTimeout(resolve,quotaPauseMs));
    }
    await page.getByRole("textbox",{name:"角色卡行动"}).fill("继续观察");
    const response=extended?page.waitForResponse(r=>r.url()===origin+"/api/card-import/sessions/"+demo.id+"/actions" && r.request().method()==="POST"):null;
    await page.getByRole("button",{name:"提交行动"}).click();
    if(response){assert.equal((await response).status(),200,"original card action HTTP at revision "+revision);if(revision===1)firstCompletedAt=Date.now();}
    await page.getByText("独立会话 · 修订 "+revision,{exact:true}).waitFor();
    const figure=page.locator('.yj-figure[data-state="'+panel+'"][data-version="'+(version?"V"+version:"")+'"]');
    try{await figure.waitFor();}catch(error){if(extended){const seen=await page.locator(".yj-figure").evaluate(el=>({...el.dataset}));await trace("revision "+revision+" expected "+panel+"; actual "+JSON.stringify(seen));}throw error;}
    const event=(await pool.query("SELECT result,raw_text_hash FROM yingjie_scene.event WHERE scope=$1 AND revision=$2",[demo.scope,revision])).rows[0];
    assert.equal(event.raw_text_hash,hash(text));
    assert.equal(event.result.scene?.sceneId??null,place);assert.equal(event.result.visual?.people.length??null,count);
    let digest=null;
    if(panel==="display"){
      await page.waitForFunction(()=>document.querySelector(".yj-figure img")?.naturalWidth>0);
      previousUrl=await figure.locator("img").getAttribute("src");
      const r=await client.request.get(origin+previousUrl);
      assert.equal(r.status(),200);digest=sha256(await r.body());assert.equal(digest,catalog[picture].sha256);
    }else{
      assert.equal(await page.locator(".yj-figure img").count(),0);
      if(previousUrl)assert.equal((await client.request.get(origin+previousUrl)).status(),404);
    }
    if([10,18,25].includes(revision)){await page.reload();await figure.waitFor();}
    if(process.env.YJ09_EVIDENCE_DIR && [10,18].includes(revision)){
      await mkdir(process.env.YJ09_EVIDENCE_DIR,{recursive:true});
      await page.locator(".yj-panel").screenshot({type:"jpeg",quality:66,
        path:join(process.env.YJ09_EVIDENCE_DIR,revision===10?"pending.jpg":"revisit.jpg")});
    }
    if(revision===10){
      assert.equal(await figure.getByText("当前画面待核实，仍可继续文字行动。").count(),1);
      const saved=(await pool.query("SELECT state FROM yingjie_scene.stream WHERE scope=$1",[demo.scope])).rows[0].state;
      assert.equal(saved.places.find(p=>p.scene.sceneId==="east").facts.people.length,5);
    }
    if(revision===18){
      assert.deepEqual(event.result.scene.aliases,["青石酒馆","老周的店"]);
      const script='import {statePool} from "./packages/scene-state/test/local-db.mjs"; import {latest} from "./packages/scene-state/store.mjs"; const p=statePool(process.argv[1]);try{console.log(JSON.stringify(await latest(p,process.argv[2])))}finally{await p.end()}';
      const child=await promisify(execFile)(process.execPath,["--input-type=module","-e",script,database,demo.scope],{windowsHide:true});
      assert.deepEqual(JSON.parse(child.stdout),{revision,result:event.result});
    }
    steps.push({...(extended?await verifyTurn({page,pool,scope:demo.scope,revision,text,sends:sends.length}):{}),revision,place,visual:event.result.visual?.visualVersion??null,people:event.result.visual?.people??null,
      reason:event.result.reason??null,action:await figure.getAttribute("data-decision"),panel,sha256:digest});
    await trace("card turn verified");
   }
   assert.equal(staleReply,true);
   assert.deepEqual(sends.map(s=>s.version),["V2","V4","V5","V7"]);
   assert.equal(sends[2].reference,catalog[1].sha256);
   const ledger=async()=>(await pool.query("SELECT request_key,id FROM yingjie_image.task WHERE scope=$1 AND request_key IS NOT NULL ORDER BY id",[demo.scope])).rows;
   const before=await ledger();
   const history=await demo.api("GET","/sessions/"+demo.id+"/history?after=0");
   assert.deepEqual(history.map(h=>[h.action,h.narrative]),route.map(r=>["继续观察",r[0]]));
   // The source is the real authenticated history endpoint. Cap the adapter's page size to exercise resume.
   const cursors=[];
   const request=async(path,opts)=>{
     const response=await client.request.get(origin+path,{headers:opts.headers});
     const json=await response.json();
     if(path.includes("history?after=")){cursors.push(Number(path.split("after=")[1]));return Response.json(json.slice(0,5));}
     return Response.json(json,{status:response.status()});
   };
   const args={request,sessionId:demo.id,signal:new AbortController().signal};
   const init=async p=>{
     for(const file of ["../../image-tasks/schema.sql","../schema.sql"])await p.query(await readFile(new URL(file,import.meta.url),"utf8"));
   };
   let differences;
   await withDatabase(async old=>withDatabase(async fresh=>{
     await init(old);await init(fresh);
     await replayHistory({...args,pool:old,extract:extractSaved});
     // Inject a failure after extraction, before the journal/checkpoint transaction commits.
     await fresh.query(`CREATE FUNCTION fail_ninth() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN IF NEW.revision=9 THEN RAISE EXCEPTION 'replay-interrupted'; END IF; RETURN NEW; END $$;
       CREATE TRIGGER stop_replay BEFORE INSERT ON yingjie_play.extraction FOR EACH ROW EXECUTE FUNCTION fail_ninth()`);
     const replay=()=>replayHistory({...args,pool:fresh,extract:extractContinuity});
     await assert.rejects(replay,/replay-interrupted/);assert.equal(await checkpoint(fresh,demo.scope),8);
     await fresh.query("DROP TRIGGER stop_replay ON yingjie_play.extraction");
     await assert.rejects(replayHistory({...args,pool:fresh,extract:extractSaved}),/incompatible-projection/);
     await assert.rejects(syncCardHistory({...args,pool:fresh,extract:extractContinuity}),/incompatible-projection/);
     assert.equal(await checkpoint(fresh,demo.scope),8);
     const race=await Promise.all([replay(),replay()]);
     assert.equal(race[0].applied+race[1].applied,route.length-8);
     assert.equal((await replay()).applied,0);
     await assert.rejects(replayHistory({...args,pool:fresh,extract:extractSaved}),/incompatible-projection/);
     differences=await compareReplay(old,fresh,demo.scope);
     const live=await compareReplay(pool,fresh,demo.scope);
     assert.ok(live.every(r=>JSON.stringify(r.previous)===JSON.stringify(r.replayed)));
     assert.equal(differences.length,route.length);
     for(const shadow of [old,fresh])assert.equal((await shadow.query("SELECT count(*)::int n FROM yingjie_image.task")).rows[0].n,0);
   }));
   assert.deepEqual(await ledger(),before);assert.equal(sends.length,4);
   assert.ok(cursors.includes(5) && cursors.includes(8));
   // Open an already-played ordinary card into a new ledger: even a new page/view cannot authorize resending.
   await page.goto(origin+"/cards/session/"+second);
   for(const [i,story] of [route[0][0],route[2][0]].entries()){
     body=story;
     await page.getByRole("textbox",{name:"角色卡行动"}).fill("继续观察");
     await page.getByRole("button",{name:"提交行动"}).click();
     await page.getByText("独立会话 · 修订 "+(i+1),{exact:true}).waitFor();
   }
   await page.getByRole("button",{name:"进入映界"}).click();
   const held=page.locator('.yj-figure[data-state="ledger-review"]');
   await held.waitFor();await page.reload();await held.waitFor();
   assert.equal(await page.locator(".yj-figure img").count(),0);
   assert.equal(sends.length,4);
   const evidence={recoveredStaleRevision:7,coldLedger:"historical 5-person session held on open and refresh",browser:browser.version(),source:"synthetic saved by original ordinary CardSession",action:"继续观察",
     realTextCalls:0,realImageCalls:0,sends,steps,differences,interruptedAt:9,resumedFrom:8,shadowTasks:0,unknownRequestPreserved:true,unchangedRequestKeyHashes:before.map(r=>hash(r.request_key))};
   if(extended){
     const secondHistory=await demo.api("GET","/sessions/"+second+"/history?after=0");
     assert.equal(secondHistory.length,2);await client.close();
     const restored=process.env.YJ13_RESTORE==="1"?await restoreDrill({pool,database,tasks,world,scope:demo.scope,unknownRevision:24,journeyRevision:route.length}):null;
     await writeFile(process.env.YJ13_DETAIL,JSON.stringify({browser:browser.version(),baseline,steps,sends,quotaPauseMs,completed:history.length,secondary:secondHistory.length,shadowTasks:0,realTextCalls:0,realImageCalls:0,restored},null,2)+"\n");
   }
   if(process.env.YJ09_EVIDENCE_DIR){
     await mkdir(process.env.YJ09_EVIDENCE_DIR,{recursive:true});
     await writeFile(join(process.env.YJ09_EVIDENCE_DIR,"journey.json"),JSON.stringify(evidence,null,2)+"\n");
   }
   t.diagnostic(JSON.stringify({turns:steps.length,browser:browser.version(),mock:sends.length,shadowTasks:0,interruptedAt:9}));
  }finally{await browser.close();}
 },{assets:catalog.slice(0,1)},{model:()=>body,provider,extractor:extractContinuity}));
});
