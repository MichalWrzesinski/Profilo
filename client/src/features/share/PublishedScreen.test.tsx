import { render, screen } from '@testing-library/react';
import { mockFetch, json } from '@/test/fetch';
import { PublishedScreen } from './PublishedScreen';

const profile = (overrides: Record<string, unknown> = {}) => ({
  nick: 'anna',
  nickLocked: true,
  status: 'published',
  publicUrl: 'https://profilo.pl/user/anna',
  ...overrides,
});

afterEach(() => vi.unstubAllGlobals());

it('celebrates the publication and offers the address and QR code', async () => {
  mockFetch((request) =>
    new URL(request.url).pathname === '/api/v1/me/profile'
      ? json(200, profile())
      : new Response('<svg/>', { status: 200 }),
  );

  render(<PublishedScreen />);

  expect(
    await screen.findByRole('heading', { name: 'Gotowe! Twoja strona jest online' }),
  ).toBeVisible();
  expect(screen.getByDisplayValue('profilo.pl/user/anna')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Kod QR do druku' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Przejdź do edytora' })).toHaveAttribute(
    'href',
    '/edytor',
  );
});

it('sends an unpublished page back to the editor', async () => {
  mockFetch(() => json(200, profile({ status: 'unpublished', publicUrl: null })));

  render(<PublishedScreen />);

  expect(
    await screen.findByRole('heading', { name: 'Strona nie jest opublikowana' }),
  ).toBeVisible();
});

it('reports a failed load', async () => {
  mockFetch(() => json(500, { status: 500 }));

  render(<PublishedScreen />);

  expect(await screen.findByText(/Nie udało się wczytać Twojej strony/)).toBeVisible();
});
