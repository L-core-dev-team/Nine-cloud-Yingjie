import assert from "node:assert/strict";
import {fork,spawnSync} from "node:child_process";
import {once} from "node:events";
import {mkdtempSync,mkdirSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {SingleApproval} from "../ledger.mjs";
import {cardModel} from "../adapter.mjs";
import {fixtureGrant,action,prepare,approvalId} from "./request.mjs";
import {readStatus,createRecord} from "./audit.mjs";

const script=fileURLToPath(import.meta.url);
const grant=fixtureGrant("1".repeat(64),1893456000000);
const request=prepare({action});
const call={owner:"synthetic",sessionId:"00000000-0000-4000-8000-000000000001",key:"00000000-0000-4000-8000-000000000002"};
const open=dir=>new SingleApproval(join(dir,"mock.sqlite"),grant);
function arm(dir){
  mkdirSync(dir);createRecord(join(dir,"accepted.json"),{runHash:grant.runHash,grant});
  const ledger=open(dir);try{ledger.arm(call,request);}finally{ledger.close();}
}
const [mode,arg]=process.argv.slice(2);
if(mode==="race" || mode==="crash"){
  const ledger=open(arg);
  if(mode==="crash"){ledger.claim(call,request);process.exit(73);}
  process.send("ready");
  process.once("message",()=>{
    let wins=0;
    try{ledger.claim(call,request);wins++;}catch(e){assert.equal(e.message,"APPROVAL_LOCKED");}
    ledger.close();process.send(wins);process.disconnect();
  });
}else{
  const root=mkdtempSync(join(tmpdir(),"yj-l5-ledger-"));
  const race=join(root,"race"),crash=join(root,"crash"),unknown=join(root,"unknown");
  for(const dir of [race,crash,unknown])arm(dir);
  assert.throws(()=>prepare({action:"private-sentinel"}),/ACTION_NOT_CLEARED/);
  assert.equal(prepare({action,untrusted:"private-sentinel"}).body.includes("private-sentinel"),false);
  const args=["--permission","--allow-fs-read=*","--allow-fs-write="+root];
  const child=spawnSync(process.execPath,[...args,script,"crash",crash],{windowsHide:true,timeout:10000});
  assert.equal(child.status,73);
  assert.equal(readStatus(crash).status,"POSSIBLE_SEND_UNCONFIRMED");
  const racers=[1,2].map(()=>fork(script,["race",race],{execArgv:args,windowsHide:true,stdio:["ignore","ignore","inherit","ipc"]}));
  let wins;
  try{
    const messages=()=>Promise.all(racers.map(c=>once(c,"message",{signal:AbortSignal.timeout(10000)}).then(([m])=>m)));
    assert.deepEqual(await messages(),["ready","ready"]);
    const counts=messages(),exits=Promise.all(racers.map(c=>once(c,"exit")));
    racers.forEach(c=>c.send("claim"));wins=await counts;await exits;
    assert.deepEqual(wins.sort(),[0,1]);
  }finally{racers.forEach(c=>c.kill());}
  const ledger=open(unknown);let sends=0;
  try{
    const model=cardModel({ledger,key:"fixture",prepareRequest:prepare,transport:async()=>{
      assert.equal(ledger.snapshot().state,"possible-sent");sends++;throw Error("fixture-timeout");
    }});
    await assert.rejects(()=>model({action},new AbortController().signal,call),/UNKNOWN_STOP/);
    assert.equal(ledger.snapshot().state,"UNKNOWN_STOP");
  }finally{ledger.close();}
  for(const dir of [unknown,crash,race]){
    const reopened=open(dir);
    try{
      assert.equal(reopened.snapshot().approvalId,approvalId);assert.equal(reopened.snapshot().reserveNanoUsd,0);
      assert.throws(()=>reopened.claim(call,request),/APPROVAL_LOCKED/);
      assert.throws(()=>reopened.arm({...call,key:randomUUID(),sessionId:randomUUID()},request),/APPROVAL_LOCKED/);
    }finally{reopened.close();}
  }
  assert.equal(sends,1);
  writeFileSync(mode,JSON.stringify({status:"PASS",crashExit:child.status,raceWins:wins,
    recovered:readStatus(crash).status,timeoutSends:sends,secondClaims:0,renewedScopeClaims:0,
    realModelQueries:0,realTextCalls:0,realImageCalls:0,newCostUsd:0},null,2)+"\n",{flag:"wx"});
}
