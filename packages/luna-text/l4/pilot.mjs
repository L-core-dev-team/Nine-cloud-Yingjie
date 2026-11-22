import {DatabaseSync} from "node:sqlite";
import {existsSync,mkdirSync} from "node:fs";
import {open} from "node:fs/promises";
import {join} from "node:path";
import {userInfo} from "node:os";
import {randomUUID} from "node:crypto";
import {SingleApproval} from "../ledger.mjs";
import {approvalId,action,prepare,grant,preflight} from "./request.mjs";
import {extract,inspectSaved} from "./analysis.mjs";

const directory=join(userInfo().homedir,".nine-cloud-yingjie","yj-p02-l4");
const file=join(directory,"approval.sqlite");
export const pilot={action,prepare,extract,inspectSaved};
export function inspect(hasKey,verified){
  const reasons=preflight(hasKey,verified);
  if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==="0")reasons.push("TLS_POLICY_NOT_VERIFIED");
  if(existsSync(file)){
    let db;
    try{
      db=new DatabaseSync(file,{readOnly:true});
      if(db.prepare("SELECT id FROM pilot WHERE id=?").get(approvalId))reasons.push("APPROVAL_LOCKED");
    }catch{reasons.push("LEDGER_UNAVAILABLE");}finally{db?.close();}
  }
  return reasons;
}
// This credentialed read, initiated by the owner's check button, has no request body or inference.
export async function verifyModel(key,signal,fetchModel=fetch){
  try{
    const r=await fetchModel("https://api.openai.com/v1/models/gpt-6-luna",{method:"GET",redirect:"error",
      credentials:"omit",signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),headers:{Authorization:"Bearer "+key}});
    if(!r.ok)return false;
    const info=await r.json();
    return info.id==="gpt-6-luna" && info.object==="model";
  }catch{return false;}
}
export async function execute({takeKey,verified,signal}){
  if(inspect(true,verified).length)throw Error("GATE_BLOCKED");
  const gate=()=>{
    signal.throwIfAborted();
    if(preflight(true,verified).length || process.env.NODE_TLS_REJECT_UNAUTHORIZED==="0")throw Error("GATE_BLOCKED");
  };
  gate();
  mkdirSync(directory,{recursive:true,mode:0o700});
  const receipt=await open(join(directory,"receipt-"+randomUUID()+".json"),"wx",0o600);
  let ledger,history=null,snapshot=null,status="LIVE_BLOCKED";
  try{
    ledger=new SingleApproval(file,grant);
    const {journey}=await import("../journey.mjs");
    history=await journey({live:true,ledger,takeKey,gate,cancelSignal:signal,pilot});
    status="ONE_CALL_PASS";
  }catch{
    const state=ledger?.snapshot()?.state;
    status=({"possible-sent":"UNKNOWN_STOP",ACKNOWLEDGED:"ACKNOWLEDGED_HISTORY_UNVERIFIED",UNKNOWN_STOP:"UNKNOWN_STOP",
      FAIL:"FAIL",REJECTED_STOP:"REJECTED_STOP"})[state]??"LIVE_BLOCKED";
  }finally{
    try{snapshot=ledger?.snapshot()??null;}finally{ledger?.close();}
    const report={approvalId,status,history,reservation:snapshot,finalButton:true,modelVisibilityVerified:verified,
      realImageCalls:0};
    try{await receipt.writeFile(JSON.stringify(report,null,2)+"\n");await receipt.sync();}finally{await receipt.close();}
  }
  return {status,revision:history?.revision,scene:history?.extraction,usage:snapshot?.usage};
}
