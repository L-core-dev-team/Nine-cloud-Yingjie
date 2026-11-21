import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {withDatabase} from "../scene-state/test/local-db.mjs";
import {withHost} from "../ui-shell/test/host.mjs";
import {counters} from "./cluster.mjs";

const state=JSON.parse(await readFile(join(process.env.YJ13_CLUSTER,"state.json"),"utf8"));
assert.equal(state.format,"yj13-local-v1");
assert.equal((await counters(state)).globalSent,0);
await withDatabase(pool=>withHost(pool,async({origin})=>{
  const request=email=>fetch(origin+"/api/auth/code",{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify({email})});
  for(let n=0;n<60;n++) assert.equal((await request(randomUUID()+"@example.invalid")).status,202);
  const before=await counters(state), response=await request(randomUUID()+"@example.invalid");
  const code=(await response.json()).code, after=await counters(state);
  assert.equal(response.status,429);assert.equal(code,"RATE_LIMITED");assert.deepEqual(before,after);
  assert.equal(after.ip.length,1);assert.equal(after.ip[0].count,60);assert.equal(after.globalSent,60);
  assert.deepEqual(after.challenges,{accounts:60,max_per_email:1});
  console.log(JSON.stringify({status:response.status,code,retryAfter:response.headers.get("retry-after"),before,after,origin:"loopback",requests:61,group:"fresh synthetic account per request"}));
}));
