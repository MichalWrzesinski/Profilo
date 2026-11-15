import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider } from '@/lib/session';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { searchParams } from '@/test/navigation';
import { NewPasswordForm } from './NewPasswordForm';

const TOKEN = 'a'.repeat(43);

async function submit(password = 'zielona-herbata-o-poranku', token = TOKEN) {
  searchParams.current = new URLSearchParams(token ? { token } : {});
  render(
    <SessionProvider>
      <NewPasswordForm />
    </SessionProvider>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nowe hasło'), password);
  await user.click(screen.getByRole('button', { name: 'Ustaw nowe hasło' }));
  return user;
}

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
  searchParams.current = new URLSearchParams();
});

describe('NewPasswordForm', () => {
  it('sets the password, signs in and offers the panel', async () => {
    const fetch = mockFetch(() => json(200, SESSION));

    await submit();

    expect(await screen.findByText('Hasło zmienione.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Przejdź do panelu' })).toHaveAttribute(
      'href',
      '/panel',
    );
    expect(tokenStore.get()).toBe('access-1');
    const request = fetch.mock.calls[0]![0] as Request;
    expect(await request.json()).toEqual({
      token: TOKEN,
      newPassword: 'zielona-herbata-o-poranku',
    });
  });

  it('shows „Link wygasł” with a way to get a new link', async () => {
    mockFetch(() => json(410, { status: 410, code: 'token_expired' }));

    await submit();

    expect(await screen.findByText('Link wygasł.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Wyślij nowy link' })).toHaveAttribute(
      'href',
      '/nie-pamietam-hasla',
    );
  });

  it('shows „Link wygasł” at once for a link without a token', () => {
    searchParams.current = new URLSearchParams();
    render(
      <SessionProvider>
        <NewPasswordForm />
      </SessionProvider>,
    );

    expect(screen.getByText('Link wygasł.')).toBeVisible();
  });

  it('shows the password rule from the server at the field', async () => {
    mockFetch(() =>
      json(422, {
        status: 422,
        code: 'validation_error',
        errors: [
          {
            field: 'newPassword',
            code: 'password_too_common',
            message: 'To hasło jest zbyt popularne. Wybierz inne.',
          },
        ],
      }),
    );

    await submit('password12345');

    expect(await screen.findByText('To hasło jest zbyt popularne. Wybierz inne.')).toBeVisible();
    expect(screen.getByLabelText('Nowe hasło')).toHaveAttribute('aria-invalid', 'true');
  });

  it('checks the length before sending and can show the password', async () => {
    const fetch = mockFetch(() => json(200, SESSION));

    const user = await submit('krotkie');

    expect(await screen.findByText(/Hasło jest za krótkie/)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Pokaż' }));
    expect(screen.getByLabelText('Nowe hasło')).toHaveAttribute('type', 'text');
  });

  it.each([
    [
      () => json(429, { status: 429, detail: 'Za dużo prób. Spróbuj ponownie później.' }),
      'Za dużo prób.',
    ],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Nie udało się połączyć.',
    ],
  ])('reports other failures (%#)', async (handler, message) => {
    mockFetch(handler);

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});
