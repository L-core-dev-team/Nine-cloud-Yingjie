import { readFileSync } from "node:fs";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlightsV2 } from "./replay.mjs";
if (process.permission?.has("net") !== false)
    throw Error("use node --permission --allow-fs-read=*");
const stories = readFileSync(new URL("../test/h2-locked.jsonl", import.meta.url), "utf8").trimEnd().split("\n").map(JSON.parse);
const [name, limit] = process.argv.slice(2);
const story = name ? stories.find(s => s.id === name) : stories[0];
if (!story)
    throw Error("Available synthetic sessions: " + stories.map(s => s.id).join("、"));
const through = limit === undefined ? story.turns.length : Number(limit);
if (!Number.isSafeInteger(through) || through < 1 || through > story.turns.length)
    throw Error("Invalid revision");
const host = session("demo-" + story.id);
for (const { text } of story.turns.slice(0, through))
    host.append(text);
const result = replayHighlightsV2({ ...host.context(), replayOnly: true });
console.log(JSON.stringify({ story: story.id, through, result }, null, 2));
