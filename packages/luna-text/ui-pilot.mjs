import {userInfo} from "node:os";
import {join} from "node:path";
import {existsSync,mkdirSync} from "node:fs";
import {open} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {SingleApproval} from "./ledger.mjs";
import {preflight,priceDate} from "./adapter.mjs";

export const approvalDirectory=join(userInfo().homedir,".nine-cloud-yingjie","yj-p02-l1");
export const approvalFile=join(approvalDirectory,"approval.sqlite");

// The checkbox is an operator attestation for this project, never a remote entitlement check.
export function inspect(hasKey,verified) {
  const reasons=preflight(hasKey?"present":"",verified?priceDate:"");
  if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==="0")reasons.push("TLS_POLICY_NOT_VERIFIED");
  if(existsSync(approvalFile)){
    let db;
    try{db=new SingleApproval(approvalFile);if(db.snapshot())reasons.push("APPROVAL_LOCKED");}
    catch{reasons.push("LEDGER_UNAVAILABLE");}finally{db?.close();}
  }
  return reasons;
}
export async function execute({takeKey,signal,verified}) {
  const check=()=>{signal.throwIfAborted();if(inspect(true,verified).length)throw Error("GATE_BLOCKED");};
  check();
  mkdirSync(approvalDirectory,{recursive:true,mode:0o700});
  const receipt=await open(join(approvalDirectory,"ui-receipt-"+randomUUID()+".json"),"wx",0o600);
  let ledger,history,snapshot,status="LIVE_BLOCKED";
  try{
    ledger=new SingleApproval(approvalFile);
    const {journey}=await import("./journey.mjs");
    // After arm(), the original ledger validates the bound scope and atomically claims it.
    const gate=()=>{
      signal.throwIfAborted();
      if(preflight("present",verified?priceDate:"").length || process.env.NODE_TLS_REJECT_UNAUTHORIZED==="0")throw Error("GATE_BLOCKED");
    };
    history=await journey({live:true,ledger,takeKey,gate,cancelSignal:signal});
    status="LUNA_ONE_CALL_PASS";
  }catch{
    snapshot=ledger?.snapshot();
    const stopped={"possible-sent":"UNKNOWN_STOP",UNKNOWN_STOP:"UNKNOWN_STOP",ACKNOWLEDGED:"ACKNOWLEDGED_HISTORY_UNVERIFIED",
      FAIL:"FAIL",REJECTED_STOP:"REJECTED_STOP"};
    status=stopped[snapshot?.state]??"LIVE_BLOCKED";
  }finally{
    try{snapshot=ledger?.snapshot();}finally{ledger?.close();}
    const report={status,history:history??null,reservation:snapshot??null,realImageCalls:0};
    try{await receipt.writeFile(JSON.stringify(report,null,2)+"\n");}finally{await receipt.close();}
  }
  return {status,revision:history?.revision??null,usage:snapshot?.usage??null};
}
