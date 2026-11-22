import {appendFileSync,openSync,closeSync,mkdirSync} from "node:fs";
import {userInfo} from "node:os";
import {join} from "node:path";
import {createHash,randomBytes} from "node:crypto";

const stages=new Set(["invite-claimed","check-blocked","preflight-ready","start-received","start-accepted","gate-denied",
  "receipt-created","receipt-write-failed","ledger-unavailable","ledger-not-sent","ledger-possible-sent",
  "provider-response-seen","history-committed","scene-reviewed","stop"]);
// The caller provides a private audit directory separate from storage being diagnosed.
export function stageJournal(directory=join(userInfo().homedir,".nine-cloud-yingjie","entry-audit")){
  mkdirSync(directory,{recursive:true,mode:0o700});
  const runHash=createHash("sha256").update(randomBytes(32)).digest("hex");
  const path=join(directory,runHash+".jsonl");
  closeSync(openSync(path,"wx",0o600));
  return {runHash,mark(stage){
    if(!stages.has(stage))throw Error("INVALID_STAGE");
    appendFileSync(path,JSON.stringify({runHash,utc:new Date().toISOString(),stage})+"\n",{flush:true});
  }};
}
