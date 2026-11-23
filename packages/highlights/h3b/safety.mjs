import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlights3B } from "./replay.mjs";
import { proposal, sentences } from "./protocol.mjs";
assert.equal(process.permission?.has("net"),false);
const tests=[];
function test(name,fn) {
    try { fn();tests.push({name,pass:true}); }
    catch(e) {tests.push({name,pass:false,message:e.message.slice(0,1000)});}
}
function context(texts) {
    const host=session("protocol");
    for (const t of texts) host.append(t,"绝不可披露的行动");
    return {...host.context(),replayOnly:true};
}
const title="东宅属于杜和。", deed="杜和签了把东宅赠给山社的契书。", effect="东宅的产权当日登记在山社名下。";
const mods={
    "wrong-quote":c=>c.spans[0].quote+="错","wrong-sha":c=>c.spans[0].narrativeSha256="f".repeat(64),
    "wrong-source":c=>c.spans[0].sourceKey="foreign","cross-session":c=>c.spans[0].session="foreign",
    "cross-scope":c=>c.scope="foreign","future":c=>c.spans[0].revision++,
    overlap:c=>c.spans.push({...c.spans[0]}),truncated:c=>{c.spans[0].end--;c.spans[0].quote=c.spans[0].quote.slice(0,-1);},
    "authoritative-field":c=>c.verified=true
};
for (const {id} of JSON.parse(readFileSync("packages/highlights/test/h3b/protocol.json"))) test(id,()=>{
    let texts=[title,deed,effect], role={asset:"东宅",recipient:"山社"};
    const semantic={
        "same-name":["另一个名叫杜和的人到场。",effect],
        "fabricated-title":["东宅临时挂名在山社名下。",effect],
        "dialogue-as-fact":["「东宅的产权当日登记在山社名下。」"],
        "opinion-as-ruling":["东宅旁有人表示这只是意向。"],
        "later-valid-ruling":["复核裁定东宅赠契无效。",effect],
        revocation:[effect,"杜和的东宅赠契经裁判撤销。"]
    };
    if (semantic[id]) texts=[title,deed,...semantic[id]];
    if (id==="distinct-adjacent") texts=["阿甲交还红印。","阿乙交还绿印。"];
    if (id==="reordered") texts=["柜员收了红印。掌柜还了绿印。"];
    const ctx=context(texts), baseline=replayHighlights3B(ctx);
    const run=replayHighlights3B(ctx,v=>{
        assert.ok(Object.isFrozen(v) && v.every(Object.isFrozen));
        assert.ok(!JSON.stringify(v).includes("绝不可披露的行动"));
        assert.deepEqual(Object.keys(v[0]).sort(),["scope","session","revision","sourceKey","narrativeSha256","text"].sort());
        if (v.length!==texts.length && id!=="distinct-adjacent") return "[]";
        const s=sentences(v.at(-1)), complete=v.flatMap(sentences);
        const c=proposal(v,"disposition",id==="distinct-adjacent"?s:complete,semantic[id]?{}:id==="distinct-adjacent"||id==="reordered"?{}:role);
        if (mods[id]) mods[id](c);
        let batch=[c];
        if (id==="duplicate-id") batch.push(c);
        if (id==="duplicate-moment") batch.push({...c,id:"second"});
        if (id==="mixed-invalid") batch.push({...c,id:"bad",allowSend:true});
        if (id==="reordered") batch=s.map((ev,i)=>({...proposal(v,"relationship",[ev]),id:i?"alpha":"zeta"}));
        if (id==="non-json") return "!";
        if (id==="permission-change") c.allowSend=true;
        if (semantic[id]) c.entities={asset:"东宅",recipient:"山社"};
        return JSON.stringify(batch);
    });
    const r=run.rounds.at(-1), result=r.proposals;
    assert.deepEqual(run.candidates,baseline.candidates);
    assert.deepEqual(run.edges,baseline.edges);
    assert.deepEqual(r.audit,baseline.rounds.at(-1).audit);
    assert.ok(run.rounds.every(x=>x.cadence.send===false && x.cadence.action!=="director-review"));
    if (mods[id]||["mixed-invalid","non-json","duplicate-id","permission-change"].includes(id)) {
        assert.ok(result.rejection);assert.equal(result.suggestions.length,0);
    } else if (id==="duplicate-moment") {assert.equal(result.duplicates.length,1);assert.equal(result.suggestions.length,1);}
    else if (id==="distinct-adjacent") assert.deepEqual(run.rounds.map(x=>x.proposals.suggestions.length),[1,1]);
    else if (id==="reordered") assert.deepEqual(result.suggestions.map(x=>x.id),["alpha","zeta"]);
    else {
        assert.equal(r.ranking.length,0);
        assert.ok(result.suggestions.every(x=>x.fact===null));
        if (id==="revocation") assert.equal(run.rounds.at(-2).ranking.length,1);
    }
});
test("host rejects before calling provider",()=>{
    for (const field of ["authorized","replayOnly"]) {
        const ctx=context([title]);ctx[field]=false;
        let called=false;assert.throws(()=>replayHighlights3B(ctx,()=>{called=true;}));assert.equal(called,false);
    }
});
test("only full claims with independent supporting events can link",()=>{
    const ctx=context([title,deed,effect]);
    const run=entities=>replayHighlights3B(ctx,v=>v.length<3?"[]":JSON.stringify([proposal(v,"disposition",v.flatMap(sentences),entities)])).rounds.at(-1).proposals.suggestions[0];
    assert.ok(run({actor:"杜和",recipient:"山社",asset:"东宅"}).fact);
    assert.equal(run({actor:"山社",recipient:"杜和",asset:"东宅"}).fact,null);
});
test("whole sentence opinion cannot discard an actual qualification",()=>{
    for (const adverse of ["东宅旁有人表示这只是意向，法院已裁定赠契无效。","东宅旁有人表示这只是意向。东宅只是暂时挂名。","法院裁定东宅赠契无效。","来意不明的人提出了异议。"]) {
        const r=replayHighlights3B(context([title,deed,adverse,effect]));assert.equal(r.rounds.at(-1).ranking.length,0);
    }
    assert.equal(replayHighlights3B(context([title,deed,"东宅边的路人认为那张纸不过是客套。",effect])).rounds.at(-1).ranking.length,1);
});
test("host disclosure exceptions are redacted",()=>{
    assert.equal(replayHighlights3B(context([title]),()=>{throw Error("private");}).rounds[0].proposals.rejection,"provider-failed");
});
test("unrelated historical line cannot become a dependency; even shared names cannot authenticate an additional cause",()=>{
    function offer(extra) {
        const ctx=context([extra,title,deed,effect]);
        return replayHighlights3B(ctx,v=>v.length!==4?"[]":JSON.stringify([
            proposal(v,"disposition",v.flatMap(sentences),{asset:"东宅",recipient:"山社"})
        ])).rounds.at(-1);
    }
    const foreign=offer("账房照料病马。");
    assert.equal(foreign.proposals.rejection,"unbound-prior-context");
    const homonymous=offer("东宅门前的花今年开得迟。");
    assert.equal(homonymous.candidateIds.length,1);
    assert.equal(homonymous.proposals.suggestions[0].fact,null);
});
test("a reused wire ID rejects the complete later batch",()=>{
    const out=replayHighlights3B(context(["钟声停了。","梆子响了。"]),v=>JSON.stringify([
        {...proposal(v,"payoff",sentences(v.at(-1))),id:"repeated"}
    ]));
    assert.equal(out.rounds[0].proposals.suggestions.length,1);
    assert.equal(out.rounds[1].proposals.rejection,"reused-provider-id");
});
test("a paraphrase citing the same disposition never repeats the moment",()=>{
    const ctx=context([title,deed,effect,"旧簿又记了一遍东宅归山社。"]);
    const out=replayHighlights3B(ctx,v=>{
        if(v.length<3) return "[]";
        const refs=[v[0],v[1],v.at(-1)].flatMap(sentences);
        return JSON.stringify([proposal(v,"disposition",refs,{asset:"东宅",recipient:"山社"})]);
    });
    assert.ok(out.rounds[2].proposals.suggestions[0].fact);
    assert.equal(out.rounds[3].proposals.duplicates.length,1);
});
test("only the inherited visual gate can suggest a director review; revocation applies at its own revision",()=>{
    const wait=n=>n+"答应沈安回到听雨酒馆。沈安一直在听雨酒馆等"+n+"归来。";
    const arrive=n=>n+"走了进来，原来的人都还在，除此再无旁人。观察位置、朝向、结构、时段和光照均未改变。";
    const survey="此时我身在琥洲的听雨酒馆。我在廊下朝北看去。殿中除沈安、宋明、药师再无旁人。我看清了这里的铜柱与长桌。此时是正午。日光照亮眼前。";
    const ctx=context([wait("林青"),wait("顾宁"),survey,arrive("林青"),arrive("顾宁")]);
    ctx.planningSnapshots=ctx.receipts.map(r=>({scope:ctx.scope,revision:r.source.revision,sourceKey:r.source.key,
        narrativeSha256:r.narrativeSha256,planningAllowed:true,enabled:true,operation:"generate",task:"idle"}));
    const proposed=v=>JSON.stringify([proposal(v,"payoff",sentences(v.at(-1)))]);
    const actions=()=>replayHighlights3B(ctx,proposed).rounds.slice(-2).map(r=>[r.cadence.action,r.cadence.send]);
    assert.deepEqual(actions(),[["director-review",false],["director-review",false]]);
    ctx.planningSnapshots.at(-1).planningAllowed=false;
    assert.deepEqual(actions(),[["director-review",false],["text-only",false]]);
});
console.log(JSON.stringify({tests}));if (tests.some(t=>!t.pass)) process.exitCode=1;
