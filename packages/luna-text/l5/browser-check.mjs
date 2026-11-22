import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createRequire} from "node:module";
import {openRehearsal} from "./pilot.mjs";

// Run each story in a fresh Node process. The original card fixture binds one PG cluster per process.
const [mode,output]=process.argv.slice(2);
if(!["complete","nonexclusive","disconnect","lost","reject","expiry","timeout"].includes(mode)||!output)throw Error("INVALID_CASE");
const root=await mkdtemp(join(tmpdir(),"yj-l5-chrome-"));
const {chromium}=createRequire(join(process.env.NINE_CLOUD_ROOT,"apps/api/package.json"))("playwright");
let fakeSends=0,allow=true,clock=Date.now();
const delayed=Promise.withResolvers();
const server=await openRehearsal(root,{story:mode==="nonexclusive"?mode:"complete",checkGate:()=>allow,
  now:()=>clock,async delayReply(){fakeSends++;if(mode==="timeout")throw Error("MOCK_TIMEOUT");if(mode==="disconnect")await delayed.promise;}});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
try{
  const context=await browser.newContext({serviceWorkers:"block"});
  await context.route("**/*",route=>{
    const url=new URL(route.request().url());
    if(url.origin!==server.origin || (mode==="lost" && url.pathname==="/start"))return route.abort();
    return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(90000);
  await page.goto(server.url);await page.locator("#project").check();
  assert.ok(await page.locator("#key").evaluate(el=>el.readOnly));
  const other=await context.newPage();await other.goto(server.url);
  await other.getByText(/一次性邀请无效/).waitFor();await other.close();
  await page.locator("#check").click();await page.waitForFunction(()=>!document.querySelector("#start").disabled);
  if(mode==="reject")allow=false;
  if(mode==="expiry")clock+=16*60_000;
  await page.locator("#start").click();
  if(mode==="disconnect"){
    await page.getByText(/服务器已接受执行/).waitFor();
    await page.waitForResponse(r=>r.url()===server.origin+"/ping" && r.status()===200,{timeout:15000});
    await page.goto("about:blank");await page.close();server.close();delayed.resolve();
  }else{
    const expected={complete:"scene ready",nonexclusive:"scene not-ready",lost:"无法排除已发送",reject:"发送前被拒绝",
      expiry:"",timeout:"无法排除已发送"}[mode];
    if(mode==="expiry")await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("过期")||
      document.querySelector("#status").textContent.includes("无法排除已发送"));
    else await page.getByText(expected,{exact:false}).waitFor();
  }
  const log=async()=>(await readFile(join(server.directory,"audit",server.runHash+".jsonl"),"utf8")).trim()
    .split("\n").map(line=>JSON.parse(line).stage);
  await context.close();
  if(["lost","expiry","reject"].includes(mode))server.close();
  const until=Date.now()+90000;
  while(!(await log()).includes("stop") && Date.now()<until)await new Promise(r=>setTimeout(r,100));
  const stages=await log(),result=server.status();
  assert.ok(stages.includes("stop"));
  const before=["lost","expiry","reject"].includes(mode);
  assert.equal(fakeSends,before?0:1);
  assert.equal(result.status,before?"NO_LOCAL_RECORD":mode==="timeout"?"POSSIBLE_SEND_UNCONFIRMED":"MOCK_HISTORY_VERIFIED");
  if(mode==="lost")assert.ok(!stages.includes("start-received"));
  if(mode==="reject")assert.ok(stages.includes("gate-denied"));
  if(!before && mode!=="timeout"){
    assert.deepEqual(stages,["invite-claimed","preflight-ready","start-received","start-accepted","receipt-created",
      "ledger-not-sent","ledger-possible-sent","provider-response-seen","history-committed","scene-reviewed","stop"]);
    assert.equal(result.scene,mode==="nonexclusive"?"not-ready":"ready");
    assert.equal(result.history.replayApplied,0);
  }
  await writeFile(output,JSON.stringify({mode,status:"PASS",chrome:browser.version(),stages,result,fakeSends,
    realModelQueries:0,realTextCalls:0,realImageCalls:0,newCostUsd:0},null,2)+"\n",{flag:"wx"});
}catch(error){
  // Browser navigation errors may contain the one-use invitation in their URL.
  const reason=String(error.message).match(/ERR_[A-Z_]+|EACCES|ECONNREFUSED|Timeout/i)?.[0]??"CHECK_FAILED";
  throw Error(mode+" · "+reason);
}finally{delayed.resolve();server.close();await browser.close();}
