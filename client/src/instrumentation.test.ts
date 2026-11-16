import * as Sentry from '@sentry/nextjs';

vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  breadcrumbsIntegration: vi.fn((options: object) => ({ name: 'Breadcrumbs', options })),
}));

type InitOptions = {
  beforeSend: (event: object) => object;
  beforeBreadcrumb: (crumb: object) => object;
  [key: string]: unknown;
};

const initOptions = () => vi.mocked(Sentry.init).mock.calls.at(-1)?.[0] as unknown as InitOptions;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(Sentry.init).mockClear();
  vi.resetModules();
});

describe('server instrumentation', () => {
  it('stays off without a DSN or outside the Node.js runtime', async () => {
    const { register } = await import('./instrumentation');
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    register();
    vi.stubEnv('SENTRY_DSN', 'https://k@o1.ingest.de.sentry.io/1');
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    register();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('reports with the release and environment of the deployment, scrubbed', async () => {
    const { register, onRequestError } = await import('./instrumentation');
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('SENTRY_DSN', 'https://k@o1.ingest.de.sentry.io/1');
    vi.stubEnv('SENTRY_RELEASE', 'abc123');
    vi.stubEnv('SENTRY_ENVIRONMENT', 'production');
    register();
    const options = initOptions();
    expect(options).toMatchObject({
      dsn: 'https://k@o1.ingest.de.sentry.io/1',
      release: 'abc123',
      environment: 'production',
      tracesSampleRate: 0,
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] },
    });
    expect(options.beforeSend({ user: { email: 'a@b.pl' }, message: 'x' })).toEqual({
      message: 'x',
    });
    expect(options.beforeBreadcrumb({ message: 'to a@b.pl' })).toEqual({
      message: 'to [Filtered]',
    });
    expect(onRequestError).toBe(Sentry.captureRequestError);
  });
});

describe('browser instrumentation', () => {
  it('is off outside production builds', async () => {
    await import('./instrumentation-client');
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('sends errors only, through the API tunnel, scrubbed', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { BROWSER_DSN, TUNNEL } = await import('./instrumentation-client');
    const options = initOptions() as InitOptions & {
      integrations: (defaults: { name: string }[]) => { name: string }[];
    };
    expect(options).toMatchObject({ dsn: BROWSER_DSN, tunnel: TUNNEL, tracesSampleRate: 0 });
    expect(TUNNEL).toBe('/api/v1/monitoring/sentry');
    const kept = options.integrations([
      { name: 'BrowserSession' },
      { name: 'BrowserTracing' },
      { name: 'Breadcrumbs' },
      { name: 'GlobalHandlers' },
    ]);
    // No sessions or tracing; breadcrumbs without clicks and console messages.
    expect(kept).toEqual([
      { name: 'GlobalHandlers' },
      { name: 'Breadcrumbs', options: { dom: false } },
    ]);
    expect(options.maxBreadcrumbs).toBe(20);
    expect(options.beforeBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
    expect(options.beforeBreadcrumb({ category: 'ui.click', message: 'x' })).toBeNull();
    expect(
      options.beforeBreadcrumb({ category: 'navigation', data: { to: '/a?token=x' } }),
    ).toEqual({ category: 'navigation', data: { to: '/a?token=[Filtered]' } });
    expect(options.beforeSend({ user: { id: 1 }, message: 'x' })).toEqual({ message: 'x' });
    expect(options.beforeBreadcrumb({ message: 'a@b.pl' })).toEqual({ message: '[Filtered]' });
  });
});
