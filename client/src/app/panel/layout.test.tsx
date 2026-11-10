import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from '@/test/navigation';
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
  tokenStore.set(null);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Panel', () => {
  it('restores the session and shows the panel', async () => {
    mockFetch(() => json(200, SESSION));

    renderPanel();

    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie');
    expect(await screen.findByText(/Zalogowano jako anna@example.pl/)).toBeInTheDocument();
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
    await user.click(screen.getByRole('menuitem', { name: 'Wyloguj się' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/logowanie'));
    expect(fetch.mock.calls.some(([req]) => (req as Request).url.endsWith('/auth/logout'))).toBe(
      true,
    );
    expect(tokenStore.get()).toBeNull();
  });
});
