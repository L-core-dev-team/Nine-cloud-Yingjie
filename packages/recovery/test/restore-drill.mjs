// Offline rehearsal for a disposable projection created by withDatabase. Never export the account database.
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {join} from "node:path";
import {mkdtemp,mkdir,readFile,writeFile,rm,copyFile,unlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {withDatabase} from "../../scene-state/test/local-db.mjs";
import {Originals,sha256,pngInfo} from "../../image-tasks/files.mjs";
import {latest} from "../../scene-state/store.mjs";
import {ImageTasks} from "../../image-tasks/index.mjs";
import {ImageHistory} from "../../image-history/history.mjs";
import {WorldAssets} from "../../world-assets/index.mjs";
import {TavernProvider} from "../../image-tasks/demo.mjs";
import {assessFixture} from "../../image-tasks/fixture-review.mjs";

const tables=["scene.stream","scene.event","scene.conflict","play.choice","play.extraction","world.binding",
  "image.permit","image.task","image.attempt","image.asset","image.conflict","history.report","history.decision","history.review_event"].map(s=>"yingjie_"+s);
const exec=promisify(execFile);
async function pg(tool,pool,database,args){
  const opt=pool.options;
  if(!/^yj04_test_[a-f0-9]{32}$/.test(database)||opt.database!==database||opt.host!=="127.0.0.1")throw Error("disposable-local-projection-required");
  return exec(join(process.env.YJ_PG_CLIENT_BIN,tool+(process.platform==="win32"?".exe":"")),
    ["-h",opt.host,"-p",String(opt.port),"-U",opt.user,"--no-password","-d",database,...args],
    {windowsHide:true,env:{...process.env,PGPASSWORD:opt.password}});
}
async function inventory(db,files){
  const ledger={};
  for(const table of tables){
    const {rows}=await db.query("SELECT to_jsonb(t)::text AS item FROM "+table+' t ORDER BY to_jsonb(t)::text COLLATE "C"');
    ledger[table]={count:rows.length,digest:sha256(Buffer.from(JSON.stringify(rows.map(r=>r.item))))};
  }
  const sequence=(await db.query("SELECT last_value,is_called FROM yingjie_history.review_event_seq_seq")).rows[0];
  const triggers=(await db.query("SELECT tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('yingjie_image'::regnamespace,'yingjie_history'::regnamespace)) ORDER BY tgname")).rows;
  const originals={};
  for(const {record:a} of (await db.query("SELECT record FROM yingjie_image.asset ORDER BY id")).rows){
    const bytes=await files.read(a.storageKey,a.sha256);if(!bytes)throw Error("missing-or-corrupt-original");
    const {width,height,format}=pngInfo(bytes);
    if(a.width!==width || a.height!==height || a.format!==format)throw Error("wrong-original-metadata");
    originals[a.sha256]??={width,height,format,references:0};
    originals[a.sha256].references++;
  }
  return {ledger,sequence,triggers,originals,schemaVersion:"0.1",contract:"0.1.1"};
}
async function verify(db,files,expected){
  const actual=await inventory(db,files);
  for(const table of tables)if(actual.ledger[table].digest!==expected.ledger[table].digest)throw Error("ledger-mismatch:"+table);
  assert.deepEqual(actual,expected);
}
export async function restoreDrill({pool,database,tasks,world,scope,wrongId,originalId,unknownRevision,journeyRevision}){
  const temp=await mkdtemp(join(tmpdir(),"yj12-synthetic-")),archive=join(temp,"projection.dump"),manifest=join(temp,"manifest.json");
  const saved=join(temp,"originals"),restored=new Originals(join(temp,"restored"));
  try{
    await mkdir(saved);await mkdir(restored.root);
    // Caller closed the browser and awaited all mock receivers before this point. No file writers remain.
    const db=await pool.connect();
    try{
      await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await db.query("LOCK TABLE "+tables.join(",")+" IN SHARE MODE");
      const leftovers=await tasks.files.audit(db);
      assert.deepEqual(leftovers,{broken:[],unreferenced:[]});
      const expected=await inventory(db,tasks.files);
      await pg("pg_dump",pool,database,["--format=custom","--no-owner","--no-privileges","-f",archive]);
      for(const digest of Object.keys(expected.originals))await copyFile(join(tasks.files.root,digest+".png"),join(saved,digest+".png"));
      await verify(db,new Originals(saved),expected);
      await writeFile(manifest,JSON.stringify({expected,archiveSha:sha256(await readFile(archive))}));
      await db.query("COMMIT");
    }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
    const {expected,archiveSha}=JSON.parse(await readFile(manifest,"utf8"));
    if(archiveSha!==sha256(await readFile(archive)))throw Error("archive-mismatch");
    return await withDatabase(async(restorePool,newName)=>{
      const keys=Object.keys(expected.originals),file=join(restored.root,keys[0]+".png");
      await copyFile(join(saved,keys[0]+".png"),file);
      const partial=join(temp,"truncated.dump");
      await writeFile(partial,(await readFile(archive)).subarray(0,32));
      await assert.rejects(pg("pg_restore",restorePool,newName,["--single-transaction","--no-owner",partial]),e=>Number(e.code)>0);
      await assert.rejects(verify(restorePool,restored,expected),e=>e.code==="42P01");
      await unlink(file);await pg("pg_restore",restorePool,newName,["--single-transaction","--no-owner","--no-privileges",archive]);
      await assert.rejects(verify(restorePool,restored,expected),/missing-or-corrupt-original/);
      for(const digest of keys)await copyFile(join(saved,digest+".png"),join(restored.root,digest+".png"));
      await writeFile(file,"synthetic corruption");await assert.rejects(verify(restorePool,restored,expected),/missing-or-corrupt-original/);
      await copyFile(join(saved,keys[0]+".png"),file);
      const client=await restorePool.connect();
      try{
        for(const [table,sql] of [["world.binding","DELETE FROM yingjie_world.binding"],
          ["history.review_event","TRUNCATE yingjie_history.review_event"]]){
          await client.query("BEGIN");
          try{await client.query(sql);await assert.rejects(verify(client,restored,expected),new RegExp("ledger-mismatch:yingjie_"+table));}
          finally{await client.query("ROLLBACK");}
        }
        // Activation gate: all checks pass before exposing even a read-only view. No worker is mounted.
        await verify(client,restored,expected);
      }finally{client.release();}
      const provider=new TavernProvider(),reader=new ImageHistory(new ImageTasks(restorePool,restored,provider,{assess:assessFixture}),
        new WorldAssets(world.cards,restorePool,world.selectEntries,world.storage));
      const ctx={scope,authorized:true,...await latest(restorePool,scope)};
      let sharedReferences;
      if(journeyRevision){
        assert.equal(ctx.revision,journeyRevision);
        const originals=Object.values(expected.originals);
        sharedReferences=Math.max(...originals.map(item=>item.references));
        assert.ok(sharedReferences>=2);
        assert.ok(ctx.result.visual==null);
      }else{
        const first=(await reader.detail(ctx,1)).media[0],wrong=(await reader.detail(ctx,2)).media[0];
        assert.equal(first.id,originalId);assert.equal(first.readable,true);assert.equal(wrong.id,wrongId);
        assert.equal(first.sha256,wrong.sha256);assert.equal(wrong.status,"invalidated");assert.equal(wrong.readable,false);
        sharedReferences=expected.originals[first.sha256].references;
      }
      const pending=await reader.detail(ctx,unknownRevision);
      assert.equal(pending.attempts.at(-1).outcome,"unknown");assert.equal(provider.calls,0);
      return {tables:tables.length,counts:Object.fromEntries(Object.entries(expected.ledger).map(([k,v])=>[k,v.count])),
        archiveDigestVerified:true,sharedReferences,revision:ctx.revision,
        version:ctx.result.visual?.visualVersion??null,unknown:"retained",faults:["truncated-dump","files-only","database-only","corrupt-original","missing-grant","missing-review-event"],
        readOnly:true,restoredSends:provider.calls};
    },{empty:true});
  }finally{await rm(temp,{recursive:true,force:true});}
}
