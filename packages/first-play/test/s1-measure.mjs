import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync,writeFileSync} from "node:fs";
import {isDeepStrictEqual} from "node:util";
import {fromCardHistory} from "../../contracts/dist/index.js";
import {project} from "../../scene-state/project.mjs";
import {hash,cardScope} from "../../scene-state/store.mjs";
import {createEvidenceReplay,sceneEvidenceV2} from "../scene-evidence-v2.mjs";
import {createSceneRegistry,syntheticRegistry} from "../scene-registry.mjs";
import {extractSceneEvidence} from "../scene-evidence.mjs";
import {previewInitialFrame} from "../../openai-image/test/s1-preview.mjs";
import {chooseFrame} from "../planner.mjs";
import {imageRequest} from "../../openai-image/protocol.mjs";
import {buildFrame} from "../../openai-image/prompt.mjs";
import {livePreflight} from "../../openai-image/money.mjs";

assert.equal(process.permission?.has("net"),false);
const dir=new URL("./s1-corpus/",import.meta.url), corpus=[], manifest=createHash("sha256");
for(const name of readdirSync(dir).sort()){
  const bytes=readFileSync(new URL(name,dir));manifest.update(name+"\0").update(bytes);
  corpus.push(...bytes.toString("utf8").trimEnd().split("\n").map(line=>JSON.parse(line)));
}
const corpusSha256=manifest.digest("hex");
assert.equal(corpusSha256,"6a6e15a44cb8d6385e38d0e582b8814233fc7b15607f7e6940950b4034ffe249");
const byId=new Map(corpus.map(c=>[c.id,c]));
assert.equal(byId.size,102);
const owner="s1-synthetic",sessionId="00000000-0000-4000-a000-000000000003",opts={owner,sessionId,replayOnly:true};
const setup=(texts,session=sessionId)=>{
  const rows=texts.map((narrative,i)=>({key:"00000000-0000-4000-a000-"+String(i+1).padStart(12,"0"),
    resulting_revision:i+1,action:"PRIVATE_ACTION_SENTINEL",narrative}));
  const receipts=rows.map(row=>({method:"scene-evidence/2",registryDigest:syntheticRegistry.digest,
    source:fromCardHistory(owner,session,row).source,narrativeSha256:hash(row.narrative)}));
  return {rows,receipts};
};
function run(c,version){
  const {rows,receipts}=setup([...c.prefix.map(id=>byId.get(id).text),c.text]);
  const state={current:null,places:[]},isolated=createEvidenceReplay(opts);
  let last;
  for(const [i,row] of rows.entries()){
    if(version==="v2"){
      last=isolated.append(row,receipts[i]);assert.deepEqual(isolated.append(row,receipts[i]),last);
    }else{
      const source=receipts[i].source;
      const {observations,audit}=extractSceneEvidence({state,source,narrative:row.narrative});
      last={audit,result:project(state,source,observations)};
    }
  }
  return last;
}
function describe(result){
  if(result.status!=="ready")return null;
  const {viewpoint,perspective,people,features,timeOfDay,lighting,visualVersion:version,sceneId:place}=result.visual;
  return {place,viewpoint,perspective,people,features,timeOfDay,lighting,version};
}
const categories=["correctAccept","unnecessaryAbstain","incorrectAccept","correctAbstain"];
const empty=()=>Object.fromEntries(categories.map(k=>[k,0]));
const scores={},details=[],failures=[];
for(const version of ["v1","v2"]){
  scores[version]={dev:empty(),accept:empty()};
  for(const c of corpus){
    const {result,audit}=run(c,version),actual=describe(result);
    const category=actual===null?(c.expected?"unnecessaryAbstain":"correctAbstain"):
      (isDeepStrictEqual(c.expected,actual)?"correctAccept":"incorrectAccept");
    scores[version][c.split][category]++;
    if(version==="v2"){
      const spans=audit.evidence.map(e=>[e.start,e.end]);
      details.push({id:c.id,split:c.split,category,reason:audit.blockers,scene:actual?.place??null,version:actual?.version??null});
      if(category==="incorrectAccept" || category==="unnecessaryAbstain")failures.push([c.id,category,actual]);
      assert.deepEqual(run(c,version),{audit,result});
      assert.equal(audit.narrativeSha256,hash(c.text));assert.equal(audit.revision,c.prefix.length+1);
      for(const [i,[a,b]] of spans.entries()){
        assert.ok(a>=0 && b>a && (i===0 || a>=spans[i-1][1]) && b<=c.text.length);
        assert.ok(c.text.slice(a,b).trim());assert.ok(audit.evidence[i].rule);
      }
      for(const [field,indices] of Object.entries(c.spans)){
        if(!actual || !c.expected)continue;
        const relevant=field==="continuity"?Object.keys(audit.fields).filter(f=>audit.fields[f].confirmedFrom && !(f in c.spans)):[field];
        for(const f of relevant){
          assert.equal(audit.fields[f].precision,"complete");
          for(const span of indices)assert.ok(audit.fields[f].spans.some(i=>isDeepStrictEqual(spans[i],span)),c.id+" / "+f);
        }
      }
      if(!c.expected)assert.equal(result.visual,undefined,c.id);
    }
  }
}

