import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {fixture,answer,output,png} from "./fixture.mjs";
import {sha256} from "../../image-tasks/files.mjs";
import {requestKey} from "../../contracts/dist/index.js";
import {rejected,east,prose} from "../../first-play/test/scene-evidence-fixtures.mjs";
import {OpenAIImageProvider,fixtureCredential} from "../index.mjs";
import {specification,buildFrame,replaySaved} from "../prompt.mjs";
import {maxJsonBytes} from "../protocol.mjs";

const use=(t,opts)=>{const f=fixture(opts);t.after(()=>f.ledger.close());return f;};
test("network denied, dormant provider and fixed model",async()=>{
  assert.equal(process.permission?.has("net"),false);
  const p=new OpenAIImageProvider({credentialsProvider(){assert.fail("unexpected credentials read");}});
  assert.equal((await p.generate({})).reason,"LIVE_DISABLED");
  assert.throws(()=>new OpenAIImageProvider({modelConfig:"different"}),/unsupported-model/);
});
for(const operation of ["generate","edit","evening"]){
  test(operation+" encodes only cleared visual facts",async t=>{
    const f=use(t,{operation}),edit=operation!=="generate";
    f.respond=async r=>{
      assert.equal(r.url,"https://api.openai.com/v1/images/"+(edit?"edits":"generations"));
      assert.equal(r.method,"POST");assert.equal(r.redirect,"error");assert.equal(r.credentials,"omit");
      assert.equal(r.headers.get("authorization"),"Bearer "+fixtureCredential);
      let fields;
      if(edit){
        assert.match(r.headers.get("content-type"),/^multipart\/form-data; boundary=/);
        const form=await r.formData();assert.equal(form.getAll("image[]").length,1);
        const image=form.get("image[]");assert.equal(image.type,"image/png");assert.equal(image.name,"reference.png");
        assert.equal(sha256(Buffer.from(await image.arrayBuffer())),f.ctx.asset.sha256);
        form.delete("image[]");fields=Object.fromEntries(form);assert.equal(fields.n,"1");fields.n=1;
      }else{assert.equal(r.headers.get("content-type"),"application/json");fields=await r.json();}
      const {prompt,...config}=fields;assert.deepEqual(config,specification);
      assert.equal(sha256(prompt),f.frame.binding.promptSha256);assert.doesNotMatch(prompt,/PRIVATE/);
      assert.ok(prompt.includes(edit?'总人数":5':'总人数":3'));assert.ok(prompt.includes("柜台"));
      if(edit)assert.ok(prompt.includes("留存人物"));
      if(operation==="edit")assert.ok(prompt.includes('到场":["紫衣客","绿衣客"]'));
      if(operation==="evening"){
        assert.ok(prompt.includes("灯笼亮起"));const delta=JSON.parse(prompt.split("\r\n").at(-1));
        assert.equal(delta.留存人物.length,5);assert.deepEqual(delta.到场,[]);assert.deepEqual(delta.离场,[]);
      }
      return answer();
    };
    // Keep assertions outside adapter error sanitization by checking the returned terminal result.
    const result=await f.provider.send(f.claim);assert.equal(result.state,"returned");
    assert.deepEqual(result.bytes,output);assert.equal(result.metadata.usage,null);
    assert.equal(result.metadata.providerRequestId,null);assert.equal(result.metadata.cost,null);assert.equal(result.origin,"mock");
    assert.equal(f.requests.length,1);
  });
}
test("changing visible evidence changes prompt and request bindings",t=>{
  const a=use(t),b=use(t,{operation:"edit"}),c=use(t,{operation:"evening"});
  assert.equal(new Set([a,b,c].map(f=>f.frame.binding.promptSha256)).size,3);
});
test("L3 complete initial survey binds the saved viewpoint and exact roster",async t=>{
  const f=use(t);f.ctx.history[0].narrative=prose(east);
  f.ctx.result=replaySaved(f.grant.owner,f.grant.sessionId,f.ctx.history)[0];
  f.plan.target=f.ctx.result.visual;f.claim.attempt.requestKey=requestKey(f.plan);
  const frame=buildFrame(f.claim,f.ctx);f.grant.images=[frame.bindingSha256];
  assert.equal((await f.provider.send(f.claim)).state,"returned");
  const body=await f.requests[0].json();assert.ok(body.prompt.includes("玩家向北所见"));
  assert.ok(body.prompt.includes("正午"));assert.ok(!body.prompt.includes(f.ctx.history[0].narrative));
});
const gates={
  "not-ready":f=>f.ctx.result.status="not-ready", partial:f=>f.ctx.history[0].narrative=rejected.nonexclusive,
  "wrong owner":f=>f.grant.owner="other","wrong session":f=>f.grant.sessionId=randomUUID(),
  "wrong scene":f=>f.claim.plan.target.sceneId="elsewhere","wrong version":f=>f.claim.plan.target.visualVersion="stale",
  "revoked viewing":f=>f.ctx.authorized=false,"images disabled":f=>f.ctx.enabled=false,
  "different claim":f=>f.claim.attempt.requestKey="changed","unset outbound":f=>f.grant.images=[],
  "unknown capability":f=>f.claim.attempt.capability={...f.provider.capability,referenceEdit:"unknown"},
  "inactive reference":f=>f.ctx.referenceActive=false,"old accepted image":f=>f.ctx.latestAcceptedId=randomUUID(),
  "digest mismatch":f=>f.claim.referenceBytes=output,"missing PNG":f=>f.claim.referenceBytes=null,
  "pending review":f=>f.ctx.asset.review.status="pending","invalidation":f=>f.ctx.asset.invalidated=true,
  "local display only":f=>f.grant.externalImageProcessing=false,"unlicensed bytes":f=>f.grant.references=[],
  "foreign reference":f=>f.ctx.asset.target.source.sessionId=randomUUID(),"bad dimensions":f=>f.ctx.asset.width=10,
  "review replaced":f=>f.ctx.asset.review.id="other","expired grant":f=>f.grant.expiresAt=1,
  "wrong format":f=>f.ctx.asset.format="jpeg","changed narrative":f=>f.ctx.history[1].narrative="PRIVATE"
};
for(const [name,mutate] of Object.entries(gates))test("gate / "+name,async t=>{
  const f=use(t,{operation:"edit"});mutate(f);
  if(name!=="different claim")f.claim.attempt.requestKey=requestKey(f.plan);
  assert.equal((await f.provider.send(f.claim)).state,"refused");
  assert.equal(f.requests.length,0);assert.deepEqual(f.ledger.summary(),[]);
});
for(const action of ["skip","reuse","preset"])test("no transport for "+action,async t=>{
  const f=use(t);f.claim.plan.action=action;assert.equal((await f.provider.send(f.claim)).reason,"no-call");assert.equal(f.requests.length,0);
});
const responseCases={
  "400":["failed",()=>new Response(null,{status:400})],"401":["refused",()=>new Response(null,{status:401})],
  "403":["refused",()=>new Response(null,{status:403})],"429":["failed",()=>new Response(null,{status:429})],
  "500":["unknown",()=>new Response(null,{status:500})],"redirect":["unknown",()=>new Response(null,{status:307})],
  "timeout":["unknown",()=>new Promise(()=>{})],"disconnect":["unknown",()=>{throw Error("lost");}],
  "stream stalled":["unknown",()=>new Response(new ReadableStream({}),{headers:{"content-type":"application/json"}})],
  "stream error":["unknown",()=>new Response(new ReadableStream({start(c){c.error(Error("lost"));}}),{headers:{"content-type":"application/json"}})],
  "json":["unknown",()=>new Response("{",{headers:{"content-type":"application/json"}})],
  "model":["unknown",()=>answer({model:"wrong"})],"no images":["unknown",()=>answer({data:[]})],
  "two images":["unknown",()=>answer({data:[{},{}]})],"url":["unknown",()=>answer({data:[{b64_json:output.toString("base64"),url:"https://unused.invalid/"}]})],
  "bad base64":["unknown",()=>answer({data:[{b64_json:"%%%="}]})],
  "truncated PNG":["unknown",()=>answer({data:[{b64_json:output.subarray(0,-12).toString("base64")}]})],
  "CRC":["unknown",()=>{const bytes=Buffer.from(output);bytes[34]^=1;return answer({data:[{b64_json:bytes.toString("base64")}]});}],
  "format":["unknown",()=>answer({output_format:"jpeg"})],"quality":["unknown",()=>answer({quality:"low"})],
  "pixel dimensions":["unknown",()=>answer({data:[{b64_json:png(16,16).toString("base64")}]})],
  "large dimensions":["unknown",()=>answer({data:[{b64_json:png(100000,100000).toString("base64")}]})],
  "oversize declaration":["unknown",()=>new Response("{}",{headers:{"content-type":"application/json","content-length":String(maxJsonBytes+1)}})],
  "oversize stream":["unknown",()=>new Response(new Uint8Array(maxJsonBytes+1),{headers:{"content-type":"application/json"}})],
  "usage mismatch":["unknown",()=>answer({usage:{input_tokens:1,output_tokens:2,total_tokens:4}})]
};
const diagnostics={"500":"http-5xx",redirect:"unconfirmed-response",timeout:"deadline",disconnect:"transport-interrupted",
  "stream stalled":"deadline","stream error":"transport-interrupted",json:"invalid-json",model:"wrong-output",
  "no images":"wrong-output","two images":"wrong-output",url:"invalid-image","bad base64":"invalid-base64",
  "truncated PNG":"invalid-png",CRC:"invalid-png",format:"wrong-output",quality:"wrong-output",
  "pixel dimensions":"wrong-dimensions","large dimensions":"invalid-png","oversize declaration":"response-too-large",
  "oversize stream":"response-too-large","usage mismatch":"invalid-usage"};
