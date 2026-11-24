import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
const base=new URL("./",import.meta.url);
const read=async name=>(await readFile(new URL(name,base),"utf8")).replace(/\r\n?/g,"\n");
const trace=JSON.parse(await read("trace.json"));
assert.equal(trace.version,"native-scene-demo/1");
assert.equal(trace.source,"isolated-authenticated-PG");
assert.deepEqual(trace.frames.map(f=>f.action),["create","move","blocked","sub","learn","back","observe","bypass","late","revisit","closed"]);
for(const f of trace.frames){
    assert.deepEqual([f.sceneEligible,f.send,f.asset],[false,false,null]);
    if(f.current){
        assert.deepEqual(f.current.visual,{people:null,features:null,timeOfDay:null,lighting:null,viewpoint:null,perspective:null});
        assert.ok(["loc_luhuadu","loc_wangqitai"].includes(f.current.id));
        assert.match(f.snapshotSHA256,/^[0-9a-f]{64}$/);
        for(const h of f.history)assert.ok(h.revision<=h.learnedRevision && h.learnedRevision<=f.revision);
    }else assert.deepEqual([f.access,f.history,f.snapshotSHA256],["hidden",[],null]);
}
const js=await read("player.js");
const css=await read("../ui-shell/yingjie.css")+"\n"+await read("page.css")+"\n.checksum{font:12px/1.6 monospace;overflow-wrap:anywhere}";
const html=(await read("page.html")).replace("PLAYER_HASH",createHash("sha256").update(js).digest("base64"))
    .replace("/* STYLES */",()=>css).replace("/* TRACE */",()=>JSON.stringify(trace).replaceAll("<","\\u003c"))
    .replace("/* PLAYER */",()=>js);
await mkdir(new URL("dist/",base),{recursive:true});
await writeFile(new URL("dist/index.html",base),html);
console.log(JSON.stringify({frames:trace.frames.length,htmlSHA256:createHash("sha256").update(html).digest("hex")}));
