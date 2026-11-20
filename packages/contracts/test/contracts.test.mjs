import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createHash } from "node:crypto";
import * as c from "@yingjie/contracts";
import { stages, json, index, evidence, read, script } from "../fixtures/tavern.mjs";

const cases = json("packages/contracts/fixtures/boundaries.json");
const [first, talk, arrival, revisit, evening] = stages;
const session = json("docs/reports/evidence/YJ-01-local-run.json").checks[0].session;
const card = c.fromCardHistory(cases.owner, session, cases.cardRow).source;
const native = c.SourceSchema.parse({ schemaVersion: c.schemaVersion, kind: "native-turn", ownerId: cases.owner,
  saveId: "sample-save", branchId: "root", parentBranchId: null, forkRevision: 0,
  revision: 1, key: "example-turn", evidence: "accepted-archived-text" });
const access = a => ({ source: a.target.source, authorized: true,
  observedSha256: createHash("sha256").update(read(a.storageKey)).digest("hex") });
const scoped = (a, source) => ({ ...a, target: { ...a.target, source } });

test("C01 completed-history projection and C02 disjoint, versioned sources", () => {
  assert.equal(card.sessionId, session);
  assert.equal(card.revision, cases.cardRow.resulting_revision);
  assert.ok(!("saveId" in card) && !("branchId" in card));
  for (const row of [{ ...cases.cardRow, status: "pending" }, { ...cases.cardRow, narrative: "" },
    { ...cases.cardRow, resulting_revision: null }]) assert.throws(() => c.fromCardHistory(cases.owner, session, row));
  for (const source of [native, first.plan.target.source]) {
    assert.equal(c.SourceSchema.safeParse({ ...source, kind: "card-history" }).success, false);
  }
  for (const source of [{ ...card, schemaVersion: "0.2" }, { ...card, ownerId: undefined }, { ...card, saveId: "" },
    { ...native, evidence: "accepted-receipt" }, { ...native, parentBranchId: "other" }])
    assert.equal(c.SourceSchema.safeParse(source).success, false);
});

test("C03–C05 evidence-backed sequence, file contents, selection and reference chain", () => {
  assert.deepEqual(stages.map(s => s.plan.target.source.eventId), script.stages.map(s => s[0]));
  assert.deepEqual(stages.map(s => s.plan.target.visualVersion), ["V1","V1","V2","V2","V3"]);
  assert.deepEqual(stages.map(s => s.asset.assetId), ["I0","I0","I1","I1","I2"]);
  const accepted = json(index.accepted);
  for (const { plan, asset, attempt } of stages) {
    const ctx = access(asset);
    assert.equal(ctx.observedSha256, asset.sha256);
    if (attempt) {
      const call = evidence.calls.find(call => call.stage === plan.target.source.eventId);
      assert.equal(call.referenceSha256, asset.reference?.sha256 ?? null);
      assert.equal(call.visualReview.people, plan.target.people.length);
      assert.equal(c.resultLink(plan, attempt, asset), "linked");
    } else {
      const record = evidence.reuse.find(r => r.stage === plan.target.source.eventId);
      assert.equal(record.sha256, accepted.accepted[record.acceptedStage].sha256);
      assert.equal(asset.sha256, record.sha256);
      assert.equal(record.modelCalls, 0);
      assert.equal(c.classifyDelivery(plan), "no-call");
      assert.equal(c.reuseEligibility(asset, plan, ctx, true), "eligible");
    }
  }
  assert.equal(c.referenceEligibility(first.asset, arrival.plan, access(first.asset)), "eligible");
  assert.equal(c.referenceEligibility(revisit.asset, evening.plan, access(revisit.asset)), "eligible");
  assert.equal(c.referenceEligibility(first.asset, evening.plan, access(first.asset)), "wrong-reference");
  const wrongParent = { ...evening.plan, reference: arrival.plan.reference };
  assert.equal(c.referenceEligibility(first.asset, wrongParent, access(first.asset)), "preservation-mismatch");
  assert.equal(c.resultLink(evening.plan, evening.attempt, { ...evening.asset, reference: null }), "wrong-reference");
});

test("C06 owner, session, branch, scene and access are independently checked", () => {
  const fork = { ...native, branchId: "fork", parentBranchId: "root", forkRevision: 1 };
  for (const [source, other] of [[card,{ ...card, ownerId: "someone-else" }],[card,{ ...card, sessionId: cases.wrongSession }],
    [native,c.SourceSchema.parse(fork)]]) {
    const a = scoped(first.asset, source);
    const ctx = { ...access(a), source: other };
    assert.equal(c.historyEligibility(a, access(a)), "eligible");
    assert.equal(c.historyEligibility(a, ctx), "wrong-scope");
    assert.equal(c.displayEligibility(a, a.target, ctx, true), "wrong-scope");
    const edit = { ...arrival.plan, target: { ...arrival.plan.target, source } };
    assert.equal(c.referenceEligibility(a, edit, access(a)), "eligible");
    assert.equal(c.referenceEligibility(a, edit, ctx), "wrong-scope");
    assert.equal(c.historyEligibility(a, { ...access(a), authorized: false }), "access-revoked");
  }
  const a = first.asset;
  const elsewhere = { ...arrival.plan.target, sceneId: "road" };
  assert.equal(c.displayEligibility(a, elsewhere, access(a), true), "wrong-scene");
  assert.equal(c.referenceEligibility(a, { ...arrival.plan, target: elsewhere }, access(a)), "wrong-scene");
  assert.equal(c.historyEligibility(a, access(a)), "fixture-only");
});

