import {createRequire} from "node:module";
import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||"playwright");
const url=process.argv[3]?pathToFileURL(process.argv[3]).href:new URL("../dist/index.html",import.meta.url).href;
const out=process.argv[2];if(out)await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.CHROME_PATH});
try{
    const results=[];
    for(const [width,height] of [[1280,850],[390,844]]){
        const ctx=await browser.newContext({viewport:{width,height},offline:true,serviceWorkers:"block"});
        const page=await ctx.newPage(),requests=[],errors=[];
        page.on("request",r=>requests.push(r.url()));page.on("pageerror",e=>errors.push(e.name));
        await page.addInitScript(()=>{window.violations=[];document.addEventListener("securitypolicyviolation",e=>window.violations.push(e.violatedDirective));});
        await page.goto(url);
        const at=id=>page.locator("#"+id);
        const label=()=>at("place").textContent();
        assert.equal(await label(),"芦花渡");
        await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>document.activeElement.id),"next");
        await page.keyboard.press("Enter");assert.equal(await label(),"望气台");
        assert.equal(await at("history-count").textContent(),"0 笔");
        await at("toggle").click();await at("next").click();assert.ok(await at("plate").isHidden());
        assert.equal(await label(),"望气台");assert.match(await at("action").textContent(),/受阻/);
        await at("toggle").click();await at("next").click();assert.equal(await at("history-count").textContent(),"0 笔");
        await at("next").click();assert.match(await at("entries").textContent(),/R1.*芦花渡.*望气台.*R3/);
        await at("prev").click();assert.equal(await at("history-count").textContent(),"0 笔");
        await page.getByRole("button",{name:"跳到回放节点 8",exact:true}).click();
        assert.equal(await label(),"芦花渡");assert.equal(await at("plate-name").textContent(),"芦花渡");
        await page.keyboard.press("ArrowRight");assert.equal(await label(),"芦花渡");
        assert.match(await at("note").textContent(),/旧记录的目的地是望气台/);
        await at("evidence").locator("summary").click();assert.match(await at("fields").textContent(),/尚未确认/);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        if(out)await page.screenshot({path:join(out,"scene-"+width+".png"),fullPage:true});
        await at("next").click();assert.equal(await label(),"望气台");assert.equal(await at("history-count").textContent(),"2 笔");
        await at("next").click();assert.ok(await at("plate").isHidden());assert.equal(await at("entries").textContent(),"行程已隐藏。");
        await at("reset").click();assert.equal(await label(),"芦花渡");assert.equal(await at("history-count").textContent(),"0 笔");
        assert.equal(await at("toggle").getAttribute("aria-checked"),"true");
        assert.deepEqual(requests,[url]);assert.deepEqual(errors,[]);
        const policy=await page.evaluate(()=>window.violations);
        assert.deepEqual(policy,[]);
        const storage=await page.evaluate(()=>[localStorage.length,sessionStorage.length]);
        assert.deepEqual(storage,[0,0]);
        results.push({width,height,scheme:"file:",offline:true,requests:1,external:0,errors,policy,storage,
            switches:true,blocked:true,learnedAtR3:true,lateReadCurrentPreserved:true,revoked:true,keyboard:true,overflow:false});
        await ctx.close();
    }
    console.log(JSON.stringify({browser:browser.version(),results}));
}finally{await browser.close();}
