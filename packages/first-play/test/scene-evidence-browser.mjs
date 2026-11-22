// Run from the repo root with the four documented runtime paths. No provider credentials.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile,rm,writeFile} from "node:fs/promises";
import {fresh,stop,admin} from "../../local-demo/cluster.mjs";
import {cardScope,hash} from "../../scene-state/store.mjs";
import {sameVisual} from "../../contracts/dist/index.js";
import {replayHistory} from "../replay.mjs";
import {extractSceneEvidence as extract} from "../scene-evidence.mjs";
import {walkthrough} from "../story.mjs";
import {east,tower,prose,rejected} from "./scene-evidence-fixtures.mjs";

const output=process.argv[2];
if (!output) throw Error("usage: node packages/first-play/test/scene-evidence-browser.mjs NEW-RECEIPT.json");
const {dir,state}=await fresh();
process.env.YJ13_CLUSTER=dir;
const cardDb=admin(state);
try {
  const {requireApi,withDatabase}=await import("../../scene-state/test/local-db.mjs");
  const {withHost}=await import("../../ui-shell/test/host.mjs");
  const {createPlayers}=await import("../../ui-shell/test/player.mjs");
  const report={status:"OFFLINE_PASS",node:process.version,steps:[],negativeCases:[],imageSends:0,
    realTextCalls:0,realImageCalls:0,additionalUsd:0};
  let nextBody=null,fakeCompletions=0;
  const model=async()=>{
    assert.ok(nextBody,"unexpected synthetic request");
    const text=nextBody;nextBody=null;fakeCompletions++;return text;
  };
  const provider={capability:{schemaVersion:"0.1",entry:"l3-disabled",origin:"mock",verifiedAt:"2026-11-22T00:00:00Z",
    generate:"unknown",referenceEdit:"unknown",query:"unknown",cancel:"unknown",idempotency:"unknown"},
    async send(){report.imageSends++;throw Error("images-disabled");}};
  await withDatabase(pool=>withHost(pool,async({origin,codes})=>{
    const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
    report.chrome=browser.version();
    try {
      async function player(){
        const context=await browser.newContext({serviceWorkers:"block"});
        await context.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
        const ids=await createPlayers(context,origin,codes);
        const page=await context.newPage();page.setDefaultTimeout(15000);
        const get=async(path,opts={})=>{
          const res=await context.request.get(origin+path,{headers:opts.headers,maxRedirects:0});
          return new Response(await res.body(),{status:res.status()});
        };
        const owner=(await (await get("/api/auth/session")).json()).account.id;
        return {...ids,context,page,get,owner};
      }
      const a=await player(), b=await player();
      const replay=(p,id,db=pool)=>replayHistory({pool:db,request:p.get,sessionId:id,signal:new AbortController().signal,extract});
      async function save(p,id,revision,text){
        const path="/api/card-import/sessions/"+id;
        if(!p.page.url().endsWith("/"+id))await p.page.goto(origin+"/cards/session/"+id);
        nextBody=text;
        const completed=p.page.waitForResponse(r=>r.request().method()==="POST" && r.url()===origin+path+"/actions");
        // Deliberately assert a location in the action even when missing from the saved reply.
        await p.page.getByRole("textbox",{name:"角色卡行动"}).fill("我声称自己在东村的青石酒馆");
        await p.page.getByRole("button",{name:"提交行动"}).click();
        assert.equal((await completed).status(),200);
        await p.page.getByText("独立会话 · 修订 "+revision,{exact:true}).waitFor();
        const h=await (await p.get(path+"/history?after="+(revision-1))).json();
        assert.equal(h.length,1);assert.equal(h[0].narrative,text);assert.equal(h[0].resulting_revision,revision);
        const row=(await cardDb.query("SELECT status,narrative,key FROM card_import.requests WHERE owner_id=$1 AND session_id=$2 AND resulting_revision=$3",
          [p.owner,id,revision])).rows;
        assert.equal(row.length,1);assert.equal(row[0].status,"completed");assert.equal(row[0].key,h[0].key);
        assert.equal(row[0].narrative,text);
        const sync=await replay(p,id);assert.equal(sync.applied,1);assert.equal(sync.revision,revision);
        const event=(await pool.query("SELECT raw_text_hash,source,result,audit FROM yingjie_scene.event JOIN yingjie_play.extraction USING(scope,revision) WHERE scope=$1 AND revision=$2",
          [cardScope(p.owner,id),revision])).rows[0];
        assert.equal(event.raw_text_hash,hash(text));assert.deepEqual(event.audit.source,event.source);
        assert.equal(event.source.key,h[0].key);assert.equal(event.source.ownerId,p.owner);assert.equal(event.source.sessionId,id);
        assert.equal(event.source.evidence,"completed-history");assert.equal(event.audit.replayOnly,true);
        assert.equal(event.audit.narrativeSha256,hash(text));assert.deepEqual(event.result,sync.result);
        return event;
      }
      const route=[
        [prose(east),"ready","V1",3],[walkthrough[1],"ready","V1",3],[walkthrough[2],"ready","V2",5],
        [walkthrough[4],"not-ready",null,null],[walkthrough[5],"ready","V2",5],
        ["他出去了。","not-ready",null,null]
      ];
      let initial,last;
      for(const [i,[body,status,version,count]] of route.entries()){
        const event=await save(a,a.first,i+1,body), result=event.result;
        assert.equal(result.status,status);assert.equal(result.visual?.visualVersion??null,version);
        assert.equal(result.visual?.people.length??null,count);
        if(i===0){
          initial=result.visual;
          const {narrativeSha256,evidence,fields}=event.audit;
          report.initialAudit={narrativeSha256,evidence,fields};
        }
        if(i===1)assert.ok(sameVisual(initial,result.visual));
        if(i===2)last=result.visual;
        if(i===4)assert.ok(sameVisual(last,result.visual));
        report.steps.push({revision:i+1,status,scene:result.scene?.sceneId??null,version,count,reason:result.reason??null});
      }
      const west=(await save(a,a.second,1,prose(east.with(0,"你走进西村的青石酒馆")))).result;
      const other=(await save(b,b.first,1,prose(tower))).result;
      assert.equal(west.scene.sceneId,"west");assert.equal(other.scene.sceneId,"north-observatory");
      assert.equal(other.visual.people.length,2);assert.equal(sameVisual(initial,west.visual),false);
      const otherEast=(await save(b,b.second,1,prose(east))).result;
      assert.equal(sameVisual(initial,otherEast.visual),false);
      await assert.rejects(replay(b,a.first),/session-inaccessible/);

      for (const [label,text] of Object.entries(rejected)) {
        const id=randomUUID();
        const res=await b.context.request.post(origin+"/api/card-import/sessions",{headers:{Origin:origin},data:{id,cardId:b.cardId}});
        assert.ok(res.ok(),"create ordinary session: "+label);
        const event=await save(b,id,1,text);
        assert.equal(event.result.status,"not-ready",label);assert.equal(event.result.visual,undefined,label);
        assert.equal(event.result.scene,undefined,label);
        if(label==="partial"){
          const {narrativeSha256,evidence,fields}=event.audit;
          report.partialAudit={narrativeSha256,evidence,fields};
        }
        report.negativeCases.push({label,status:event.result.status,blockers:event.audit.blockers});
      }
      // Rebuild from authenticated history into a second blank projection and compare every revision.
      await withDatabase(async shadow=>{
        await shadow.query(await readFile(new URL("../../image-tasks/schema.sql",import.meta.url),"utf8"));
        await shadow.query(await readFile(new URL("../schema.sql",import.meta.url),"utf8"));
        const rebuilt=await replay(a,a.first,shadow);assert.equal(rebuilt.applied,route.length);
        assert.equal((await replay(a,a.first,shadow)).applied,0);
        const journal=async db=>(await db.query("SELECT revision,raw_text_hash,result,audit FROM yingjie_scene.event JOIN yingjie_play.extraction USING(scope,revision) WHERE scope=$1 ORDER BY revision",
          [cardScope(a.owner,a.first)])).rows;
        assert.deepEqual(await journal(shadow),await journal(pool));
      });
      const counts=(await pool.query("SELECT (SELECT count(*)::int FROM yingjie_image.task) AS tasks,(SELECT count(*)::int FROM yingjie_image.attempt) AS attempts")).rows[0];
      assert.deepEqual(counts,{tasks:0,attempts:0});assert.equal(report.imageSends,0);
      assert.equal(fakeCompletions,route.length+3+Object.keys(rejected).length);
      Object.assign(report,{imageTasks:counts.tasks,imageAttempts:counts.attempts,fakeCompletions,
        stableReplayRevisions:route.length,duplicateApplied:0,foreignAccountDenied:true,distinctSessions:true,
        completeScenes:["east","west","north-observatory"],historySource:"completed-history"});
    } finally {await browser.close();}
  },{assets:[]},{model,provider,extractor:extract}));
  await writeFile(output,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
  console.log("OFFLINE_PASS",report.fakeCompletions,"completed turns");
} finally {
  await cardDb.end();stop(dir);await rm(dir,{recursive:true,force:true});
}
