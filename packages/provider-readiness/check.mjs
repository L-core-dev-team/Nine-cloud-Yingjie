import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import assert from "node:assert/strict";

const root=fileURLToPath(new URL("../../",import.meta.url));
const dir=mkdtempSync(join(tmpdir(),"p01-offline-"));
try {
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC)$/i.test(k)));
  Object.assign(env,{TEMP:dir,TMP:dir,TMPDIR:dir});
  function run(args){
    return execFileSync(process.execPath,["--permission","--allow-fs-read="+root,"--allow-fs-read="+dir,
      "--allow-fs-write="+dir,...args],{cwd:root,windowsHide:true,env,encoding:"utf8",timeout:30000});
  }
  const tap=run(["--test-isolation=none","--test-reporter=tap","--test","packages/provider-readiness/test/offline.test.mjs"]);
  const count=name=>Number(tap.match(new RegExp("^# "+name+" (\\d+)$","m"))?.[1]);
  const cases=[...tap.matchAll(/^ok \d+ - (.+)$/gm)].map(m=>m[1].trim());
  const tests={cases,tests:count("tests"),pass:count("pass"),fail:count("fail"),skipped:count("skipped")};
  assert.ok(cases.length>0);assert.equal(tests.tests,cases.length);assert.equal(tests.pass,tests.tests);
  const restart=["loss","reopen"].map(phase=>JSON.parse(run(["packages/provider-readiness/test/restart-worker.mjs",phase,dir])));
  const result={status:"OFFLINE_PASS",node:process.version,tests,restart,networkPermission:false,
    liveTextCalls:0,liveImageCalls:0,execution:"in-process fake; no network capability in any child",cost:null,usage:null};
  if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
