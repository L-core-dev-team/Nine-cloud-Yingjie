import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {bindPicture,catalog,recordDisplay,reviewedBytes,setEnabled,target} from "./pictures.mjs";
const evidence=new URL("../../../docs/reports/evidence/YJ-P05-VISUAL-LOOP-01/",import.meta.url);
const load=name=>JSON.parse(readFileSync(new URL(name,evidence)));
const late=load("continue-r6.json").results;
const rows=[...load("first.json").results,...late].map(x=>x.h);
const store=new Map(),scope=rows[0].scope;
const bind=h=>bindPicture(store,h,{id:catalog.route[h.revision-1].id});
const rejected=(fn,status)=>assert.throws(fn,e=>e.status===status);
const names=[];
function check(name,fn){fn();names.push(name);}
let r1;
check("foreign scope, current subarea, future history rejected",()=>{
  r1=bind(rows[0]);const live=rows[0].native;
  rejected(()=>target(store,"foreign",live,"current",1,r1.key),404);
  rejected(()=>target(store,scope,{...live,sub:"other"},"current",1,r1.key),409);
  rejected(()=>target(store,scope,{...live,revision:0},"history",1,r1.key),404);
});
check("wrong location, rules version, body or event cannot get a binding",()=>{
  for(const change of [{native:{...rows[0].native,location:"elsewhere"}},{ruleVersion:"other"},{text:"另一段"},{events:["move.arrived"]}])
    assert.equal(bind({...rows[0],...change}).asset,null);
  bind(rows[0]);
});
check("a route deviation cannot match later by place or revision",()=>{
  assert.equal(bindPicture(store,rows[1],{id:"scan"}).onRoute,false);
  assert.equal(bind(rows[2]).asset,null);
  bind(rows[1]);bind(rows[2]);
});
check("unseen prior frame cannot carry into a text-only reward",()=>{
  assert.equal(bind(rows[3]).asset,null);
});
check("return without evidence hides the ferry, no earlier ridge display means first at revisit",()=>{
  const ridge=bind(rows[4]);setEnabled(store,scope,false);
  rejected(()=>target(store,scope,rows[4].native,"current",5,ridge.key),404);
  assert.equal(bind(rows[5]).asset,null);assert.equal(bind(rows[6]).asset,null);
  const again=bind(rows[7]);setEnabled(store,scope,true);
  assert.equal(recordDisplay(store,again,"current","decoded").state,"first-display");
  assert.equal(recordDisplay(store,ridge,"history","decoded").state,"history");
  rejected(()=>target(store,scope,rows[7].native,"current",5,ridge.key),409);
});
check("missing and corrupt original are refused; byte-checked originals available",()=>{
  for(const id of Object.keys(catalog.assets))assert.ok(reviewedBytes(id).length);
  rejected(()=>reviewedBytes("I02",()=>{throw Error("missing")}),404);
  rejected(()=>reviewedBytes("I02",()=>Buffer.from("damaged")),404);
});
console.log(JSON.stringify({type:"offline structural controls",passed:names,projectCalls:0}));
