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
    {
      // Pages only: not the API, media, Next.js assets or files (a dot in the path: public/,
      // robots.txt, sitemap.xml; nicks have no dots).
      source: '/((?!api/|media/|_next/|.*\\.).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
