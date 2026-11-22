import assert from "node:assert/strict";
import {fork} from "node:child_process";
import {mkdtemp,mkdir,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {Originals,sha256} from "../image-tasks/files.mjs";
import {output,originalHash} from "./test/fixture.mjs";

const root=fileURLToPath(new URL("../../",import.meta.url)),worker=fileURLToPath(new URL("test/money-worker.mjs",import.meta.url));
const base=await mkdtemp(join(tmpdir(),"i2-offline-"));
const permitted=new Set([sha256(output),originalHash,"004fabce7d1bacae36346e556db0d8017d0fde96e4e6ca99bc59c2a47c808aeb"]);
function start(mode,dir,onReady){
  return new Promise((resolve,reject)=>{
    const files=new Originals(join(dir,"originals")),child=fork(worker,[mode,dir],{windowsHide:true,serialization:"advanced",
      execArgv:["--permission","--allow-fs-read="+root,"--allow-fs-read="+dir,"--allow-fs-write="+dir],
      env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:dir,TMP:dir},stdio:["ignore","ignore","inherit","ipc"]});
    const timer=setTimeout(()=>{child.kill();reject(Error("worker-timeout"));},60000);
    let result;
    child.on("message",async msg=>{
      try{
        if(msg.save){
          assert.ok(Buffer.isBuffer(msg.save) && permitted.has(sha256(msg.save)));
          child.send(await files.save(msg.save));
        }else if(msg.ready)onReady(()=>child.send("go"));
        else result=msg;
      }catch(error){child.kill();reject(error);}
    });
    child.once("error",reject);
    child.once("exit",code=>{
      clearTimeout(timer);
      if(mode==="crash" && code===73)return resolve({exit:code});
      if(code!==0 || !result)return reject(Error("worker-"+mode+"-exit-"+code));
      resolve(result);
    });
  });
}
try{
  const suite=await start("suite",base),processChecks={};
  for(const scenario of ["race","crash"]){
    const dir=join(base,scenario);await mkdir(dir);await start("seed",dir);
    if(scenario==="race"){
      const waiting=[],barrier=go=>{waiting.push(go);if(waiting.length===2)waiting.forEach(f=>f());};
      const results=await Promise.all([start("race",dir,barrier),start("race",dir,barrier)]);
      assert.deepEqual(results.map(r=>r.calls).sort(),[0,1]);
      assert.deepEqual(results.map(r=>r.state).sort(),["already-claimed","unknown"]);
      processChecks.race=results.sort((a,b)=>a.calls-b.calls);
    }else processChecks.crash=await start("crash",dir,go=>go());
    const reopen=await start("reopen",dir,go=>go());
    assert.equal(reopen.calls,0);assert.equal(reopen.state,"already-claimed");assert.equal(reopen.microUsd,4000);
    assert.ok(reopen.sentAtPresent);assert.ok(reopen.stages.includes("possible-sent"));
    processChecks[scenario+"Reopen"]=reopen;
    const lost=await start("lost-task-record",dir,go=>go());
    assert.equal(lost.calls,0);assert.equal(lost.state,"not-sent");assert.equal(lost.sentAtPresent,false);
    assert.equal(lost.holds,1);processChecks[scenario+"LostAttempt"]=lost;
  }
  const aggregate=join(base,"aggregate");await mkdir(aggregate);
  await start("seed-aggregate-generate",aggregate);await start("seed-aggregate-edit",aggregate);
  const ready=[],begin=go=>{ready.push(go);if(ready.length===2)ready.forEach(f=>f());};
  const competing=await Promise.all(["generate","edit"].map(op=>start("aggregate-"+op,aggregate,begin)));
  assert.deepEqual(competing.map(r=>r.state).sort(),["not-sent","unknown"]);
  assert.deepEqual(competing.map(r=>r.calls).sort(),[0,1]);
  assert.ok(competing.every(r=>r.holds===1 && r.microUsd<=7000 && r.sentAtPresent===(r.calls===1)));
  processChecks.sharedBudget={totalMicroUsd:7000,generate:competing[0],edit:competing[1]};
  const report={node:process.version,authority:"SQLite synchronous=FULL, shared task+money transaction",networkPermission:false,
    ...suite,processChecks,live:"LIVE_BLOCKED_COST_BOUND",nativePgChrome:"ENV_BLOCKED / NOT_RUN",modelQueries:0,textCalls:0,imageCalls:0,actualUsd:0};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+"\n",{flag:"wx"});
  console.log("I2 mock scenarios",suite.cases.length,"passed; process race, forced exit and both reopen/lost-attempt paths passed");
}finally{await rm(base,{recursive:true,force:true});}
