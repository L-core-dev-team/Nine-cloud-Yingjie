import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { once } from "node:events";
import { upstream, requireApi, cardRuntime, withDatabase } from "./local-db.mjs";
import { hash } from "../store.mjs";
import { syncCardHistory } from "../index.mjs";

const load = path => import(pathToFileURL(join(upstream,"apps/api/dist",path)));
test("saved ordinary card history via authenticated loopback HTTP and separate PostgreSQL state", async t => {
  const { createApp } = await load("app.js");
  const { EmailAuthService } = await load("services/email-auth.js");
  const { PostgresEmailAuthRepository } = await load("services/postgres-email-auth.js");
  const { localCardOptions } = await load("card-import/local-runtime.js");
  const runtime = cardRuntime();
  // Synthetic verification code sink scoped to this test; no credential is printed.
  let code;
  const auth = new EmailAuthService(new PostgresEmailAuthRepository(runtime.pool,runtime.secret),
    async (_email,value) => { code=value; },runtime.secret);
  const cards = localCardOptions(runtime.pool,{NODE_ENV:"test",CARD_LOCAL_MODE:"synthetic",
    DATABASE_URL:"postgresql://127.0.0.1/jiuxiao_test_cards_demo"});
  const entered = Promise.withResolvers(), release = Promise.withResolvers();
  const synthetic = cards.model;
  cards.model = async (...args) => { entered.resolve(); await release.promise; return synthetic(...args); };
  const origin = "http://127.0.0.1";
  const app = createApp(undefined,undefined,{service:auth,origin},undefined,cards);
  const server = requireApi("@hono/node-server").serve({ hostname:"127.0.0.1",port:0,fetch:app.fetch });
  try {
    await once(server,"listening");
    const base = origin + ":" + server.address().port;
    let cookie = "";
    const request = (path, opts = {}) => fetch(base+path,{...opts,redirect:"error",
      headers:{Origin:origin,Cookie:cookie,...opts.headers}});
    async function post(path, data) {
      const r = await request(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
      assert.ok(r.ok, path+" HTTP "+r.status);
      if (r.headers.has("set-cookie")) cookie=r.headers.get("set-cookie").split(";")[0];
      return r.json();
    }
    async function login() {
      const email="yj04-"+randomUUID()+"@example.invalid";
      await post("/api/auth/code",{email});
      await post("/api/auth/verify",{email,code});
    }
    await login();
    const prefix="/api/card-import";
    const preview=await post(prefix+"/imports",{kind:"card",filename:"cards-demo.json",rightsConfirmed:true,
      bytesBase64:readFileSync(join(upstream,"docs/examples/cards-demo.json")).toString("base64")});
    const card=await post(prefix+"/cards",{importId:preview.id,source:"local-test",notes:"YJ-04 fixture",links:[]});
    const sessionId=randomUUID();
    await post(prefix+"/sessions",{id:sessionId,cardId:card.id});
    await withDatabase(async pool => {
      const options={ pool,request,sessionId,signal:new AbortController().signal };
      assert.equal((await syncCardHistory(options)).revision,0);
      const copy=await post(prefix+"/cards/duplicates",{strategy:"copy",importId:preview.id,idempotencyKey:randomUUID()});
      const groupId=randomUUID();
      await post(prefix+"/group-sessions",{id:groupId,cardIds:[card.id,copy.cardId]});
      await assert.rejects(syncCardHistory({...options,sessionId:groupId}),/group-not-adapted/);
      const actionKey=randomUUID();
      const action=post(prefix+"/sessions/"+sessionId+"/actions",{action:"查看周围",expectedRevision:0,idempotencyKey:actionKey});
      try {
        await Promise.race([entered.promise,action.then(()=>{throw Error("missing-pending-window");})]);
        const pendingPage=await request(prefix+"/sessions/"+sessionId+"/history?after=0");
        assert.deepEqual(await pendingPage.json(),[]);
        assert.equal((await syncCardHistory(options)).revision,0);
      } finally { release.resolve(); await action; }
      const saved=await syncCardHistory(options);
      assert.equal(saved.applied,1);
      assert.equal(saved.revision,1);
      assert.equal(saved.result.status,"not-ready");
      const {rows:[event]}=await pool.query("SELECT source, raw_text_hash FROM yingjie_scene.event");
      assert.equal(event.source.sessionId,sessionId);
      assert.equal(event.source.key,actionKey);
      assert.equal(event.source.kind,"card-history");
      assert.equal(event.raw_text_hash,hash("本地合成回复（非真实模型）"));
      assert.equal((await syncCardHistory(options)).applied,0);
      const originalCookie=cookie;
      await login();
      await assert.rejects(syncCardHistory(options),/session-inaccessible/);
      cookie=originalCookie;
      await post("/api/auth/logout",{});
      cookie=originalCookie;
      await assert.rejects(syncCardHistory(options),/account-inaccessible/);
      t.diagnostic(JSON.stringify({suite:"live-card",transport:"loopback-http",provider:"synthetic",pendingRows:0,
        completedRevision:saved.revision,applied:saved.applied,sceneStatus:saved.result.status,foreignOwner:"rejected",group:"rejected",revokedCookie:"rejected"}));
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await runtime.pool.end();
  }
});
