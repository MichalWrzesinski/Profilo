import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { json, mockFetch } from '@/test/fetch';
import type { OwnerProfile } from './fields';
import { announcements, droppedOrder, LinksSection } from './LinksSection';

type Link = OwnerProfile['draft']['links'][number];

const LINKEDIN: Link = {
  id: '00000000-0000-7000-8000-00000000000a',
  url: 'https://linkedin.com/in/anna',
  label: 'LinkedIn',
  service: 'linkedin',
};
const GITHUB: Link = {
  id: '00000000-0000-7000-8000-00000000000b',
  url: 'https://github.com/anna',
  label: 'GitHub',
  service: 'github',
};

const profileWith = (links: Link[]) => ({ draft: { links } }) as unknown as OwnerProfile;

function setup(initial: Link[], handler: (request: Request, body: unknown) => Response) {
  const bodies: { method: string; path: string; body: unknown }[] = [];
  const fetch = mockFetch(async (request) => {
    const body =
      request.method === 'GET' || request.method === 'DELETE' ? undefined : await request.json();
    bodies.push({ method: request.method, path: new URL(request.url).pathname, body });
    return handler(request, body);
  });
  const run = vi.fn();
  function Host() {
    const [links, setLinks] = useState(initial);
    run.mockImplementation(async (change: () => Promise<OwnerProfile | null>) => {
      const next = await change();
      if (next) setLinks(next.draft.links);
    });
    return <LinksSection links={links} run={run} />;
  }
  render(<Host />);
  return { bodies, fetch, run, user: userEvent.setup() };
}

afterEach(() => vi.unstubAllGlobals());

