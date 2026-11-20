import assert from "node:assert/strict";
import {test} from "node:test";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {mkdtemp,rm,copyFile,readFile,writeFile,unlink} from "node:fs/promises";
import {project} from "../../scene-state/project.mjs";
import {scenes,fixtureEvent} from "../../scene-state/test/tavern.mjs";
import {catalog,catalogId,matchPlace,selectPreset} from "../index.mjs";
import {approvedEntries,digest} from "../sources.mjs";
import {book} from "./tavern.mjs";

const world=book("固定样例"),source={kind:"linked",id:"book",card_id:"card",book:world,sha256:"verified-import"};
const binding={scope:"test",card_id:"card",import_id:"book",import_sha:source.sha256,book_sha:digest(world),
  entry_sha:digest(world.entries[0]),scene_id:"east",parent_id:"东村",fixed_features:["柜台"],tags:["酒馆"],catalog:catalogId,basis:"fixture"};
const sceneState={places:[],current:null};
const stages=scenes.map((notes,i)=>({authorized:true,scope:"test",result:project(sceneState,fixtureEvent(i+1).source,notes)}));
// The pure filter test uses an inert validator; the live suite injects Nine-cloud's compiled selector.
const place=(ctx,bindings=[binding],sources=[source])=>matchPlace(ctx,{bindings,sources},()=>[]);
test("stable place and versioned source pins, conservative book subset",()=>{
  const initial=stages[0],renamed=stages[6];
  assert.equal(renamed.result.scene.name,"老周的店");assert.ok(renamed.result.scene.aliases.includes("青石酒馆"));
  assert.equal(place(renamed).status,"candidate");
  const west=structuredClone(initial);west.result.scene.sceneId="west";west.result.scene.parentSceneId="西村";
  west.result.visual.sceneId="west";assert.equal(place(west).reason,"different-place");
  const ambiguous=place(initial,[binding,{...binding,catalog:"different-collection"}]);
  assert.equal(ambiguous.status,"ambiguous");
  assert.equal(place(initial,[]).reason,"no-grant");
  assert.equal(place(initial,[binding],[]).reason,"no-worldbook");
  assert.equal(place(initial,[{...binding,book_sha:"old"}]).reason,"book-version");
  assert.equal(place(initial,[{...binding,import_sha:"old"}]).reason,"book-version");
  assert.equal(place(initial,[{...binding,entry_sha:"old"}]).reason,"entry-inactive");
  assert.equal(place(initial,[{...binding,fixed_features:["暗门"]}]).reason,"structure-mismatch");
  assert.equal(place(initial,[binding],[{...source,invalid:true}]).reason,"invalid-book");
  assert.equal(place(stages[3]).status,"not-ready");
  assert.throws(()=>place({...initial,authorized:false}),/account-inaccessible/);
  assert.equal(approvedEntries(null,()=>[]).reason,"invalid-book");
  assert.equal(approvedEntries({entries:[]},()=>[]).reason,"empty-book");
  for(const raw of [{constant:true,content:"x",extensions:{unknown:true}}, {keys:["酒馆"],content:"x"},
    {constant:true,content:"x",probability:30}])
    assert.equal(approvedEntries({entries:[raw]},()=>[]).reason,"unsupported-rule");
  assert.deepEqual(approvedEntries({entries:[{constant:true,enabled:false,content:"disabled"}]},()=>[]).entries,[]);
  assert.equal(approvedEntries(world,()=>{throw Error("upstream limits");}).reason,"unsupported-rule");
  assert.deepEqual(place(initial).features,["柜台"]);assert.deepEqual(place(initial).tags,["酒馆"]);
  assert.ok(!JSON.stringify(place(initial)).includes("陌生剑客"));
});

test("exact visual facts, review, rights and current bytes gate selection",async()=>{
  const ctx=stages[0],p=place(ctx),a=catalog[0];
  const choose=(assets,current=ctx)=>selectPreset(current,p,{assets});
  assert.equal((await choose([])).reason,"no-preset");
  assert.equal((await choose([a],stages[2])).reason,"visual-mismatch");
  assert.equal((await choose([a,a])).status,"ambiguous");
  for(const patch of [{viewpoint:"后门"},{perspective:"俯视"},{lighting:"大火"},{people:["掌柜"]},{features:["西窗"]},{visualVersion:"V9"}]){
    const changed=structuredClone(ctx);Object.assign(changed.result.visual,patch);
    assert.equal((await choose([a],changed)).reason,"visual-mismatch");
  }
  for(const patch of [{invalidated:true},{review:{...a.review,decision:"pending"}},{review:{...a.review,decision:"rejected"}},
    {review:{...a.review,people:4}},{reviewedSha256:"wrong"}])
    assert.equal((await choose([{...a,...patch}])).reason,"review-ineligible");
  assert.equal((await choose([{...a,license:"private"}])).reason,"asset-rights");
  assert.equal((await choose([{...a,file:"../untrusted"}])).reason,"invalid-original");
  const dir=await mkdtemp(join(tmpdir(),"yj07-catalog-"));
  try {
    const path=join(dir,"I0.png"),directory=pathToFileURL(dir+"/");
    await copyFile(new URL("../../../docs/reports/evidence/YJ-02/I0.png",import.meta.url),path);
    const chooseDisk=()=>selectPreset(ctx,p,{assets:[a],directory});
    assert.equal((await chooseDisk()).status,"matched");
    const bytes=await readFile(path);bytes[100]^=1;await writeFile(path,bytes);
    assert.equal((await chooseDisk()).reason,"invalid-original");await unlink(path);
    assert.equal((await chooseDisk()).reason,"missing-original");
  } finally {await rm(dir,{recursive:true,force:true});}
});
