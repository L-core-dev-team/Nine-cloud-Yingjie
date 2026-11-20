import { readFileSync } from "node:fs";
import { AssetSchema, AttemptSchema, CapabilitySchema, DecisionSchema, SceneSchema,
  VisualSchema, requestKey, schemaVersion } from "@yingjie/contracts";

const root = new URL("../../../", import.meta.url);
export const read = path => readFileSync(new URL(path, root));
export const json = path => JSON.parse(read(path));
export const index = json("packages/contracts/fixtures/tavern.json");
export const evidence = json(index.runs);
export const script = json(index.script);
const assets = new Map();

export const stages = index.stages.map(row => {
  const source = { schemaVersion, kind: script.source, fixtureId: script.id, eventId: row.id };
  const scene = SceneSchema.parse({ schemaVersion, source, ...index.scene });
  const evening = row.version === "V3";
  const target = VisualSchema.parse({ schemaVersion, source, sceneId: scene.sceneId, visualVersion: row.version,
    people: index.people[row.version === "V1" ? "V1" : "V2"], features: scene.fixedFeatures,
    lighting: evening ? "灯笼亮" : "灯笼未亮", timeOfDay: evening ? "傍晚" : "日间",
    viewpoint: "室内固定广角", perspective: "不显示玩家形象" });
  const reason = script.stages.find(([stage]) => stage === row.id)[1];
  const base = { schemaVersion, action: row.action, target, reason };
  const parent = assets.get(row.reference);
  const reference = parent ? { assetId: parent.assetId, sha256: parent.sha256, visualVersion: parent.target.visualVersion,
    reviewId: parent.review.id } : null;
  const plan = DecisionSchema.parse(row.action === "edit" ? { ...base, reference,
    preservePeople: parent.target.people, preserveFeatures: scene.fixedFeatures, change: row.change } :
    row.action === "reuse" ? { ...base, assetId: row.asset } : base);
  if (row.action === "reuse") return { plan, asset: assets.get(row.asset), attempt: null };

  const call = evidence.calls.find(call => call.id === row.asset);
  const capability = CapabilitySchema.parse({ schemaVersion, entry: call.entry, origin: "codex-tool",
    verifiedAt: call.returnedAt, generate: "supported", referenceEdit: row.action === "edit" ? "supported" : "unknown",
    query: "unknown", cancel: "unknown", idempotency: "unknown" });
  const attempt = AttemptSchema.parse({ schemaVersion, requestKey: requestKey(plan), attemptId: "yj03-" + call.id,
    capability, sentAt: call.startedAt, observedAt: call.returnedAt, localWait: "active",
    outcome: { state: "returned", assetId: call.id, sha256: call.output.sha256 },
    providerRequestId: evidence.providerRequestId, model: evidence.model, seed: evidence.seed,
    usage: evidence.usage, cost: evidence.cost });
  const asset = AssetSchema.parse({ schemaVersion, assetId: call.id, requestKey: attempt.requestKey,
    attemptId: attempt.attemptId, target, reference, storageKey: "docs/reports/evidence/" + call.output.file,
    width: call.output.pixels[0], height: call.output.pixels[1], format: "png", sha256: call.output.sha256,
    invalidated: false, review: { id: "review-" + call.id, status: call.visualReview.decision, assessment: "matches",
      reason: call.visualReview.notes, basis: index.runs + "#" + call.id } });
  assets.set(asset.assetId, asset);
  return { plan, attempt, asset };
});
