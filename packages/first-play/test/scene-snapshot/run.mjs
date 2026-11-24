import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { session } from "../s2-host.mjs";
import { reviewVisualHistory } from "../../visual-consistency.mjs";
import { hash } from "../../../scene-state/store.mjs";

assert.equal(process.permission?.has("net"), false, "run with Node network access denied");
const source = new URL("./input.json", import.meta.url);
const revisions = JSON.parse(await readFile(source, "utf8"));
const replay = session("YJ-P04-SCENE-SNAPSHOT-01");
const frames = [];
let previous;

for (const { revision, action, narrative } of revisions) {
  const current = replay.append(narrative, action);
  const { result, audit } = current;
  const verification = reviewVisualHistory(current);
  assert.equal(revision, current.revision);
  assert.equal(audit.narrativeSha256, hash(narrative));
  assert.deepEqual(verification.turns.at(-1), { audit, result });
  const review = verification.review;
  // Only the current projection supplies publishable values. Audit spans remain diagnostic.
  const visual = result.status === "ready" ? result.visual : null;
  const snapshot = {
    place: result.scene?.name ?? null,
    sceneId: result.scene?.sceneId ?? null,
    people: visual?.people ?? null,
    count: visual ? visual.people.length : null,
    features: visual?.features ?? null,
    timeOfDay: visual?.timeOfDay ?? null,
    lighting: visual?.lighting ?? null,
    viewpoint: visual?.viewpoint ?? null,
    perspective: visual?.perspective ?? null,
    visualVersion: visual?.visualVersion ?? null,
    change: null,
    imageEligible: review.imageEligible
  };
  if (visual && previous) {
    snapshot.change = ["sceneId", "people", "features", "timeOfDay", "lighting", "viewpoint", "perspective"]
      .filter(field => JSON.stringify(previous[field]) !== JSON.stringify(visual[field]));
  }
  frames.push({ revision, inputSha256: audit.narrativeSha256, result, audit, review, snapshot });
  previous = visual;
}
function display(value) {
  if (value === null) return "未确认";
  if (Array.isArray(value)) return value.length ? value.join("、") : "已确认无";
  return String(value);
}

function describe({ revision, snapshot, result, audit, review }) {
  const s = snapshot;
  const labels = {
    sceneId: "地点", people: "人物", features: "设施", timeOfDay: "时段",
    lighting: "光照", viewpoint: "观察位置", perspective: "朝向"
  };
  const change = s.change === null ? "无法比较" :
    s.change.length ? s.change.map(field => labels[field]).join("、") : "无可见变化";
  const lines = [
    `R${revision}　${revisions[revision - 1].action}`,
    `地点：${display(s.place)}。当前名单：${display(s.people)}。人数：${display(s.count)}。`,
    `设施：${display(s.features)}。时段／光照：${display(s.timeOfDay)}／${display(s.lighting)}。`,
    `观察位置／朝向：${display(s.viewpoint)}／${display(s.perspective)}。`,
    `相对上一帧：${revision === 1 ? "首帧" : change}。视觉版本：${display(s.visualVersion)}。`,
    `场景画面资格：${review.imageEligible ? "就绪" : "未就绪"}（${result.reason ?? result.status}；${review.reason}）。`
  ];
  const roster = audit.fields.people;
  if (roster.admitted === false && roster.value) lines.push("未采纳的名单候选：" + display(roster.value) + "。");
  lines.push("外观、年龄、衣色、家具数量和精确布局：未知。");
  return lines.join("\n");
}

if (process.argv.includes("--text")) console.log(frames.map(describe).join("\n\n"));
else console.log(JSON.stringify({ fixture: "synthetic-card-history", networkAllowed: false, frames }, null, 2));
