import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider, useSession } from '@/lib/session';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { router } from '@/test/navigation';
import { Editor } from './Editor';
import type { OwnerProfile } from './fields';

const STORAGE_KEY = `profilo:draft:${SESSION.account.id}`;

function owner(overrides: Partial<OwnerProfile> = {}, draft: Partial<OwnerProfile['draft']> = {}) {
  return {
    nick: 'anna-wisniewska',
    nickLocked: true,
    status: 'published',
    hasUnpublishedChanges: false,
    publishedAt: '2026-11-10T12:00:00Z',
    version: 5,
    draftUpdatedAt: '2026-11-10T12:00:00Z',
    publicUrl: 'http://localhost:8080/user/anna-wisniewska',
    ...overrides,
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
      ...draft,
    },
  } as OwnerProfile;
}

type Handler = (body: Record<string, unknown>, call: number) => Response | Promise<Response>;

function setup({
  profile = owner(),
  patch,
  publish,
  confirmed = true,
  load,
}: {
  profile?: OwnerProfile;
  patch?: Handler;
  publish?: () => Response | Promise<Response>;
  confirmed?: boolean;
  load?: () => Response;
} = {}) {
  let version = profile.version;
  let calls = 0;
  const bodies: Record<string, unknown>[] = [];
  const fetch = mockFetch(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === '/api/v1/me/profile' && request.method === 'GET') {
      return load?.() ?? json(200, profile);
    }
    if (path === '/api/v1/me/profile' && request.method === 'PATCH') {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      calls += 1;
      if (patch) return patch(body, calls);
      version += 1;
      return json(200, { ...profile, version, hasUnpublishedChanges: true });
    }
    if (path === '/api/v1/me/profile/publish') {
      return publish?.() ?? json(200, { ...profile, version, hasUnpublishedChanges: false });
    }
    return json(404, { status: 404 });
  });

  function SignedIn() {
    const { signIn } = useSession();
    useEffect(() => {
      signIn({ ...SESSION, account: { ...SESSION.account, emailConfirmed: confirmed } });
    }, [signIn]);
    return <Editor />;
  }
  render(
    <SessionProvider>
      <SignedIn />
    </SessionProvider>,
  );
  return { fetch, bodies, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) };
}

const input = (label: string) => screen.findByLabelText(label, { exact: false });
const saveState = () => document.querySelector('.save-state')!;
const publishButton = () => screen.getByRole('button', { name: /^Opublikuj/ });

// `shouldAdvanceTime` keeps Testing Library's waitFor working with fake timers; timing
// assertions below leave a margin for the real milliseconds that pass meanwhile.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  router.push.mockClear();
  tokenStore.set(null);
  vi.unstubAllGlobals();
});

