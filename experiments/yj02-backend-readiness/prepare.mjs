import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  AssetSchema, AttemptSchema, CapabilitySchema, DecisionSchema,
  referenceEligibility, requestKey, resultLink, reuseEligibility, schemaVersion, stopWaiting,
} from '../../packages/contracts/dist/index.js';
import { script, stages } from '../../packages/contracts/fixtures/tavern.mjs';

const repo = new URL('../../', import.meta.url);
const assets = new Map(stages.map(({ asset }) => [asset.assetId, asset]));
const clock = () => new Date().toISOString();

function observedDigest(asset) {
  try {
    const bytes = readFileSync(new URL(asset.storageKey, repo));
    return createHash('sha256').update(bytes).digest('hex');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const quietTurn = stages.find(({ plan }) => plan.action === 'reuse').plan;
const skipPlan = DecisionSchema.parse({
  schemaVersion, action: 'skip', reason: '额外离线分支：玩家关闭图片',
  target: { ...quietTurn.target, source: { ...quietTurn.target.source, eventId: 'skip-example' } },
});
export const examples = [...stages, { plan: skipPlan, asset: null }];

function capability(mode) {
  const mock = mode === 'mock';
  return CapabilitySchema.parse({
    schemaVersion, origin: mode, entry: mock ? 'in-process-fixture' : 'logical-preparation',
    verifiedAt: mock ? clock() : null, generate: mock ? 'supported' : 'unknown',
    referenceEdit: mock ? 'supported' : 'unknown', query: 'unknown', cancel: 'unknown', idempotency: 'unknown',
  });
}

// Reads trusted, tracked fixture assets only. The access grant is scoped to this synthetic experiment.
export function prepare({ plan: input, asset: expected }, mode = 'offline', digestOf = observedDigest) {
  const plan = DecisionSchema.parse(input);
  const record = { plan, eligibility: null, logicalInput: null, attempt: null };
  if (plan.action === 'skip') return record;
  if (plan.action === 'reuse' || plan.action === 'edit') {
    const id = plan.action === 'edit' ? plan.reference.assetId : plan.assetId;
    const selected = assets.get(id);
    record.eligibility = 'file-missing';
    if (selected) {
      const access = { authorized: true, source: plan.target.source, observedSha256: digestOf(selected) };
      record.eligibility = plan.action === 'edit' ? referenceEligibility(selected, plan, access)
        : reuseEligibility(selected, plan, access, true);
    }
    if (plan.action === 'reuse') return record;
  }
  const eligible = record.eligibility === null || record.eligibility === 'eligible';
  const key = requestKey(plan);
  if (eligible) {
    const prompt = script.prompts[expected.assetId];
    if (!prompt) throw new Error('Missing fixture prompt');
    record.logicalInput = { action: plan.action, target: plan.target, prompt };
    if (plan.action === 'edit') Object.assign(record.logicalInput, {
      reference: { ...plan.reference, storageKey: assets.get(plan.reference.assetId).storageKey },
      change: plan.change, preservePeople: plan.preservePeople, preserveFeatures: plan.preserveFeatures,
    });
  }
  record.attempt = AttemptSchema.parse({
    schemaVersion, attemptId: randomUUID(), requestKey: key, capability: capability(mode),
    sentAt: null, observedAt: clock(), localWait: 'active',
    providerRequestId: null, model: null, seed: null, usage: null, cost: null,
    outcome: { state: 'not-sent', reason: eligible ? 'prepared-only' : record.eligibility },
  });
  return record;
}

// Only the experiment's injected functions use this boundary. No HTTP client or provider SDK.
export function mockSession(send) {
  const requests = new Map();
  let calls = 0;

  async function deliver(prepared) {
    const { plan, attempt, logicalInput } = prepared;
    const sentAt = clock();
    const waiting = AttemptSchema.parse({
      ...attempt, sentAt, observedAt: sentAt, outcome: { state: 'waiting' },
    });
    calls++;
    let response;
    try {
      response = await send(logicalInput);
    } catch {
      // A transport exception after dispatch does not prove remote failure.
      response = null;
    }
    // Only this test protocol's opaque identifiers are admitted. Never copy raw replies or error text.
    const remote = typeof response?.jobId === 'string' && /^mock-job-[0-9]+$/.test(response.jobId)
      ? { source: 'provider-response', value: response.jobId } : null;
    function finish(outcome) {
      return AttemptSchema.parse({ ...waiting, observedAt: clock(), outcome, providerRequestId: remote });
    }
    if (response?.state === 'failed') {
      return { attempt: finish({ state: 'failed', reason: 'mock-explicit-failure' }), asset: null };
    }
    if (response?.state !== 'returned') {
      return { attempt: stopWaiting({ ...waiting, providerRequestId: remote }, 'dispatch-result-unknown', clock()), asset: null };
    }

    const original = assets.get(response.fixtureAssetId);
    if (!original || observedDigest(original) !== original.sha256) throw new Error('Invalid mock asset bytes');
    const asset = AssetSchema.parse({
      ...original, assetId: 'mock-' + waiting.attemptId, attemptId: waiting.attemptId,
      requestKey: waiting.requestKey, review: { id: 'pending-' + waiting.attemptId, status: 'pending',
        assessment: 'indeterminate', basis: 'local-mock', reason: '引用原工具样图作模拟回执，未进行新图审阅' },
    });
    const returned = finish({ state: 'returned', assetId: asset.assetId, sha256: asset.sha256 });
    const link = resultLink(plan, returned, asset);
    if (link !== 'linked') throw new Error('Invalid mock result association: ' + link);
    return { attempt: returned, asset, link, provenance: { kind: 'existing-codex-tool-png', assetId: original.assetId } };
  }
  return {
    get calls() { return calls; },
    submit(prepared) {
      if (!prepared.logicalInput || prepared.attempt?.capability.origin !== 'mock') {
        throw new Error('Only an eligible mock request can enter this transport');
      }
      const key = prepared.attempt.requestKey;
      if (!requests.has(key)) requests.set(key, Promise.resolve().then(() => deliver(prepared)));
      return requests.get(key);
    },
  };
}

export function dryRun() {
  const records = examples.map(row => prepare(row));
  return {
    mode: 'dry-run', source: 'synthetic-fixture', backendStatus: 'BLOCKED / NOT_RUN',
    gaps: ['approved-backend-image-entry', 'backend-authentication', 'approved-live-call-scope'],
    logicalRequests: records.filter(row => row.logicalInput).length, mockSends: 0, externalImageCalls: 0, records,
  };
}