const checks=[];
function check(label,fn){fn();checks.push(label);}
const initial=byId.get("P30"), valid=setup([initial.text]);
const preview=(data,extra={})=>previewInitialFrame({owner,sessionId,authorized:true,scope:cardScope(owner,sessionId),...data,...extra});
check("new-scene preview from raw completed history uses the I1 visible-only formatter",()=>{
  for(const id of ["P30","P41","P52"]){
    const c=byId.get(id),data=setup([c.text]);
    const frame=preview(data,{visibleTags:["PRIVATE_TAG","石柱"]});assert.equal(frame.status,"offline-preview");
    const json=JSON.parse(frame.prompt.split("\r\n").at(-1));
    assert.deepEqual(json.完整名单,c.expected.people);assert.deepEqual(json.眼前结构,c.expected.features);
    assert.equal(json.观察位置,c.expected.viewpoint);assert.equal(json.观察视角,c.expected.perspective);
    assert.equal(json.时段,c.expected.timeOfDay);assert.equal(json.光照,c.expected.lighting);
    assert.equal(frame.reference,null);assert.equal(frame.promptSha256,hash(frame.prompt));assert.doesNotMatch(frame.prompt,/PRIVATE|未批准材料/);
    assert.equal(preview(data,{action:"edit"}).status,"no-new-initial-frame");
  }
});
check("every labelled incomplete revision is ineligible for an image preview",()=>{
  for(const c of corpus.filter(c=>!c.expected)){
    assert.deepEqual(preview(setup([...c.prefix.map(k=>byId.get(k).text),c.text])),{status:"not-ready"},c.id);
  }
});
check("source, scope, method, registry, hash, revision and duplicate event mismatches fail closed",()=>{
  assert.throws(()=>createEvidenceReplay({...opts,replayOnly:false}));
  const [row]=valid.rows,[r]=valid.receipts;
  for(const corrupt of [{...r,source:{...r.source,ownerId:"other"}},{...r,source:{...r.source,sessionId:"another"}},
    {...r,narrativeSha256:"wrong"},{...r,method:"scene-evidence/1"},{...r,registryDigest:"other"}])
    assert.throws(()=>createEvidenceReplay(opts).append(row,corrupt));
  const rep=createEvidenceReplay(opts);rep.append(row,r);
  const changed=setup(["另一段正文"]);assert.throws(()=>rep.append(changed.rows[0],changed.receipts[0]),/conflicting/);
  const more=setup([initial.text,initial.text]);assert.throws(()=>createEvidenceReplay(opts).append(more.rows[1],more.receipts[1]),/order/);
  const repeat={...more.rows[1],key:row.key};
  assert.throws(()=>rep.append(repeat,{...more.receipts[1],source:fromCardHistory(owner,sessionId,repeat).source}),/key/);
  assert.throws(()=>preview(valid,{scope:"other"}));assert.throws(()=>preview(valid,{authorized:false}));
  const altSession="00000000-0000-4000-a000-000000000004";
  const elsewhere=setup(["眼前的一切都没有变化。"],altSession);
  assert.equal(createEvidenceReplay({...opts,sessionId:altSession}).append(elsewhere.rows[0],elsewhere.receipts[0]).result.status,"not-ready");
});
check("directory collisions abstain; aliases resolve to the same stable id",()=>{
  assert.equal(syntheticRegistry.resolve("青石酒馆").reason,"ambiguous-place");
  assert.equal(syntheticRegistry.resolve("听竹轩","竹谷").place.sceneId,"bamboo-lodge");
  assert.equal(syntheticRegistry.resolve("听竹轩","北城").reason,"unknown-place");
  const entries=[{sceneId:"a",parentSceneId:"甲地",name:"山门",aliases:["旧门"]},{sceneId:"b",parentSceneId:"甲地",name:"旧门"}];
  assert.equal(createSceneRegistry(entries).resolve("旧门","甲地").reason,"ambiguous-place");
});
check("unknown hides prior visual until full survey; qualified homonyms stay separate",()=>{
  const rows=[byId.get("P00").text,byId.get("P10").text,"有人走了。","我回到东村的青石酒馆。我重新环顾，人物、结构、时段、光照、观察位置和朝向全与离开时相同。",byId.get("P00").text];
  const x=setup(rows),replay=createEvidenceReplay(opts);
  const results=x.rows.map((r,i)=>replay.append(r,x.receipts[i]).result);
  assert.deepEqual(results.map(r=>r.visual?.sceneId??null),["east","west",null,null,"east"]);
  assert.deepEqual(results.at(-1).visual.people,results[0].visual.people);
});
check("UTF-16 astral offset and raw surrounding whitespace",()=>{
  const body="  "+initial.text+"  ",data=setup([body]),out=createEvidenceReplay(opts).append(data.rows[0],data.receipts[0]);
  assert.equal(out.audit.narrativeSha256,hash(body));assert.equal(out.audit.evidence[0].start,2);
  const foreign=setup(["😀。"+initial.text]),entry=createEvidenceReplay(opts).append(foreign.rows[0],foreign.receipts[0]);
  assert.equal(entry.result.status,"not-ready");assert.equal(entry.audit.evidence[1].start,3);
});
check("original builder still rejects a v2-only visual, I2 live release stays disabled",()=>{
  const current=createEvidenceReplay(opts).append(valid.rows[0],valid.receipts[0]).result;
  assert.throws(()=>buildFrame({plan:{schemaVersion:"0.1",action:"generate",target:current.visual,reason:"offline"}},
    {authorized:true,enabled:true,scope:cardScope(owner,sessionId),revision:1,result:current,history:valid.rows}),/unconfirmed/);
  assert.equal(livePreflight().allowLiveSend,false);assert.equal(livePreflight().status,"LIVE_BLOCKED_COST_BOUND");
});
check("compatible partial roster and split viewpoint evidence; contradictory extra witness blocks",()=>{
  const survey=t=>{const x=setup([t]);return createEvidenceReplay(opts).append(x.rows[0],x.receipts[0]);};
  const full=initial.text.replace("你站在山门前，向南望去","我站在山门前。我向南望去");
  const partial=full+"这里还站着林青。";
  const ok=survey(partial);
  assert.equal(ok.result.status,"ready");assert.equal(ok.audit.fields.people.spans.length,2);
  assert.notDeepEqual(ok.audit.fields.viewpoint.spans,ok.audit.fields.perspective.spans);
  const wrong=survey(full+"这里还站着宋安。");assert.ok(wrong.audit.blockers.includes("conflict:people"));
  assert.equal(wrong.result.status,"not-ready");
  const colliding=survey(full+"我向西望去。");assert.ok(colliding.audit.blockers.includes("conflict:perspective"));
  assert.equal(survey(full.replace("林青、守门人","叶澜、宋安")).result.status,"ready");
  assert.equal(survey(full.replace("林青、守门人","沈不在、守门人")).result.status,"not-ready");
  assert.equal(survey(full+"掌柜说：“茶价照旧。”").result.status,"ready");
  assert.equal(survey(full+"掌柜说：“那边还有一人。”").result.status,"not-ready");
});
check("identity is injected, aliases and catalogue data cannot supply missing visual fields",()=>{
  assert.throws(()=>createEvidenceReplay({...opts,registry:{...syntheticRegistry}}),/unregistered-directory/);
  const catalogue=createSceneRegistry([{sceneId:"research-hall",parentSceneId:"桃洲",name:"春波阁",aliases:["春台"]}]);
  const data=setup([initial.text.replace("松岭的宗门山门","桃洲的春台")]);
  const rec={...data.receipts[0],registryDigest:catalogue.digest};
  const replay=createEvidenceReplay({...opts,registry:catalogue});
  assert.equal(replay.append(data.rows[0],rec).result.scene.sceneId,"research-hall");
  assert.throws(()=>createEvidenceReplay(opts).append(data.rows[0],rec),/source-mismatch/);
});
check("active incomplete resurvey holds previous place; only full resurvey lifts the hold",()=>{
  const x=setup([initial.text,"我来到松岭的听松门。这里还站着林青。","眼前的一切都没有变化。",initial.text]);
  const replay=createEvidenceReplay(opts),out=x.rows.map((r,i)=>replay.append(r,x.receipts[i]));
  assert.deepEqual(out.map(o=>o.result.status),["ready","not-ready","not-ready","ready"]);
  assert.equal(out[1].result.scene.sceneId,"pine-gate");
  assert.equal(out[1].audit.fields.people.precision,"partial");assert.equal(out[1].result.visual,undefined);
  assert.equal(out[3].result.visual.visualVersion,"V1");
});
check("a nonvisual conversation preserves only the uninterrupted active frame",()=>{
  const chat="掌柜说：“茶价照旧。”";
  const x=setup([initial.text,chat,"我离开了这里。",chat]);
  const replay=createEvidenceReplay(opts),out=x.rows.map((r,i)=>replay.append(r,x.receipts[i]));
  assert.deepEqual(out.map(o=>o.result.visual?.visualVersion??null),["V1","V1",null,null]);
  assert.equal(out[1].audit.fields.people.basis,"inherited-active");
  assert.deepEqual(out[1].audit.fields.people.spans,[]);assert.equal(out[1].audit.fields.people.confirmedFrom.revision,1);
});
const previews=[];
for(const id of ["P30","P41","P52"]){
  const c=byId.get(id),frame=preview(setup([c.text])),operation="generate";
  const request=imageRequest({binding:{operation},prompt:frame.prompt},"offline-fixture",new AbortController().signal);
  const {prompt,...spec}=await request.json();
  assert.equal(request.method,"POST");assert.equal(request.url,"https://api.openai.com/v1/images/generations");
  assert.equal(hash(prompt),frame.promptSha256);assert.deepEqual(spec,frame.specification);
  previews.push({id,scene:c.expected.place,promptSha256:hash(prompt),reference:null,constructed:1,transmitted:0});
}
checks.push("three I1 request bodies encoded and decoded in memory without transport");
for(const c of corpus.filter(c=>!c.expected)){
  const {result}=run(c,"v2");
  const never=()=>assert.fail("looked up an image for an unknown visual");
  assert.deepEqual(await chooseFrame({taskFor:never},{resolve:never},{authorized:true,result},true),{action:"skip",reason:"not-ready"});
}
checks.push("existing frame planner skipped every non-ready result before asset or preset lookup");
const examples=["P30","P41","P52","N07","N51","C3a","C3d","C3e"].map(id=>{
  const {audit,result}=run(byId.get(id),"v2");
  const {source,fields,...meta}=audit;
  const coverage=Object.fromEntries(Object.entries(fields).map(([field,{confirmedFrom,...rest}])=>
    [field,{...rest,...(confirmedFrom?{priorRevision:confirmedFrom.revision}:{})}]));
  return {id,...meta,fields:coverage,scene:result.scene?.sceneId??null,version:result.visual?.visualVersion??null};
});
const report={node:process.version,method:sceneEvidenceV2,corpusSha256,registryDigest:syntheticRegistry.digest,
  count:corpus.length,scores,checks,failures,previews,details,networkPermission:false,modelQueries:0,textCalls:0,imageCalls:0,costUsd:0};
console.log(JSON.stringify({scores,checks:checks.length,failures,corpusSha256:report.corpusSha256}));
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(examples,null,2)+"\n",{flag:"wx"});
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+"\n",{flag:"wx"});
assert.deepEqual(failures,[]);
