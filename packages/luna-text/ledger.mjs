import {DatabaseSync} from "node:sqlite";
import {digest} from "../provider-readiness/reservations.mjs";
import {modelId,outputLimit,ceilingNanoUsd,reserveNanoUsd} from "./adapter.mjs";

const approval="YJ-P02-L1-single-luna-text";
function binding(call,prepared) {
  const ids=[call?.owner,call?.sessionId,call?.key];
  if (ids.some(x=>typeof x!=="string" || !x.length) ||
      !ids.slice(1).every(x=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x))) throw Error("INVALID_SCOPE");
  return JSON.stringify({ownerHash:digest(ids[0]),sessionHash:digest(ids[1]),actionKeyHash:digest(ids[2]),
    requestSha256:prepared.requestSha256,model:modelId,maxOutputTokens:outputLimit,inputBound:prepared.inputBound,
    ceilingNanoUsd,reserveNanoUsd});
}
export class SingleApproval {
  constructor(file) {
    this.db=new DatabaseSync(file);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS pilot(id TEXT PRIMARY KEY, binding TEXT NOT NULL, state TEXT NOT NULL, receipt TEXT)`);
  }
  arm(call,prepared) {
    const b=binding(call,prepared);
    this.db.prepare("INSERT INTO pilot VALUES (?,?,'not-sent',NULL) ON CONFLICT(id) DO NOTHING").run(approval,b);
    const row=this.db.prepare("SELECT binding,state FROM pilot WHERE id=?").get(approval);
    if(row.binding!==b || row.state!=="not-sent") throw Error("APPROVAL_LOCKED");
  }
  claim(call,prepared) {
    // One durable SQLite autocommit before transport. Every new action shares this approval.
    const result=this.db.prepare("UPDATE pilot SET state='possible-sent' WHERE id=? AND binding=? AND state='not-sent'")
      .run(approval,binding(call,prepared));
    if(result.changes!==1) throw Error("APPROVAL_LOCKED");
  }
  finish(state,receipt) {
    if (!["ACKNOWLEDGED","UNKNOWN_STOP","REJECTED_STOP","FAIL"].includes(state)) throw Error("INVALID_OUTCOME");
    if(this.db.prepare("UPDATE pilot SET state=?,receipt=? WHERE id=? AND state='possible-sent'")
      .run(state,JSON.stringify(receipt),approval).changes!==1) throw Error("APPROVAL_LOCKED");
  }
  snapshot() {
    const row=this.db.prepare("SELECT * FROM pilot WHERE id=?").get(approval);
    return row?{approvalId:row.id,...JSON.parse(row.binding),state:row.state,...JSON.parse(row.receipt)}:null;
  }
  close(){this.db.close();}
}
