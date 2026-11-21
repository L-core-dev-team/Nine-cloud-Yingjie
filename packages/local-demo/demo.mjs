import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {readFile,writeFile,realpath,access,cp,lstat,mkdtemp,open,unlink} from "node:fs/promises";
import {join,resolve,basename,dirname} from "node:path";
import {tmpdir} from "node:os";
import {fresh,admin,start,stop,upstream} from "./cluster.mjs";
import {catalog} from "../world-assets/index.mjs";
import {Originals} from "../image-tasks/files.mjs";
import {extractContinuity} from "../first-play/continuity.mjs";
import {walkthroughModel} from "../first-play/story.mjs";

const [mode,location,probe]=process.argv.slice(2);
if (!(mode==="init"&&!location||mode==="snapshot"&&location&&!probe||mode==="open"&&location&&(!probe||["--smoke","--advance","--diagnose"].includes(probe))))
  throw Error("usage: demo.mjs init | open PRIVATE_DIRECTORY [--diagnose] | snapshot PRIVATE_DIRECTORY");
await access(join(upstream,"apps/api/dist/app.js"));
await access(process.env.CHROME_PATH);
for(const a of catalog){
  const bytes=await readFile(new URL("../../docs/reports/evidence/"+a.file,import.meta.url));
  if(createHash("sha256").update(bytes).digest("hex")!==a.reviewedSha256)throw Error("reviewed original SHA mismatch: "+a.id);
}
if(mode==="init"){
  const {dir,state}=await fresh();
  try{
    const database="yj04_test_"+randomUUID().replaceAll("-","");
    const pg=admin(state,"postgres");
    try{await pg.query("CREATE DATABASE "+database);}finally{await pg.end();}
    const pool=admin(state,database);
    try{await pool.query(await readFile(new URL("../scene-state/schema.sql",import.meta.url),"utf8"));}finally{await pool.end();}
    await writeFile(join(dir,"demo.json"),JSON.stringify({fixture:state.id,database}),{flag:"wx",mode:0o600});
  }finally{stop(dir);}
  console.log(dir);
}else{
  const dir=await realpath(resolve(location));
  if(dirname(dir)!==await realpath(tmpdir())||!/^yj13-demo-[\w-]+$/.test(basename(dir)))throw Error("expected the private directory printed by init");
  const state=JSON.parse(await readFile(join(dir,"state.json"),"utf8"));
  const meta=JSON.parse(await readFile(join(dir,"demo.json"),"utf8"));
  if(state.format!=="yj13-local-v1" || !state.installed || meta.fixture!==state.id || !/^yj04_test_[a-f0-9]{32}$/.test(meta.database))throw Error("demo identity mismatch");
  const lockPath=join(dir,"demo.lock");
  const lease=await open(lockPath,"wx",0o600);
  try{
    if(mode==="snapshot"){
      const stopped=await lstat(join(dir,"postgres","postmaster.pid")).then(()=>false,e=>{if(e.code==="ENOENT")return true;throw e;});
      if(!stopped)throw Error("close the demo and verify PostgreSQL has stopped before snapshot");
      const target=await mkdtemp(join(tmpdir(),"yj13-demo-"));
      await cp(dir,target,{recursive:true,force:false,errorOnExist:true,filter:async path=>{
        if(path===lockPath)return false;
        if((await lstat(path)).isSymbolicLink())throw Error("unexpected link in demo directory");
        return true;
      }});
      console.log(target);
    }else{
      process.env.YJ13_CLUSTER=dir;
      const {requireApi,statePool}=await import("../scene-state/test/local-db.mjs");
      const {withHost}=await import("../ui-shell/test/host.mjs");
      const {createPlayers}=await import("../ui-shell/test/player.mjs");
      const {prepareTavern}=await import("../world-assets/test/tavern.mjs");
      start(dir,state); // pg_ctl refuses an existing server, including another demo writer
      const pool=statePool(meta.database),originals=join(dir,"originals");
      try{
        const actual=(await pool.query("SHOW data_directory")).rows[0].data_directory;
        assert.equal(await realpath(actual),await realpath(join(dir,"postgres")));
        if(meta.session)assert.deepEqual(await new Originals(originals).audit(pool),{broken:[],unreferenced:[]});
        await withHost(pool,async({origin,codes,tasks})=>{
          const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:Boolean(probe)});
          try{
            const cookieFile=join(dir,"browser.json");
            const context=await browser.newContext(meta.session?{storageState:cookieFile}:{});
            if(!meta.session && probe==="--diagnose")throw Error("open the demo once before requesting a history diagnostic");
            if(!meta.session){
              const {cardId}=await createPlayers(context,origin,codes);
              const tavern=await prepareTavern(context,origin,pool,cardId);
              meta.session=tavern.id;meta.scope=tavern.scope;
              await writeFile(cookieFile,JSON.stringify(await context.storageState()),{mode:0o600});
              await writeFile(join(dir,"demo.json"),JSON.stringify(meta),{mode:0o600});
            }
            const history=async()=>{
              const r=await context.request.get(origin+"/api/card-import/sessions/"+meta.session+"/history?after=0");
              if(r.status()!==200)throw Error("saved synthetic session inaccessible: HTTP "+r.status());
              return r.json();
            };
            const before=await history();
            if(probe==="--diagnose"){
              const result={completed:before.length,counts:{}};
              for(const table of ["scene.event","image.task","image.attempt","image.asset","history.review_event"])
                result.counts[table]=(await pool.query("SELECT count(*)::int AS n FROM yingjie_"+table)).rows[0].n;
              await writeFile(join(dir,"diagnostic.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
              return;
            }
            const page=await context.newPage();
            await page.goto(origin+"/cards/session/"+meta.session);
            console.log("本地模拟样例 · 合成正文与已审酒馆图。关闭标签页可停写并保留历史。\n"+page.url());
            await page.getByRole("button",{name:"进入映界"}).click();
            await page.locator(".yj-figure").waitFor();
            if(probe){
              if(!before.length||probe==="--advance"){
                await page.getByRole("textbox",{name:"角色卡行动"}).fill("进入酒馆");
                await page.getByRole("button",{name:"提交行动"}).click();
              }
              const saved=probe==="--advance"?before.length+1:(before.length||1);
              await page.locator('.yj-figure[data-state="display"][data-revision="'+saved+'"] img').waitFor();
              await page.waitForFunction(()=>document.querySelector(".yj-figure img")?.naturalWidth>0);
              const after=await history();assert.equal(after.length,saved);
              if(before.length&&probe!=="--advance")assert.deepEqual(after,before);
              const detail={revision:saved,historyBefore:before.length,historyAfter:after.length,mockSends:tasks.provider.calls,
                digest:createHash("sha256").update(JSON.stringify(after.map(v=>v.narrative))).digest("hex"),browser:browser.version()};
              await writeFile(join(dir,"diagnostic.json"),JSON.stringify(detail,null,2)+"\n");
              console.log(JSON.stringify(detail));
            }else await page.waitForEvent("close",{timeout:0});
          }finally{await browser.close();}
        },{assets:catalog.slice(0,1)},{model:walkthroughModel,extractor:extractContinuity,originals});
      }finally{await pool.end();stop(dir);}
    }
  }finally{await lease.close();await unlink(lockPath);}
}
