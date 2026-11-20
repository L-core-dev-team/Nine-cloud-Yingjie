import assert from 'node:assert/strict';
import { nextAttemptAction } from '../../packages/contracts/dist/index.js';
import { dryRun, examples, mockSession, prepare } from './prepare.mjs';

const stage = id => examples.find(row => row.plan.target.source.eventId === id);
const syntheticSecret = 'SYNTHETIC-DO-NOT-LOG-9284';
const noise = {
  authorization: 'Bearer ' + syntheticSecret,
  downloadUrl: 'https://example.invalid/asset?signature=' + syntheticSecret,
  rawResponse: { diagnostic: syntheticSecret },
};

async function checkMock() {
  const offline = dryRun();
  assert.equal(offline.logicalRequests, 3);
  assert.deepEqual(offline.records.map(r => r.plan.action), ['generate', 'reuse', 'edit', 'reuse', 'edit', 'skip']);
  for (const record of offline.records) {
    if (record.logicalInput) {
      assert.equal(record.attempt.sentAt, null);
      assert.equal(record.attempt.outcome.state, 'not-sent');
      assert.equal(record.attempt.capability.origin, 'offline');
    } else {
      assert.equal(record.attempt, null);
    }
  }
  for (const [id, reference, preserves] of [['S2', 'I0', 3], ['S3B', 'I1', 5]]) {
    const prepared = prepare(stage(id));
    assert.equal(prepared.eligibility, 'eligible');
    assert.equal(prepared.logicalInput.reference.assetId, reference);
    assert.equal(prepared.logicalInput.preservePeople.length, preserves);
    const damaged = prepare(stage(id), 'mock', () => '0'.repeat(64));
    assert.equal(damaged.attempt.outcome.reason, 'digest-mismatch');
    assert.equal(damaged.logicalInput, null);
    const never = mockSession(() => { throw new Error('unexpected send'); });
    assert.throws(() => never.submit(damaged));
    assert.equal(never.calls, 0);
  }

  const cases = [
    { name: 'normal', stageId: 'S0', reply: { state: 'returned', fixtureAssetId: 'I0', jobId: 'mock-job-1' } },
    { name: 'missing-remote-metadata', stageId: 'S2', reply: { state: 'returned', fixtureAssetId: 'I1' } },
    { name: 'explicit-failure', stageId: 'S2', reply: { state: 'failed' } },
    { name: 'unknown-after-send', stageId: 'S3B' },
  ];
  const records = [];
  for (const {name, stageId, reply} of cases) {
    const prepared = prepare(stage(stageId), 'mock');
    const session = mockSession(async () => {
      if (!reply) throw new Error('simulated timeout: ' + syntheticSecret);
      return { ...reply, ...noise };
    });
    const receipt = await session.submit(prepared);
    const {attempt, asset} = receipt;
    assert.equal(attempt.attemptId, prepared.attempt.attemptId);
    assert.equal(attempt.requestKey, prepared.attempt.requestKey);
    assert.equal(attempt.capability.origin, 'mock');
    assert.ok(attempt.sentAt);
    assert.equal(attempt.usage, null);
    assert.equal(attempt.cost, null);
    if (reply?.state === 'returned') {
      assert.equal(receipt.link, 'linked');
      assert.equal(asset.target.source.eventId, stageId);
      assert.equal(asset.review.status, 'pending');
      assert.equal(receipt.provenance.assetId, reply.fixtureAssetId);
      assert.equal(attempt.providerRequestId?.value ?? null, reply.jobId ?? null);
    } else if (reply) {
      assert.equal(attempt.outcome.state, 'failed');
      assert.equal(attempt.outcome.reason, 'mock-explicit-failure');
      assert.equal(asset, null);
    } else {
      assert.equal(attempt.outcome.state, 'unknown');
      assert.equal(attempt.localWait, 'stopped');
      assert.equal(nextAttemptAction(attempt, false), 'hold-unknown');
      assert.equal(attempt.providerRequestId, null);
      const replay = await session.submit(prepared);
      assert.strictEqual(replay, receipt);
      assert.equal(asset, null);
    }
    assert.equal(session.calls, 1);
    records.push({name, stageId, mockSends: session.calls, nextAction: nextAttemptAction(attempt, false), ...receipt});
  }
  const output = {mode: 'local-mock', logicalRequests: cases.length,
    mockSends: records.reduce((sum, row) => sum + row.mockSends, 0), externalImageCalls: 0,
    verified: ['four-actions', 'corrupt-reference-blocked', 'result-link', 'missing-metadata',
      'explicit-failure', 'unknown-replay-one-send', 'redaction'], records};
  const serialized = JSON.stringify(output);
  for (const forbidden of [syntheticSecret, 'authorization', 'downloadUrl', 'rawResponse', 'signature=']) {
    assert.ok(!serialized.includes(forbidden), 'Sensitive response data escaped');
  }
  return output;
}

const args = process.argv.slice(2);
if (args.length > 1 || (args.length && !['--mock', '--dry-run'].includes(args[0]))) {
  throw new Error('Usage: node experiments/yj02-backend-readiness/run.mjs [--dry-run|--mock]');
}
const result = args[0] === '--mock' ? await checkMock() : dryRun();
console.log(JSON.stringify(result, null, 2));
