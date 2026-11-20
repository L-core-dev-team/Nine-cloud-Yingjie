export * from "./schema.js";
import { z } from "zod";
import { AttemptSchema, FactSchema, type Source, type Visual, type Decision, type Attempt, type Asset } from "./schema.js";

function scope(s: Source) {
  switch (s.kind) {
    case "synthetic-fixture": return [s.kind, s.fixtureId];
    case "card-history": return [s.kind, s.ownerId, s.sessionId];
    case "native-turn": return [s.kind, s.ownerId, s.saveId, s.branchId];
  }
}

function sameScope(a: Source, b: Source) {
  return JSON.stringify(scope(a)) === JSON.stringify(scope(b));
}

function sameEvent(a: Source, b: Source) {
  return eventKey(a) === eventKey(b) && (a.kind === "synthetic-fixture" ||
    (b.kind !== "synthetic-fixture" && a.revision === b.revision));
}

export function eventKey(s: Source) {
  return JSON.stringify([...scope(s), s.kind === "synthetic-fixture" ? s.eventId : s.key]);
}

const sorted = (items: string[]) => [...items].sort();
function facts(v: Visual) {
  return [sorted(v.people), sorted(v.features), v.timeOfDay, v.lighting, v.viewpoint, v.perspective];
}

export function sameVisual(a: Visual, b: Visual) {
  return sameScope(a.source, b.source) && a.sceneId === b.sceneId && a.visualVersion === b.visualVersion &&
    JSON.stringify(facts(a)) === JSON.stringify(facts(b));
}

export function currentFacts(source: Source, candidates: z.infer<typeof FactSchema>[]) {
  return candidates.filter(f => sameEvent(f.source, source) && f.basis === "current-story" && f.playerKnown)
    .map(f => f.value);
}

// The server supplies the live access decision and the digest observed in storage.
export type Access = { source: Source; authorized: boolean; observedSha256: string | null };
function available(asset: Asset, access: Access) {
  if (!access.authorized) return "access-revoked";
  if (!sameScope(asset.target.source, access.source)) return "wrong-scope";
  if (asset.invalidated) return "invalidated";
  if (!asset.storageKey || !access.observedSha256) return "file-missing";
  if (asset.sha256 !== access.observedSha256) return "digest-mismatch";
  if (asset.review.status !== "accepted") return "review-" + asset.review.status;
  if (asset.review.assessment !== "matches") return "review-inconclusive";
  return "eligible";
}

export function historyEligibility(asset: Asset, originalAccess: Access) {
  const result = available(asset, originalAccess);
  if (result !== "eligible") return result;
  return asset.target.source.kind === "synthetic-fixture" ? "fixture-only" : "eligible";
}

export function displayEligibility(asset: Asset, current: Visual, access: Access, targetActive: boolean) {
  const result = available(asset, access);
  if (result !== "eligible") return result;
  if (!targetActive) return "target-inactive";
  if (!sameScope(current.source, asset.target.source)) return "wrong-scope";
  if (current.sceneId !== asset.target.sceneId) return "wrong-scene";
  return sameVisual(asset.target, current) ? "eligible" : "visual-mismatch";
}

export function reuseEligibility(asset: Asset, plan: Extract<Decision,{action:"reuse"}>, access: Access, targetActive: boolean) {
  if (asset.assetId !== plan.assetId) return "wrong-candidate";
  return displayEligibility(asset, plan.target, access, targetActive);
}

export function referenceEligibility(asset: Asset, plan: Extract<Decision,{action:"edit"}>, access: Access) {
  const result = available(asset, access);
  if (result !== "eligible") return result;
  if (!sameScope(asset.target.source, plan.target.source)) return "wrong-scope";
  if (asset.target.sceneId !== plan.target.sceneId) return "wrong-scene";
  const ref = plan.reference;
  if (asset.assetId !== ref.assetId || asset.sha256 !== ref.sha256 ||
      asset.target.visualVersion !== ref.visualVersion || asset.review.id !== ref.reviewId) return "wrong-reference";
  const retained = (required: string[], from: string[], to: string[]) =>
    required.every(item => from.includes(item) && to.includes(item));
  return retained(plan.preservePeople, asset.target.people, plan.target.people) &&
    retained(plan.preserveFeatures, asset.target.features, plan.target.features) ? "eligible" : "preservation-mismatch";
}

