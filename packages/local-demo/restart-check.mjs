import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";

const receipt=process.argv[2];
if(!receipt)throw Error("usage: node packages/local-demo/restart-check.mjs NEW-RECEIPT.json");
const run=(...args)=>execFileSync(process.execPath,["packages/local-demo/demo.mjs",...args],{encoding:"utf8",windowsHide:true,timeout:90000}).trim();
const dir=run("init").split(/\r?\n/).at(-1);
const probe=async(dir,flag)=>{
  run("open",dir,flag);
  return JSON.parse(await readFile(join(dir,"diagnostic.json"),"utf8"));
};
const initial=await probe(dir,"--smoke");
const backup=run("snapshot",dir).split(/\r?\n/).at(-1);
const reopened=await probe(dir,"--smoke");
assert.equal(reopened.digest,initial.digest);assert.equal(reopened.historyBefore,1);assert.equal(reopened.mockSends,0);
const diagnostic=await probe(dir,"--diagnose");
assert.equal(diagnostic.completed,1);assert.equal(diagnostic.counts["scene.event"],1);
const advanced=await probe(dir,"--advance");
assert.equal(advanced.revision,2);
const recovered=await probe(backup,"--smoke");
assert.equal(recovered.revision,1);assert.equal(recovered.digest,initial.digest);assert.equal(recovered.mockSends,0);
await writeFile(receipt,JSON.stringify({initial,reopened,diagnostic,advanced,recovered,restore:"separate stopped same-host copy",realTextCalls:0,realImageCalls:0},null,2)+"\n",{flag:"wx"});
console.log("Source and independently opened checkpoint retained under the current user's private temp directory.");
console.log(dir+"\n"+backup);
