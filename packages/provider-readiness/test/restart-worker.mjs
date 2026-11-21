import assert from "node:assert/strict";
import {join} from "node:path";
import {readFileSync,writeFileSync} from "node:fs";
import {offlineAdapters} from "../offline.mjs";
import {Reservations} from "../reservations.mjs";
import {sampleGrant,target,claimFor} from "./fixture.mjs";

const [phase,dir]=process.argv.slice(2);
assert.equal(process.permission.has("net"),false);
const fixture=join(dir,"fixture.json"),db=new Reservations(join(dir,"restart.sqlite"));
try{
  if(phase==="loss"){
    const grant=sampleGrant();
    writeFileSync(fixture,JSON.stringify({grant,visual:target(grant,0)}),{flag:"wx"});
  }else assert.equal(phase,"reopen");
  const {grant,visual}=JSON.parse(readFileSync(fixture,"utf8"));
  const adapter=offlineAdapters({resolve:()=>({authorized:true,grant,visual}),ledger:db,scenario:"lost"});
  const claim=claimFor(adapter.provider,{schemaVersion:"0.1",action:"generate",target:visual,reason:"fixture"});
  await assert.rejects(adapter.provider.send(claim),phase==="loss"?/transport-unconfirmed/:/already-claimed/);
  assert.equal(adapter.observations.length,phase==="loss"?1:0);
  const summary=db.summary();
  assert.deepEqual(summary.map(r=>[r.state,r.calls,r.reservedUnits]),[["unknown",1,4]]);
  console.log(JSON.stringify({phase,fakeSends:adapter.observations.length,reservations:summary,networkPermission:false}));
}finally{db.close();}