describe('Editor', () => {
  it('restarts the delay with every keystroke', async () => {
    const { bodies, user } = setup();
    const city = await input('Miejscowość');
    await user.type(city, 'K');
    await act(() => vi.advanceTimersByTimeAsync(800));
    await user.type(city, 'r');
    await act(() => vi.advanceTimersByTimeAsync(800));

    expect(bodies).toHaveLength(0);
    expect(saveState()).toHaveTextContent('Zapisywanie…');
    await act(() => vi.advanceTimersByTimeAsync(300));
    await waitFor(() => expect(bodies).toEqual([{ version: 5, city: 'Kr' }]));
  });

  it('saves a change typed just before leaving to the panel', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { bodies, user } = setup();
    await user.type(await input('Nagłówek'), 'UX');

    await user.click(screen.getByRole('link', { name: 'Panel' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/panel'));
    expect(bodies).toEqual([{ version: 5, headline: 'UX' }]);
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('asks before leaving when a change cannot be saved', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = setup();
    await user.type(await input('Publiczny e-mail'), 'anna@');

    await user.click(screen.getByRole('link', { name: 'Panel' }));

    expect(confirm).toHaveBeenCalledWith(
      'Część zmian nie jest zapisana. Zostaną w tej przeglądarce do następnej edycji. Wyjść?',
    );
    expect(router.push).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('sends a pending change when the editor closes', async () => {
    const { bodies, fetch, user } = setup();
    await user.type(await input('Firma'), 'Studio');

    cleanup();

    await waitFor(() => expect(bodies).toEqual([{ version: 5, company: 'Studio' }]));
    const request = fetch.mock.calls.at(-1)![0] as Request;
    expect(request.keepalive).toBe(true);
  });

  it('ignores an API error for a value changed while it was being saved', async () => {
    let release: (response: Response) => void = () => {};
    const { bodies, user } = setup({
      patch: (_body, call) =>
        call === 1
          ? new Promise<Response>((resolve) => (release = resolve))
          : json(200, owner({ version: 6 })),
    });
    const phone = await input('Telefon');
    await user.type(phone, '60123');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await user.type(phone, '4567');

    await act(async () =>
      release(
        json(422, {
          status: 422,
          code: 'validation_error',
          errors: [{ field: 'publicPhone', code: 'invalid_phone', message: 'Zły numer.' }],
        }),
      ),
    );

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({ version: 5, publicPhone: '+48 601234567' });
    expect(screen.queryByText('Zły numer.')).toBeNull();
  });

  it('tries once when leaving offline, then asks', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { bodies, user } = setup({
      patch: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await user.type(await input('Firma'), 'X');

    await user.click(screen.getByRole('link', { name: 'Panel' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/panel'));
    expect(bodies).toHaveLength(1);
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('leaves a modified click to the browser', async () => {
    const { bodies, user } = setup();
    await user.type(await input('Firma'), 'X');

    await user.keyboard('{Meta>}');
    await user.click(screen.getByRole('link', { name: 'Panel' }));
    await user.keyboard('{/Meta}');

    expect(router.push).not.toHaveBeenCalled();
    expect(bodies).toHaveLength(0);
  });

  it('stops on an error for a field that was not sent', async () => {
    const { bodies, user } = setup({
      patch: () =>
        json(422, {
          status: 422,
          code: 'validation_error',
          errors: [{ field: 'bio', code: 'too_long', message: 'Za długi.' }],
        }),
    });
    await user.type(await input('Firma'), 'X');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(await screen.findByText('Nie udało się zapisać zmian.')).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(bodies).toHaveLength(1);
  });

  it('stops on a validation error it cannot attach to a field', async () => {
    const { bodies, user } = setup({
      patch: () =>
        json(422, {
          status: 422,
          code: 'validation_error',
          errors: [{ field: '', code: 'invalid', message: 'Coś nie tak.' }],
        }),
    });
    await user.type(await input('Firma'), 'X');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(await screen.findByText('Nie udało się zapisać zmian.')).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(bodies).toHaveLength(1);
  });

  it('keeps the newer draft version when publishing finishes after a save', async () => {
    let releasePublish: (response: Response) => void = () => {};
    const { bodies, user } = setup({
      profile: owner({ hasUnpublishedChanges: true }),
      // Publishing is slow: answered only after the autosave below.
      publish: () => new Promise<Response>((resolve) => (releasePublish = resolve)),
    });
    await screen.findByText('Masz nieopublikowane zmiany');
    await user.click(publishButton());
    await user.type(await input('Firma'), 'Nowa');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(bodies).toHaveLength(1));

    await act(async () =>
      releasePublish(json(200, owner({ version: 5, hasUnpublishedChanges: false }))),
    );
    await user.type(await input('Firma'), '!');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ version: 6 });
    expect(screen.getByText('Masz nieopublikowane zmiany')).toBeInTheDocument();
  });

  it('saves only the changed field one second after the last edit', async () => {
    const { bodies, user } = setup();
    await user.type(await input('Krótki opis'), 'Projektuję');

    expect(bodies).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    await waitFor(() => expect(saveState()).toHaveTextContent('Zapisano'));
    expect(bodies).toEqual([{ version: 5, bio: 'Projektuję' }]);
    expect(screen.getByText('Masz nieopublikowane zmiany')).toBeInTheDocument();
    expect(publishButton()).toBeEnabled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('shows „Zapisywanie…” while saving', async () => {
    let release: (response: Response) => void = () => {};
    const { user } = setup({
      patch: () => new Promise<Response>((resolve) => (release = resolve)),
    });
    await user.type(await input('Miejscowość'), 'Kraków');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(saveState()).toHaveTextContent('Zapisywanie…');
    expect(publishButton()).toBeDisabled();
    await act(async () => release(json(200, owner({ version: 6 }, { city: 'Kraków' }))));
    await waitFor(() => expect(saveState()).toHaveTextContent('Zapisano'));
  });

  it('starts with an empty public e-mail and saves the phone with +48', async () => {
    const { bodies, user } = setup();

    expect(await input('Publiczny e-mail')).toHaveValue('');
    await user.type(await input('Telefon'), '601234567');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    await waitFor(() => expect(bodies).toEqual([{ version: 5, publicPhone: '+48 601234567' }]));
  });

  it('sends the chosen country prefix', async () => {
    const { bodies, user } = setup({ profile: owner({}, { publicPhone: '+48601234567' }) });

    await user.selectOptions(await screen.findByLabelText('Kierunkowy kraju'), 'DE');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    await waitFor(() => expect(bodies).toEqual([{ version: 5, publicPhone: '+49 601 234 567' }]));
  });

  it('keeps a change made while saving and sends it next', async () => {
    let release: (response: Response) => void = () => {};
    const { bodies, user } = setup({
      patch: (_body, call) =>
        call === 1
          ? new Promise<Response>((resolve) => (release = resolve))
          : json(200, owner({ version: 7 })),
    });
    const city = await input('Miejscowość');
    await user.type(city, 'Kra');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await user.type(city, 'ków');

    await act(async () => release(json(200, owner({ version: 6 }, { city: 'Kra' }))));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({ version: 6, city: 'Kraków' });
  });

  it('shows a conflict and does not overwrite the newer draft', async () => {
    const newer = owner({ version: 9 }, { headline: 'Z innego okna' });
    const { bodies, user } = setup({
      patch: () => json(409, { status: 409, code: 'draft_conflict', current: newer }),
    });
    const headline = await input('Nagłówek');
    await user.type(headline, 'Stąd');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(await screen.findByText('Szkic zmienił się w innym oknie — odśwież.')).toBeVisible();
    expect(saveState()).toHaveTextContent('Nie zapisano');
    await user.type(headline, '!');
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(bodies).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Odśwież' }));
    expect(headline).toHaveValue('Z innego okna');
    expect(saveState()).toHaveTextContent('Zapisano');
  });

  it('holds back a too long bio and keeps saving other fields', async () => {
    const { bodies, user } = setup();
    const bio = await input('Krótki opis');
    await user.click(bio);
    await user.paste('x'.repeat(501));
    await user.type(await input('Firma'), 'Studio');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(screen.getByText('Możesz wpisać najwyżej 500 znaków (teraz 501).')).toBeVisible();
    expect(bio).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(bodies).toEqual([{ version: 5, company: 'Studio' }]));
    expect(saveState()).toHaveTextContent('Nie zapisano');
    expect(publishButton()).toBeDisabled();

    await user.type(bio, '{Backspace}');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(bodies[1]).toEqual({ version: 6, bio: 'x'.repeat(500) }));
  });

  it('shows the API error under the field and resends the other fields', async () => {
    const { bodies, user } = setup({
      patch: (body) =>
        'publicPhone' in body
          ? json(422, {
              status: 422,
              code: 'validation_error',
              errors: [
                {
                  field: 'publicPhone',
                  code: 'invalid_phone',
                  message: 'To nie wygląda na numer telefonu. Sprawdź cyfry i kierunkowy.',
                },
              ],
            })
          : json(200, owner({ version: 6 }, { city: 'Gdańsk' })),
    });
    await user.type(await input('Telefon'), '12');
    await user.type(await input('Miejscowość'), 'Gdańsk');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(
      await screen.findByText('To nie wygląda na numer telefonu. Sprawdź cyfry i kierunkowy.'),
    ).toBeVisible();
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({ version: 5, city: 'Gdańsk' });
  });

  it('keeps changes in the browser when offline and retries on request', async () => {
    let online = false;
    const { bodies, user } = setup({
      patch: () => {
        if (!online) throw new TypeError('Failed to fetch');
        return json(200, owner({ version: 6 }, { city: 'Łódź' }));
      },
    });
    await user.type(await input('Miejscowość'), 'Łódź');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(await screen.findByText('Nie udało się zapisać zmian.')).toBeVisible();
    expect(saveState()).toHaveTextContent('Nie zapisano');
    expect(publishButton()).toBeDisabled();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toMatchObject({
      baseVersion: 5,
      dirty: ['city'],
      values: { city: 'Łódź' },
    });

    online = true;
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await waitFor(() => expect(saveState()).toHaveTextContent('Zapisano'));
    expect(bodies).toHaveLength(2);
    expect(screen.queryByText('Nie udało się zapisać zmian.')).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('treats a server error like a failed save', async () => {
    const { user } = setup({ patch: () => json(500, { status: 500 }) });
    await user.type(await input('Firma'), 'X');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(await screen.findByText('Nie udało się zapisać zmian.')).toBeVisible();
  });

  it('restores changes kept in this browser and saves them', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        baseVersion: 5,
        dirty: ['city'],
        values: { ...valuesOf(owner()), city: 'Toruń' },
      }),
    );
    const { bodies } = setup();

    expect(await input('Miejscowość')).toHaveValue('Toruń');
    await waitFor(() => expect(bodies).toEqual([{ version: 5, city: 'Toruń' }]));
  });

  it('drops kept changes made on an older version', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ baseVersion: 2, dirty: ['city'], values: { city: 'Stare' } }),
    );
    const { bodies } = setup();

    expect(await input('Miejscowość')).toHaveValue('');
    expect(bodies).toHaveLength(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('publishes the saved draft', async () => {
    const { fetch, user } = setup({ profile: owner({ hasUnpublishedChanges: true }) });

    await screen.findByText('Masz nieopublikowane zmiany');
    await user.click(publishButton());

    await waitFor(() => expect(screen.queryByText('Masz nieopublikowane zmiany')).toBeNull());
    const request = fetch.mock.calls.at(-1)![0] as Request;
    expect(await request.json()).toEqual({ version: 5 });
  });

  it.each([
    [
      () => json(403, { status: 403, code: 'email_not_confirmed', detail: 'Potwierdź e-mail.' }),
      'Potwierdź e-mail.',
    ],
    [() => json(500, { status: 500 }), 'Nie udało się opublikować.'],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Nie udało się opublikować. Sprawdź połączenie i spróbuj ponownie.',
    ],
  ])('reports a failed publication (%#)', async (publish, message) => {
    const { user } = setup({ profile: owner({ status: 'never_published' }), publish });

    await user.click(await screen.findByRole('button', { name: 'Opublikuj' }));

    expect(await screen.findByText(message)).toBeVisible();
  });

  it.each([
    [
      { confirmed: false },
      owner({ status: 'never_published' }),
      'Potwierdź adres e-mail, żeby opublikować stronę.',
    ],
    [
      {},
      owner({ status: 'never_published', nick: null }),
      'Najpierw wybierz adres strony w kreatorze.',
    ],
  ])('explains why publishing is disabled (%#)', async (options, profile, hint) => {
    setup({ ...options, profile });

    const button = await screen.findByRole('button', { name: 'Opublikuj' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(hint);
    expect(screen.getByText('Nieopublikowana')).toBeInTheDocument();
  });

  it('shows the blocked badge', async () => {
    setup({ profile: owner({ status: 'blocked' }) });

    expect(await screen.findByText('Zablokowana')).toBeInTheDocument();
  });

  it('saves typed fields before a link change and continues from its version', async () => {
    const link = {
      id: '00000000-0000-7000-8000-00000000000a',
      url: 'https://github.com/anna',
      label: 'GitHub',
      service: 'github' as const,
    };
    const calls: string[] = [];
    let version = 5;
    const fetch = mockFetch(async (request) => {
      const path = new URL(request.url).pathname;
      calls.push(`${request.method} ${path}`);
      if (request.method === 'GET') return json(200, owner({ version }, { links: [link] }));
      if (request.method === 'PATCH') {
        const body = (await request.json()) as { version: number };
        if (body.version !== version) return json(409, { status: 409, code: 'draft_conflict' });
        version += 1;
        return json(200, owner({ version }, { links: path.endsWith('/me/profile') ? [link] : [] }));
      }
      version += 1; // DELETE bumps the draft version on the server
      return new Response(null, { status: 204 });
    });
    function SignedIn() {
      const { signIn } = useSession();
      useEffect(
        () => signIn({ ...SESSION, account: { ...SESSION.account, emailConfirmed: true } }),
        [signIn],
      );
      return <Editor />;
    }
    render(
      <SessionProvider>
        <SignedIn />
      </SessionProvider>,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(await input('Firma'), 'Studio');

    await user.click(screen.getByRole('button', { name: 'Usuń GitHub' }));
    await waitFor(() => expect(calls).toHaveLength(4));
    await user.type(await input('Miejscowość'), 'Łódź');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    await waitFor(() => expect(calls).toHaveLength(5));
    expect(calls).toEqual([
      'GET /api/v1/me/profile',
      'PATCH /api/v1/me/profile',
      `DELETE /api/v1/me/profile/links/${link.id}`,
      'GET /api/v1/me/profile',
      'PATCH /api/v1/me/profile',
    ]);
    expect(saveState()).toHaveTextContent('Zapisano');
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('keeps saving fields typed while a failed link change was running', async () => {
    const link = {
      id: '00000000-0000-7000-8000-00000000000a',
      url: 'https://github.com/anna',
      label: 'GitHub',
      service: 'github' as const,
    };
    let release: (response: Response) => void = () => {};
    const bodies: unknown[] = [];
    mockFetch(async (request) => {
      if (request.method === 'GET') return json(200, owner({}, { links: [link] }));
      if (request.method === 'DELETE') {
        return new Promise<Response>((resolve) => (release = resolve));
      }
      bodies.push(await request.json());
      return json(200, owner({ version: 6 }, { links: [link] }));
    });
    function SignedIn() {
      const { signIn } = useSession();
      useEffect(
        () => signIn({ ...SESSION, account: { ...SESSION.account, emailConfirmed: true } }),
        [signIn],
      );
      return <Editor />;
    }
    render(
      <SessionProvider>
        <SignedIn />
      </SessionProvider>,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Usuń GitHub' }));
    await user.type(await input('Firma'), 'Studio');
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(bodies).toHaveLength(0); // waits for the link change
    expect(publishButton()).toBeDisabled();

    await act(async () => release(json(500, { status: 500 })));
    expect(await screen.findByText('Nie udało się usunąć linku. Spróbuj ponownie.')).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(1000));

    await waitFor(() => expect(bodies).toEqual([{ version: 5, company: 'Studio' }]));
  });

  it('runs quick link changes one after another and saves typing with the last version', async () => {
    const a = {
      id: '00000000-0000-7000-8000-00000000000a',
      url: 'https://a.pl',
      label: 'A',
      service: 'other' as const,
    };
    const b = {
      id: '00000000-0000-7000-8000-00000000000b',
      url: 'https://b.pl',
      label: 'B',
      service: 'other' as const,
    };
    const c = {
      id: '00000000-0000-7000-8000-00000000000c',
      url: 'https://c.pl',
      label: 'C',
      service: 'other' as const,
    };
    let version = 5;
    let links = [a, b, c];
    const releases: (() => void)[] = [];
    const patches: { version: number }[] = [];
    mockFetch(async (request) => {
      if (request.method === 'GET') return json(200, owner({ version }, { links }));
      if (request.method === 'PUT') {
        const { linkIds } = (await request.json()) as { linkIds: string[] };
        await new Promise<void>((resolve) => releases.push(resolve));
        version += 1;
        links = linkIds.map((id) => [a, b, c].find((link) => link.id === id)!);
        return json(200, owner({ version }, { links }));
      }
      const body = (await request.json()) as { version: number };
      patches.push(body);
      if (body.version !== version) return json(409, { status: 409, code: 'draft_conflict' });
      version += 1;
      return json(200, owner({ version }, { links }));
    });
    function SignedIn() {
      const { signIn } = useSession();
      useEffect(
        () => signIn({ ...SESSION, account: { ...SESSION.account, emailConfirmed: true } }),
        [signIn],
      );
      return <Editor />;
    }
    render(
      <SessionProvider>
        <SignedIn />
      </SessionProvider>,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(await screen.findByRole('button', { name: 'Przesuń w dół: A' }));
    // The row buttons wait while the first change runs.
    expect(screen.getByRole('button', { name: 'Przesuń w dół: B' })).toBeDisabled();
    await user.type(await input('Firma'), 'Studio');
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(patches).toHaveLength(0);

    await act(async () => releases.shift()!());
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ version: 6 });
    await waitFor(() => expect(saveState()).toHaveTextContent('Zapisano'));
    expect(screen.queryByText(/Szkic zmienił się w innym oknie/)).toBeNull();
  });

  it('switches between the form and the preview on phones', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('tab', { name: 'Podgląd' }));

    expect(screen.getByRole('tab', { name: 'Podgląd' })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('[data-tab="preview"]')).not.toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Edycja' }));
    expect(document.querySelector('[data-tab="edit"]')).not.toBeNull();
  });

  it('shows the loading skeleton first', () => {
    setup({ load: () => new Promise<Response>(() => {}) as unknown as Response });

    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie…');
    expect(document.querySelectorAll('.skel').length).toBeGreaterThan(0);
  });

  it('reports a failed load', async () => {
    setup({ load: () => json(500, { status: 500 }) });

    expect(await screen.findByText(/Nie udało się wczytać Twojej strony/)).toBeVisible();
  });

  it('asks before leaving with unsaved changes', async () => {
    const { user } = setup();
    await user.type(await input('Firma'), 'X');

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

function valuesOf(profile: OwnerProfile) {
  return {
    displayName: profile.draft.displayName,
    headline: '',
    bio: '',
    position: '',
    company: '',
    city: '',
    publicEmail: '',
    phoneCountry: 'PL',
    phoneNational: '',
  };
}
