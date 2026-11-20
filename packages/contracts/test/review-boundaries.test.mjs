import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as c from "@yingjie/contracts";
import { stages } from "../fixtures/tavern.mjs";

// These tests exercise contract decisions with recorded digests as host inputs.
// The original suite and probe.py separately check the actual PNG bytes.
const [first,,arrival,,evening] = stages;
const access = asset => ({ source: asset.target.source, authorized: true, observedSha256: asset.sha256 });

test("review: an edit cannot change visible facts under the same visual version", () => {
  const sameVersion = c.DecisionSchema.parse({ ...arrival.plan,
    target: { ...arrival.plan.target, visualVersion: first.asset.target.visualVersion } });
  assert.equal(c.referenceEligibility(first.asset, sameVersion, access(first.asset)), "visual-mismatch");

  const cosmetic = c.DecisionSchema.parse({ ...arrival.plan, target: { ...first.asset.target,
    source: { ...first.asset.target.source, eventId: "review-cosmetic" } }, change: "离线对照：只修正图像瑕疵" });
  assert.equal(c.referenceEligibility(first.asset, cosmetic, access(first.asset)), "eligible");
  for (const field of ["lighting", "timeOfDay", "viewpoint", "perspective"]) {
    const changed = c.DecisionSchema.parse({ ...cosmetic, target: { ...cosmetic.target, [field]: "changed" } });
    assert.equal(c.referenceEligibility(first.asset, changed, access(first.asset)), "visual-mismatch");
  }
  const changedFeatures = c.DecisionSchema.parse({ ...cosmetic, target: { ...cosmetic.target,
    features: [...cosmetic.target.features, "new-feature"] } });
  assert.equal(c.referenceEligibility(first.asset, changedFeatures, access(first.asset)), "visual-mismatch");
  assert.equal(c.referenceEligibility(first.asset, arrival.plan, access(first.asset)), "eligible");
  assert.equal(c.referenceEligibility(arrival.asset, evening.plan, access(arrival.asset)), "eligible");
});

test("review: card UUID case cannot split an event, request or access scope", () => {
  const row = { key: "abcdefab-cdef-4abc-8def-abcdefabcdef", action: "离线复核",
    narrative: "同一会话身份", resulting_revision: 1 };
  const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const source = c.fromCardHistory("ReviewOwner", sessionId, row).source;
  const plan = c.DecisionSchema.parse({ ...first.plan, target: { ...first.plan.target, source } });
  const asset = c.AssetSchema.parse({ ...first.asset, target: plan.target, requestKey: c.requestKey(plan) });

  for (const patch of [{ sessionId: sessionId.toUpperCase() }, { key: row.key.toUpperCase() },
    { sessionId: sessionId.toUpperCase(), key: row.key.toUpperCase() }]) {
    const canonical = c.SourceSchema.parse({ ...source, ...patch });
    assert.deepEqual(canonical, source);
    const replay = c.DecisionSchema.parse({ ...plan, target: { ...plan.target, source: canonical } });
    assert.equal(c.eventKey(canonical), c.eventKey(source));
    assert.equal(c.requestKey(replay), c.requestKey(plan));
    assert.equal(c.classifyDelivery(replay, plan), "duplicate");
    assert.equal(c.displayEligibility(asset, replay.target, { ...access(asset), source: canonical }, true), "eligible");
  }
  const mapped = c.fromCardHistory("ReviewOwner", sessionId.toUpperCase(), { ...row, key: row.key.toUpperCase() });
  assert.deepEqual(mapped.source, source);
  assert.equal(mapped.source.ownerId, "ReviewOwner");
  assert.equal(c.SourceSchema.safeParse({ ...source, sessionId: "not-a-uuid" }).success, false);
  const other = c.SourceSchema.parse({ ...source, sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeef" });
  assert.notEqual(c.eventKey(other), c.eventKey(source));
  assert.equal(c.displayEligibility(asset, asset.target, { ...access(asset), source: other }, true), "wrong-scope");
  const fixture = c.SourceSchema.parse({ ...first.plan.target.source, fixtureId: "CaseSensitiveFixture" });
  assert.equal(fixture.fixtureId, "CaseSensitiveFixture");
});
