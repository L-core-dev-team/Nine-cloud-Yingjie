import assert from "node:assert/strict";
import {fork} from "node:child_process";
import {once} from "node:events";
import {randomUUID} from "node:crypto";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {SingleApproval} from "../ledger.mjs";
import {cardModel,endpoint} from "../adapter.mjs";
import * as l1 from "../adapter.mjs";
import * as l4 from "../l4/request.mjs";
const isL4=process.argv.includes("--l4");
const {action,priceDate,prepare}=isL4?l4:l1;
const preflight=isL4?(key,day,now)=>l4.preflight(Boolean(key),day===priceDate,now):l1.preflight;
const openLedger=file=>new SingleApproval(file,isL4?l4.grant:null);
import {reply} from "./fake.mjs";

const script=fileURLToPath(import.meta.url);
const call={owner:"synthetic-owner",sessionId:"00000000-0000-4000-8000-000000000001",key:"00000000-0000-4000-8000-000000000002"};
const input={action,instructions:"PRIVATE_SENTINEL",worldbooks:["PRIVATE_SENTINEL"],messages:["PRIVATE_SENTINEL"]};
const prepared=prepare(input);
async function worker(mode,dir) {
  assert.equal(process.permission.has("net"),false);
  if(mode==="race"){
    const db=openLedger(join(dir,"race.sqlite"));
    process.send("ready");
    await once(process,"message");
    let n=0;
    try { db.claim(call,prepared); n++; } catch(e){assert.equal(e.message,"APPROVAL_LOCKED");}
    // Exit without acknowledgement, as on process loss after possible send.
    db.close();process.send(n);return;
  }
  const today=new Date(priceDate+"T04:00:00Z");
  assert.deepEqual(preflight("fixture",priceDate,today),[]);
  assert.ok(preflight("",priceDate,today).includes("API_KEY_NOT_CONFIGURED"));
  assert.ok(preflight("fixture","",today).includes("PROJECT_MODEL_STANDARD_ACCESS_UNCONFIRMED"));
  assert.ok(preflight("fixture",priceDate,new Date(today.valueOf()+86400000)).includes("BUDGET_GATE_NOT_VERIFIED"));
  const observations=[];
  for(const scenario of ["completed","401","403","429","503","redirect","timeout","bad-json","wrong-model","wrong-tier","tool","usage-missing","incomplete","unexpected-input-charge","over-output-limit"]){
    const file=join(dir,scenario+".sqlite"),db=openLedger(file);
    db.arm(call,prepared);
    let sent=0;
    const model=cardModel({ledger:db,prepareRequest:prepare,hashResponseId:isL4,key:"local-placeholder",transport:async(url,init)=>{
      sent++;assert.equal(url,endpoint);assert.equal(init.method,"POST");assert.equal(init.redirect,"error");
      assert.equal(init.credentials,"omit");assert.equal(init.headers.Authorization,"Bearer local-placeholder");
      assert.ok(!init.body.includes("PRIVATE_SENTINEL"));
      const body=JSON.parse(init.body);
      assert.deepEqual(body,{model:"gpt-6-luna",service_tier:"default",reasoning:{effort:"none"},max_output_tokens:1200,
        store:false,truncation:"disabled",tools:[],stream:false,background:false,input:JSON.parse(prepared.body).input});
      if(scenario==="timeout")throw Error("no-reply");
      if(scenario==="redirect")return new Response(null,{status:307});
      if(/^\d+$/.test(scenario))return new Response(null,{status:Number(scenario)});
      if(scenario==="bad-json")return new Response("{");
      const data=reply();
      if(scenario==="wrong-model")data.model="other";
      if(scenario==="wrong-tier")data.service_tier="priority";
      if(scenario==="tool")data.output.push({type:"function_call"});
      if(scenario==="usage-missing")delete data.usage;
      if(scenario==="incomplete")data.status="incomplete";
      if(scenario==="unexpected-input-charge")Object.assign(data.usage,{input_tokens:prepared.inputBound+1,total_tokens:prepared.inputBound+59});
      if(scenario==="over-output-limit")Object.assign(data.usage,{output_tokens:1201,total_tokens:1326});
      return Response.json(data);
    }});
    const run=(i=input,c=call)=>model(i,new AbortController().signal,c);
    await assert.rejects(run({action:"PRIVATE_SENTINEL"}),/ACTION_NOT_CLEARED/);
    for(const field of ["owner","key","sessionId"])await assert.rejects(run(input,{...call,[field]:randomUUID()}),/APPROVAL_LOCKED/);
    assert.equal(sent,0);
    const expected={completed:"ACKNOWLEDGED","wrong-model":"FAIL","wrong-tier":"FAIL",401:"REJECTED_STOP",403:"REJECTED_STOP",429:"REJECTED_STOP"};
    const state=expected[scenario]??"UNKNOWN_STOP";
    if(scenario==="completed")assert.equal(await run(),reply().output[0].content[0].text);
    else await assert.rejects(run(),new RegExp(state));
    await assert.rejects(run(),/APPROVAL_LOCKED/);assert.equal(sent,1);
    const snapshot=db.snapshot();assert.equal(snapshot.state,state);
    if(isL4){
      assert.equal(snapshot.approvalId,l4.approvalId);
      assert.deepEqual(snapshot.grant,l4.grant);assert.equal(snapshot.responseId,undefined);
      if(state==="ACKNOWLEDGED")assert.match(snapshot.responseIdHash,/^[a-f0-9]{64}$/);
    }
    if(state==="FAIL"){assert.equal(snapshot.usage.inputTokens,125);assert.equal(snapshot.usage.estimatedNanoUsd,null);}
    db.close();
    const reopened=openLedger(file);
    assert.throws(()=>reopened.arm({...call,key:randomUUID()},prepared),/APPROVAL_LOCKED/);
    reopened.close();observations.push({scenario,state,fakeSends:sent});
  }
  process.send(observations);
}
function child(mode,dir) {
  const child=fork(script,[mode,dir,...(isL4?["--l4"]:[])],{execArgv:["--permission","--allow-fs-read=*","--allow-fs-write="+dir],
    env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH},stdio:["ignore","inherit","inherit","ipc"]});
  const done=once(child,"exit").then(([code])=>assert.equal(code,0));
  // Reject on premature exit so a broken worker cannot hang its parent.
  const message=()=>Promise.race([once(child,"message").then(([x])=>x),done.then(()=>{throw Error("worker exited");})]);
  return {child,done,message};
}
if(process.send){
  await worker(process.argv[2],process.argv[3]);process.disconnect();
}else{
  const dir=await mkdtemp(join(tmpdir(),"luna-offline-"));
  try{
    const checks=child("suite",dir);const scenarios=await checks.message();await checks.done;
    let db=openLedger(join(dir,"race.sqlite"));db.arm(call,prepared);db.close();
    const racers=[child("race",dir),child("race",dir)];
    assert.deepEqual(await Promise.all(racers.map(r=>r.message())),["ready","ready"]);
    const counts=Promise.all(racers.map(r=>r.message()));
    racers.forEach(r=>r.child.send("go"));
    const wins=await counts;await Promise.all(racers.map(r=>r.done));assert.deepEqual(wins.sort(),[0,1]);
    db=openLedger(join(dir,"race.sqlite"));
    assert.equal(db.snapshot().state,"possible-sent");
    assert.throws(()=>db.claim(call,prepared),/APPROVAL_LOCKED/);db.close();
    const report={...(isL4?{approvalId:l4.approvalId}:{}),status:"OFFLINE_PASS",node:process.version,networkPermission:false,scenarios,
      concurrentProcesses:2,possibleSendsAfterRace:wins.reduce((a,b)=>a+b),crashRestart:"APPROVAL_LOCKED",
      requestSha256:prepared.requestSha256,inputBound:prepared.inputBound,realTextCalls:0,realImageCalls:0};
    if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+"\n",{flag:"wx"});
    console.log(JSON.stringify(report));
  }finally{await rm(dir,{recursive:true,force:true});}
}
