import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {session} from "../../first-play/test/s2-host.mjs";
import {replayHighlights2R} from "./replay.mjs";
assert.equal(process.permission?.has("net"),false);
const output={};
for(const file of ["locked.jsonl","h2-locked.jsonl"]){
  let tp=0,miss=0,fp=0,tn=0,top1=0,eligibleStories=0,prefixes=0;
  const stories=[],failures=[];
  for(const s of readFileSync(new URL("../test/"+file,import.meta.url),"utf8").trim().split("\n").map(JSON.parse)){
    const host=session("h2r-compat-"+s.id),texts=s.history??s.turns.map(t=>t.text),gold=s.kinds??s.turns.map(t=>t.expected.type);
    const ctxs=texts.map(x=>({...host.append(x),replayOnly:true}));
    const run=replayHighlights2R(ctxs.at(-1)),rank=run.rounds.at(-1).ranking.map(id=>run.candidates.find(c=>c.id===id).revision);
    const target=s.rank??s.turns.at(-1).expected.top3;
    const rows=[];
    for(const [i,r] of run.rounds.entries()){
      const pos=gold[i]!=="ordinary",detected=r.state==="confirmed-peak";
      if(pos&&detected)tp++;else if(pos)miss++;else if(detected)fp++;else tn++;
      if(pos!==detected)failures.push({story:s.id,r:i+1,gold:gold[i],state:r.state,reason:r.reason});
      const cut=replayHighlights2R(ctxs[i]);assert.deepEqual(cut.rounds,run.rounds.slice(0,i+1));
      assert.deepEqual(cut.candidates,run.candidates.filter(c=>c.revision<=i+1));
      assert.deepEqual(cut.events,run.events.filter(e=>e.learnedAt<=i+1));prefixes++;
      rows.push([r.state,r.cadence.action]);
    }
    if(target.length){eligibleStories++;top1+=Number(rank[0]===target[0]);}
    if(rank[0]!==target[0])failures.push({story:s.id,goldFirst:target[0],ranking:rank});
    stories.push({id:s.id,rows,rank});
  }
  output[file]={tp,miss,fp,tn,top1,eligibleStories,prefixes,stories,failures};
}
console.log(JSON.stringify(output));
