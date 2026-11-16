import { contentSecurityPolicy, FRAMABLE_PATHS, newNonce } from './csp';

const directive = (policy: string, name: string) =>
  policy
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe('contentSecurityPolicy', () => {
  it('allows scripts only with the nonce, without unsafe-inline', () => {
    const policy = contentSecurityPolicy('abc', { path: '/', dev: false });
    expect(directive(policy, 'script-src')).toBe("'nonce-abc' 'strict-dynamic'");
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(policy).not.toContain('unsafe-eval');
    expect(directive(policy, 'worker-src')).toBe("'self'");
    expect(directive(policy, 'connect-src')).toBe("'self'");
    expect(directive(policy, 'object-src')).toBe("'none'");
  });

  it('keeps inline styles allowed (no nonce in style-src, which would disable them)', () => {
    const policy = contentSecurityPolicy('abc', { path: '/', dev: false });
    expect(directive(policy, 'style-src')).toBe("'self' 'unsafe-inline'");
  });

  it('allows eval only in development', () => {
    expect(contentSecurityPolicy('n', { path: '/', dev: true })).toContain(
      "script-src 'nonce-n' 'strict-dynamic' 'unsafe-eval'",
    );
  });

  it('lets only the preview and the example page be framed, by our own pages', () => {
    for (const path of FRAMABLE_PATHS) {
      expect(directive(contentSecurityPolicy('n', { path, dev: false }), 'frame-ancestors')).toBe(
        "'self'",
      );
    }
    for (const path of ['/', '/panel', '/user/anna', '/podglad/x']) {
      expect(directive(contentSecurityPolicy('n', { path, dev: false }), 'frame-ancestors')).toBe(
        "'none'",
      );
    }
  });
});

describe('newNonce', () => {
  it('is random base64 of 16 bytes', () => {
    const nonces = new Set(Array.from({ length: 50 }, newNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