test("C07 pending, rejected, indeterminate, invalidated and damaged assets", () => {
  for (const [condition, reason] of cases.rejectedAssets) {
    const a = structuredClone(first.asset);
    const ctx = access(a);
    if (condition === "pending" || condition === "rejected") a.review.status = condition;
    if (condition === "invalidated") a.invalidated = true;
    if (condition === "missing") ctx.observedSha256 = null;
    if (condition === "corrupt") ctx.observedSha256 = "0".repeat(64);
    assert.equal(c.displayEligibility(c.AssetSchema.parse(a), a.target, ctx, true), reason);
    assert.equal(c.referenceEligibility(a, arrival.plan, ctx), reason);
  }
  const a = structuredClone(first.asset);
  a.review.assessment = "indeterminate";
  assert.equal(c.AssetSchema.safeParse(a).success, false);
  a.review.status = "pending";
  assert.equal(c.referenceEligibility(c.AssetSchema.parse(a), arrival.plan, access(a)), "review-pending");
});

test("C08 older story event can display until the visual target changes", () => {
  const { plan, attempt, asset } = first;
  const show = v => c.deliveryEligibility(plan, attempt, asset, v, access(asset), true);
  assert.equal(show(talk.plan.target), "eligible");
  const prior = scoped(asset, card);
  const later = { ...prior.target, source: { ...card, revision: 2, key: cases.wrongSession } };
  assert.equal(c.displayEligibility(prior, later, access(prior), true), "eligible");
  assert.equal(c.displayEligibility(prior, { ...later, visualVersion: "V2" }, access(prior), true), "visual-mismatch");
  assert.equal(c.historyEligibility(prior, access(prior)), "eligible");
  assert.equal(show(arrival.plan.target), "visual-mismatch");
  assert.equal(show({ ...talk.plan.target, lighting: "changed without bump" }), "visual-mismatch");
  assert.equal(c.reuseEligibility(asset, revisit.plan, access(asset), true), "wrong-candidate");
});

test("C09/C11 timeout, close, late return and unproven provider capabilities", () => {
  const { plan, asset, attempt } = first;
  const waiting = c.AttemptSchema.parse({ ...attempt, outcome: {state:"waiting"} });
  const stopped = c.stopWaiting(waiting, "local-timeout", attempt.observedAt);
  assert.equal(stopped.outcome.state, "unknown");
  assert.equal(stopped.sentAt, waiting.sentAt);
  for (const query of ["unknown","unsupported","supported"]) {
    const a = c.AttemptSchema.parse({ ...stopped, capability: { ...stopped.capability, query } });
    assert.equal(c.nextAttemptAction(a, true), "hold-unknown");
    const identified = { ...a, providerRequestId: { value: "offline-example", source: "provider-response" } };
    assert.equal(c.nextAttemptAction(identified, false), query === "supported" ? "query-original" : "hold-unknown");
  }
  const late = c.AttemptSchema.parse({ ...stopped, outcome: attempt.outcome });
  assert.equal(c.classifyResult(plan, late, asset), "record-once");
  assert.equal(c.deliveryEligibility(plan, late, asset, talk.plan.target, access(asset), true), "target-inactive");
  assert.equal(c.deliveryEligibility(plan, attempt, asset, talk.plan.target, access(asset), false), "target-inactive");
  const departed = { ...talk.plan.target, source: { ...talk.plan.target.source, fixtureId: "another-fixture" } };
  assert.equal(c.deliveryEligibility(plan, attempt, asset, departed, access(asset), true), "wrong-scope");
  for (const field of ["providerRequestId","usage","cost","seed","model"]) assert.equal(attempt[field], null);
  assert.equal(c.AttemptSchema.safeParse({ ...stopped, outcome: {state:"cancelled",confirmation:"closed UI"} }).success, false);
  assert.equal(c.AttemptSchema.safeParse({ ...waiting, sentAt: null }).success, false);
  for (const [state, sentAt, next] of [["not-sent",null,"eligible-for-policy-review"],["failed",attempt.sentAt,"eligible-for-policy-review"],
    ["refused",attempt.sentAt,"terminal"]]) {
    const a = c.AttemptSchema.parse({ ...attempt, sentAt, outcome:{state,reason:"offline control"} });
    assert.equal(c.nextAttemptAction(a,true), next);
    if (next !== "terminal") assert.equal(c.nextAttemptAction(a,false), "scheduling-disabled");
  }
});

test("C10 duplicate delivery, input conflicts and repeat results", () => {
  const { plan, attempt, asset } = evening;
  const replay = structuredClone(plan);
  replay.preservePeople.reverse();
  replay.target.features.reverse();
  assert.equal(c.classifyDelivery(replay, plan), "duplicate");
  assert.equal(c.classifyDelivery({ ...plan, reference: arrival.plan.reference }, plan), "event-conflict");
  assert.equal(c.classifyDelivery(plan), "new-request");
  assert.equal(c.classifyResult(plan, attempt, asset, structuredClone(asset)), "duplicate");
  assert.equal(c.classifyResult(plan, attempt, asset, { ...asset, sha256: "0".repeat(64) }), "result-conflict");
  const skip = c.DecisionSchema.parse({schemaVersion:c.schemaVersion, target:plan.target, action:"skip", reason:"无匹配"});
  assert.equal(c.classifyDelivery(skip), "no-call");
});

test("C12 annotated facts preserve the player's current location and knowledge", () => {
  const source = arrival.plan.target.source;
  const input = cases.facts.map(([basis,playerKnown,value]) => c.FactSchema.parse({source,basis,playerKnown,value}));
  assert.deepEqual(c.currentFacts(source, input), ["两位旅人已到场"]);
  assert.deepEqual(c.currentFacts(first.plan.target.source, input), []);
});
