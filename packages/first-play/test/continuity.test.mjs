import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join} from "node:path";
import {extractSaved} from "../extract.mjs";
import {extractContinuity} from "../continuity.mjs";

const json=async file=>JSON.parse(await readFile(new URL(file,import.meta.url)));
const corpus=await json("continuity-corpus.json");
const reference=await json("reference.json"),prose=await json("prose.json");
const source={kind:"card-history",evidence:"completed-history"};
function state(people){
  return {current:"east",places:[{scene:{sceneId:"east",name:"青石酒馆",aliases:[],parentSceneId:"东村"},
    facts:{...corpus.baseline,people}}]};
}
const fmt=o=>o.field?o.type+":"+o.field+"="+(o.values?.join("/")??o.value):o.type+(o.sceneId?":"+o.sceneId:o.name?":"+o.name:"");
const abandoned=v=>v.some(op=>["hold","unknown"].includes(op));
const empty={current:null,places:[]};
const batches={
  reference:reference.map(([id,text,ops])=>({id,text,ops,before:id==="建立场景"?empty:state(["掌柜","蓝衣客","赭衣客"])})),
  prose:prose.map(([text,ops],i)=>({id:"P"+(i+1),text,ops,before:state(["掌柜","紫衣客","蓝衣客"])})),
  continuity:corpus.cases.map(c=>({...c,before:state(corpus.baseline.people)}))
};
test("both versioned extractors on fixed labeled passages, including deliberate abstentions",async t=>{
 const evidence={};
 for(const extract of [extractSaved,extractContinuity]){
  const byBatch=evidence[extract.method]={};
  for(const [batch,cases] of Object.entries(batches)){
   const stats={exact:0,incorrectAccept:0,abstain:0,unnecessaryAbstain:0,wrongAbstentionKind:0},rows=[];
   for(const {id,text,ops,before} of cases){
    const input={source,narrative:text,state:before};
    const out=extract({...input,action:"走出去"}),actual=out.observations.map(x=>fmt(x.operation));
    assert.deepEqual(extract({...input,action:"走进来"}),out);
    assert.ok(out.audit.evidence.every(e=>text.slice(e.start,e.start+e.length).length===e.length && e.length>0));
    const equal=JSON.stringify(actual)===JSON.stringify(ops);
    const category=abandoned(actual)?"abstain":equal?"exact":"incorrectAccept";
    stats[category]++;
    if(category==="abstain" && !abandoned(ops))stats.unnecessaryAbstain++;
    if(category==="abstain" && abandoned(ops) && !equal)stats.wrongAbstentionKind++;
    rows.push({id,expected:ops,actual,category});
   }
   byBatch[batch]={stats,rows};t.diagnostic(JSON.stringify({method:extract.method,batch,...stats}));
   if(extract===extractContinuity){
    assert.equal(stats.incorrectAccept,0,JSON.stringify(rows.filter(r=>r.category==="incorrectAccept")));
    if(batch!=="reference")assert.equal(stats.unnecessaryAbstain,0,JSON.stringify(rows.filter(r=>r.category==="abstain")));
    if(batch==="continuity")assert.equal(stats.wrongAbstentionKind,0,JSON.stringify(rows.filter(r=>abandoned(r.actual) && abandoned(r.expected) && r.actual[0]!==r.expected[0])));
   }
  }
 }
 if(process.env.YJ09_EVIDENCE_DIR){
   await mkdir(process.env.YJ09_EVIDENCE_DIR,{recursive:true});
   await writeFile(join(process.env.YJ09_EVIDENCE_DIR,"corpus.json"),JSON.stringify(evidence,null,2)+"\n");
 }
});
