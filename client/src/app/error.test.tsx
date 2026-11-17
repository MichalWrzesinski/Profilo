import * as Sentry from '@sentry/nextjs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/lib/session';
import ErrorPage from './error';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

describe('error page', () => {
  it('explains the failure in Polish, reports it and retries', async () => {
    const reset = vi.fn();
    const error = new Error('API down');
    render(
      <SessionProvider>
        <ErrorPage error={error} reset={reset} />
      </SessionProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Nie udało się wczytać strony' })).toBeVisible();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(reset).toHaveBeenCalled();
  });
});
