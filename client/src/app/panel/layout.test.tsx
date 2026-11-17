import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router, pathname } from '@/test/navigation';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider } from '@/lib/session';
import PanelLayout from './layout';
import PanelPage from './page';

function renderPanel() {
  render(
    <SessionProvider>
      <PanelLayout>
        <PanelPage />
      </PanelLayout>
    </SessionProvider>,
  );
}

afterEach(() => {
  pathname.current = '/';
  tokenStore.set(null);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Panel', () => {
  it('restores the session and shows the panel', async () => {
    mockFetch(() => json(200, SESSION));

    renderPanel();

    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie');
    // The address is in the top bar, not in the page.
    const account = await screen.findByText('Zalogowano jako anna@example.pl');
    expect(account.closest('header')).not.toBeNull();
  });

  it.each([
    ['published', true],
    ['unpublished', false],
    ['draft', false],
  ])('links to the page from the top bar when it is %s: %s', async (status, shown) => {
    mockFetch((request) =>
      new URL(request.url).pathname === '/api/v1/me/profile'
        ? json(200, { status, publicUrl: 'http://localhost:8080/user/anna', nick: 'anna' })
        : json(200, SESSION),
    );
    renderPanel();

    await screen.findByText('Zalogowano jako anna@example.pl');
    const link = screen.queryByRole('link', { name: /Zobacz swój profil/ });
    if (shown) {
      await waitFor(() =>
        expect(screen.getByRole('link', { name: /Zobacz swój profil/ })).toHaveAttribute(
          'href',
          'http://localhost:8080/user/anna',
        ),
      );
      expect(screen.getByRole('link', { name: /Zobacz swój profil/ })).toHaveAttribute(
        'target',
        '_blank',
      );
    } else {
      await screen.findByRole('heading', { name: 'Status strony' });
      expect(link).toBeNull();
      expect(screen.queryByRole('link', { name: /Zobacz swój profil/ })).toBeNull();
    }
  });

  it('sends anonymous visitors to the login page', async () => {
    mockFetch(() => json(401, { status: 401, code: 'unauthorized' }));

    renderPanel();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/logowanie'));
  });

  it('logs out from the menu', async () => {
    const fetch = mockFetch((request) =>
      request.url.endsWith('/logout') ? new Response(null, { status: 204 }) : json(200, SESSION),
    );
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: 'Wyloguj się' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/logowanie'));
    expect(fetch.mock.calls.some(([req]) => (req as Request).url.endsWith('/auth/logout'))).toBe(
      true,
    );
    expect(tokenStore.get()).toBeNull();
  });

  it('links to the account settings and closes the menu', async () => {
    pathname.current = '/panel';
    mockFetch(() => json(200, SESSION));
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Menu' }));
    const settings = screen.getByRole('link', { name: 'Ustawienia konta' });
    expect(settings).toHaveAttribute('href', '/panel/konto');
    // Back to the panel from any page of it; the current page is marked.
    expect(screen.getByRole('link', { name: 'Panel' })).toHaveAttribute('href', '/panel');
    expect(screen.getByRole('link', { name: 'Panel' })).toHaveAttribute('aria-current', 'page');
    await user.click(settings);

    expect(screen.queryByRole('navigation', { name: 'Menu konta' })).toBeNull();
  });

  it('closes the menu with Escape and gives the focus back', async () => {
    mockFetch(() => json(200, SESSION));
    renderPanel();
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Menu' });

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    screen.getByRole('link', { name: 'Panel' }).focus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('navigation', { name: 'Menu konta' })).toBeNull();
    expect(button).toHaveFocus();
  });
});
