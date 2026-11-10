import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from '@/test/navigation';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider } from '@/lib/session';
import { LoginForm } from './LoginForm';

async function submit(email = 'anna@example.pl', password = 'jasne-niebo-nad-krakowem') {
  render(
    <SessionProvider>
      <LoginForm />
    </SessionProvider>,
  );
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('E-mail'), email);
  if (password) await user.type(screen.getByLabelText('Hasło'), password);
  await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));
}

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('LoginForm', () => {
  it('signs in and opens the panel', async () => {
    mockFetch(() => json(200, SESSION));

    await submit();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/panel'));
    expect(tokenStore.get()).toBe('access-1');
  });

  it('shows the same message for any wrong credentials', async () => {
    mockFetch(() =>
      json(401, {
        status: 401,
        code: 'invalid_credentials',
        detail: 'Nieprawidłowy e-mail lub hasło.',
      }),
    );

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Nieprawidłowy e-mail lub hasło.');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows the lockout message after too many attempts', async () => {
    mockFetch(() => json(429, { status: 429, code: 'rate_limited' }, { 'Retry-After': '600' }));

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Za dużo prób.');
  });

  it('requires both fields', async () => {
    const fetch = mockFetch(() => json(200, SESSION));

    await submit('', '');

    expect(await screen.findByText('Wpisz hasło.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
