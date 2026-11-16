/**
 * Removes personal data from Sentry events before they leave the browser or the Next.js
 * server (TASK-023). Same rules as the API's `core/monitoring.py`, which scrubs browser
 * events once more in the tunnel.
 */

const FILTERED = '[Filtered]';
const SENSITIVE_KEY =
  /pass|secret|token|auth|cookie|session|e-?mail|phone|dsn|csrf|jwt|api[-_]?key|signature/i;
// Also internationalised addresses: anything around an @ up to a separator, dot in the domain.
const EMAIL = /[^\s@<>()[\]"',;:=]+@[^\s@<>()[\]"',;:=]+\.[^\s@<>()[\]"',;:=]+/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const OPAQUE = /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/g;
const QUERY_SECRET = /((?:token|code|password|email|key)=)[^&#\s]+/gi;
const PHONE = /(?<!\d)\+?\d(?:[ -]?\d){8,14}(?!\d)/g;
const STRUCTURAL = new Set([
  'release',
  'event_id',
  'trace_id',
  'span_id',
  'parent_span_id',
  'debug_id',
  'debug_meta',
  'sdk',
  'platform',
  'timestamp',
  'start_timestamp',
  'dist',
  'fingerprint',
  'server_name',
  'request_id',
]);

export function scrubText(value: string): string {
  return value
    .replace(QUERY_SECRET, `$1${FILTERED}`)
    .replace(EMAIL, FILTERED)
    .replace(JWT, FILTERED)
    .replace(OPAQUE, FILTERED)
    .replace(PHONE, FILTERED);
}

function scrub(value: unknown): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (STRUCTURAL.has(key)) continue;
      record[key] = SENSITIVE_KEY.test(key) ? FILTERED : scrub(record[key]);
    }
  }
  return value;
}

type Scrubbable = Record<string, unknown>;

export function scrubEvent<T extends Scrubbable>(event: T): T {
  delete event.user;
  const request = event.request as Scrubbable | undefined;
  if (request && typeof request === 'object') {
    delete request.data;
    delete request.cookies;
    delete request.env;
    const headers = request.headers as Record<string, unknown> | undefined;
    request.headers =
      headers && typeof headers === 'object' && 'User-Agent' in headers
        ? { 'User-Agent': headers['User-Agent'] }
        : {};
  }
  return scrub(event) as T;
}

export function scrubBreadcrumb<T extends Scrubbable>(crumb: T): T {
  return scrub(crumb) as T;
}
