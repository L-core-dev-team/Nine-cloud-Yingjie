// Local operator for the one bounded route. No model transport.
import {createRequire} from "node:module";
import {readFileSync,existsSync,mkdirSync,writeFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import assert from "node:assert/strict";
import {hash} from "./data.mjs";
const [instance,operation,from,to,out]=process.argv.slice(2);
if(!["demo","rehearsal"].includes(instance))throw Error("test instance only");
const dir=join(process.env.LOCALAPPDATA,"NineCloud-P05",instance),config=JSON.parse(readFileSync(join(dir,"private.json")));
const {chromium}=createRequire(resolve(config.upstream,"package.json"))("playwright");
const exe=process.env.CHROME_PATH||["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:exe});
const route=["scan","berm","combat:npc_shuiyuya","quest:claim","loc_wangqitai","loc_luhuadu","chat","loc_wangqitai"];
try{
 const context=await browser.newContext({viewport:{width:1120,height:840}}),page=await context.newPage();
 await context.route("**/*",r=>{const url=new URL(r.request().url());return ["file:","data:"].includes(url.protocol)||url.hostname==="127.0.0.1"?r.continue():r.abort()});
 await page.goto(pathToFileURL(join(dir,"open.html")).href);
 await page.waitForURL("http://127.0.0.1:"+config.httpPort+"/**");await page.waitForFunction(()=>document.querySelector("#where")?.textContent?.startsWith("当前"));
 const game=()=>page.evaluate(async()=>await (await fetch("/game")).json());
 let g=await game();
 if(operation==="walk"){
   const first=Number(from),last=Number(to);assert.equal(g.current.revision,first-1);
   for(let i=first;i<=last;i++){
     const choice=route[i-1],b=page.locator('[data-action="'+choice+'"]');
     if(!await b.count())throw Error("R"+i+" unavailable; actions "+g.current.actions.map(a=>a.id));
     const response=page.waitForResponse(r=>r.url().endsWith("/act"));
     await b.click();const resp=await response;assert.equal(resp.status(),200,await resp.text());
     await page.waitForFunction(r=>document.querySelector("#where").textContent.includes("第 "+r+" 回合"),i);
     g=await game();assert.equal(g.current.revision,i);const h=g.history.at(-1);assert.equal(hash(h.text),h.bodySha);
     console.log(JSON.stringify({instance,revision:i,id:choice,place:g.current.place,sub:g.current.sub,events:h.events,text:h.text,reward:g.current.quest,sha:h.bodySha}));
   }
 }
 await page.reload();await page.waitForFunction(()=>document.querySelector("#where")?.textContent?.startsWith("当前"));
 g=await game();
 if(g.history.length){await page.locator('[data-rev="1"]').click();assert.match(await page.locator("#where").textContent(),/历史/);await page.locator("#current").click();assert.equal((await game()).current.revision,g.current.revision)}
 if(out){mkdirSync(out,{recursive:true});await page.screenshot({path:join(out,instance+"-r"+g.current.revision+".png")})}
 console.log(JSON.stringify({checked:operation,revision:g.current.revision,scope:g.scope,bodyHashes:g.history.map(h=>h.bodySha),reward:g.current.quest,slots:g.slots.map(s=>[s.rev,s.kind,s.status]),browser:browser.version()}));
}finally{await browser.close()}
