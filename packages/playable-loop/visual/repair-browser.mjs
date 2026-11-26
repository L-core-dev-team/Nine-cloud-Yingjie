import assert from "node:assert/strict";
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import {DatabaseSync} from "node:sqlite";
import {hash} from "../data.mjs";
import {catalog} from "./pictures.mjs";

const [run,phase="walk"]=process.argv.slice(2);
const ev=new URL("../../../docs/reports/evidence/YJ-P05-VISUAL-REPAIR-01/",import.meta.url);
const matrix=JSON.parse(readFileSync(new URL("matrix.json",ev)));
const personal=run==="personal";
assert.ok(personal||["A","B","C"].includes(run));
assert.ok(["walk","resume","inspect"].includes(phase));
const name=personal?"visual-reader":"repair-"+run.toLowerCase();
const dir=join(process.env.LOCALAPPDATA,"NineCloud-P05",name);
const cfg=JSON.parse(readFileSync(join(dir,"private.json")));
const {chromium}=createRequire(resolve(cfg.upstream,"package.json"))("playwright");
const db=new DatabaseSync(join(dir,"sidecar.sqlite"),{readOnly:true});
const get=k=>JSON.parse(db.prepare("SELECT v FROM kv WHERE k=?").get(k)?.v??"null");
const browser=await chromium.launch({channel:"chrome",headless:true,chromiumSandbox:true});
const save=(name,x)=>writeFileSync(new URL(name,ev),JSON.stringify(x,null,2)+"\n");
try {
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.route("**/*",r=>{const u=new URL(r.request().url());return u.protocol==="file:"||u.origin==="http://127.0.0.1:"+cfg.httpPort?r.continue():r.abort()});
  const page=await context.newPage();
  await page.goto(pathToFileURL(join(dir,"open.html")).href);
  await page.waitForFunction(()=>document.querySelector("#where")?.textContent.startsWith("当前"));
  const game=()=>page.evaluate(async()=>await (await fetch("/game")).json());
  let g=await game();assert.equal(g.continuing,true);assert.deepEqual(g.slots,[]);
  if(phase==="inspect"){
    assert.ok(!personal && ["A","B","C"].includes(run));
    const r=matrix[run].length,b=get("picture:"+g.scope+":"+r);
    assert.equal(g.current.revision,r);
    assert.deepEqual(g.visual.evidence[r],{version:b.version,reason:b.reason,observed:b.sourceRevision});
    assert.ok((await page.locator("#diag").textContent()).includes(b.reason));
    if(b.asset)await page.locator("#sheet img").waitFor();
    else assert.equal(await page.locator("#sheet img").count(),0);
    if(run==="B"){
      await page.locator('[data-rev="10"]').click();await page.locator("#sheet img").waitFor();
      assert.match(await page.locator("#sheet img").getAttribute("src"),/history\/10\//);
    }
    save(run+"-final-read.json",{version:g.visual.evidence[r].version,revision:r,asset:b.asset,reason:b.reason,actionsSubmitted:0});
  }else if(personal){
    const choices=await page.locator("[data-action]").count();
    assert.ok(choices>0);assert.equal(choices,g.current.actions.length);
    save("personal-entry.json",{scope:g.scope,revision:g.current.revision,buttons:choices,browser:browser.version(),actionClicks:0});
  }else{
    const route=matrix[run].map(x=>x.startsWith("parent ferry")?"return-to-location":x);
    const max=run==="B"&&phase==="walk"?7:route.length;
    if(phase==="resume"){
      assert.equal(run,"B");assert.equal(g.current.revision,7);
      assert.deepEqual(g,JSON.parse(readFileSync(new URL("B-before.json",ev))));
      save("B-after.json",g);assert.equal(g.visual.enabled,false);
      await page.locator("#toggle").click();await page.waitForFunction(()=>document.querySelector("#toggle").getAttribute("aria-pressed")==="true");
    }
    const expected={A:["I03",null],B:[null,"I01",null,null,"I02","I02","I02","I03",null,"I03"],C:[null,"I02",null,null]}[run];
    const first=phase==="resume"?8:1;
    for(let r=first;r<=max;r++){
      const out=run+r+".json";
      if(g.current.revision>=r && existsSync(new URL(out,ev))){
        const archived=JSON.parse(readFileSync(new URL(out,ev)));
        assert.equal(archived.h.canonicalReceiptSha,g.history[r-1].canonicalReceiptSha);continue;
      }
      if(g.current.revision===r-1){
        const wait=page.waitForResponse(x=>x.url().endsWith("/act")&&x.request().method()==="POST");
        await page.locator('[data-action="'+route[r-1]+'"]').click();
        const resp=await wait;assert.equal(resp.status(),200,await resp.text());
      }else assert.equal(g.current.revision,r,"resume only from persisted revision");
      await page.waitForFunction(r=>document.querySelector("#where").textContent.includes("第 "+r+" 回合"),r);
      g=await game();const h=g.history.at(-1),b=get("picture:"+g.scope+":"+r);
      assert.equal(r,g.current.revision);assert.equal(hash(await page.locator("#text").textContent()),h.bodySha);
      const snapshot={h,b,expected:expected[r-1],browser:browser.version()};
      const actual=b.asset;
      if(actual){
        await page.locator("#sheet img").waitFor();
        const img=page.locator("#sheet img");
        const bytes=await (await context.request.get(await img.getAttribute("src").then(src=>"http://127.0.0.1:"+cfg.httpPort+src))).body();
        assert.equal(hash(bytes),catalog.assets[actual].sha256);
        snapshot.decoded=await img.evaluate(async i=>{await i.decode();return [i.naturalWidth,i.naturalHeight,i.getBoundingClientRect().width]});
        assert.ok(snapshot.decoded[2]>0);
        for(let i=0;i<50&&!get("shown:"+b.key+":current");i++)await page.waitForTimeout(40);
        snapshot.shown=get("shown:"+b.key+":current");assert.ok(snapshot.shown);
        if(run==="B" && [2,5,7,8,10].includes(r))await page.screenshot({path:fileURLToPath(new URL(run+r+".png",ev))});
      }else assert.equal(await page.locator("#sheet img").count(),0);
      save(out,snapshot);
      assert.equal(actual,expected[r-1],JSON.stringify(snapshot));
      if(run==="B" && [6,7].includes(r)){assert.equal(b.sourceRevision,5);assert.equal(snapshot.shown.state,"retained")}
      if(run==="A" && r===2)assert.equal(h.sceneEvidence.outcome,"legal_failure");
      if(run==="C" && r===4)assert.match(b.reason,/冲突/);
      if(run==="B" && r===10){
        assert.equal(snapshot.shown.state,"reused");
        await page.locator('[data-rev="10"]').click();await page.locator("#sheet img").waitFor();
        const src=await page.locator("#sheet img").getAttribute("src");assert.match(src,/history\/10\//);
        for(const [path,status] of [[src,200],[src.replace("/10/","/11/"),404],[src.replace("/10/","/010/"),404],[src.replace("/10/","/9007199254740992/"),404],
          ["/pictures/current/8/"+g.visual.frames[8].key,409],["/pictures/history/2/"+g.visual.frames[8].key,404]]){
          assert.equal((await context.request.get("http://127.0.0.1:"+cfg.httpPort+path)).status(),status);
        }
        await page.locator('[data-rev="9"]').click();assert.ok(await page.locator("#text").isVisible());assert.equal(await page.locator("#sheet img").count(),0);
        save("history-controls.json",{revision:10,historyImageDecoded:true,r9Text:true,future:404,leadingZero:404,unsafeInteger:404,lateCurrent:409,wrongBinding:404});
      }
    }
    if(run==="B" && phase==="walk"){
      await page.locator("#toggle").click();await page.waitForFunction(()=>document.querySelector("#toggle").getAttribute("aria-pressed")==="false");
      save("B-before.json",await game());
    }
  }
  console.log(run,phase,"PASS",g.current.revision,browser.version());
}finally{await browser.close();db.close()}
