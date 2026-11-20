import assert from "node:assert/strict";
import { test } from "node:test";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { withDatabase } from "./local-db.mjs";
import { fixtureEvent, scope, scenes } from "./tavern.mjs";
import { consume, latest, checkpoint, cardScope, hash } from "../store.mjs";
import { syncCardHistory } from "../index.mjs";

const exec = promisify(execFile);
const worker = fileURLToPath(new URL("./worker.mjs",import.meta.url));
const child = async (db,mode,n=0) => (await exec(process.execPath,[worker,db,mode,String(n)],{windowsHide:true})).stdout.trim();

test("process death, concurrent replay, restart, aliases, missing facts and visual history",async t=>{
  await withDatabase(async(pool,db)=>{
    const apply = n => consume(pool,fixtureEvent(n),()=>scenes[n-1]);
    await child(db,"apply",1);
    assert.equal((await latest(pool,scope)).result.visual.people.length,3);
    await apply(2);
    assert.equal((await latest(pool,scope)).result.visual.visualVersion,"V1");
    await assert.rejects(child(db,"crash",3),e=>e.code===61);
    assert.equal(await checkpoint(pool,scope),2);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM yingjie_scene.event")).rows[0].n,2);
    const results=await Promise.all([child(db,"race",3),child(db,"race",3)]);
    assert.deepEqual(results.sort(),["applied","duplicate"]);
    assert.equal(await apply(1),"duplicate");
    const expected=[[4,"not-ready"],[5,"V2"],[6,"V3"],[7,"V3"],[8,"incomplete-visible-facts"],
      [9,"ambiguous-place"],[10,"V3"],[11,"V4"],[12,"V4"]];
    for(const [n,want] of expected) {
      assert.equal(await apply(n),"applied");
      const {result}=JSON.parse(await child(db,"read"));
      if (n===4) assert.equal(result.status,want);
      else assert.equal(result.visual?.visualVersion ?? result.reason,want);
      if (n===5 || n===6 || n===10) {
        assert.equal(result.scene.sceneId,"east");
        assert.equal(result.visual.people.length,5);
        assert.ok(!result.visual.features.includes("光点"));
      }
      if (n===7 || n===10) {
        assert.equal(result.scene.name,"老周的店");
        assert.deepEqual(result.scene.aliases,["青石酒馆"]);
      }
      if (n===8) assert.equal(result.scene.sceneId,"west");
      if (n>=11) assert.equal(result.visual.people.length,4);
    }
    const journal=(await pool.query("SELECT * FROM yingjie_scene.event WHERE scope=$1 ORDER BY revision",[scope])).rows;
    assert.deepEqual(journal.flatMap(row=>row.versions).map(v=>[v.previous,v.visual.visualVersion]),
      [[null,"V1"],[1,"V2"],[2,"V3"],[3,"V4"]]);
    const state=(await pool.query("SELECT state FROM yingjie_scene.stream WHERE scope=$1",[scope])).rows[0].state;
    const people=state.places.find(p=>p.scene.sceneId==="east").confirmed.people;
    assert.equal(people.find(p=>p.name==="掌柜").source.eventId,"stage-1");
    assert.equal(people.find(p=>p.name==="紫衣客").source.eventId,"stage-3");
    const first=fixtureEvent(1);
    assert.equal(journal[0].raw_text_hash,hash(first.rawNarrative));
    assert.equal(journal[0].normalized_text_hash,hash(first.rawNarrative.trim()));
    for(const input of [{...first,rawNarrative:first.rawNarrative.trim()},{...first,revision:13},
      {...first,source:{...first.source,eventId:"different"}}])
      assert.equal(await consume(pool,input,()=>[]),"event-conflict");
    assert.equal(await consume(pool,fixtureEvent(14),()=>[]),"revision-gap");
    assert.equal(await checkpoint(pool,scope),12);
    await assert.rejects(consume(pool,fixtureEvent(13),()=>null),/annotations-pending/);
    assert.equal(await checkpoint(pool,scope),12);
    assert.equal(await consume(pool,fixtureEvent(13),()=>[]),"applied");
    assert.equal((await pool.query("SELECT count(*)::int n FROM yingjie_scene.conflict")).rows[0].n,4);
    t.diagnostic(JSON.stringify({suite:"synthetic-tavern",db:(await pool.query("SHOW server_version")).rows[0].server_version,
      crashExit:61,checkpointAfterCrash:2,race:results,committedEvents:journal.length,
      versions:journal.flatMap(r=>r.versions).map(v=>v.visual.visualVersion),revisitPeople:journal[4].result.visual.people.length}));
  });
});

