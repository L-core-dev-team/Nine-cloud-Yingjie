import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {fork} from "node:child_process";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {Originals,sha256} from "../../image-tasks/files.mjs";
import {initialPng,editedPng} from "./s2-png.mjs";

const dir=await mkdtemp(join(tmpdir(),"s2-slice-")),files=new Originals(join(dir,"originals"));
const allowed=new Set([sha256(initialPng),sha256(editedPng)]);
try{
  const result=await new Promise((resolve,reject)=>{
    const worker=fork(fileURLToPath(new URL("s2-story-worker.mjs",import.meta.url)),[dir],{serialization:"advanced",windowsHide:true,
      execArgv:["--permission","--allow-fs-read="+fileURLToPath(new URL("../../../",import.meta.url)),"--allow-fs-read="+dir,"--allow-fs-write="+dir],
      env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:dir,TMP:dir},stdio:["ignore","ignore","inherit","ipc"]});
    const timeout=setTimeout(()=>{worker.kill();reject(Error("slice-timeout"));},45000);
    let report;
    worker.on("message",async m=>{
      try{
        if(m.save){assert.ok(Buffer.isBuffer(m.save) && allowed.has(sha256(m.save)));worker.send(await files.save(m.save));}
        else report=m.summary;
      }catch(error){worker.kill();reject(error);}
    });
    worker.once("error",reject);worker.once("exit",code=>{clearTimeout(timeout);
      if(code===0 && report)resolve(report);else reject(Error("slice-exit-"+code));});
  });
  const db=new DatabaseSync(join(dir,"story.sqlite"),{readOnly:true});
  try{
    const held=db.prepare("SELECT COUNT(*) n,SUM(micro_usd) amount FROM image_money_hold").get();
    const assets=db.prepare("SELECT record FROM asset").all().map(a=>JSON.parse(a.record));
    assert.deepEqual([held.n,held.amount],[2,9000]);
    assert.equal(assets.length,2);
    for(const a of assets){
      assert.deepEqual(await files.read(a.storageKey,a.sha256),a.review.status==="accepted"?initialPng:editedPng);
      assert.ok(result.reviews.some(r=>r.sha256===a.sha256 && r.to===a.review.status && r.sourceRevision===a.target.source.revision));
    }
    result.reopened={originals:assets.length,fullReservations:held.n,heldMicroUsd:held.amount};
  }finally{db.close();}
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+"\n",{flag:"wx"});
  console.log("slice passed",result.turns.length,"revisions,",result.traffic.length,"fake sends");
}finally{await rm(dir,{recursive:true,force:true});}
