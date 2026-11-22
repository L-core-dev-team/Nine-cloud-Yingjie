import assert from "node:assert/strict";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {readFile,rm} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {fresh,admin,stop,upstream} from "../local-demo/cluster.mjs";
import {extractContinuity} from "../first-play/continuity.mjs";
import {syncCardHistory} from "../scene-state/index.mjs";
import {digest} from "../provider-readiness/reservations.mjs";
import {action,prepare,cardModel,endpoint} from "./adapter.mjs";
import {reply} from "./test/fake.mjs";

export async function journey({live,ledger,key,takeKey,gate,cancelSignal,pilot}) {
  const requestAction=pilot?.action??action,prepareRequest=pilot?.prepare??prepare;
  const extractor=pilot?.extract??extractContinuity;
  const {dir,state}=await fresh();
  process.env.YJ13_CLUSTER=dir;
  let cardDb,projection;
  let imageSends=0,fakeSends=0;
  try {
    const {statePool,requireApi}=await import("../scene-state/test/local-db.mjs");
    const {withHost}=await import("../ui-shell/test/host.mjs");
    const {createPlayers}=await import("../ui-shell/test/player.mjs");
    const {createCardEgressFetch}=await import(pathToFileURL(join(upstream,"apps/api/dist/card-import/provider-egress.js")));
    const policy={allowedHosts:["api.openai.com"]};
    const send=live?createCardEgressFetch(policy):createCardEgressFetch(policy,
      async host=>{assert.equal(host,"api.openai.com");return [{family:4,address:"1.2.3.4"}];},
      async (url,init,address)=>{
        assert.equal(url.href,endpoint);assert.equal(address,"1.2.3.4");
        assert.equal(init.body,prepareRequest({action:requestAction}).body);
        fakeSends++;return Response.json(pilot?.fakeReply?.()??reply());
      });
    const model=cardModel({ledger,transport:send,key,takeKey,gate,cancelSignal,prepareRequest,hashResponseId:Boolean(pilot),mark:pilot?.mark});
    const provider={capability:{schemaVersion:"0.1",entry:"luna-no-images",origin:"mock",
      verifiedAt:"2026-11-21T00:00:00Z",generate:"unknown",referenceEdit:"unknown",query:"unknown",cancel:"unknown",idempotency:"unknown"},
      async send(){imageSends++;throw Error("NO_IMAGE_PERMISSION");}};
    // Keep both databases on disk after a live attempt. No image dispatch routes are entered.
    const dbName="yj04_test_"+randomUUID().replaceAll("-","");
    cardDb=admin(state);
    await cardDb.query("CREATE DATABASE "+dbName);
    projection=statePool(dbName);
    await projection.query(await readFile(new URL("../scene-state/schema.sql",import.meta.url),"utf8"));
    let evidence;
    await withHost(projection,async({origin,codes})=>{
      const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
      try {
        const context=await browser.newContext({serviceWorkers:"block"});
        await context.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
        const {first}=await createPlayers(context,origin,codes);
        const request=async(path,options={})=>{
          const r=await context.request.get(origin+path,{headers:options.headers,maxRedirects:0});
          return new Response(await r.body(),{status:r.status()});
        };
        const base="/api/card-import/sessions/"+first;
        const owner=(await (await request("/api/auth/session")).json()).account.id;
        const {owner_id,revision}=await (await request(base)).json();
        assert.equal(owner_id,owner);assert.equal(revision,0);
        const sync=()=>syncCardHistory({pool:projection,request,sessionId:first,
          signal:new AbortController().signal,extract:extractor});
        assert.equal((await sync()).revision,0);
        const page=await context.newPage();page.setDefaultTimeout(15000);
        await page.goto(origin+"/cards/session/"+first);
        let bound;
        // Bind the original UI key only on this trusted browser's first approved action.
        let forwarded=0;
        await page.route(origin+base+"/actions",async route=>{
          const req=route.request(),data=req.postDataJSON();
          if(req.method()!=="POST" || data.action!==requestAction || data.expectedRevision!==0 || forwarded) return route.abort();
          bound={owner,sessionId:first,key:data.idempotencyKey};
          try{gate?.();ledger.arm(bound,prepareRequest({action:requestAction}));}catch{return route.abort();}
          forwarded++;
          return route.continue();
        });
        const response=page.waitForResponse(r=>r.url()===origin+base+"/actions" && r.request().method()==="POST",{timeout:75000});
        await page.getByRole("textbox",{name:"角色卡行动"}).fill(requestAction);
        await page.getByRole("button",{name:"提交行动"}).click();
        const result=await response;
        assert.equal(forwarded,1);assert.equal(result.status(),200);
        if(ledger.snapshot()?.state!=="ACKNOWLEDGED") throw Error("PROVIDER_STOP");
        const history=await (await request(base+"/history?after=0")).json();
        assert.equal(history.length,1);const [h]=history;
        assert.equal(h.key,bound.key);assert.equal(h.action,requestAction);assert.equal(h.resulting_revision,1);
        const rows=(await cardDb.query(`SELECT r.key,r.action,r.status,r.narrative,r.resulting_revision,s.revision
          FROM card_import.requests r JOIN card_import.sessions s ON s.id=r.session_id AND s.owner_id=r.owner_id
          WHERE r.owner_id=$1 AND r.session_id=$2`,[owner,first])).rows;
        assert.equal(rows.length,1);const [row]=rows;
        assert.equal(row.key,bound.key);assert.equal(row.status,"completed");assert.equal(row.revision,1);
        assert.equal(row.action,requestAction);assert.equal(fakeSends,live?0:1);
        assert.equal(row.resulting_revision,1);assert.equal(digest(row.narrative),digest(h.narrative));
        assert.equal(digest(h.narrative),ledger.snapshot().bodySha256);
        pilot?.mark?.("history-committed");
        const saved=await sync();
        assert.equal(saved.applied,1);assert.equal(saved.revision,1);
        assert.ok(["ready","not-ready"].includes(saved.result.status));
        const events=(await projection.query("SELECT raw_text_hash,source FROM yingjie_scene.event")).rows;
        assert.equal(events.length,1);assert.equal(events[0].raw_text_hash,digest(h.narrative));
        assert.equal(events[0].source.evidence,"completed-history");assert.equal(events[0].source.key,bound.key);
        const images=(await projection.query(`SELECT (SELECT count(*)::int FROM yingjie_image.task) AS tasks,
          (SELECT count(*)::int FROM yingjie_image.attempt) AS attempts`)).rows[0];
        assert.deepEqual(images,{tasks:0,attempts:0});assert.equal(imageSends,0);
        evidence={browser:browser.version(),node:process.version,actionPosts:forwarded,fakeSends,
          cardStatus:row.status,revision:row.revision,bodySha256:digest(h.narrative),source:events[0].source.evidence,
          ...(pilot?{scene:await pilot.inspectSaved(projection,h,events[0].source)}:{}),sourceMatchesPostgres:true,extraction:saved.result.status,imageTasks:images.tasks,imageAttempts:images.attempts,imageSends};
        pilot?.mark?.("scene-reviewed");
      }finally{await browser.close();}
    },{assets:[]},{model,provider,extractor});
    return evidence;
  }finally{
    try{await projection?.end();await cardDb?.end();}finally{
      stop(dir);if(!live)await rm(dir,{recursive:true,force:true});
    }
  }
}
