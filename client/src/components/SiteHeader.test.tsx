import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/lib/session';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { tokenStore } from '@/lib/api/client';
import { SiteHeader } from './SiteHeader';

const renderHeader = () =>
  render(
    <SessionProvider>
      <SiteHeader />
    </SessionProvider>,
  );

afterEach(() => {
  tokenStore.set(null);
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('SiteHeader', () => {
  it('keeps page styling and panel navigation for a signed-in visitor', async () => {
    window.localStorage.setItem('profilo:signed-in', '1');
    mockFetch(() => json(200, SESSION));
    render(
      <SessionProvider>
        <SiteHeader className="home-border" />
      </SessionProvider>,
    );
    const menu = await screen.findByRole('button', { name: 'Menu' });
    expect(menu.closest('header')).toHaveClass('home-border');
    expect(screen.getByText(/Zalogowano jako/)).toHaveTextContent(SESSION.account.email);
  });
  it('offers login and sign-up without asking the API in a new browser', () => {
    const fetch = mockFetch(() => json(200, SESSION));
    renderHeader();

    expect(screen.getByRole('link', { name: 'Zaloguj się' })).toHaveAttribute('href', '/logowanie');
    expect(screen.getByRole('link', { name: 'Załóż stronę' })).toHaveAttribute(
      'href',
      '/rejestracja',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a signed-in visitor signed in and lets them sign out', async () => {
    window.localStorage.setItem('profilo:signed-in', '1');
    mockFetch((request) => (request.url.endsWith('/refresh') ? json(200, SESSION) : json(204)));
    renderHeader();

    await userEvent.click(await screen.findByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('link', { name: 'Panel' })).toHaveAttribute('href', '/panel');
    await userEvent.click(screen.getByRole('button', { name: 'Wyloguj się' }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Zaloguj się' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });

  it('hides the buttons while a likely session is restored', async () => {
    window.localStorage.setItem('profilo:signed-in', '1');
    let answer: (response: Response) => void = () => undefined;
    mockFetch(() => new Promise<Response>((resolve) => (answer = resolve)));
    renderHeader();

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Zaloguj się' })).toBeNull());
    answer(new Response(JSON.stringify({ code: 'unauthorized', status: 401 }), { status: 401 }));

    expect(await screen.findByRole('link', { name: 'Zaloguj się' })).toBeVisible();
  });
});
