import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateAudit, evaluateProcessResult, runAudit, EXCEPTION } from './audit.mjs';

const NOW = new Date('2026-11-17T18:00:00Z');
const advisory = (changes = {}) => ({ ...EXCEPTION, dependency: 'picomatch', ...changes });
const report = (via) => ({
  auditReportVersion: 2,
  vulnerabilities: {
    sentry: { via: ['rollup'] },
    rollup: { via: ['picomatch'] },
    picomatch: { via },
  },
});
const evaluate = (value, options = {}) => evaluateAudit(value, { now: NOW, ...options });

test('excepts only the approved advisory, including indirect findings', () => {
  const result = evaluate(report([advisory()]));
  assert.equal(result.ignored.length, 1);
  assert.equal(result.blocked.length, 0);
});

test('blocks the advisory again exactly at expiry', () => {
  const result = evaluate(report([advisory()]), { now: new Date(EXCEPTION.expiresAt) });
  assert.equal(result.ignored.length, 0);
  assert.equal(result.blocked.length, 1);
});

for (const change of [
  { url: 'https://github.com/advisories/GHSA-other' },
  { name: 'other' },
  { dependency: 'other' },
  { range: '<=4.0.8' },
  { severity: 'critical' },
]) {
  test(`does not extend the exception to ${JSON.stringify(change)}`, () => {
    assert.equal(evaluate(report([advisory(change)])).blocked.length, 1);
  });
}

test('another advisory in the same dependency still blocks', () => {
  const result = evaluate(
    report([advisory(), advisory({ url: 'https://github.com/advisories/GHSA-new' })]),
  );
  assert.equal(result.ignored.length, 1);
  assert.equal(result.blocked.length, 1);
});

test('resolves npm peer-dependency cycles without dropping another advisory', () => {
  const value = report([advisory()]);
  value.vulnerabilities.vitest = { via: ['coverage', 'picomatch'] };
  value.vulnerabilities.coverage = { via: ['vitest'] };
  assert.equal(evaluate(value).ignored.length, 1);
  value.vulnerabilities.coverage.via.push(
    advisory({ url: 'https://github.com/advisories/GHSA-new' }),
  );
  assert.equal(evaluate(value).blocked.length, 1);
});

test('subprocess failures and incomplete reports cannot pass', () => {
  const clean = { auditReportVersion: 2, vulnerabilities: {} };
  for (const result of [
    { error: new Error('spawn failed'), status: null },
    { error: new Error('timeout'), status: null, signal: 'SIGTERM' },
    { status: 2, stderr: 'registry unavailable' },
    { status: 1, stdout: 'not JSON' },
    { status: 1, stdout: JSON.stringify(clean) },
    { status: 0, stdout: JSON.stringify({ error: 'registry error' }) },
  ])
    assert.throws(() => evaluateProcessResult(result, { now: NOW }));
  assert.equal(
    evaluateProcessResult({ status: 0, stdout: JSON.stringify(clean) }, { now: NOW }).blocked
      .length,
    0,
  );
  assert.equal(
    evaluateProcessResult({ status: 1, stdout: JSON.stringify(report([advisory()])) }, { now: NOW })
      .ignored.length,
    1,
  );
});

test('does not accept flags that weaken the audit', () => {
  assert.throws(() => runAudit(['--audit-level=critical']));
  assert.throws(() => runAudit(['--omit=dev', '--omit=dev']));
});

test('reports dev-only moderate findings but blocks them in runtime dependencies', () => {
  const value = report([advisory({ severity: 'moderate' })]);
  assert.equal(evaluate(value).remaining.length, 1);
  assert.equal(evaluate(value).blocked.length, 0);
  assert.equal(evaluate(value, { minimum: 'info' }).blocked.length, 1);
});

test('accepts a clean report', () => {
  assert.deepEqual(evaluate({ auditReportVersion: 2, vulnerabilities: {} }).blocked, []);
});

test('fails closed on invalid, incomplete or cyclic reports', () => {
  for (const value of [
    null,
    { error: 'offline' },
    { auditReportVersion: 3, vulnerabilities: {} },
    report([]),
    report(['missing']),
    report(['sentry']),
    report([{}]),
    { auditReportVersion: 2, vulnerabilities: [] },
  ]) {
    assert.throws(() => evaluate(value));
  }
});
