import {mkdir,open} from "node:fs/promises";
import {join} from "node:path";
import {SingleApproval} from "../ledger.mjs";
import {grant} from "./request.mjs";

// Used only with synthetic callbacks and a caller-owned temporary directory.
// Never resolve a real user's home or import a network transport.
export async function executeFixture({directory,gate,mark,runHash,run,signal}){
  if(!/^[a-f0-9]{64}$/.test(runHash))throw Error("INVALID_RUN_HASH");
  const result={status:"START_REJECTED_BEFORE_SEND"};
  try{signal.throwIfAborted();gate();}catch{mark("gate-denied");return result;}
  let receipt,ledger;
  try{
    await mkdir(directory,{recursive:true,mode:0o700});
    receipt=await open(join(directory,"receipt.json"),"wx",0o600);
  }catch{mark("receipt-write-failed");return {status:"RECEIPT_WRITE_FAILED_BEFORE_SEND"};}
  try{
    mark("receipt-created");
    try{ledger=new SingleApproval(join(directory,"approval.sqlite"),{...grant,approvalId:"l4r-fixture-only",runHash},mark);}
    catch{mark("ledger-unavailable");result.status="LEDGER_UNAVAILABLE_BEFORE_SEND";return result;}
    try{
      await run(ledger);
      result.status=ledger.snapshot()?.state==="ACKNOWLEDGED"?"MOCK_COMPLETED":"POSSIBLE_SEND_UNCONFIRMED";
    }catch{
      const state=ledger.snapshot()?.state;
      if(state==="ACKNOWLEDGED")result.status="ACKNOWLEDGED_HISTORY_UNVERIFIED";
      else if(state && state!=="not-sent")result.status="POSSIBLE_SEND_UNCONFIRMED";
    }
    return result;
  }finally{
    try{
      // A failure here is post-execution unless the durable ledger proves otherwise.
      await receipt.writeFile(JSON.stringify({runHash,...result})+"\n");await receipt.sync();
    }catch{mark("receipt-write-failed");result.status="RECEIPT_WRITE_FAILED";}
    finally{ledger?.close();await receipt.close();}
  }
}
