import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider, useSession } from '@/lib/session';
import { json, mockFetch, SESSION, type Handler } from '@/test/fetch';
import { router } from '@/test/navigation';
import { AccountSettings } from './AccountSettings';

// Throwaway values typed into the forms (not secrets).
const CURRENT = 'stare-haslo-123'; // gitleaks:allow
const NEXT = 'nowe-haslo-12345'; // gitleaks:allow
const TYPED = 'moje-haslo-123'; // gitleaks:allow

const CONFIRMED = { ...SESSION, account: { ...SESSION.account, emailConfirmed: true } };
const NEW_SESSION = { ...CONFIRMED, accessToken: 'access-2' };

function setup(handler: Handler, confirmed = true) {
  const fetch = mockFetch(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === '/api/v1/me/profile') {
      return json(200, { publicUrl: 'http://localhost:8080/user/anna' });
    }
    return handler(request);
  });
  function SignedIn() {
    const { signIn } = useSession();
    useEffect(() => signIn(confirmed ? CONFIRMED : SESSION), [signIn]);
    return <AccountSettings />;
  }
  render(
    <SessionProvider>
      <SignedIn />
    </SessionProvider>,
  );
  return { fetch, user: userEvent.setup() };
}

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const bodyOf = async (fetch: ReturnType<typeof mockFetch>, path: string) => {
  const call = fetch.mock.calls.find(([input]) =>
    String((input as Request).url ?? input).endsWith(path),
  );
  return (call![0] as Request).json();
};

