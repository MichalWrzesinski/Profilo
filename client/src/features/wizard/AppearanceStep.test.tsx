import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider, useSession } from '@/lib/session';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { router } from '@/test/navigation';
import { AppearanceStep } from './AppearanceStep';
import { WizardExitProvider, useWizardExitHandler } from './WizardExit';

function owner(version = 3) {
  return {
    nick: 'anna',
    nickLocked: false,
    status: 'never_published',
    hasUnpublishedChanges: false,
    version,
    publicUrl: null,
    draft: {
      displayName: 'Anna',
      headline: null,
      bio: null,
      city: null,
      company: null,
      position: null,
      publicEmail: null,
      publicPhone: null,
      layout: 'classic',
      accent: 'granat',
      avatar: null,
      background: null,
      links: [],
    },
  };
}

function TopBarExit() {
  const exit = useWizardExitHandler();
  return (
    <button type="button" onClick={() => exit?.get()?.('/edytor')}>
      później
    </button>
  );
}

function setup({ patch, load }: { patch?: () => Response; load?: () => Response } = {}) {
  const bodies: unknown[] = [];
  mockFetch(async (request) => {
    if (request.method === 'GET') return load?.() ?? json(200, owner());
    bodies.push(await request.json());
    return patch?.() ?? json(200, { ...owner(4), draft: { ...owner().draft, layout: 'card' } });
  });
  function SignedIn() {
    const { signIn } = useSession();
    useEffect(() => signIn(SESSION), [signIn]);
    return (
      <WizardExitProvider>
        <TopBarExit />
        <AppearanceStep />
      </WizardExitProvider>
    );
  }
  render(
    <SessionProvider>
      <SignedIn />
    </SessionProvider>,
  );
  return { bodies, user: userEvent.setup() };
}

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('AppearanceStep', () => {
  it('saves the chosen layout before going on to the content', async () => {
    const { bodies, user } = setup();

    expect(await screen.findByRole('heading', { name: 'Wybierz układ' })).toBeVisible();
    await user.click(screen.getByRole('radio', { name: /Wizytówka/ }));
    await user.click(screen.getByRole('button', { name: 'Dalej: treść →' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/kreator/tresc'));
    expect(bodies).toEqual([{ version: 3, layout: 'card' }]);
  });

  it('goes back to step 1 and lets the top bar leave through the step', async () => {
    const { user } = setup();
    await screen.findByRole('heading', { name: 'Wybierz układ' });

    await user.click(screen.getByRole('button', { name: '← Wstecz' }));
    await user.click(screen.getByRole('button', { name: 'później' }));

    expect(router.push.mock.calls).toEqual([['/kreator'], ['/edytor']]);
  });

  it('reports a failed save and asks before leaving', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = setup({ patch: () => json(500, {}) });
    await screen.findByRole('heading', { name: 'Wybierz układ' });

    await user.click(screen.getByRole('radio', { name: 'Zieleń' }));
    await user.click(screen.getByRole('button', { name: 'Dalej: treść →' }));

    expect(await screen.findByText(/Nie udało się zapisać wyboru/)).toBeVisible();
    expect(confirm).toHaveBeenCalledWith('Wybór nie jest zapisany. Wyjść mimo to?');
    expect(router.push).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('reports a failed load', async () => {
    setup({ load: () => json(500, {}) });

    expect(await screen.findByText(/Nie udało się wczytać Twojej strony/)).toBeVisible();
    await act(async () => {});
  });

  it('reports a network failure while loading', async () => {
    setup({
      load: () => {
        throw new TypeError('offline');
      },
    });

    expect(await screen.findByText(/Nie udało się wczytać Twojej strony/)).toBeVisible();
  });
});
