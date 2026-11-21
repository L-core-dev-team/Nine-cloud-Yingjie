import {spawnSync,execFileSync} from "node:child_process";
import {resolve} from "node:path";
import {rmSync,writeFileSync} from "node:fs";
import {fresh,stop,counters} from "./cluster.mjs";

const tests={
  "scene-state":["live-card","persistence"],"image-tasks":["recovery"],"ui-shell":["browser"],
  "world-assets":["matching","live"],"first-play":["extract","browser","continuity","revisit-browser","trigger","trigger-browser"],
  "image-history":["history"],"recovery":["terminal"]
};
const [mode,file]=process.argv.slice(2);
if (!["limit","regression","play","play-restore","terminal"].includes(mode)||!file) throw Error("usage: node packages/local-demo/check.mjs limit|regression|play|play-restore|terminal NEW-RECEIPT.json");
const {openSync,closeSync}=await import("node:fs");
closeSync(openSync(file,"wx")); // refuse to replace evidence
const {dir,state}=await fresh();
const env={...process.env,YJ13_CLUSTER:dir};
for(const name of Object.keys(env)) if(/^YJ\d+_EVIDENCE_DIR$/.test(name))delete env[name];
const args=mode==="limit"?["packages/local-demo/limit.mjs"]:["packages/scene-state/test/verify-local.mjs",
  ...(mode==="regression"?Object.entries(tests).flatMap(([pkg,files])=>files.map(f=>"packages/"+pkg+"/test/"+f+".test.mjs")):
    [mode.startsWith("play")?"packages/first-play/test/revisit-browser.test.mjs":"packages/recovery/test/terminal.test.mjs"])];
env.YJ13_RESTORE=mode==="play-restore"?"1":"0";
if(mode.startsWith("play")||mode==="terminal")env.YJ13_DETAIL=resolve(file)+".detail.json";
const started=Date.now();
try {
  const baseline=await counters(state);
  const r=spawnSync(process.execPath,args,{env,encoding:"utf8",windowsHide:true,timeout:480000,maxBuffer:8*1024*1024});
  const output=(r.stdout??"")+"\n"+(r.stderr??"");
  const summary={mode,head:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),fixtureId:state.id,
    exit:r.status,signal:r.signal,error:r.error?.code??null,elapsedMs:Date.now()-started,before:baseline,after:await counters(state)};
  if(mode==="limit"&&r.status===0)summary.rejection=JSON.parse(r.stdout.trim());
  else {
    summary.tests={};
    for(const name of ["tests","pass","fail","cancelled","skipped","todo"]){
      const m=output.match(new RegExp("(?:#|ℹ) "+name+" (\\d+)"));summary.tests[name]=m?Number(m[1]):null;
    }
    summary.failures=output.split(/\r?\n/).filter(s=>/^(?:not ok|✖) /.test(s)).map(s=>s.replace(/ \([\d.]+ms\)$/,"")).slice(0,25);
  }
  writeFileSync(file,JSON.stringify(summary,null,2)+"\n");
  if(r.status!==0)process.stderr.write(output);
  console.log(JSON.stringify(summary));process.exitCode=r.status??1;
}finally{stop(dir);rmSync(dir,{recursive:true,force:true});}