export function requestKey(plan: Decision) {
  if (plan.action === "skip" || plan.action === "reuse") return null;
  const t = plan.target;
  const edit = plan.action === "edit" ? [plan.reference.assetId, plan.reference.sha256, plan.reference.visualVersion,
    plan.reference.reviewId, sorted(plan.preservePeople), sorted(plan.preserveFeatures), plan.change] : null;
  return JSON.stringify([eventKey(t.source), t.source.kind === "synthetic-fixture" ? null : t.source.revision,
    t.sceneId, t.visualVersion, facts(t), plan.action, edit]);
}

// The caller stores one decision per source event and compares before dispatch.
export function classifyDelivery(plan: Decision, prior: Decision | undefined) {
  if (prior && eventKey(prior.target.source) === eventKey(plan.target.source)) {
    const sameCandidate = prior.action !== "reuse" || (plan.action === "reuse" && prior.assetId === plan.assetId);
    return sameEvent(prior.target.source, plan.target.source) && prior.action === plan.action && sameCandidate && sameVisual(prior.target, plan.target) &&
      requestKey(prior) === requestKey(plan) ? "duplicate" : "event-conflict";
  }
  return requestKey(plan) === null ? "no-call" : "new-request";
}

export function resultLink(plan: Decision, attempt: Attempt, asset: Asset) {
  if (requestKey(plan) !== attempt.requestKey || asset.requestKey !== attempt.requestKey ||
      asset.attemptId !== attempt.attemptId) return "wrong-request";
  if (!sameVisual(plan.target, asset.target) || !sameEvent(plan.target.source, asset.target.source))
    return "wrong-target";
  if (attempt.outcome.state !== "returned" || attempt.outcome.assetId !== asset.assetId ||
      attempt.outcome.sha256 !== asset.sha256) return "wrong-result";
  const ref = plan.action === "edit" ? plan.reference : null;
  if (ref === null ? asset.reference !== null : !asset.reference || ref.assetId !== asset.reference.assetId ||
      ref.sha256 !== asset.reference.sha256 || ref.visualVersion !== asset.reference.visualVersion ||
      ref.reviewId !== asset.reference.reviewId) return "wrong-reference";
  return "linked";
}

// Scope result receipts by logical request AND attempt; contradictory repeats need reconciliation.
export function classifyResult(plan: Decision, attempt: Attempt, asset: Asset, previous?: Asset) {
  const link = resultLink(plan, attempt, asset);
  if (link !== "linked") return link;
  if (!previous) return "record-once";
  return resultLink(plan, attempt, previous) === "linked" ? "duplicate" : "result-conflict";
}

export function deliveryEligibility(plan: Decision, attempt: Attempt, asset: Asset, current: Visual, access: Access, targetActive: boolean) {
  const link = resultLink(plan, attempt, asset);
  if (link !== "linked") return link;
  return displayEligibility(asset, current, access, targetActive && attempt.localWait === "active");
}

export function stopWaiting(attempt: Attempt, reason: string, observedAt: string): Attempt {
  return AttemptSchema.parse({ ...attempt, localWait: "stopped", observedAt,
    outcome: attempt.outcome.state === "waiting" ? { state: "unknown", reason } : attempt.outcome });
}

export function nextAttemptAction(a: Attempt, schedulingEnabled: boolean) {
  switch (a.outcome.state) {
    case "unknown":
      return a.capability.query === "supported" && a.providerRequestId ? "query-original" : "hold-unknown";
    case "waiting": return "await-original";
    case "not-sent":
    case "failed": return schedulingEnabled ? "eligible-for-policy-review" : "scheduling-disabled";
    default: return "terminal";
  }
}
