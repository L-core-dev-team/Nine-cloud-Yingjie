import assert from "node:assert/strict";
import {mkdtemp,readFile,readdir,mkdir,rm,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import {execFileSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {serve} from "../key-entry/server.mjs";
import {stageJournal} from "../key-entry/stages.mjs";
import {executeFixture} from "../l4/offline-execution.mjs";
import {action,prepare} from "../l4/request.mjs";
import {verifyModel} from "../l4/pilot.mjs";
import {cardModel} from "../adapter.mjs";
import {reply} from "./fake.mjs";

const old="51ab08d6a14eeb37a67e1d2d38c2cb7fc1f4c7fa";
const temp=await mkdtemp(join(tmpdir(),"l4r-"));
const fakeKey="fake-local-"+randomUUID();
const chrome=createRequire(join(process.env.NINE_CLOUD_ROOT,"apps/api/package.json"))("playwright").chromium;
const browser=await chrome.launch({executablePath:process.env.CHROME_PATH,headless:true});
const cases=[],executionCases=[];
const deferred=()=>Promise.withResolvers();
const checkFaults=["check-401","check-403","check-429","check-timeout","check-wrong-model"];
async function exists(path){try{await readdir(path);return true;}catch(e){if(e.code==="ENOENT")return false;throw e;}}
try{
  // Historical source only; no launcher, real pilot, ledger or model lookup is imported.
  const legacy=join(temp,"legacy");await mkdir(legacy);
  for(const name of ["server.mjs","entry.js","index.html","style.css"]){
    const bytes=execFileSync("git",["show",old+":packages/luna-text/key-entry/"+name],{windowsHide:true});
    await writeFile(join(legacy,name),bytes);
  }
  const oldServe=(await import(pathToFileURL(join(legacy,"server.mjs")))).serve;
  for(const scenario of ["old-lost-start","old-server-gate","lost-start","server-gate","mkdir","receipt","sqlite","not-sent",
    "gate-after-accept","disconnect-after-claim","lost-provider","lost-reply","ack-no-history","success","pending-check","check-before-close","checked-close","ping-after-finish",...checkFaults]){
    const root=join(temp,scenario);await mkdir(root);
    const storage=join(root,"run"),journal=stageJournal(root),begin=deferred(),release=deferred(),ping=deferred(),dropPing=deferred(),executed=deferred();
    let accepted=0,sends=0,checkCount=0,closed=false,startsAtHttp=0,lookupCalls=0;
    const past=scenario.startsWith("old-");
    if(scenario==="mkdir")await writeFile(storage,"fixture file in place of directory");
    if(scenario==="receipt" || scenario==="sqlite"){
      await mkdir(storage);
      await mkdir(join(storage,scenario==="receipt"?"receipt.json":"approval.sqlite"));
    }
    const server=await (past?oldServe:serve)({journal,
      inspect:(held,verified)=>{checkCount++;return held && verified && !(checkCount>1 && scenario.endsWith("server-gate"))?[]:["CHECK_BLOCKED"];},
      verifyModel:async(key,signal)=>{lookupCalls++;
        if(checkFaults.includes(scenario))return verifyModel(key,signal,async()=>{
          if(scenario==="check-timeout")throw Error("fixture timeout");
          return scenario==="check-wrong-model"?Response.json({object:"model",id:"wrong"}):new Response(null,{status:Number(scenario.slice(6))});
        });if(scenario==="pending-check"){begin.resolve();await release.promise;}return true;},
      execute:async({signal,takeKey,mark,runHash})=>{
        accepted++;
        assert.equal(takeKey(),fakeKey);
        try{return await executeFixture({directory:storage,signal,gate:()=>{
          if(scenario==="gate-after-accept")throw Error("fixture gate denied");
        },mark,runHash,run:async ledger=>{
          const call={owner:"synthetic",key:randomUUID(),sessionId:randomUUID()};
          ledger.arm(call,prepare({action}));
          assert.equal(ledger.snapshot().grant.runHash,journal.runHash);
          if(scenario==="not-sent")throw Error("fixture stops before claim");
          const model=cardModel({ledger,prepareRequest:prepare,mark,key:fakeKey,transport:async()=>{
            sends++;begin.resolve();
            if(scenario==="lost-provider")throw Error("synthetic timeout");
            await release.promise;
            if(scenario==="disconnect-after-claim")throw Error("fixture disconnected");
            return Response.json(reply());
          }});
          await model({action},signal,call);
          if(scenario==="ack-no-history")throw Error("simulated PG failure");
          mark("history-committed");mark("scene-reviewed");
        }});}finally{executed.resolve();}
      }});
    const context=await browser.newContext({serviceWorkers:"block"});
    const page=await context.newPage();page.setDefaultTimeout(5000);
    await context.route("**/*",async route=>{
      const u=new URL(route.request().url());
      if(u.origin!==server.origin)return route.abort();
      if(scenario==="ping-after-finish" && u.pathname==="/ping" && accepted){
        ping.resolve();await dropPing.promise;return route.abort().catch(()=>{});
      }
      if(u.pathname==="/start"){
        if(scenario.endsWith("lost-start"))return route.abort();
        startsAtHttp++;
        if(scenario==="lost-reply"){const res=await route.fetch();assert.ok(res.ok());return route.abort();}
      }
      return route.continue();
    });
    try{
      await page.goto(server.url);
      await page.locator("#key").fill(fakeKey);await page.locator("#project").check();
      if(scenario==="check-before-close"){
        await page.close();closed=true;
      } else {
        await page.locator("#check").click();
        if(scenario==="pending-check"){
          await begin.promise;
          // Use the actual 8 s browser heartbeat with verification in flight.
          await page.waitForResponse(r=>r.url()===server.origin+"/ping" && r.status()===200,{timeout:12000});
          assert.equal(accepted,0);assert.ok(await page.locator("#start").isDisabled());
          release.resolve();
        }
        if(checkFaults.includes(scenario)){
          await page.getByText(/未能核实该 Key/).waitFor();assert.ok(await page.locator("#start").isDisabled());
          await page.close();closed=true;
        }else await page.waitForFunction(()=>!document.querySelector("#start").disabled);
        if(closed || scenario==="checked-close" || scenario==="pending-check"){if(!closed)await page.close();closed=true;}
        else{
          const expected=past?"会话已结束":scenario==="server-gate"?"发送前被拒绝":scenario==="not-sent" || ["gate-after-accept","mkdir","sqlite","receipt"].includes(scenario)?"发送前失败":
            scenario==="ack-no-history"?"ACKNOWLEDGED_HISTORY_UNVERIFIED":scenario==="success" || scenario==="ping-after-finish"?"MOCK_COMPLETED":"无法排除已发送";
          await page.locator("#start").evaluate(button=>{button.click();button.click();});
          if(scenario==="disconnect-after-claim"){
            await begin.promise;await page.getByText(/服务器已接受执行/).waitFor();
            await page.close();release.resolve();await executed.promise;
          }
          if(["success","ack-no-history","ping-after-finish","lost-reply"].includes(scenario)){
            await begin.promise;
            if(scenario!=="lost-reply")await page.getByText(/服务器已接受执行/).waitFor();
            if(scenario==="ping-after-finish"){
              await ping.promise;
            }
            release.resolve();
          }
          if(!page.isClosed()){
            await page.waitForFunction(text=>document.querySelector("#status").textContent.includes(text),expected);
            if(scenario==="ping-after-finish"){
              const failed=page.waitForEvent("requestfailed",r=>r.url()===server.origin+"/ping");
              dropPing.resolve();await failed;await page.evaluate(()=>new Promise(r=>setTimeout(r,0)));
              assert.match(await page.locator("#status").textContent(),/MOCK_COMPLETED/);
            }
            assert.ok(await page.locator("#start").isDisabled());
          }
        }
      }
      assert.equal(accepted,scenario.endsWith("lost-start") || scenario.endsWith("server-gate") || closed?0:1);
      const afterClaim=["disconnect-after-claim","success","ping-after-finish","lost-provider","lost-reply","ack-no-history"].includes(scenario);
      assert.equal(sends,afterClaim?1:0);
      if(!accepted || scenario==="gate-after-accept")assert.equal(await exists(storage),false);
      if(!past){
        const log=await readFile(join(root,journal.runHash+".jsonl"),"utf8");
        const rows=log.trim().split("\n").map(JSON.parse);
        for(const row of rows){
          assert.deepEqual(Object.keys(row),["runHash","utc","stage"]);assert.equal(row.runHash,journal.runHash);
          assert.match(row.utc,/Z$/);
        }
        assert.ok(!log.includes(fakeKey));assert.ok(!log.includes(action));
        const stages=rows.map(r=>r.stage);
        if(accepted)assert.ok(stages.includes("start-accepted"));
        if(stages.includes("receipt-created"))
          assert.equal(JSON.parse(await readFile(join(storage,"receipt.json"),"utf8")).runHash,journal.runHash);
        if(afterClaim)assert.ok(stages.indexOf("ledger-possible-sent")>stages.indexOf("ledger-not-sent"));
        if(scenario==="lost-start")assert.ok(!stages.includes("start-received"));
        if(scenario==="server-gate")assert.ok(stages.includes("start-received") && stages.includes("gate-denied"));
        if(scenario==="success")assert.deepEqual(stages,["invite-claimed","preflight-ready","start-received","start-accepted","receipt-created",
          "ledger-not-sent","ledger-possible-sent","provider-response-seen","history-committed","scene-reviewed","stop"]);
        executionCases.push({scenario,stages});
      }
      cases.push({scenario,startRequestsForwarded:startsAtHttp,executeEntered:accepted,fakeSends:sends,lookupCalls});
    }finally{dropPing.resolve();release.resolve();server.close();await context.close();}
  }
  await writeFile(process.argv[2],JSON.stringify({status:"PASS",chrome:browser.version(),cases,executionCases,
    realModelQueries:0,realTextCalls:0,realImageCalls:0,newCostUsd:0},null,2)+"\n",{flag:"wx"});
  console.log("PASS",cases.length);
}finally{await browser.close();await rm(temp,{recursive:true,force:true});}
