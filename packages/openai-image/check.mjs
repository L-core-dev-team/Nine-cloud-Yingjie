import {execFileSync} from "node:child_process";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../../",import.meta.url)),dir=mkdtempSync(join(tmpdir(),"i1-check-"));
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(SYSTEMROOT|WINDIR|PATH|PATHEXT|COMSPEC)$/i.test(key)));
Object.assign(env,{TMP:dir,TEMP:dir,TMPDIR:dir});
const opts={cwd:root,env,encoding:"utf8",timeout:90000,windowsHide:true};
const isolated=["--permission","--allow-fs-read="+root,"--allow-fs-read="+dir,"--allow-fs-write="+dir];
const test=(name,file,args)=>{
  const tap=execFileSync(process.execPath,[...args,"--test-isolation=none","--test-reporter=tap","--test",file],opts);
  const counts=Object.fromEntries(["tests","pass","fail","skipped","cancelled"].map(k=>[k,Number(tap.match(new RegExp("^# "+k+" (\\d+)$","m"))?.[1])]));
  if(!counts.tests || counts.tests!==counts.pass)throw Error("incomplete-"+name);
  return {name,...counts,cases:[...tap.matchAll(/^ok \d+ - (.+)$/gm)].map(m=>m[1])};
};
try{
  const suites=[test("offline adapter","packages/openai-image/test/offline.test.mjs",isolated),
    test("ImageTasks and process recovery","packages/openai-image/test/tasks.test.mjs",[])];
  const protocol=JSON.parse(execFileSync(process.execPath,[...isolated,"packages/openai-image/test/receipt.mjs"],opts));
  const evidence={status:"IMAGE_ADAPTER_OFFLINE_PASS",node:process.version,suites,protocol,
    taskStore:"SQLite test substitution",nativePostgres:"ENV_BLOCKED / NOT_RUN",nativeChrome:"ENV_BLOCKED / NOT_RUN",
    realModelLookups:0,realTextCalls:0,realImageGenerations:0,realImageEdits:0,newCostUsd:0};
  if(process.argv[2])writeFileSync(resolve(process.argv[2]),JSON.stringify(evidence,null,2)+"\n",{flag:"wx"});
  console.log(evidence.status,suites.map(s=>s.pass+"/"+s.tests).join(", "));
}finally{rmSync(dir,{recursive:true,force:true});}
