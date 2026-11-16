/**
 * Browser error reporting (TASK-023). The browser never talks to Sentry: CSP allows only our
 * origin, so reports go to the API's tunnel, which scrubs them again, sets release and
 * environment and forwards them with the real DSN (or drops them when reporting is off).
 * The DSN below is a syntactically valid placeholder; the tunnel replaces it.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent } from '@/lib/monitoring/scrub';

export const BROWSER_DSN = 'https://public@sentry.invalid/1';
export const TUNNEL = '/api/v1/monitoring/sentry';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: BROWSER_DSN,
    tunnel: TUNNEL,
    // No user data, cookies, headers, bodies or query parameters; scrubEvent does the rest.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
    sendClientReports: false,
    // The last pages visited and API calls (addresses, scrubbed) help to find the cause;
    // clicks and console messages are not recorded (privacy policy).
    maxBreadcrumbs: 20,
    // Errors only: no session per page view, no replays, no performance data.
    integrations: (defaults) => [
      ...defaults.filter(
        (integration) =>
          !['BrowserSession', 'BrowserTracing', 'Breadcrumbs'].includes(integration.name),
      ),
      Sentry.breadcrumbsIntegration({ dom: false }),
    ],
    beforeSend: (event) =>
      scrubEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
    beforeBreadcrumb: (crumb) =>
      crumb.category === 'console' || crumb.category?.startsWith('ui.')
        ? null
        : (scrubBreadcrumb(crumb as unknown as Record<string, unknown>) as unknown as typeof crumb),
  });
}
