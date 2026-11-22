import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtemp,readFile,readdir,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {serve} from "../key-entry/server.mjs";
import {stageJournal} from "../key-entry/stages.mjs";
import {SingleApproval} from "../ledger.mjs";
import {action,prepare,grant} from "../l4/request.mjs";

const fixture={...grant,approvalId:"l4r-crash-fixture"};
const scope={owner:"fake",sessionId:"00000000-0000-4000-8000-000000000001",key:"00000000-0000-4000-8000-000000000002"};
if(process.argv[2]==="--exit-after-claim"){
  const dir=process.argv[3],j=stageJournal(dir);
  const l=new SingleApproval(join(dir,"fixture.sqlite"),fixture,j.mark);
  l.arm(scope,prepare({action}));l.claim(scope,prepare({action}));
  process.exit(73); // No transport, close or finally; caller must treat the claim as possibly sent.
}
const dir=await mkdtemp(join(tmpdir(),"l4r-crash-"));
try{
  const child=spawnSync(process.execPath,[process.argv[1],"--exit-after-claim",dir],{windowsHide:true,stdio:"ignore"});
  assert.equal(child.status,73);
  const db=new SingleApproval(join(dir,"fixture.sqlite"),fixture);
  try{
    assert.equal(db.snapshot().state,"possible-sent");assert.throws(()=>db.claim(scope,prepare({action})),/APPROVAL_LOCKED/);
  }finally{db.close();}
  const name=(await readdir(dir)).find(n=>n.endsWith(".jsonl"));
  const beforeExit=(await readFile(join(dir,name),"utf8")).trim().split("\n").map(line=>JSON.parse(line).stage);
  assert.deepEqual(beforeExit,["ledger-not-sent","ledger-possible-sent"]);
  const cases=[];
  for(const kind of ["lease","lifetime"]){
    let clock=0,starts=0;
    const server=await serve({journal:stageJournal(dir),now:()=>clock,inspect:()=>[],execute:()=>{starts++;}});
    try{
      let session=new URL(server.url).hash.slice(1);
      const post=path=>fetch(server.origin+path,{method:"POST",headers:{Origin:server.origin,"Content-Type":"application/octet-stream","X-YJ-Session":session},body:""});
      session=(await (await post("/claim")).json()).session;
      if(kind==="lifetime"){
        for(clock=80000;clock<900000;clock+=80000)assert.equal((await post("/ping")).status,200);
        clock=900000;
      }else clock=90001;
      const res=await post("/start");assert.equal(res.status,410);assert.equal((await res.json()).status,"INVITE_EXPIRED");assert.equal(starts,0);
      cases.push({kind,elapsedMs:clock,starts});
    }finally{server.close();}
  }
  await writeFile(process.argv[2],JSON.stringify({status:"PASS",beforeExit,recovered:"possible-sent",secondClaim:"APPROVAL_LOCKED",cases},null,2)+"\n",{flag:"wx"});
}finally{await rm(dir,{recursive:true,force:true});}
