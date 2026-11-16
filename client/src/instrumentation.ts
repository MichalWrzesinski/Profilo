/**
 * Server-side error reporting of the Next.js app (TASK-023): only when the server has a DSN
 * (`SENTRY_DSN`, delivered by the deploy workflow), with the release and environment of the
 * deployment. Rendering errors are reported by `onRequestError`.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent } from '@/lib/monitoring/scrub';

export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !dsn) return;
  Sentry.init({
    dsn,
    release: process.env.SENTRY_RELEASE,
    environment: process.env.SENTRY_ENVIRONMENT,
    // No user data, cookies, headers, bodies or query parameters; scrubEvent does the rest.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
    initialScope: { tags: { service: 'client-server' } },
    beforeSend: (event) =>
      scrubEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
    beforeBreadcrumb: (crumb) =>
      scrubBreadcrumb(crumb as unknown as Record<string, unknown>) as unknown as typeof crumb,
  });
}

export const onRequestError = Sentry.captureRequestError;
