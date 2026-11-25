// Reconcile the eight bounded sidecar rows to owned PG receipts, without executing a turn.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {openStore,hash} from "./data.mjs";
import {openNative,publicState} from "./native.mjs";
import {digest as canonical} from "../native-facts/admission.mjs";
const dir=join(process.env.LOCALAPPDATA,"NineCloud-P05","demo"),store=openStore(dir);
const cfg=JSON.parse(readFileSync(join(dir,"private.json"),"utf8"));
process.env.NODE_ENV="test";
const n=await openNative(cfg,dir,store,{provision:false});
try{
 const identity=await n.auth.resolve(store.get("session"));assert.ok(identity?.ownerId&&store.get("save"));
 const current=await n.saveFor(identity.ownerId),scope=hash([identity.ownerId,current.saveId,"root"]);
 const rows=store.history(scope),summary=[];assert.equal(current.revision,8);assert.equal(rows.length,8);
 for(const h of rows){
   const receipt=n.core.contracts.TurnReceiptSchema.parse(await n.repo.getReceiptForOwner(identity.ownerId,current.saveId,h.requestKey));
   assert.equal(receipt.resultingRevision,h.revision);assert.equal(receipt.idempotencyKey,h.requestKey);
   assert.equal(receipt.saveId,current.saveId);assert.deepEqual(receipt.decision.events.map(e=>e.type),h.events);
   const rereadHash=hash(receipt);
   const batch=await n.pool.query("SELECT e.* FROM turn_events e JOIN game_saves s ON s.id=e.save_id WHERE s.owner_id=$1 AND e.save_id=$2 AND e.idempotency_key=$3 ORDER BY sequence",[identity.ownerId,current.saveId,h.requestKey]);
   const events=batch.rows.map(e=>({id:e.id,saveId:e.save_id,branchId:e.branch_id,type:e.event_type,source:e.source,ruleVersion:e.rule_version,beforeRevision:e.before_revision,afterRevision:e.after_revision,occurredAt:e.occurred_at.toISOString(),payload:e.payload}));
   assert.deepEqual(events,receipt.decision.events);
   const hints=n.hints.buildP1NarrativeHints(receipt,current);
   const body=n.hints.ensureP1NarrativeHints(await n.core.runtime.narrativeFallback(receipt,hints),receipt,hints);
   assert.equal(hash(body),h.bodySha);
   if(h.canonicalReceiptSha)assert.equal(canonical(receipt),h.canonicalReceiptSha);
   let extra={};
   if(h.revision===5){
      const e=receipt.decision.events.find(e=>e.type==="move.arrived");
      const sub=e.payload.stateDelta.factChanges.find(d=>d.key==="currentSublocationId");
      assert.equal(e.payload.from,rows[3].native.location);assert.equal(sub.before.value,rows[3].native.sub);
      extra={from:e.payload.from,subBefore:sub.before.value,to:e.payload.to,subAfter:sub.after.value};
   }
   if(h.revision===8){
      const ctx=n.hints.buildP1NarrativeHints(receipt,current);
      const body=n.hints.ensureP1NarrativeHints(await n.core.runtime.narrativeFallback(receipt,ctx),receipt,ctx);
      assert.equal(hash(body),h.bodySha);extra={reconstructedCurrentBodySha:hash(body)};
   }
   summary.push({revision:h.revision,originalReturnSha:h.receiptSha,rereadHash,byteDigestMatches:rereadHash===h.receiptSha,
     canonicalPgReceiptSha:canonical(receipt),canonicalAtOriginalSubmission:h.canonicalReceiptSha??null,matchedIndependentEvents:events.length,matchedBodySha:hash(body),...extra});
 }
 const live=publicState(current,n.labels);
 console.log(JSON.stringify({authenticatedReceipts:summary,live:{place:live.place,sub:live.sub,revision:live.revision,quest:live.quest},executeCalls:0}));
}finally{await n.pool.end();store.db.close()}