for(const [name,[expected,respond]] of Object.entries(responseCases))test("response / "+name,async t=>{
  const f=use(t);f.respond=respond;if(name==="timeout"||name==="stream stalled")f.provider.timeoutMs=35;
  const result=await f.provider.send(f.claim);assert.equal(result.state,expected);assert.equal(result.bytes,undefined);
  if(expected==="unknown")assert.equal(result.diagnostic,diagnostics[name]);
  else assert.equal(result.reason,"http-"+name);
  f.claim.attempt.attemptId=randomUUID();assert.equal((await f.provider.send(f.claim)).state,"unknown");
  assert.equal(f.requests.length,1);assert.equal(f.ledger.summary()[0].state,expected);
});
test("changing requestKey cannot repeat an occupied event",async t=>{
  const f=use(t,{operation:"edit"});f.respond=()=>{throw Error();};await f.provider.send(f.claim);
  f.claim.plan.change="alternative";f.claim.attempt.requestKey=requestKey(f.claim.plan);
  f.grant={...f.grant,id:randomUUID(),images:[buildFrame(f.claim,f.ctx).bindingSha256]};
  assert.notEqual(f.claim.attempt.requestKey,f.frame.binding.requestKey);
  assert.equal((await f.provider.send(f.claim)).state,"unknown");assert.equal(f.requests.length,1);
});
