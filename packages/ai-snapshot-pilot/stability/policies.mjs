import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {session} from "../../first-play/test/s2-host.mjs";
import {createSceneRegistry} from "../../first-play/scene-registry.mjs";
import {reviewVisualHistory} from "../../first-play/visual-consistency.mjs";
import {classifyTrigger} from "../../first-play/trigger.mjs";
import {replayHighlightsV2} from "../../highlights/v2/replay.mjs";
import {replayHighlights3A} from "../../highlights/h3a/replay.mjs";

assert.equal(process.permission?.has("net"),false);
const directory=createSceneRegistry([
    {sceneId:"hall",parentSceneId:"溪山",name:"听泉堂",aliases:[]},
    {sceneId:"well",parentSceneId:"溪山",name:"伏潮井",aliases:[]}
]);
const host=session("spring-stability-synthetic",directory);
const story=JSON.parse(readFileSync(new URL("./story.json",import.meta.url),"utf8"));
const rows=story.map(({text,action,revision})=>{
    const ctx={...host.append(text,action),replayOnly:true};
    const visual=reviewVisualHistory(ctx);
    const turn=visual.turns.at(-1);
    // A ready projection would also require a genuine version event. No such asset/grant is invented here.
    const trigger=classifyTrigger(turn.result,null);
    const h2=replayHighlightsV2(ctx).rounds.at(-1);
    const h3=replayHighlights3A(ctx).rounds.at(-1);
    assert.equal(h2.cadence.send,false);
    assert.equal(h3.cadence.send,false);
    return {revision,visual:turn.result.status,eligible:visual.review.imageEligible,
        trigger:trigger.reason,triggerCandidate:trigger.triggerCandidate,
        h2:{finding:h2.finding,action:h2.cadence.action},h3:{importance:h3.narrativeImportance,action:h3.cadence.action},
        send:false};
});
console.log(JSON.stringify(rows));
