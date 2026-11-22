import assert from "node:assert/strict";
import {fixture} from "./fixture.mjs";
import {sha256} from "../../image-tasks/files.mjs";

const calls=[];
for(const operation of ["generate","edit","evening"]){
  const f=fixture({operation});
  try{
    const result=await f.provider.send(f.claim);
    assert.equal(result.state,"returned");assert.equal(f.requests.length,1);
    const [req]=f.requests,edit=operation!=="generate";
    const fields=edit?Object.fromEntries(await req.formData()):await req.json();
    const ref=edit?sha256(Buffer.from(await fields["image[]"].arrayBuffer())):null;
    const promptHash=sha256(fields.prompt);assert.equal(promptHash,result.promptSha256);
    calls.push({operation,origin:result.origin,path:new URL(req.url).pathname,method:req.method,encoding:edit?"multipart/form-data":"application/json",
      model:fields.model,size:fields.size,quality:fields.quality,n:Number(fields.n),format:fields.output_format,people:f.plan.target.people.length,
      referenceSha256:ref,promptSha256:promptHash,outputSha256:sha256(result.bytes),usage:result.metadata.usage,cost:result.metadata.cost});
  }finally{f.ledger.close();}
}
console.log(JSON.stringify({networkPermission:process.permission.has("net"),calls}));
