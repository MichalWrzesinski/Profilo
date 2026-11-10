import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from '@/test/navigation';
import { json, mockFetch, requestAt, SESSION } from '@/test/fetch';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider } from '@/lib/session';
import { RegisterForm } from './RegisterForm';

function setup() {
  render(
    <SessionProvider>
      <RegisterForm />
    </SessionProvider>,
  );
  return userEvent.setup();
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  password = 'jasne-niebo-nad-krakowem',
) {
  await user.type(screen.getByLabelText('Imię i nazwisko lub pseudonim'), 'Anna Wiśniewska');
  await user.type(screen.getByLabelText('E-mail do logowania'), 'anna@example.pl');
  await user.type(screen.getByLabelText('Hasło'), password);
  await user.click(screen.getByRole('checkbox', { name: /Akceptuję Regulamin/ }));
}

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('RegisterForm', () => {
  it('creates the account, keeps the token in memory and opens the panel', async () => {
    const fetch = mockFetch(() => json(201, SESSION));
    const user = setup();
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Załóż konto' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/panel'));
    expect(tokenStore.get()).toBe('access-1');
    const body = await requestAt(fetch, 0).json();
    expect(body).toEqual({
      displayName: 'Anna Wiśniewska',
      email: 'anna@example.pl',
      password: 'jasne-niebo-nad-krakowem',
      acceptTerms: true,
      challenge: null,
    });
  });

  it('validates fields before sending and summarises the errors', async () => {
    const fetch = mockFetch(() => json(201, SESSION));
    const user = setup();
    await user.type(screen.getByLabelText('E-mail do logowania'), 'anna@example');
    await user.type(screen.getByLabelText('Hasło'), 'krotkie');

    await user.click(screen.getByRole('button', { name: 'Załóż konto' }));

    expect(await screen.findByText('Popraw 4 pola zaznaczone poniżej.')).toBeInTheDocument();
    expect(screen.getByText('Wpisz pełny adres e-mail, np. anna@example.pl.')).toBeInTheDocument();
    expect(
      screen.getByText('Hasło jest za krótkie. Użyj co najmniej 10 znaków.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Zaakceptuj regulamin, aby założyć konto.')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasło')).toHaveAttribute('aria-invalid', 'true');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the login link when the e-mail is already registered', async () => {
    mockFetch(() => json(409, { status: 409, code: 'email_taken' }));
    const user = setup();
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Załóż konto' }));

    expect(await screen.findByRole('link', { name: 'Zaloguj się' })).toHaveAttribute(
      'href',
      '/logowanie',
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows the server message on the password field', async () => {
    mockFetch(() =>
      json(422, {
        status: 422,
        code: 'validation_error',
        errors: [
          {
            field: 'password',
            code: 'password_too_common',
            message: 'To hasło jest zbyt popularne. Wybierz inne.',
          },
        ],
      }),
    );
    const user = setup();
    await fill(user, 'password123');

    await user.click(screen.getByRole('button', { name: 'Załóż konto' }));

    expect(
      await screen.findByText('To hasło jest zbyt popularne. Wybierz inne.'),
    ).toBeInTheDocument();
  });

  it('shows the rate limit message', async () => {
    mockFetch(() =>
      json(429, {
        status: 429,
        code: 'rate_limited',
        detail: 'Za dużo prób. Spróbuj ponownie później.',
      }),
    );
    const user = setup();
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Załóż konto' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Za dużo prób.');
  });

  it('shows a generic message when the server fails without details', async () => {
    mockFetch(() => json(500, { status: 500, code: 'internal_error' }));
    const user = setup();
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Załóż konto' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Coś poszło nie tak.');
  });

  it('toggles password visibility', async () => {
    const user = setup();
    const password = screen.getByLabelText('Hasło');

    await user.click(screen.getByRole('button', { name: 'Pokaż' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Ukryj' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('links to the terms and the privacy policy', () => {
    setup();

    expect(screen.getByRole('link', { name: 'Regulamin' })).toHaveAttribute('href', '/regulamin');
    expect(screen.getByRole('link', { name: 'Polityką prywatności' })).toHaveAttribute(
      'href',
      '/prywatnosc',
    );
  });
});
