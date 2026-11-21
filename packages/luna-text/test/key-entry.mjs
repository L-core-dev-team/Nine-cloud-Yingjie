import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {request} from "node:http";
import {once} from "node:events";
import {serve} from "../key-entry/server.mjs";
import {preflight,priceDate,action,prepare,cardModel} from "../adapter.mjs";
import {SingleApproval} from "../ledger.mjs";

delete process.env.OPENAI_API_KEY;
const fixture="synthetic-only-"+randomUUID(),dir=await mkdtemp(join(tmpdir(),"yj-ui-test-"));
const {chromium}=createRequire(join(process.env.NINE_CLOUD_ROOT,"apps/api/package.json"))("playwright");
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
const servers=[],db=new SingleApproval(join(dir,"fixture.sqlite")),checks=[];
let fakeSends=0,externalBrowserRequests=0;
async function newPage(options={}){
  const server=await serve({inspect:(present,verified)=>{
    const reasons=preflight(present?"present":"",verified?priceDate:"",new Date(priceDate+"T03:00:00Z"));
    if(db.snapshot())reasons.push("APPROVAL_LOCKED");return reasons;
  },execute:async({takeKey,signal})=>{
    const scope={owner:"fixture",sessionId:randomUUID(),key:randomUUID()};
    db.arm(scope,prepare({action}));
    const model=cardModel({ledger:db,takeKey,transport:async(url,init)=>{
      assert.equal(init.headers.Authorization,"Bearer "+fixture);fakeSends++;throw Error("fixture-lost-response");
    }});
    await assert.rejects(model({action},signal,scope),/UNKNOWN_STOP/);
    return {status:db.snapshot().state};
  },...options});
  servers.push(server);
  const context=await browser.newContext({serviceWorkers:"block"}),page=await context.newPage();
  await context.route("**/*",route=>{
    if(new URL(route.request().url()).origin===server.origin)return route.continue();
    externalBrowserRequests++;return route.abort();
  });
  const claimResponse=page.waitForResponse(r=>r.url()===server.origin+"/claim");
  await page.goto(server.url);
  await page.getByText("可以填写密钥。检查配置只在本机运行。").waitFor();
  assert.equal(page.url(),server.origin+"/");assert.equal(await page.locator("#key").getAttribute("type"),"password");
  return {server,page,context,testSession:(await (await claimResponse).json()).session};
}
async function raw(server,path,token,overrides={}){
  const headers={"Content-Length":"0","Content-Type":"application/octet-stream",Origin:server.origin,
    "X-YJ-Session":token,...overrides};
  const r=request(server.origin+path,{method:"POST",headers});const pending=once(r,"response");r.end();
  const [res]=await pending;const chunks=[];for await(const chunk of res)chunks.push(chunk);
  const content=Buffer.concat(chunks).toString();assert.ok(!content.includes(fixture));return {status:res.statusCode,data:JSON.parse(content)};
}
async function unavailable(origin){
  for(let i=0;i<30;i++){try{await fetch(origin);}catch{return;}await new Promise(r=>setTimeout(r,100));}
  throw Error("listener remained open");
}
try{
  const locks=await serve({inspect:()=>[],execute:()=>{throw Error("unexpected execution");}});
  servers.push(locks);
  const invite=new URL(locks.url).hash.slice(1);
  assert.equal((await raw(locks,"/claim",invite,{Host:"localhost"})).status,403);
  assert.equal((await raw(locks,"/claim",invite,{Origin:"https://example.invalid"})).status,403);
  assert.equal((await raw(locks,"/claim",invite,{"Sec-Fetch-Site":"cross-site"})).status,403);
  assert.equal((await raw(locks,"/claim",invite,{"Content-Type":"text/plain"})).status,403);
  assert.equal((await raw(locks,"/claim","invalid")).status,403);
  const claim=await raw(locks,"/claim",invite);assert.equal(claim.status,200);
  assert.equal((await raw(locks,"/claim",invite)).status,403);
  assert.equal((await raw(locks,"/start",claim.data.session)).status,409);
  locks.close();checks.push("host-origin-nonce-content-type-rejected","invite-single-use","unprepared-start-denied");
  const a=await newPage();
  const entry=await a.context.request.get(a.server.origin);
  assert.equal(entry.headers()["cache-control"],"no-store");assert.ok(entry.headers()["content-security-policy"].includes("worker-src 'none'"));
  await a.page.locator("#key").fill(fixture);await a.page.locator("#check").click();
  await a.page.getByText("请先核实并勾选项目权限和费率。").waitFor();
  assert.equal(await a.page.locator("#key").inputValue(),"");assert.equal(await a.page.locator("#start").isDisabled(),true);
  assert.equal(await a.page.content().then(x=>x.includes(fixture)),false);
  assert.deepEqual(await a.page.evaluate(()=>[localStorage.length,sessionStorage.length,document.cookie]),[0,0,""]);
  assert.equal(db.snapshot(),null);assert.equal(fakeSends,0);
  await a.page.reload({waitUntil:"commit"}).catch(()=>{});
  await unavailable(a.server.origin);await a.context.close();
  checks.push("check-no-send-no-reservation","input-cleared-storage-empty","refresh-invalidates");
  const b=await newPage();await b.page.locator("#key").fill(fixture);await b.page.locator("#check").click();
  await b.page.getByText("请先核实并勾选项目权限和费率。").waitFor();
  await b.page.goto("about:blank");await b.page.goBack({waitUntil:"commit"}).catch(()=>{});
  await unavailable(b.server.origin);await b.context.close();checks.push("back-invalidates");
  const c=await newPage();await c.page.locator("#clear").click();await unavailable(c.server.origin);await c.context.close();
  const d=await newPage();await d.page.close();await unavailable(d.server.origin);await d.context.close();
  const lease=await serve({inspect:()=>[],execute:()=>{},leaseMs:90});
  servers.push(lease);await raw(lease,"/claim",new URL(lease.url).hash.slice(1));await unavailable(lease.origin);
  const expired=await serve({inspect:()=>[],execute:()=>{},lifetimeMs:90,leaseMs:100});
  servers.push(expired);await unavailable(expired.origin);checks.push("clear-close-expiry-heartbeat-loss-invalidates");
  const e=await newPage();await e.page.locator("#key").fill(fixture);await e.page.locator("#project").check();await e.page.locator("#check").click();
  await e.page.getByText(/本机预检通过/).waitFor();assert.equal(fakeSends,0);
  assert.equal((await raw(e.server,"/start",e.testSession)).status,409);
  assert.equal((await raw(e.server,"/start",e.testSession,{Origin:"https://example.invalid","X-YJ-Confirm":"one-luna-text"})).status,403);
  assert.equal(fakeSends,0);checks.push("ready-still-requires-same-origin-explicit-confirmation");
  await e.page.locator("#start").evaluate(button=>{button.click();button.click();});
  await e.page.getByText(/测试已停止 · UNKNOWN_STOP/).waitFor();assert.equal(fakeSends,1);
  await unavailable(e.server.origin);await e.context.close();
  const f=await newPage();await f.page.locator("#key").fill(fixture);await f.page.locator("#project").check();await f.page.locator("#check").click();
  await f.page.getByText("这笔许可已被占用。").waitFor();assert.equal(await f.page.locator("#start").isDisabled(),true);
  await f.context.close();assert.equal(db.snapshot().state,"UNKNOWN_STOP");assert.equal(fakeSends,1);
  checks.push("explicit-double-click-single-fake-send","unknown-survives-new-session");
  assert.equal(externalBrowserRequests,0);
  const report={status:"OFFLINE_PASS",browser:browser.version(),checks,fakeSends,externalBrowserRequests,realTextCalls:0,realImageCalls:0};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify(report));
}finally{servers.forEach(s=>s.close());await browser.close();db.close();await rm(dir,{recursive:true,force:true});}
