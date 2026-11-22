import { readFile } from "node:fs/promises";
import { session } from "../first-play/test/s2-host.mjs";
import { replayHighlights } from "./replay.mjs";
if (process.permission?.has("net") !== false)
    throw Error("run under Node --permission");
const [name = "两条线", through] = process.argv.slice(2);
const stories = (await readFile(new URL("./test/locked.jsonl", import.meta.url), "utf8")).trimEnd().split("\n").map(JSON.parse);
const scene = stories.find(s => s.id === name);
if (!scene)
    throw Error("Unknown synthetic story. Choose: " + stories.map(s => s.id).join("、"));
const end = through === undefined ? scene.history.length : Number(through);
if (!Number.isSafeInteger(end) || end < 1 || end > scene.history.length)
    throw Error("invalid revision");
const host = session("demo-" + name);
for (const narrative of scene.history.slice(0, end))
    host.append(narrative);
console.log(JSON.stringify(replayHighlights({ ...host.context(), replayOnly: true }), null, 2));
