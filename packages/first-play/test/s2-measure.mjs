import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync,writeFileSync} from "node:fs";
import {isDeepStrictEqual as equal} from "node:util";
import {hash} from "../../scene-state/store.mjs";
import {reviewVisualHistory,reviewAssetUse} from "../visual-consistency.mjs";
import {syntheticRegistry} from "../scene-registry.mjs";
import {MockImageMoney} from "../../openai-image/money.mjs";
import {S2ReplayProvider} from "../../openai-image/test/s2-replay-bridge.mjs";
import {initialPng} from "./s2-png.mjs";
import {session} from "./s2-host.mjs";

assert.equal(process.permission?.has("net"),false);
const corpus=new URL("./s2-corpus/",import.meta.url),manifest=createHash("sha256"),groups={},cases=[],errors=[],examples=[];
const fileHashes={},inputs=new Map();
const score=()=>({literalCorrectAccept:0,literalCorrectAbstain:0,literalWrongAccept:0,literalUnnecessaryAbstain:0,
  correctEligible:0,correctReview:0,correctConflict:0,correctNotReady:0,dangerousAllow:0,unnecessaryBlock:0,wrongVerdictOrReason:0});
function describe(v){
  if(!v)return null;
  const {sceneId:place,visualVersion:version,viewpoint,perspective,features,people,timeOfDay,lighting}=v;
  return {place,version,viewpoint,perspective,features,people,timeOfDay,lighting};
}
for(const file of readdirSync(corpus).sort()){
  const bytes=readFileSync(new URL(file,corpus));manifest.update(file+"\0").update(bytes);fileHashes[file]=hash(bytes);
  for(const line of bytes.toString("utf8").trimEnd().split("\n")){
    const c=JSON.parse(line),saved=session(c.scope),stats=groups[c.split]??=score();
    inputs.set(c.id,c);
    for(const t of c.prefix)saved.append(t);
    const ctx=saved.append(c.text,c.action),v=ctx.result.visual,actual=describe(v);
    assert.equal(ctx.revision,c.revision);
    if(equal(actual,c.expectedLiteral))stats[actual?"literalCorrectAccept":"literalCorrectAbstain"]++;
    else {stats[actual?"literalWrongAccept":"literalUnnecessaryAbstain"]++;errors.push([c.id,"literal"]);}
    if(c.fault==="revoked")ctx.authorized=false;
    if(c.fault==="foreign-scope")ctx.scope="another-scope";
    const checked=reviewVisualHistory(ctx);let verdict=checked.review;
    if(c.fault?.endsWith("-reference")){
      const bytes=initialPng,sha=hash(bytes);
      const asset={schemaVersion:"0.1",target:structuredClone(v),requestKey:"synthetic",attemptId:"original",assetId:"original",reference:null,
        sha256:sha,format:"png",storageKey:sha+".png",width:1536,height:864,invalidated:false,
        review:{id:"review-1",basis:"mock",reason:"evaluated",assessment:"matches",status:"accepted"}};
      const plan={schemaVersion:"0.1",target:v,assetId:asset.assetId,action:"reuse",reason:"same-state"};
      assert.equal(reviewAssetUse(checked,plan,{asset,bytes,active:true}).imageEligible,true);
      if(c.fault==="wrong-scene-reference")asset.target.sceneId="another";
      else if(c.fault==="invalidated-reference")asset.invalidated=true;
      else asset.review.status=c.fault.split("-")[0];
      verdict=reviewAssetUse(checked,plan,{asset,bytes,active:true});
    }
    if(verdict.imageEligible && !c.imageEligible)stats.dangerousAllow++;
    if(!verdict.imageEligible && c.imageEligible)stats.unnecessaryBlock++;
    if(verdict.verdict!==c.verdict || verdict.reason!==c.reason){stats.wrongVerdictOrReason++;errors.push([c.id,c.verdict,c.reason,verdict.verdict,verdict.reason]);}
    else stats[{eligible:"correctEligible","needs-review":"correctReview",conflict:"correctConflict","not-ready":"correctNotReady"}[verdict.verdict]]++;
    for(const e of verdict.evidence){
      const row=ctx.history[(e.revision??e.priorRevision)-1];assert.equal(hash(row.narrative),e.sha256);
      if(e.revision)assert.ok(row.narrative.slice(e.start,e.end).length>0);
    }
    if(actual && c.expectedLiteral)for(const [field,span] of Object.entries(c.spans)){
      if(!ctx.audit.fields[field])continue;
      assert.ok(ctx.audit.fields[field].spans.some(i=>{const e=ctx.audit.evidence[i];return equal([e.start,e.end],span);}),c.id+" "+field);
    }
    if(["A0","A16","A20","B6","B8","C0a"].includes(c.id))examples.push({id:c.id,review:verdict});
    cases.push({id:c.id,narrativeSha256:hash(c.text),reviewSha256:verdict.reviewSha256??null,authenticatedFieldReady:verdict.fieldReady,revision:ctx.revision,fieldReady:Boolean(v),verdict:verdict.verdict,reason:verdict.reason});
  }
}
const regressions=[];
for(const id of ["P30","P50"]){
  const oldDir=new URL("./s1-corpus/",import.meta.url);
  const c=readdirSync(oldDir).flatMap(f=>readFileSync(new URL(f,oldDir),"utf8").trimEnd().split("\n").map(JSON.parse)).find(x=>x.id===id);
  const saved=session(id,syntheticRegistry),ctx=saved.append(c.text),review=reviewVisualHistory(ctx).review;
  assert.ok(ctx.result.visual);assert.equal(review.verdict,"needs-review");assert.equal(review.reason,"temporal-lighting-ambiguity");
  regressions.push({id,fieldReady:review.fieldReady,imageEligible:review.imageEligible,reason:review.reason});
}
const extraChecks=[];
function probe(name,test){test();extraChecks.push(name);}
const getContext=(texts,label)=>{const s=session(label);for(const t of texts)s.append(t);return s.context();};
probe("authenticated field offsets, revision and prior disclosure hash must match",()=>{
  const c=inputs.get("A16"),ctx=getContext([...c.prefix,c.text],"corruption");
  for(const mutation of [x=>x.receipts[0].narrativeSha256="0".repeat(64),x=>x.receipts[1].method="unknown",
    x=>x.audit.evidence[0].end++,x=>x.result.visual.people.push("未曾揭示"),x=>x.revision++,x=>x.receipts[0].source.ownerId="foreign"]){
    const x={...ctx,receipts:structuredClone(ctx.receipts),audit:structuredClone(ctx.audit),result:structuredClone(ctx.result)};
    mutation(x);assert.equal(reviewVisualHistory(x).review.reason,"source-mismatch");
  }
});
probe("lighting exception binds its emitter in the actual prompt and ends after the next survey",()=>{
  const c=inputs.get("A16"),s=session("exception-frame");
  s.append(c.prefix[0]);const ctx=s.append(c.text);
  const provider=new S2ReplayProvider({mode:"mock",moneyGate:new MockImageMoney("00000000-0000-4000-a000-000000000001")});
  const plan={schemaVersion:"0.1",action:"generate",reason:"preview",target:ctx.result.visual};
  const frame=provider.buildFrame({plan},ctx);
  assert.ok(frame.prompt.includes("竹屏上的引日阵照出日光"));
  assert.equal(hash(frame.prompt),frame.binding.promptSha256);
  assert.equal(reviewVisualHistory(s.append("你们谈了谈茶价。")).review.verdict,"needs-review");
  const moved=getContext([c.prefix[0],c.text.replace("此时我身在","我回到")],"moved");
  assert.equal(reviewVisualHistory(moved).review.verdict,"needs-review");
});
probe("side view and unclassified current local constraint require inspection",()=>{
  const c=inputs.get("A24");
  const side=getContext([c.prefix[0],c.text.replace("望北侧","望西侧")],"side");
  assert.equal(reviewVisualHistory(side).review.reason,"view-angle-undetermined");
  const opaque=getContext([c.prefix[0].replace("位于我正北方，我背向它时便看不见它","在迷雾中忽隐忽现"),c.text],"opaque");
  assert.equal(reviewVisualHistory(opaque).review.reason,"unverified-local-observation");
});
probe("same visual version cannot reuse a picture explained by a different emitter",()=>{
  const c=inputs.get("A16"),s=session("two-emitters");s.append(c.prefix[0]);
  const before=s.append(c.text),prior=before.result.visual;
  s.append(c.prefix[0].replace("竹屏上的","铜柱上的"));const ctx=s.append(c.text);
  const checked=reviewVisualHistory(ctx);assert.ok(checked.review.imageEligible);
  assert.equal(prior.visualVersion,ctx.result.visual.visualVersion);
  const digest=hash(initialPng),asset={schemaVersion:"0.1",target:prior,requestKey:"a",attemptId:"a",assetId:"a",reference:null,
    sha256:digest,format:"png",storageKey:digest+".png",width:1536,height:864,invalidated:false,
    review:{id:"r",basis:"fixture",reason:"test-only",status:"accepted",assessment:"matches"}};
  const plan={schemaVersion:"0.1",action:"reuse",assetId:"a",reason:"reuse",target:ctx.result.visual};
  assert.equal(reviewAssetUse(checked,plan,{active:true,asset,bytes:initialPng}).imageEligible,false);
});
probe("explicit continuing light source must agree with the current survey",()=>{
  const c=inputs.get("A16");
  const ctx=getContext([...c.prefix,c.text.replace("夜间","正午")],"changed-time");
  assert.equal(reviewVisualHistory(ctx).review.reason,"light-source-disagrees-with-survey");
  assert.equal(reviewVisualHistory(null).review.reason,"access-denied");
});
for(const scores of Object.values(groups)){
  assert.equal(scores.dangerousAllow,0);
  assert.equal(scores.unnecessaryBlock,0);
}
const corpusSha256=manifest.digest("hex");
assert.equal(corpusSha256,"ee1575bfb816524503507ec5284bcdc48e7a29f4138120975efe3428f2d18a8d");
const report={method:"visual-consistency/1",node:process.version,corpusSha256,fileHashes,count:cases.length,examples,extraChecks,
  humanReview:"INDEPENDENT_HUMAN_REVIEW_NOT_RUN",groups,regressions,errors,cases,networkPermission:false};
console.log(JSON.stringify({count:cases.length,groups,errors,hash:report.corpusSha256}));
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+"\n",{flag:"wx"});
assert.deepEqual(errors,[]);