describe('LinksSection', () => {
  it('starts with the empty state and adds a link without a label', async () => {
    const { bodies, user } = setup([], () =>
      json(201, profileWith([{ ...LINKEDIN, url: 'https://linkedin.com/in/anna-wisniewska' }])),
    );

    expect(screen.getByText('Nie masz jeszcze linków')).toBeVisible();
    expect(screen.getByText('0 / 20')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dodaj pierwszy link' }));
    await user.type(screen.getByLabelText('Adres strony'), 'linkedin.com/in/anna-wisniewska');
    await user.click(screen.getByRole('button', { name: 'Zapisz link' }));

    expect(await screen.findByText('linkedin.com/in/anna-wisniewska')).toBeVisible();
    expect(bodies).toEqual([
      {
        method: 'POST',
        path: '/api/v1/me/profile/links',
        body: { url: 'linkedin.com/in/anna-wisniewska' },
      },
    ]);
    expect(screen.queryByLabelText('Adres strony')).toBeNull();
  });

  it('shows the API message under the address', async () => {
    const { user } = setup([LINKEDIN], () =>
      json(422, {
        status: 422,
        code: 'validation_error',
        errors: [
          {
            field: 'url',
            code: 'invalid_url',
            message: 'To nie wygląda na adres strony. Sprawdź, czy nie ma w nim spacji.',
          },
        ],
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Dodaj link' }));
    await user.type(screen.getByLabelText('Adres strony'), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Zapisz link' }));

    const message = await screen.findByText(/To nie wygląda na adres strony/);
    expect(message).toBeVisible();
    expect(screen.getByLabelText('Adres strony')).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    [
      () =>
        json(409, {
          status: 409,
          code: 'links_limit_reached',
          detail: 'Możesz dodać najwyżej 20 linków.',
        }),
      'Możesz dodać najwyżej 20 linków.',
    ],
    [() => json(500, { status: 500 }), 'Nie udało się zapisać linku. Spróbuj ponownie.'],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Nie udało się zapisać linku. Sprawdź połączenie i spróbuj ponownie.',
    ],
  ])('reports a failed save (%#)', async (handler, message) => {
    const { user } = setup([LINKEDIN], handler);
    await user.click(screen.getByRole('button', { name: 'Dodaj link' }));
    await user.type(screen.getByLabelText('Adres strony'), 'example.com');
    await user.click(screen.getByRole('button', { name: 'Zapisz link' }));

    expect(await screen.findByText(message)).toBeVisible();
  });

  it('asks for an address before sending', async () => {
    const { bodies, user } = setup([], () => json(500, {}));
    await user.click(screen.getByRole('button', { name: 'Dodaj pierwszy link' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz link' }));

    expect(screen.getByText('Wpisz adres strony.')).toBeVisible();
    expect(bodies).toHaveLength(0);
  });

  it('edits a label and keeps it required', async () => {
    const { bodies, user } = setup([LINKEDIN], () =>
      json(200, profileWith([{ ...LINKEDIN, label: 'Mój LinkedIn' }])),
    );
    await user.click(screen.getByRole('button', { name: 'Edytuj LinkedIn' }));
    const label = screen.getByLabelText('Etykieta');
    await user.clear(label);
    await user.click(screen.getByRole('button', { name: 'Zapisz link' }));
    expect(screen.getByText('Wpisz etykietę.')).toBeVisible();

    await user.type(label, 'Mój LinkedIn');
    await user.click(screen.getByRole('button', { name: 'Zapisz link' }));

    expect(await screen.findByText('Mój LinkedIn')).toBeVisible();
    expect(bodies[0]).toEqual({
      method: 'PATCH',
      path: `/api/v1/me/profile/links/${LINKEDIN.id}`,
      body: { url: LINKEDIN.url, label: 'Mój LinkedIn' },
    });
  });

  it('cancels editing', async () => {
    const { user } = setup([LINKEDIN], () => json(500, {}));
    await user.click(screen.getByRole('button', { name: 'Edytuj LinkedIn' }));
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));

    expect(screen.getByRole('button', { name: 'Edytuj LinkedIn' })).toBeVisible();
  });

  it('removes a link and shows the server state', async () => {
    const { bodies, user } = setup([LINKEDIN, GITHUB], (request) =>
      request.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : json(200, profileWith([GITHUB])),
    );

    await user.click(screen.getByRole('button', { name: 'Usuń LinkedIn' }));

    await waitFor(() => expect(screen.queryByText('LinkedIn')).toBeNull());
    expect(bodies.map((b) => `${b.method} ${b.path}`)).toEqual([
      `DELETE /api/v1/me/profile/links/${LINKEDIN.id}`,
      'GET /api/v1/me/profile',
    ]);
  });

  it('moves focus to the next link after removing one', async () => {
    const { user } = setup([LINKEDIN, GITHUB], (request) =>
      request.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : json(200, profileWith([GITHUB])),
    );

    await user.click(screen.getByRole('button', { name: 'Usuń LinkedIn' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edytuj GitHub' })).toHaveFocus(),
    );
  });

  it('moves focus to „Dodaj pierwszy link” after removing the last one', async () => {
    const { user } = setup([LINKEDIN], (request) =>
      request.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : json(200, profileWith([])),
    );

    await user.click(screen.getByRole('button', { name: 'Usuń LinkedIn' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dodaj pierwszy link' })).toHaveFocus(),
    );
  });

  it('says so when the list cannot be refreshed after removing', async () => {
    let gets = 0;
    const { user } = setup([LINKEDIN], (request) => {
      if (request.method === 'DELETE') return new Response(null, { status: 204 });
      gets += 1;
      return json(500, {});
    });

    await user.click(screen.getByRole('button', { name: 'Usuń LinkedIn' }));

    expect(
      await screen.findByText(/Link został usunięty, ale nie udało się odświeżyć/),
    ).toBeVisible();
    expect(gets).toBe(2);
  });

  it('returns focus to the link after editing or adding', async () => {
    const { user } = setup([LINKEDIN], () => json(500, {}));
    await user.click(screen.getByRole('button', { name: 'Edytuj LinkedIn' }));
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edytuj LinkedIn' })).toHaveFocus(),
    );

    await user.click(screen.getByRole('button', { name: 'Dodaj link' }));
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dodaj link' })).toHaveFocus());
  });

  it('marks the form with an error', async () => {
    const { user } = setup([], () => json(500, {}));
    await user.click(screen.getByRole('button', { name: 'Dodaj pierwszy link' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz link' }));

    expect(screen.getByLabelText('Adres strony').closest('form')?.className).toMatch(/formError/);
  });

  it('waits with the row buttons while a link change runs', () => {
    render(<LinksSection links={[LINKEDIN, GITHUB]} run={vi.fn()} busy />);

    for (const name of ['Edytuj LinkedIn', 'Usuń LinkedIn', 'Przesuń w dół: LinkedIn']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('reports a failed removal', async () => {
    const { user } = setup([LINKEDIN], () => json(500, {}));

    await user.click(screen.getByRole('button', { name: 'Usuń LinkedIn' }));

    expect(await screen.findByText('Nie udało się usunąć linku. Spróbuj ponownie.')).toBeVisible();
  });

  it('moves a link with the arrows and saves the order', async () => {
    const { bodies, user } = setup([LINKEDIN, GITHUB], () =>
      json(200, profileWith([GITHUB, LINKEDIN])),
    );
    expect(screen.getByRole('button', { name: 'Przesuń w górę: LinkedIn' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Przesuń w dół: GitHub' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Przesuń w górę: GitHub' }));

    await waitFor(() =>
      expect(within(screen.getByRole('list')).getAllByRole('listitem')[0]).toHaveTextContent(
        'GitHub',
      ),
    );
    expect(bodies[0]).toEqual({
      method: 'PUT',
      path: '/api/v1/me/profile/links/order',
      body: { linkIds: [GITHUB.id, LINKEDIN.id] },
    });
    expect(screen.getByText('Link GitHub jest teraz na miejscu 1 z 2.')).toHaveClass('sr-only');
    // GitHub is first now, so its „up” arrow is disabled: focus moved to „down”.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Przesuń w dół: GitHub' })).toHaveFocus(),
    );
    await user.click(screen.getByRole('button', { name: 'Przesuń w dół: GitHub' }));
    expect(bodies[1]?.body).toEqual({ linkIds: [LINKEDIN.id, GITHUB.id] });
  });

  it.each([
    [
      () =>
        json(422, {
          status: 422,
          code: 'link_order_mismatch',
          detail: 'Lista linków się zmieniła — odśwież stronę.',
        }),
      'Lista linków się zmieniła — odśwież stronę.',
    ],
    [() => json(500, { status: 500 }), 'Nie udało się zmienić kolejności linków.'],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Nie udało się zapisać linków. Sprawdź połączenie i spróbuj ponownie.',
    ],
  ])('puts the order back when saving it fails (%#)', async (handler, message) => {
    const { user } = setup([LINKEDIN, GITHUB], handler);

    await user.click(screen.getByRole('button', { name: 'Przesuń w dół: LinkedIn' }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')[0]).toHaveTextContent(
      'LinkedIn',
    );
  });

  it('blocks adding at 20 links', () => {
    const links = Array.from({ length: 20 }, (_, n) => ({
      ...GITHUB,
      id: `00000000-0000-7000-8000-0000000001${String(n).padStart(2, '0')}`,
      label: `Link ${n}`,
    }));
    setup(links, () => json(500, {}));

    expect(screen.getByRole('button', { name: 'Dodaj link' })).toBeDisabled();
    expect(screen.getByText('Masz już 20 linków — to najwięcej, ile można dodać.')).toBeVisible();
  });

  it('gives the drag handle a Polish name and instructions', () => {
    setup([LINKEDIN, GITHUB], () => json(500, {}));

    const handle = screen.getByRole('button', {
      name: 'Przeciągnij, aby zmienić kolejność: GitHub',
    });
    expect(handle).toHaveAttribute('aria-roledescription', 'sortable');
    expect(document.body.textContent).toContain('Aby przenieść link, naciśnij spację lub Enter');
  });
});

describe('drag and drop helpers', () => {
  it('computes the order after a drop', () => {
    expect(droppedOrder(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(droppedOrder(['a', 'b'], 'a', 'a')).toBeNull();
    expect(droppedOrder(['a', 'b'], 'a', undefined)).toBeNull();
  });

  it('announces moves in Polish', () => {
    const say = announcements([LINKEDIN, GITHUB]);
    const active = { id: GITHUB.id } as never;
    const over = { id: LINKEDIN.id } as never;

    expect(say.onDragStart({ active })).toBe('Przenosisz link GitHub.');
    expect(say.onDragOver?.({ active, over } as never)).toBe('Link GitHub jest na miejscu 1 z 2.');
    expect(say.onDragOver?.({ active, over: null } as never)).toBe('Link GitHub jest poza listą.');
    expect(say.onDragEnd({ active, over } as never)).toBe('Link GitHub jest teraz na miejscu 1.');
    expect(say.onDragEnd({ active, over: null } as never)).toBe('Kolejność się nie zmieniła.');
    expect(say.onDragCancel({ active } as never)).toBe(
      'Anulowano przenoszenie linku GitHub. Kolejność się nie zmieniła.',
    );
    expect(announcements([]).onDragStart({ active })).toBe('Przenosisz link link.');
  });
});
