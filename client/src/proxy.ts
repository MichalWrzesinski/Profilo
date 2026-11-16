import { type NextRequest, NextResponse } from 'next/server';
import { contentSecurityPolicy, newNonce } from '@/lib/csp';

/**
 * A fresh nonce for every page request (TASK-024). Next.js reads it from the request's CSP
 * header and puts it on its scripts; the same policy goes back in the response.
 */
export function proxy(request: NextRequest) {
  const policy = contentSecurityPolicy(newNonce(), {
    path: request.nextUrl.pathname,
    dev: process.env.NODE_ENV === 'development',
  });
  const headers = new Headers(request.headers);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    // Pages only — every document, prefetched and prerendered ones too (they would otherwise
    // arrive without a nonce and never become interactive): not the API, media, Next.js
    // assets or files with a known extension (public/, robots.txt, sitemap.xml). A dotted
    // path that is not a file (a 404) still gets the nonce; nicks have no dots anyway.
    '/((?!api/|media/|_next/|.*\\.(?:txt|xml|ico|png|jpe?g|svg|webp|gif|js|css|map|json|woff2?|webmanifest)$).*)',
  ],
};