test("bounded 100-row pages, mid-page failure, checkpoint resume and stale access",async t=>{
  await withDatabase(async pool=>{
    const id=randomUUID(),owner="offline-pagination";
    const rows=Array.from({length:102},(_,i)=>({key:randomUUID(),action:"查看",narrative:"当地交谈",resulting_revision:i+1}));
    let limit=101, mode="ordinary", stale=false;
    const pages=[];
    const request=async(path,options)=>{
      if(path.endsWith("/auth/session")) return Response.json({account:{id:owner}});
      assert.equal(options.headers["x-jiuxiao-account"],owner);
      if(stale) return Response.json({}, {status:404});
      if(path.endsWith("/group")) return mode==="ordinary" ? Response.json({error:"NOT_GROUP_SESSION"},{status:409}) : Response.json([]);
      if(path.endsWith(id)) return Response.json({owner_id:owner,id,revision:limit});
      const after=Number(path.split("after=")[1]);
      pages.push(after);
      return Response.json(rows.slice(after,after+100));
    };
    const options={pool,sessionId:id.toUpperCase(),request,signal:new AbortController().signal};
    const outOfOrder=async(path,opts)=>{
      if(path.includes("after=")) return Response.json([rows[0],{...rows[0],key:randomUUID()}]);
      return request(path,opts);
    };
    await assert.rejects(syncCardHistory({...options,request:outOfOrder}),/unordered-history-page/);
    assert.equal(await checkpoint(pool,cardScope(owner,id)),0);
    rows[39].status="pending";
    await assert.rejects(syncCardHistory(options));
    assert.equal(await checkpoint(pool,cardScope(owner,id)),39);
    delete rows[39].status;
    assert.equal((await syncCardHistory(options)).revision,101);
    assert.deepEqual(pages,[0,39]);
    const other=randomUUID();
    const calls=[];
    const cleanRequest=async(path,opts)=>{
      if(path.endsWith(other)) return Response.json({owner_id:owner,id:other,revision:102});
      if(path.includes("after=")) calls.push(Number(path.split("after=")[1]));
      return request(path,opts);
    };
    await syncCardHistory({...options,sessionId:other,request:cleanRequest});
    assert.deepEqual(calls,[0,100]);
    assert.equal(await checkpoint(pool,cardScope(owner,id)),101);
    limit=100;
    await assert.rejects(syncCardHistory(options),/history-regressed/);
    limit=101;mode="group";
    await assert.rejects(syncCardHistory(options),/group-not-adapted/);
    mode="ordinary";
    const controller=new AbortController();
    const late=async(path,opts)=>{
      const response=await request(path,opts);
      if(path.includes("after=")) controller.abort();
      return response;
    };
    limit=102;
    await assert.rejects(syncCardHistory({...options,request:late,signal:controller.signal}),{name:"AbortError"});
    assert.equal(await checkpoint(pool,cardScope(owner,id)),101);
    const deleted=async(path,opts)=>{
      const response=await request(path,opts);
      if(path.includes("after=")) stale=true;
      return response;
    };
    await assert.rejects(syncCardHistory({...options,request:deleted}),/session-inaccessible/);
    await assert.rejects(syncCardHistory(options),/session-inaccessible/);
    t.diagnostic(JSON.stringify({suite:"synthetic-pagination",cleanCursors:calls,rows:102,checkpointAtFailure:39,abort:"rejected",deletedSession:"rejected"}));
  });
});
