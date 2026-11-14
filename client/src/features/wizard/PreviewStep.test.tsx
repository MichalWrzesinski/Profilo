import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider, useSession } from '@/lib/session';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { router } from '@/test/navigation';
import { PreviewStep } from './PreviewStep';

function owner(overrides: Record<string, unknown> = {}) {
  return {
    nick: 'anna',
    nickLocked: false,
    status: 'never_published',
    hasUnpublishedChanges: false,
    publishedAt: null,
    version: 7,
    publicUrl: null,
    draft: {
      displayName: 'Anna Wiśniewska',
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
    ...overrides,
  };
}

function setup({
  confirmed = true,
  profile = owner(),
  publish,
  load,
}: {
  confirmed?: boolean;
  profile?: ReturnType<typeof owner>;
  publish?: () => Response;
  load?: () => Response;
} = {}) {
  const fetch = mockFetch(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === '/api/v1/me/profile') return load?.() ?? json(200, profile);
    if (path === '/api/v1/me/profile/publish')
      return publish?.() ?? json(200, owner({ status: 'published' }));
    return json(404, {});
  });
  function SignedIn() {
    const { signIn } = useSession();
    useEffect(
      () => signIn({ ...SESSION, account: { ...SESSION.account, emailConfirmed: confirmed } }),
      [signIn],
    );
    return <PreviewStep />;
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

describe('PreviewStep', () => {
  it('shows the preview and publishes the page', async () => {
    const { fetch, user } = setup();

    expect(
      await screen.findByRole('heading', { name: 'Tak zobaczą Cię odwiedzający' }),
    ).toBeVisible();
    expect(screen.getByTitle('Podgląd strony')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Popraw treść' })).toHaveAttribute(
      'href',
      '/kreator/tresc',
    );
    await user.click(screen.getByRole('button', { name: 'Telefon' }));
    await user.click(screen.getByRole('button', { name: 'Opublikuj stronę' }));

    expect(router.push).toHaveBeenCalledWith('/edytor?opublikowano=1');
    const body = await (fetch.mock.calls.at(-1)![0] as Request).json();
    expect(body).toEqual({ version: 7 });
  });

  it.each([
    [{ confirmed: false }, 'Najpierw potwierdź e-mail'],
    [{ profile: owner({ nick: null }) }, 'Najpierw wybierz adres strony'],
    [{ profile: owner({ status: 'blocked' }) }, 'Strona jest zablokowana'],
  ])('explains why publishing is disabled (%#)', async (options, hint) => {
    setup(options);

    const button = await screen.findByRole('button', { name: /Opublikuj/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(hint);
  });

  it('says „Opublikuj zmiany” for a published page', async () => {
    setup({ profile: owner({ status: 'published' }) });

    expect(await screen.findByRole('button', { name: 'Opublikuj zmiany' })).toBeEnabled();
  });

  it.each([
    [
      () => json(409, { status: 409, code: 'draft_conflict', current: owner({ version: 9 }) }),
      'Strona zmieniła się w innym oknie. Sprawdź podgląd i opublikuj ponownie.',
    ],
    [
      () => json(403, { status: 403, code: 'email_not_confirmed', detail: 'Potwierdź e-mail.' }),
      'Potwierdź e-mail.',
    ],
    [() => json(500, { status: 500 }), 'Nie udało się opublikować. Spróbuj ponownie.'],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Nie udało się opublikować. Sprawdź połączenie i spróbuj ponownie.',
    ],
  ])('reports a failed publication (%#)', async (publish, message) => {
    const { user } = setup({ publish });

    await user.click(await screen.findByRole('button', { name: 'Opublikuj stronę' }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    [() => json(500, {})],
    [
      () => {
        throw new TypeError('x');
      },
    ],
  ])('reports a failed load (%#)', async (load) => {
    setup({ load });

    expect(await screen.findByText(/Nie udało się wczytać Twojej strony/)).toBeVisible();
  });
});
