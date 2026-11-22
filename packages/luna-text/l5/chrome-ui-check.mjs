import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {join} from "node:path";
import {randomBytes} from "node:crypto";

const html=await readFile(new URL("index.html",import.meta.url),"utf8");
const script=await readFile(new URL("../key-entry/entry.js",import.meta.url),"utf8");
const {chromium}=createRequire(join(process.env.NINE_CLOUD_ROOT,"apps/api/package.json"))("playwright");
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
const scenarios={lost:"无法排除已发送",rejected:"发送前被拒绝",unknown:"无法排除已发送",
  ack:"completed-history 尚未校验",ready:"scene ready",incomplete:"scene not-ready",expired:"邀请已过期"};
const results=[];
try{
  for(const [mode,expected] of Object.entries(scenarios)){
    const context=await browser.newContext({serviceWorkers:"block"});
    try{
      // Entire document, script and fetch double are local. No listener, DNS or upstream transport.
      await context.route("**/*",route=>{
        const u=new URL(route.request().url());
        if(u.hostname!=="l5-fixture.invalid")return route.abort();
        if(u.pathname==="/entry.js")return route.fulfill({contentType:"text/javascript",body:script});
        if(u.pathname==="/")return route.fulfill({contentType:"text/html",body:html});
        return route.fulfill({contentType:"text/css",body:""});
      });
      await context.addInitScript(mode=>{
        window.startCount=0;
        window.fetch=async(path,init)=>{
          if(path==="/claim")return Response.json({session:"a".repeat(43),runHash:"b".repeat(64)});
          if(path==="/check")return Response.json({status:"READY",held:true});
          if(path!=="/start")return Response.json({});
          window.startCount++;
          if(mode==="lost")throw Error("fixture");
          if(mode==="expired")return Response.json({status:"INVITE_EXPIRED"},{status:410});
          if(mode==="rejected")return Response.json({status:"START_REJECTED_BEFORE_SEND"},{status:409});
          const payload=mode==="unknown"?{status:"POSSIBLE_SEND_UNCONFIRMED"}:
            mode==="ack"?{status:"ACKNOWLEDGED_HISTORY_UNVERIFIED"}:
            {status:"MOCK_HISTORY_VERIFIED",revision:1,scene:mode==="ready"?"ready":"not-ready"};
          const stream=new ReadableStream({start(controller){
            window.releaseBody=()=>{controller.enqueue(new TextEncoder().encode(JSON.stringify(payload)));controller.close();};
          }});
          return new Response(stream,{headers:{"X-YJ-Start":"accepted"}});
        };
      },mode);
      const page=await context.newPage();page.setDefaultTimeout(10000);
      await page.goto("https://l5-fixture.invalid/#"+randomBytes(32).toString("base64url"));
      await page.locator("#project").check();await page.locator("#check").click();
      await page.waitForFunction(()=>!document.querySelector("#start").disabled);
      await page.locator("#start").evaluate(button=>{button.click();button.click();});
      const accepted=!["lost","expired","rejected"].includes(mode);
      if(accepted){await page.getByText(/服务器已接受执行/).waitFor();await page.evaluate(()=>window.releaseBody());}
      await page.getByText(expected,{exact:false}).waitFor();
      assert.equal(await page.evaluate(()=>window.startCount),1);assert.ok(await page.locator("#start").isDisabled());
      results.push({mode,acceptedHeaderSeen:accepted,finalLabel:expected,startClicksForwarded:1});
    }finally{await context.close();}
  }
  await writeFile(process.argv[2],JSON.stringify({status:"PASS",chrome:browser.version(),
    transport:"fully-intercepted browser document and synthetic fetch",results},null,2)+"\n",{flag:"wx"});
}finally{await browser.close();}
