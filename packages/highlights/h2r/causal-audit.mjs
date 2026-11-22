import assert from "node:assert/strict";
import {session} from "../../first-play/test/s2-host.mjs";
import {replayHighlights2R} from "./replay.mjs";
assert.equal(process.permission?.has("net"),false);

// Diagnostics on the frozen implementation. These cases do not enter held denominators.
const title="旧陶场属于邢黎。", signed="邢黎签了把陶场赠给陶会的契书。",effect="陶场的产权当日登记在陶会名下。";
const cases=[
  ["compatible-public-registration",[title,signed,effect],true],
  ["superseding-owner",[title,signed,"旧陶场属于罗齐。",effect],false],
  ["rejected-document",[title,signed,"陶场的赠契已作废。",effect],false],
  ["counterfeit-reported-with-different-wording",[title,signed,"验契官验明那张签条系冒签，裁定自始不算数。",effect],false],
  ["narrator-retracts-in-same-revision",[title,signed,effect+"上句是碑上刻错的旧话，实际从未过户。"],false],
  ["later-clarification-is-not-earlier-proof",[signed,effect,title],false],
  ["opaque-recipient",[title,"邢黎签了赠陶场的契。","另一桩诉讼结案。产权当天换到陶会名下。"],false],
  ["separate-agreement",[title,signed,"学宫另收了一卷书。书卷的产权当日登记在陶会名下。"],false],
  ["temporary-bookkeeping-while-disputed",[title,signed,effect+"这只是为诉讼临时挂名，受赠人还没有取得产权。"],false],
  ["two-sole-owners-conflict",[title,"新陶场是巩珠的私产。",signed,effect],false],
  ["earnings-route-not-a-personal-waiver",["雷丹掌着窑费的收入。","她暂时把账册交给弟子，往后每笔窑费都直接进了州库公账。"],false],
  ["new-disposition-after-void",[title,signed,"赠契已作废。",signed,effect],true]
];
const results=[];
for(const [label,texts,expected] of cases){
  const host=session("post-freeze-audit-"+label);
  for(const text of texts)host.append(text);
  const run=replayHighlights2R({...host.context(),replayOnly:true});
  const c=run.candidates.find(x=>x.frame==="durable-right"||x.frame==="rights-transfer");
  results.push({label,texts,expected,confirmed:Boolean(c),pass:expected===Boolean(c),evidence:c?.evidence,
    finalCadence:run.rounds.at(-1).cadence.action,send:run.rounds.at(-1).cadence.send});
}
console.log(JSON.stringify({results,failed:results.filter(x=>!x.pass).map(x=>x.label)}));
if(results.some(x=>!x.pass))process.exitCode=1;
