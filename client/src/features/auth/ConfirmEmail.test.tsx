import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router, searchParams } from '@/test/navigation';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider } from '@/lib/session';
import { ConfirmEmail } from './ConfirmEmail';

const TOKEN = 'a'.repeat(43);
type Routes = Record<string, () => Response>;

function setup(routes: Routes, token = TOKEN) {
  searchParams.current = new URLSearchParams(token ? { token } : {});
  const fetch = mockFetch((request) => {
    const path = new URL(request.url).pathname;
    const route = routes[path];
    return route ? route() : json(404, { status: 404, code: 'not_found' });
  });
  render(
    <SessionProvider>
      <ConfirmEmail />
    </SessionProvider>,
  );
  return fetch;
}

const CONFIRM = '/api/v1/auth/email-confirmations/confirm';
const REFRESH = '/api/v1/auth/refresh';
const RESEND = '/api/v1/auth/email-confirmations';
const noContent = () => new Response(null, { status: 204 });
const unauthorized = () => json(401, { status: 401, code: 'unauthorized' });
const expired = () => json(410, { status: 410, code: 'token_expired' });

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ConfirmEmail', () => {
  it('confirms and offers the panel to a logged-in owner', async () => {
    const fetch = setup({ [CONFIRM]: noContent, [REFRESH]: () => json(200, SESSION) });

    expect(screen.getByRole('status')).toHaveTextContent('Sprawdzamy link');
    expect(await screen.findByText(/Adres potwierdzony/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Przejdź do panelu' })).toHaveAttribute(
      'href',
      '/panel',
    );
    const body = await (fetch.mock.calls[0]![0] as Request).json();
    expect(body).toEqual({ token: TOKEN });
  });

  it('sends a logged-out owner to the login page with a notice', async () => {
    setup({ [CONFIRM]: noContent, [REFRESH]: unauthorized });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/logowanie?potwierdzono=1'));
  });

  it('shows the expired state and sends a new link', async () => {
    const fetch = setup({
      [CONFIRM]: expired,
      [REFRESH]: () => json(200, SESSION),
      [RESEND]: () => new Response(null, { status: 202 }),
    });
    const user = userEvent.setup();

    expect(await screen.findByText('Link wygasł albo został już użyty.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Wyślij nowy link' }));

    expect(await screen.findByText(/Wysłaliśmy nowy link/)).toBeInTheDocument();
    expect(fetch.mock.calls.some(([r]) => new URL((r as Request).url).pathname === RESEND)).toBe(
      true,
    );
  });

  it('asks a logged-out owner to log in before sending a new link', async () => {
    setup({ [CONFIRM]: expired, [REFRESH]: unauthorized });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Wyślij nowy link' }));

    expect(router.push).toHaveBeenCalledWith('/logowanie');
  });

  it('treats a missing token as expired without calling the API', async () => {
    const fetch = setup({}, '');

    expect(await screen.findByText('Link wygasł albo został już użyty.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows an error when the server fails', async () => {
    setup({ [CONFIRM]: () => json(500, { status: 500, code: 'internal_error' }) });

    expect(await screen.findByText(/Nie udało się potwierdzić adresu/)).toBeInTheDocument();
  });

  it('shows an error when sending the new link fails', async () => {
    setup({
      [CONFIRM]: expired,
      [REFRESH]: () => json(200, SESSION),
      [RESEND]: () => json(500, { status: 500, code: 'internal_error' }),
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Wyślij nowy link' }));

    expect(await screen.findByText(/Nie udało się potwierdzić adresu/)).toBeInTheDocument();
  });
});
