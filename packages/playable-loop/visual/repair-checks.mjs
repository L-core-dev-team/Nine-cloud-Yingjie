import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {binding,bindPicture,describe,recordDisplay,target} from "./pictures.mjs";
import {bindScene} from "./scene-policy.mjs";
const ev=new URL("../../../docs/reports/evidence/YJ-P05-VISUAL-REPAIR-01/",import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,ev)));
const counts={A:2,B:10,C:4};
const matrix=read("matrix.json");
const kinds={scan:"observe",chat:"talk",berm:"move","combat:npc_shuiyuya":"combat","quest:claim":"quest",loc_wangqitai:"move",loc_luhuadu:"move","parent ferry via native move":"move"};
let total=0,events=0,legalFailure=0;
for(const [instance,count] of Object.entries(counts)){
  const store=new Map();
  const pg=readFileSync(new URL("pg-"+instance.toLowerCase()+".jsonl",ev),"utf8").trim().split(/\r?\n/).map(JSON.parse).at(-1);
  assert.equal(pg.authenticatedReceipts.length,count);
  for(let rev=1;rev<=count;rev++){
    const {h,b,shown,expected}=read(instance+rev+".json");
    const rebuilt=bindScene(store,h,{kind:kinds[matrix[instance][rev-1]]});
    assert.deepEqual(rebuilt,b);assert.equal(b.asset,expected);
    assert.equal(b.receipt,pg.authenticatedReceipts[rev-1].canonicalPgReceiptSha);
    assert.equal(h.bodySha,pg.authenticatedReceipts[rev-1].matchedBodySha);
    if(b.asset){
      assert.deepEqual(target(store,h.scope,h.native,"current",rev,b.key),b);
      assert.equal(recordDisplay(store,b,"current","decoded").state,shown.state);
    }
    events+=pg.authenticatedReceipts[rev-1].matchedIndependentEvents;total++;
    if(h.sceneEvidence.outcome==="legal_failure")legalFailure++;
  }
}
const A=read("A1.json"),B=read("B2.json");
assert.notEqual(A.h.scope,B.h.scope);
const store=new Map();
// Isolated compatibility fixture: leave a v1 off-route row byte-identical while the
// next authenticated observation is evaluated by v2 with no onRoute dependency.
const old=bindPicture(store,A.h,{id:"loc_wangqitai"});
assert.equal(old.onRoute,false);
const original=JSON.stringify(old);
const newObserved=bindScene(store,{...A.h,revision:2},{kind:"move"});
assert.equal(newObserved.asset,"I03");
assert.equal(original,JSON.stringify(binding(store,A.h.scope,1)));
assert.equal(describe(store,A.h.scope,1),null);
assert.throws(()=>target(store,B.h.scope,{...A.h.native,revision:2},"current",2,newObserved.key),e=>e.status===404);
const unknownSuffix={...A.h,text:A.h.text+"\n山脊已被遮挡。"};
const {hash}=await import("../data.mjs");unknownSuffix.bodySha=hash(unknownSuffix.text);
assert.equal(bindScene(new Map(),unknownSuffix,{kind:"move"}).asset,null);
const damaged={...newObserved,bodySha:null};
store.set("picture:"+A.h.scope+":2",JSON.stringify(damaged));
assert.equal(describe(store,A.h.scope,2),null);
assert.deepEqual(read("personal-before.json").state,read("personal-after.json").state);
assert.deepEqual(read("B-before.json"),read("B-after.json"));
console.log(JSON.stringify({accepted:total,legalFailure,rejectedRequests:0,independentEvents:events,canonicalAndTextMatched:total,
  controls:["replay all actual rows without changing first answers","v1 off-route retained and v2 observation succeeds","foreign scope denied","unrecognized extra sentence hides picture","missing legacy evidence hides picture","B7 identical recovery","personal history identical"],nativeActionsInReplay:0}));
