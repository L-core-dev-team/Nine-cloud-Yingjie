import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile,readFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {journey} from "../journey.mjs";
import {SingleApproval} from "../ledger.mjs";
import {reply} from "../test/fake.mjs";
import {serve} from "../key-entry/server.mjs";
import {stageJournal} from "../key-entry/stages.mjs";
import {pilot,verifyModel} from "./pilot.mjs";
import {grant,preflight,priceDate,prompt} from "./request.mjs";
import {east,tower,partial,prose} from "../../first-play/test/scene-evidence-fixtures.mjs";

const source={schemaVersion:"0.1",kind:"card-history",evidence:"completed-history",ownerId:"synthetic",sessionId:randomUUID(),key:randomUUID(),revision:1};
const state={places:[],current:null};
const labels=[
  ["complete",prose(east),true],["semicolon",east.join("；"),true],
  ["order",prose([east[0],east[4],east[5],east[3],east[2],east[1]]),true],
  ["natural-paraphrase","走进东村青石酒馆，你立在正门向北看。正午日光映着固定的柜台、双窗。你看遍全堂，确认仅掌柜、蓝衣客与赭衣客三人在场。",true],
  ["partial",partial,false],["dream","你梦见"+prose(east),false],["other-place",prose(tower),false],
  ["wrong-count",prose(east.with(2,"环顾屋内，在场的只有掌柜、蓝衣客")),false],
  ["wrong-direction",prose(east.with(1,"你站在正门，向南望去")),false]
];
const cases=labels.map(([id,narrative,shouldAccept])=>{
  const out=pilot.extract({source,narrative,state,action:prompt});
  return {id,shouldAccept,status:out.audit.status,conflicts:out.audit.conflicts};
});
const falseAccept=cases.filter(c=>!c.shouldAccept && c.status==="ready").length;
const unnecessaryAbstain=cases.filter(c=>c.shouldAccept && c.status==="not-ready").length;
assert.equal(falseAccept,0);assert.equal(unnecessaryAbstain,1);
const dir=await mkdtemp(join(tmpdir(),"yj-l4-offline-"));
const journal=stageJournal(dir);
const ledger=new SingleApproval(join(dir,"mock.sqlite"),grant,journal.mark);
let pageServer,browser;
try{
  const fakeReply=()=>{const data=reply();data.output[0].content[0].text=prose(east);return data;};
  const history=await journey({live:false,ledger,key:"offline-fixture",pilot:{...pilot,fakeReply,mark:journal.mark}});
  const stageRows=(await readFile(join(dir,journal.runHash+".jsonl"),"utf8")).trim().split("\n").map(JSON.parse);
  const savedStages=stageRows.map(row=>row.stage);
  assert.deepEqual(savedStages,["ledger-not-sent","ledger-possible-sent","provider-response-seen","history-committed","scene-reviewed"]);
  assert.equal(history.extraction,"ready");assert.equal(history.imageTasks+history.imageAttempts+history.imageSends,0);
  assert.equal(history.scene.method,"l4-scene-review/1");assert.equal(history.fakeSends,1);
  let starts=0,lookups=0,permit=false;
  const fakeKey="synthetic-key-"+randomUUID();
  const html=(await readFile(new URL("./index.html",import.meta.url),"utf8")).replace("{{PROMPT}}",prompt);
  pageServer=await serve({html,journal:stageJournal(dir),inspect:(key,confirmed)=>preflight(key,confirmed,new Date(priceDate+"T04:00:00Z")),
    verifyModel:(key,signal)=>verifyModel(key,signal,async(url,init)=>{
      lookups++;assert.equal(key,fakeKey);assert.equal(init.method,"GET");assert.equal(init.body,undefined);
      assert.equal(url,"https://api.openai.com/v1/models/gpt-6-luna");
      return Response.json(permit?{object:"model",id:"gpt-6-luna"}:{error:"not authorized"},{status:permit?200:403});
    }),execute:async({takeKey})=>{assert.equal(takeKey(),fakeKey);starts++;return {status:"MOCK_STOP"};}});
  const {chromium}=createRequire(join(process.env.NINE_CLOUD_ROOT,"apps/api/package.json"))("playwright");
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
  const context=await browser.newContext({serviceWorkers:"block"});
  await context.route("**/*",r=>new URL(r.request().url()).origin===pageServer.origin?r.continue():r.abort());
  const page=await context.newPage();await page.goto(pageServer.url);
  await page.locator("#key").fill(fakeKey);assert.equal(starts+lookups,0);
  await page.locator("#project").check();await page.locator("#check").click();
  await page.getByText(/未能核实该 Key/).waitFor();assert.ok(await page.locator("#start").isDisabled());
  permit=true;await page.locator("#check").click();await page.getByText(/项目可见性与本机门禁通过/).waitFor();
  assert.equal(starts,0);assert.equal(await page.locator("#key").inputValue(),"");
  assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length,document.cookie]),[0,0,""]);
  await page.locator("#start").click();await page.getByText(/MOCK_STOP/).waitFor();assert.equal(starts,1);
  const result={status:"PREP_OFFLINE_PASS",grant,history,savedStages,cases,falseAccept,unnecessaryAbstain,
    abstain:cases.filter(c=>c.status==="not-ready").length,ui:{lookups,clicks:starts,modelCallsBeforeClick:0},
    fakeUsage:ledger.snapshot().usage,realTextCalls:0,realImageCalls:0,newCostUsd:0};
  await writeFile(process.argv[2],JSON.stringify(result,null,2)+"\n",{flag:"wx"});
  console.log("PREP_OFFLINE_PASS");
}finally{
  await browser?.close();pageServer?.close();ledger.close();await rm(dir,{recursive:true,force:true});
}
