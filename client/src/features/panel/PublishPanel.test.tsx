import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider, useSession } from '@/lib/session';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { PublishPanel } from './PublishPanel';

type State = {
  status?: string;
  nick?: string | null;
  hasUnpublishedChanges?: boolean;
  publicUrl?: string | null;
};

function owner({
  status = 'never_published',
  nick = 'anna-wisniewska',
  hasUnpublishedChanges = false,
  publicUrl = null,
}: State = {}) {
  return {
    nick,
    nickLocked: status !== 'never_published',
    status,
    hasUnpublishedChanges,
    publishedAt: null,
    version: 4,
    draftUpdatedAt: '2026-11-10T10:00:00Z',
    publicUrl,
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
  };
}

const PUBLISHED = owner({
  status: 'published',
  publicUrl: 'http://localhost:8080/user/anna-wisniewska',
});

function SignedIn({ confirmed }: { confirmed: boolean }) {
  const { signIn } = useSession();
  useEffect(() => {
    signIn({ ...SESSION, account: { ...SESSION.account, emailConfirmed: confirmed } });
  }, [signIn, confirmed]);
  return <PublishPanel />;
}

function setup(
  profile: ReturnType<typeof owner> | Response,
  options: { confirmed?: boolean; publish?: () => Response; unpublish?: () => Response } = {},
) {
  const fetch = mockFetch(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === '/api/v1/me/profile')
      return profile instanceof Response ? profile : json(200, profile);
    if (path === '/api/v1/me/profile/publish') return options.publish?.() ?? json(200, PUBLISHED);
    if (path === '/api/v1/me/profile/unpublish')
      return options.unpublish?.() ?? json(200, owner({ status: 'unpublished' }));
    return json(404, { status: 404 });
  });
  render(
    <SessionProvider>
      <SignedIn confirmed={options.confirmed ?? true} />
    </SessionProvider>,
  );
  return { fetch, user: userEvent.setup() };
}

const publishButton = (name = 'Opublikuj') => screen.findByRole('button', { name });

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
});

describe('PublishPanel', () => {
  it('publishes the first version and shows the address', async () => {
    const { fetch, user } = setup(owner());
    expect(await screen.findByText('Nieopublikowana')).toBeInTheDocument();

    await user.click(await publishButton());

    expect(await screen.findByText('Opublikowana')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'localhost:8080/user/anna-wisniewska' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Opublikuj zmiany' })).toBeDisabled();
    expect(screen.getByText('Wszystkie zmiany są już na stronie.')).toBeInTheDocument();
    const body = await (fetch.mock.calls.at(-1)![0] as Request).json();
    expect(body).toEqual({ version: 4 });
  });

  it('offers to publish changes and to hide the page', async () => {
    const { user } = setup(owner({ status: 'published', hasUnpublishedChanges: true }));

    expect(await screen.findByText('Masz nieopublikowane zmiany')).toBeInTheDocument();
    expect(await publishButton('Opublikuj zmiany')).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Ukryj stronę' }));

    expect(await screen.findByText('Ukryta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Opublikuj' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Ukryj stronę' })).toBeNull();
  });

  it.each([
    [{ confirmed: false }, owner(), 'Potwierdź adres e-mail, żeby opublikować stronę.'],
    [{}, owner({ nick: null }), 'Najpierw wybierz adres strony w kreatorze.'],
    [
      {},
      owner({ status: 'blocked' }),
      'Strona jest zablokowana — napisz do nas, jeśli to pomyłka.',
    ],
  ])('explains why publishing is disabled (%#)', async (options, profile, reason) => {
    setup(profile, options);

    expect(await publishButton()).toBeDisabled();
    expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Opublikuj' })).toHaveAccessibleDescription(reason);
  });

  it('shows the blocked badge', async () => {
    setup(owner({ status: 'blocked' }));

    expect(await screen.findByText('Zablokowana')).toBeInTheDocument();
  });

  it('reloads the current state after a conflict', async () => {
    const { user } = setup(owner(), {
      publish: () =>
        json(409, {
          status: 409,
          code: 'draft_conflict',
          current: owner({ status: 'published', hasUnpublishedChanges: true }),
        }),
    });

    await user.click(await publishButton());

    expect(await screen.findByText(/zmieniła się w innym oknie/)).toBeInTheDocument();
    expect(screen.getByText('Masz nieopublikowane zmiany')).toBeInTheDocument();
  });

  it.each([
    [
      () => json(403, { status: 403, code: 'email_not_confirmed', detail: 'Potwierdź e-mail.' }),
      'Potwierdź e-mail.',
    ],
    [() => json(500, { status: 500 }), 'Nie udało się zapisać zmiany. Spróbuj ponownie.'],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Nie udało się połączyć. Sprawdź połączenie i spróbuj ponownie.',
    ],
  ])('reports a failed publication (%#)', async (publish, message) => {
    const { user } = setup(owner(), { publish });

    await user.click(await publishButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Opublikuj' })).toBeEnabled();
  });

  it.each([json(500, { status: 500 })])('reports a failed load', async (response) => {
    setup(response);

    expect(await screen.findByText(/Nie udało się wczytać Twojej strony/)).toBeInTheDocument();
  });
});
