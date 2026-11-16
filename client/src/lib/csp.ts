/**
 * Content-Security-Policy of the pages (TASK-024): scripts only with the per-request nonce
 * (Next.js adds it to its own scripts) or loaded by such a script (`'strict-dynamic'`); an
 * injected `<script>` without the nonce does not run. Caddy keeps a strict fallback for
 * everything else (API, media) — infra/server/Caddyfile.
 */

/** Pages that other pages of the site may frame (the editor preview, the landing's example). */
export const FRAMABLE_PATHS = ['/podglad', '/przyklad'];

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function contentSecurityPolicy(
  nonce: string,
  { path, dev }: { path: string; dev: boolean },
): string {
  const framable = FRAMABLE_PATHS.includes(path);
  return [
    "default-src 'self'",
    // React uses eval only in development (debug stacks).
    `script-src 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // 'strict-dynamic' ignores 'self' for scripts: the proof-of-work web worker needs this.
    "worker-src 'self'",
    // No nonce here: a nonce would make browsers ignore 'unsafe-inline', which the
    // components' inline styles still need (out of scope of TASK-024).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-ancestors ${framable ? "'self'" : "'none'"}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}
