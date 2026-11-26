// Reconcile the eight bounded sidecar rows to owned PG receipts, without executing a turn.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {openStore,hash} from "./data.mjs";
import {openNative,publicState} from "./native.mjs";
import {digest as canonical} from "../native-facts/admission.mjs";
const instance=process.argv[2]??"demo";
const repair=["repair-a","repair-b","repair-c"].includes(instance);
assert.ok(repair || ["demo","visual-demo"].includes(instance));
const dir=join(process.env.LOCALAPPDATA,"NineCloud-P05",instance),store=openStore(dir);
const cfg=JSON.parse(readFileSync(join(dir,"private.json"),"utf8"));
process.env.NODE_ENV="test";
const n=await openNative(cfg,dir,store,{provision:false});
try{
 const identity=await n.auth.resolve(store.get("session"));assert.ok(identity?.ownerId&&store.get("save"));
 const current=await n.saveFor(identity.ownerId),scope=hash([identity.ownerId,current.saveId,"root"]);
 const rows=store.history(scope),summary=[];
 assert.equal(current.revision,rows.length);
 if(!repair)assert.equal(rows.length,8);
 const historical=structuredClone(current);
 for(const h of [...rows].reverse()){
   assert.equal(historical.revision,h.revision);
   const receipt=n.core.contracts.TurnReceiptSchema.parse(await n.repo.getReceiptForOwner(identity.ownerId,current.saveId,h.requestKey));
   assert.equal(receipt.resultingRevision,h.revision);assert.equal(receipt.idempotencyKey,h.requestKey);
   assert.equal(receipt.saveId,current.saveId);assert.deepEqual(receipt.decision.events.map(e=>e.type),h.events);
   const rereadHash=hash(receipt);
   const batch=await n.pool.query("SELECT e.* FROM turn_events e JOIN game_saves s ON s.id=e.save_id WHERE s.owner_id=$1 AND e.save_id=$2 AND e.idempotency_key=$3 ORDER BY sequence",[identity.ownerId,current.saveId,h.requestKey]);
   const events=batch.rows.map(e=>({id:e.id,saveId:e.save_id,branchId:e.branch_id,type:e.event_type,source:e.source,ruleVersion:e.rule_version,beforeRevision:e.before_revision,afterRevision:e.after_revision,occurredAt:e.occurred_at.toISOString(),payload:e.payload}));
   assert.deepEqual(events,receipt.decision.events);
   assert.equal(historical.state.locationId,h.native.location);
   assert.equal(historical.state.facts.currentSublocationId,h.native.sub);
   if(repair){
     assert.equal(historical.state.facts.ferryState,h.sceneEvidence.ferry);
     assert.equal(historical.state.facts.obstacleState,h.sceneEvidence.obstacle);
   }
   const hints=n.hints.buildP1NarrativeHints(receipt,historical);
   const body=n.hints.ensureP1NarrativeHints(await n.core.runtime.narrativeFallback(receipt,hints),receipt,hints);
   assert.equal(hash(body),h.bodySha);
   if(repair || instance==="visual-demo" || h.canonicalReceiptSha)assert.equal(canonical(receipt),h.canonicalReceiptSha);
   let extra={};
   if(!repair && h.revision===5){
      const e=receipt.decision.events.find(e=>e.type==="move.arrived");
      const sub=e.payload.stateDelta.factChanges.find(d=>d.key==="currentSublocationId");
      assert.equal(e.payload.from,rows[3].native.location);assert.equal(sub.before.value,rows[3].native.sub);
      extra={from:e.payload.from,subBefore:sub.before.value,to:e.payload.to,subAfter:sub.after.value};
   }
   if(!repair && h.revision===8){
      const ctx=n.hints.buildP1NarrativeHints(receipt,current);
      const body=n.hints.ensureP1NarrativeHints(await n.core.runtime.narrativeFallback(receipt,ctx),receipt,ctx);
      assert.equal(hash(body),h.bodySha);extra={reconstructedCurrentBodySha:hash(body)};
   }
   for(const event of [...events].reverse()){
     const delta=event.payload.stateDelta;
     assert.equal(event.afterRevision,h.revision);
     if(delta.locationChange){
       assert.equal(historical.state.locationId,delta.locationChange.after);
       historical.state.locationId=delta.locationChange.before;
     }
     for(const {key,before,after} of delta.factChanges){
       const facts=historical.state.facts;
       assert.equal(Object.hasOwn(facts,key),after.present);
       if(after.present)assert.deepEqual(facts[key],after.value);
       if(before.present)facts[key]=before.value;
       else delete facts[key];
     }
     historical.state.elapsedMinutes-=delta.timeChange;
   }
   historical.revision--;
   summary.unshift({revision:h.revision,originalReturnSha:h.receiptSha,rereadHash,byteDigestMatches:rereadHash===h.receiptSha,
     canonicalPgReceiptSha:canonical(receipt),canonicalAtOriginalSubmission:h.canonicalReceiptSha??null,matchedIndependentEvents:events.length,matchedBodySha:hash(body),...extra});
 }
 const live=publicState(current,n.labels);
 console.log(JSON.stringify({authenticatedReceipts:summary,live:{place:live.place,sub:live.sub,revision:live.revision,quest:live.quest},executeCalls:0}));
}finally{await n.pool.end();store.db.close()}