describe('change password', () => {
  async function change(user: ReturnType<typeof userEvent.setup>, current = CURRENT, next = NEXT) {
    await user.type(await screen.findByLabelText('Obecne hasło'), current);
    await user.type(screen.getByLabelText('Nowe hasło'), next);
    await user.click(screen.getByRole('button', { name: 'Zmień hasło' }));
  }

  it('changes the password and keeps this browser signed in', async () => {
    const { fetch, user } = setup(() => json(200, NEW_SESSION));

    await change(user);

    expect(await screen.findByText(/Hasło zmienione/)).toBeVisible();
    expect(tokenStore.get()).toBe('access-2');
    expect(await bodyOf(fetch, '/me/password')).toEqual({
      currentPassword: CURRENT,
      newPassword: NEXT,
    });
    expect(screen.getByLabelText('Obecne hasło')).toHaveValue('');
  });

  it('marks a wrong current password at its field', async () => {
    const { user } = setup(() => json(403, { status: 403, code: 'invalid_password' }));

    await change(user);

    expect(await screen.findByText('Obecne hasło jest nieprawidłowe')).toBeVisible();
    expect(screen.getByLabelText('Obecne hasło')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the server rule for the new password', async () => {
    const { user } = setup(() =>
      json(422, {
        status: 422,
        errors: [
          {
            field: 'newPassword',
            code: 'same_password',
            message: 'Nowe hasło musi być inne niż obecne.',
          },
        ],
      }),
    );

    await change(user);

    expect(await screen.findByText('Nowe hasło musi być inne niż obecne.')).toBeVisible();
  });

  it.each([
    [
      () => json(429, { status: 429, detail: 'Za dużo prób z nieprawidłowym hasłem.' }),
      'Za dużo prób',
    ],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Nie udało się połączyć.',
    ],
  ])('reports other failures (%#)', async (handler, message) => {
    const { user } = setup(handler);

    await change(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('checks the fields first and can show the passwords', async () => {
    const { fetch, user } = setup(() => json(200, NEW_SESSION));

    await user.click(await screen.findByRole('button', { name: 'Zmień hasło' }));

    expect(await screen.findByText('Wpisz obecne hasło')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Pokaż' }));
    expect(screen.getByLabelText('Nowe hasło')).toHaveAttribute('type', 'text');
    expect(fetch.mock.calls.some(([input]) => String(input).includes('/me/password'))).toBe(false);
  });

  it('asks an unconfirmed owner to confirm the e-mail first', async () => {
    setup(() => json(200, NEW_SESSION), false);

    expect(await screen.findByText(/Najpierw potwierdź adres e-mail/)).toBeVisible();
    expect(screen.queryByLabelText('Obecne hasło')).toBeNull();
  });
});

describe('delete account', () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Usuń konto' }));
    return screen.getByRole('dialog', { name: 'Usunąć konto na zawsze?' });
  }

  it('deletes with the password, signs out and says goodbye', async () => {
    const { fetch, user } = setup((request) =>
      new URL(request.url).pathname === '/api/v1/auth/logout'
        ? new Response(null, { status: 204 })
        : new Response(null, { status: 204 }),
    );
    const dialog = await openDialog(user);
    expect(dialog).toHaveTextContent('Adres localhost:8080/user/anna przestanie działać od razu.');
    expect(within(dialog).getByLabelText('Wpisz hasło, aby potwierdzić')).toHaveFocus();

    await user.type(within(dialog).getByLabelText('Wpisz hasło, aby potwierdzić'), TYPED);
    await user.click(within(dialog).getByRole('button', { name: 'Usuń konto' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/konto-usuniete'));
    expect(sessionStorage.getItem('profilo:account-deleted')).toBe('1');
    expect(tokenStore.get()).toBeNull();
    sessionStorage.clear();
    expect(await bodyOf(fetch, '/me/deletion')).toEqual({ password: TYPED });
  });

  it('keeps the dialog open with a wrong password', async () => {
    const { user } = setup(() => json(403, { status: 403, code: 'invalid_password' }));
    const dialog = await openDialog(user);

    await user.type(within(dialog).getByLabelText('Wpisz hasło, aby potwierdzić'), 'zle');
    await user.click(within(dialog).getByRole('button', { name: 'Usuń konto' }));

    expect(await within(dialog).findByText('Hasło jest nieprawidłowe')).toBeVisible();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sends once even if submitted twice quickly', async () => {
    let finish: (response: Response) => void = () => undefined;
    const { fetch, user } = setup(() => new Promise<Response>((resolve) => (finish = resolve)));
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Wpisz hasło, aby potwierdzić'), TYPED);

    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    finish(new Response(null, { status: 204 }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/konto-usuniete'));
    const deletions = fetch.mock.calls.filter(([input]) =>
      String((input as Request).url ?? input).endsWith('/me/deletion'),
    );
    expect(deletions).toHaveLength(1);
    sessionStorage.clear();
  });

  it('asks for the password before sending', async () => {
    const { fetch, user } = setup(() => new Response(null, { status: 204 }));
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Usuń konto' }));

    expect(within(dialog).getByText('Wpisz hasło')).toBeVisible();
    expect(fetch.mock.calls.some(([input]) => String(input).includes('/me/deletion'))).toBe(false);
  });

  it.each([
    [
      () => json(429, { status: 429, detail: 'Za dużo prób z nieprawidłowym hasłem.' }),
      'Za dużo prób',
    ],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Nie udało się połączyć.',
    ],
  ])('reports other failures (%#)', async (handler, message) => {
    const { user } = setup(handler);
    const dialog = await openDialog(user);

    await user.type(within(dialog).getByLabelText('Wpisz hasło, aby potwierdzić'), 'haslo');
    await user.click(within(dialog).getByRole('button', { name: 'Usuń konto' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
  });

  it('cancels and clears the password', async () => {
    const { user } = setup(() => new Response(null, { status: 204 }));
    let dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Wpisz hasło, aby potwierdzić'), 'haslo');

    await user.click(within(dialog).getByRole('button', { name: 'Anuluj' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    dialog = await openDialog(user);

    expect(within(dialog).getByLabelText('Wpisz hasło, aby potwierdzić')).toHaveValue('');
  });

  it('works without the page address', async () => {
    mockFetch(() => json(500, { status: 500 }));
    function SignedIn() {
      const { signIn } = useSession();
      useEffect(() => signIn(CONFIRMED), [signIn]);
      return <AccountSettings />;
    }
    render(
      <SessionProvider>
        <SignedIn />
      </SessionProvider>,
    );
    const user = userEvent.setup();

    const dialog = await openDialog(user);

    expect(dialog).not.toHaveTextContent('przestanie działać');
  });
});
