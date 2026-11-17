import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Owner-approved on 2026-11-17. This accepts the risk temporarily; it is not a fix.
export const EXCEPTION = Object.freeze({
  url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
  name: 'picomatch',
  range: '<=4.0.7',
  severity: 'high',
  expiresAt: '2026-11-24T00:00:00Z',
});

const LEVELS = ['info', 'low', 'moderate', 'high', 'critical'];
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Resolve npm's indirect findings to their underlying advisories before applying the exception. */
export function evaluateAudit(report, { now = new Date(), minimum = 'high' } = {}) {
  if (
    !record(report) ||
    report.error ||
    report.auditReportVersion !== 2 ||
    !record(report.vulnerabilities) ||
    !LEVELS.includes(minimum) ||
    !Number.isFinite(now.getTime())
  )
    throw new Error('Invalid npm audit report or audit options');

  const findings = new Map();
  function visit(name, parents = new Set()) {
    if (parents.has(name)) return false; // npm peer dependencies can form cycles.
    const node = report.vulnerabilities[name];
    if (!record(node) || !Array.isArray(node.via) || !node.via.length) {
      throw new Error(`Unresolved npm audit dependency: ${name}`);
    }
    let resolved = false;
    for (const via of node.via) {
      if (typeof via === 'string') {
        resolved = visit(via, new Set([...parents, name])) || resolved;
      } else {
        if (
          !record(via) ||
          typeof via.url !== 'string' ||
          typeof via.name !== 'string' ||
          !LEVELS.includes(via.severity)
        ) {
          throw new Error(`Invalid npm audit advisory for ${name}`);
        }
        findings.set(
          JSON.stringify([via.url, via.name, via.dependency, via.severity, via.range]),
          via,
        );
        resolved = true;
      }
    }
    return resolved;
  }
  for (const name of Object.keys(report.vulnerabilities)) {
    if (!visit(name)) throw new Error(`Unresolved npm audit dependency: ${name}`);
  }

  const ignored = [];
  const remaining = [];
  for (const finding of findings.values()) {
    const excepted =
      now < new Date(EXCEPTION.expiresAt) &&
      finding.url === EXCEPTION.url &&
      finding.name === EXCEPTION.name &&
      finding.dependency === EXCEPTION.name &&
      finding.range === EXCEPTION.range &&
      finding.severity === EXCEPTION.severity;
    (excepted ? ignored : remaining).push(finding);
  }
  return {
    ignored,
    remaining,
    blocked: remaining.filter(
      (finding) => LEVELS.indexOf(finding.severity) >= LEVELS.indexOf(minimum),
    ),
  };
}

export function evaluateProcessResult(result, options) {
  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(`npm audit did not complete: ${result.error?.message ?? result.stderr}`);
  }
  const report = JSON.parse(result.stdout);
  const evaluated = evaluateAudit(report, options);
  if (result.status === 1 && !Object.keys(report.vulnerabilities).length) {
    throw new Error('npm audit failed without a vulnerability report');
  }
  return evaluated;
}

export function runAudit(args) {
  if (args.some((arg) => arg !== '--omit=dev') || args.length > 1) {
    throw new Error('Usage: node scripts/audit.mjs [--omit=dev]');
  }
  const result = spawnSync('npm', ['audit', '--json', ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  });
  const evaluated = evaluateProcessResult(result, {
    minimum: args.includes('--omit=dev') ? 'info' : 'high',
  });
  for (const finding of evaluated.ignored) {
    console.warn(
      `TEMPORARY EXCEPTION: ${finding.name} ${finding.url}; expires ${EXCEPTION.expiresAt}`,
    );
  }
  for (const finding of evaluated.remaining) {
    console.log(`${finding.severity}: ${finding.name} ${finding.url}`);
  }
  console.log(
    `Audit: ${evaluated.blocked.length} blocking, ${evaluated.remaining.length} reported, ${evaluated.ignored.length} temporarily excepted`,
  );
  return evaluated.blocked.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = runAudit(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
