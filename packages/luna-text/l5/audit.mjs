import {DatabaseSync} from "node:sqlite";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {approvalId} from "./request.mjs";

export function createRecord(path,record) {
  writeFileSync(path,JSON.stringify(record)+"\n",{flag:"wx",mode:0o600,flush:true});
}
// Missing or damaged evidence never enables another operation.
export function readStatus(directory) {
  const occupied=join(directory,"accepted.json"),dbFile=join(directory,"mock.sqlite");
  let db;
  try {
    if(!existsSync(occupied) && !existsSync(dbFile))return {status:"NO_LOCAL_RECORD"};
    const {runHash}=JSON.parse(readFileSync(occupied,"utf8"));
    if(!/^[a-f0-9]{64}$/.test(runHash))throw Error();
    db=new DatabaseSync(dbFile,{readOnly:true});
    const row=db.prepare("SELECT state,binding FROM pilot WHERE id=?").get(approvalId);
    if(row && JSON.parse(row.binding).grant.runHash!==runHash)throw Error();
    const file=join(directory,"result.json");
    if(existsSync(file)){
      const result=JSON.parse(readFileSync(file,"utf8"));
      if(result.runHash!==runHash)throw Error();
      if(result.status==="MOCK_HISTORY_VERIFIED" && row?.state!=="ACKNOWLEDGED")throw Error();
      return result;
    }
    const status=row?.state==="ACKNOWLEDGED"?"ACKNOWLEDGED_HISTORY_UNVERIFIED":
      row?.state==="not-sent"?"LEDGER_NOT_SENT":"POSSIBLE_SEND_UNCONFIRMED";
    return {status,runHash};
  }catch{return {status:"POSSIBLE_SEND_UNCONFIRMED"};}
  finally{db?.close();}
}

export function readStages(directory,runHash) {
  if(!/^[a-f0-9]{64}$/.test(runHash))throw Error("INVALID_RUN_HASH");
  const rows=readFileSync(join(directory,"audit",runHash+".jsonl"),"utf8").trim();
  const stages=rows?rows.split("\n").map(line=>{
    const row=JSON.parse(line);
    if(row.runHash!==runHash || !/^[a-z-]{1,40}$/.test(row.stage))throw Error("INVALID_AUDIT");
    return {stage:row.stage,utc:new Date(row.utc).toISOString()};
  }):[];
  const result=readStatus(directory);
  return {runHash,stages,...(result.runHash===runHash?{result}:{})};
}
