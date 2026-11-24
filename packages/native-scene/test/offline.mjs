import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {livePreflight} from "../../openai-image/money.mjs";

assert.equal(process.permission?.has("net"), false);
const root=new URL("../../../",import.meta.url);
const read=name=>readFile(new URL(name,root),"utf8");
const evidence="docs/reports/evidence/YJ-P04-NATIVE-SCENE-01/";
const frozen=JSON.parse(await read(evidence+"freeze.json")).evidence;
const hash=(str,encoding="hex")=>createHash("sha256").update(str).digest(encoding);
for(const [name,sha] of Object.entries(frozen)) assert.equal(hash(await read(name)),sha,name);
const gate=livePreflight();
assert.deepEqual([gate.allowLiveSend,gate.status],[false,"LIVE_BLOCKED_COST_BOUND"]);
const html=(await read("packages/native-scene/dist/index.html")).replace(/\r\n?/g,"\n");
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
assert.ok(html.includes("script-src 'sha256-"+hash(script,"base64")+"'"));
assert.match(html,/connect-src 'none'/);
assert.match(html,/@media[^{]*max-width/);
assert.doesNotMatch(html,/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|serviceWorker|localStorage|sessionStorage|document\.cookie|innerHTML|api[_-]?key|ownerId|saveId|idempotencyKey|auth_sessions)\b|https?:\/\/|[A-Z]:\\Users\\|sk-[\w-]{16,}/i);
assert.doesNotMatch(html,/<(?:iframe|form|object|embed|link|img)\b|<script[^>]+src=/i);
for(const [,href] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) assert.match(href,/^#[\w-]+$/);
const fixture=html.match(/<script id="trace" type="application\/json">([\s\S]*?)<\/script>/)[1];
const {frames}=JSON.parse(fixture);
assert.deepEqual(frames,JSON.parse(await read("packages/native-scene/trace.json")).frames);
class Element {
    textContent=""; children=[]; attributes=new Map(); dataset={}; hidden=false;
    classes=new Set();
    classList={toggle:(name,enabled)=>enabled?this.classes.add(name):this.classes.delete(name)};
    append(item){this.children.push(item);}
    replaceChildren(){this.children=[];}
    setAttribute(name,value){this.attributes.set(name,value);}
    removeAttribute(name){this.attributes.delete(name);}
}
const elements=new Map([...html.matchAll(/\bid="([\w-]+)"/g)].map(m=>[m[1],new Element()]));
const el=id=>{assert.ok(elements.has(id),id);return elements.get(id);};
const listeners=new Map();
el("trace").textContent=fixture;
const document={getElementById:el,querySelector:q=>el(q.slice(1)),createElement:()=>new Element(),
    addEventListener:(name,fn)=>listeners.set(name,fn)};
runInNewContext(script,{document},{timeout:1000});
const expected=["芦花渡","望气台","望气台","望气台","望气台","望气台","望气台","芦花渡","芦花渡","望气台","地点待确认"];
const historyCounts=[0,0,0,0,1,1,1,1,1,2,0];
const text=id=>el(id).children.map(c=>c.textContent).join("\n");
function check(i,preview=true) {
    assert.equal(el("counter").textContent,"节点 "+(i+1)+" / 11");
    assert.equal(el("place").textContent,expected[i]);
    assert.equal(el("prev").disabled,i===0);
    assert.equal(el("next").disabled,i===10);
    assert.equal(el("history-count").textContent,historyCounts[i]+" 笔");
    assert.equal(el("plate").hidden,!preview||i===10);
    assert.equal(el("steps").children.filter(b=>b.attributes.has("aria-current")).length,1);
    assert.equal(el("steps").children[i].attributes.get("aria-current"),"step");
    assert.deepEqual([frames[i].sceneEligible,frames[i].send,frames[i].asset],[false,false,null]);
    if(i===10){
        assert.doesNotMatch(text("entries")+text("fields")+el("plate-name").textContent,/芦花渡|望气台|[0-9a-f]{64}/);
    }else{
        assert.equal(el("plate-name").textContent,expected[i]);
        assert.match(text("fields"),/人物名单、场景结构、时间、光照、观察位置与朝向/);
        if(i>=4) assert.match(text("entries"),/历史 R1.*芦花渡.*望气台.*R3 获证/);
        else assert.doesNotMatch(text("entries"),/历史 R1/);
    }
}
check(0);
for(let i=1;i<11;i++){el("next").onclick();check(i);}
for(let i=9;i>=0;i--){el("prev").onclick();check(i);}
el("toggle").onclick();el("steps").children[7].onclick();check(7,false);
listeners.get("keydown")({key:"ArrowRight",preventDefault(){}});check(8,false);
assert.match(el("note").textContent,/旧记录的目的地是望气台/);
el("reset").onclick();check(0);
assert.equal(el("evidence").open,false);assert.equal(el("history").open,true);
console.log(JSON.stringify({suite:"offline-dom-and-boundaries",frames:11,forwardAndReverse:true,
    isolatedKeyboardAndReset:true,cspScriptHash:true,frozenReceipts:Object.keys(frozen).length,
    imageGate:gate.status,networkAllowed:false,browser:false}));
