import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from '@/test/navigation';
import { json, mockFetch } from '@/test/fetch';
import { NickStep } from './NickStep';

type Overrides = { nick?: string | null; nickLocked?: boolean; displayName?: string };

function profile({
  nick = null,
  nickLocked = false,
  displayName = 'Anna Wiśniewska',
}: Overrides = {}) {
  return {
    nick,
    nickLocked,
    status: 'never_published',
    hasUnpublishedChanges: false,
    publishedAt: null,
    version: 3,
    draftUpdatedAt: '2026-11-10T10:00:00Z',
    publicUrl: null,
    draft: {
      displayName,
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

type Api = {
  profile?: ReturnType<typeof profile>;
  suggestion?: string | null;
  taken?: string[];
  put?: () => Response;
  availability?: (nick: string) => Response | Promise<Response>;
  patch?: () => Response;
  load?: () => Response;
};

function setup(options: Api = {}) {
  const current = options.profile ?? profile();
  const fetch = mockFetch(async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/me/profile' && request.method === 'GET')
      return options.load?.() ?? json(200, current);
    if (url.pathname === '/api/v1/me/profile' && request.method === 'PATCH') {
      return options.patch?.() ?? json(200, { ...current, version: current.version + 1 });
    }
    if (url.pathname === '/api/v1/nicks/suggestion') {
      return json(200, {
        nick: options.suggestion === undefined ? 'anna-wisniewska' : options.suggestion,
      });
    }
    if (url.pathname.endsWith('/availability')) {
      const nick = decodeURIComponent(url.pathname.split('/')[4]!);
      if (options.availability) return options.availability(nick);
      return (options.taken ?? []).includes(nick)
        ? json(200, {
            nick,
            available: false,
            reason: 'taken',
            suggestions: [`${nick}-2`, `${nick}-3`],
          })
        : json(200, { nick, available: true, suggestions: [] });
    }
    if (url.pathname === '/api/v1/me/profile/nick') {
      return options.put?.() ?? json(200, { ...current, nick: 'x' });
    }
    return json(404, { status: 404 });
  });
  render(<NickStep />);
  return { fetch, user: userEvent.setup() };
}

const nickInput = () => screen.getByLabelText('Adres Twojej strony');
const next = () => screen.getByRole('button', { name: 'Dalej →' });
const calls = (fetch: ReturnType<typeof mockFetch>, method: string, path: string) =>
  fetch.mock.calls
    .map(([r]) => r as Request)
    .filter((r) => r.method === method && new URL(r.url).pathname === path);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('NickStep', () => {
  it('proposes a nick from the display name and saves it', async () => {
    const { fetch, user } = setup();

    await waitFor(() => expect(nickInput()).toHaveValue('anna-wisniewska'));
    expect(screen.getByText(/Adres wolny/)).toBeInTheDocument();
    await user.click(next());

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/panel'));
    const [put] = calls(fetch, 'PUT', '/api/v1/me/profile/nick');
    expect(await put!.json()).toEqual({ nick: 'anna-wisniewska' });
    expect(calls(fetch, 'PATCH', '/api/v1/me/profile')).toHaveLength(0);
  });

  it('leaves the field empty when the name gives no proposal', async () => {
    setup({ suggestion: null, profile: profile({ displayName: 'Al' }) });

    await screen.findByDisplayValue('Al');
    await waitFor(() => expect(nickInput()).toHaveValue(''));
    expect(next()).toBeDisabled();
  });

  it('normalises typed text and shows suggestions for a taken nick', async () => {
    const { user } = setup({ taken: ['anna'] });
    await screen.findByDisplayValue('anna-wisniewska');

    await user.clear(nickInput());
    await user.type(nickInput(), 'Anna');

    expect(await screen.findByText(/Ten adres jest już zajęty/)).toBeInTheDocument();
    expect(nickInput()).toHaveValue('anna');
    expect(next()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'anna-2' }));
    expect(nickInput()).toHaveValue('anna-2');
    expect(next()).toBeEnabled();
  });

  it('shows the rule for an invalid nick without asking the API', async () => {
    const { fetch, user } = setup();
    await screen.findByDisplayValue('anna-wisniewska');
    const before = fetch.mock.calls.length;

    await user.clear(nickInput());
    await user.type(nickInput(), '-an');

    expect(
      screen.getByText(/3–40 znaków: małe litery, cyfry i pojedyncze myślniki/),
    ).toBeInTheDocument();
    expect(nickInput()).toHaveAttribute('aria-invalid', 'true');
    expect(next()).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(
      fetch.mock.calls.slice(before).some(([r]) => (r as Request).url.includes('availability')),
    ).toBe(false);
  });

  it('saves a changed display name before the nick', async () => {
    const { fetch, user } = setup();
    await screen.findByDisplayValue('anna-wisniewska');

    const name = screen.getByLabelText('Imię i nazwisko lub pseudonim');
    await user.clear(name);
    await user.type(name, 'Anna W.');
    await user.clear(nickInput());
    await user.type(nickInput(), 'anna-w');
    await screen.findByText(/Adres wolny/);
    await user.click(next());

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/panel'));
    const [patch] = calls(fetch, 'PATCH', '/api/v1/me/profile');
    expect(await patch!.json()).toEqual({ version: 3, displayName: 'Anna W.' });
  });

  it('shows suggestions when someone takes the nick at the last moment', async () => {
    const { user } = setup({
      put: () => json(409, { status: 409, code: 'nick_taken', suggestions: ['anna-wisniewska-2'] }),
    });
    await screen.findByText(/Adres wolny/);

    await user.click(next());

    expect(await screen.findByRole('button', { name: 'anna-wisniewska-2' })).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    [() => json(422, { status: 422, code: 'validation_error' }), /pojedyncze myślniki/],
    [() => json(500, { status: 500, code: 'internal_error' }), /Nie udało się zapisać adresu/],
  ])('reports save errors %#', async (put, message) => {
    const { user } = setup({ put });
    await screen.findByText(/Adres wolny/);

    await user.click(next());

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('reports a failed name save', async () => {
    const { user } = setup({
      patch: () => json(409, { status: 409, code: 'draft_conflict', detail: 'Szkic zmienił się.' }),
    });
    await screen.findByText(/Adres wolny/);
    const name = screen.getByLabelText('Imię i nazwisko lub pseudonim');
    await user.type(name, '!');

    await user.click(next());

    expect(await screen.findByText('Szkic zmienił się.')).toBeInTheDocument();
  });

  it('keeps an existing nick and locks it after publication', async () => {
    setup({ profile: profile({ nick: 'anna', nickLocked: true }) });

    await waitFor(() => expect(nickInput()).toHaveValue('anna'));
    expect(nickInput()).toBeDisabled();
    expect(
      screen.getByText(/Adresu nie można zmienić po pierwszej publikacji/),
    ).toBeInTheDocument();
    expect(next()).toBeEnabled();
  });

  it('treats typing back the current nick as unchanged', async () => {
    const { user } = setup({ profile: profile({ nick: 'anna' }) });
    await waitFor(() => expect(nickInput()).toHaveValue('anna'));

    await user.type(nickInput(), 'x');
    await user.type(nickInput(), '{Backspace}');

    expect(next()).toBeEnabled();
  });

  it.each([
    [
      () => json(200, { nick: 'panel', available: false, reason: 'reserved' }),
      /Ten adres jest już zajęty\.$/,
    ],
    [
      () => json(200, { nick: 'panel', available: false, reason: 'invalid_format' }),
      /pojedyncze myślniki/,
    ],
  ])('shows the server verdict %#', async (availability, message) => {
    const { user } = setup({ availability });
    await screen.findByDisplayValue('anna-wisniewska');

    await user.clear(nickInput());
    await user.type(nickInput(), 'panel');

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(next()).toBeDisabled();
  });

  it('lets the owner continue when the live check fails', async () => {
    const { user } = setup({ availability: () => json(500, { status: 500 }) });
    await screen.findByDisplayValue('anna-wisniewska');

    await user.type(nickInput(), 'x');

    expect(await screen.findByText(/Nie udało się teraz sprawdzić adresu/)).toBeInTheDocument();
    expect(next()).toBeEnabled();
  });

  it('treats a network error in the live check like a failed check', async () => {
    const { user } = setup({
      availability: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await screen.findByDisplayValue('anna-wisniewska');

    await user.type(nickInput(), 'x');

    expect(await screen.findByText(/Nie udało się teraz sprawdzić adresu/)).toBeInTheDocument();
  });

  it('ignores a late answer for an older value', async () => {
    let releaseOld: (response: Response) => void = () => {};
    const { user } = setup({
      availability: (nick) =>
        nick === 'anna-wisniewskax'
          ? new Promise<Response>((resolve) => (releaseOld = resolve))
          : json(200, { nick, available: false, reason: 'taken', suggestions: [] }),
    });
    await screen.findByDisplayValue('anna-wisniewska');

    await user.type(nickInput(), 'x');
    await new Promise((resolve) => setTimeout(resolve, 400));
    await user.type(nickInput(), 'y');
    expect(await screen.findByText('Ten adres jest już zajęty.')).toBeInTheDocument();

    releaseOld(json(200, { nick: 'anna-wisniewskax', available: true, suggestions: [] }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByText(/Adres wolny/)).toBeNull();
    expect(next()).toBeDisabled();
  });

  it('offers a retry when the profile cannot be loaded', async () => {
    let fail = true;
    const { user } = setup({
      load: () => (fail ? json(500, { status: 500 }) : json(200, profile())),
    });

    expect(await screen.findByText('Nie udało się wczytać Twojej strony.')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByDisplayValue('Anna Wiśniewska')).toBeInTheDocument();
  });

  it('reports a network error while saving the nick', async () => {
    const { user } = setup({
      put: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await screen.findByText(/Adres wolny/);

    await user.click(next());

    expect(await screen.findByText(/Sprawdź połączenie/)).toBeInTheDocument();
  });

  it('reports a network error while saving the name', async () => {
    const { user } = setup({
      patch: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await screen.findByText(/Adres wolny/);
    await user.type(screen.getByLabelText('Imię i nazwisko lub pseudonim'), '!');

    await user.click(next());

    expect(await screen.findByText('Nie udało się zapisać nazwy.')).toBeInTheDocument();
  });

  it('reports a failed name save without details', async () => {
    const { user } = setup({ patch: () => json(500, { status: 500 }) });
    await screen.findByText(/Adres wolny/);
    await user.type(screen.getByLabelText('Imię i nazwisko lub pseudonim'), '!');

    await user.click(next());

    expect(await screen.findByText('Nie udało się zapisać nazwy.')).toBeInTheDocument();
  });
});
