import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockFetch } from '@/test/fetch';
import { ownerProfile } from '@/test/profiles';
import { ChecklistCard, completionSteps, firstName, ShareCard, Shortcuts } from './PanelCards';
import { PanelProfileProvider } from './PanelProfile';

type Owner = ReturnType<typeof ownerProfile>;

function renderWith(profile: Owner, ui: React.ReactNode) {
  const fetch = mockFetch((request) => {
    const path = new URL(request.url).pathname;
    if (path === '/api/v1/me/profile') return json(200, profile);
    if (path === '/api/v1/me/profile/qr')
      return new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    return json(404, { status: 404 });
  });
  render(<PanelProfileProvider>{ui}</PanelProfileProvider>);
  return fetch;
}

const IMAGE = { id: 'i1', urls: { '256': '/media/a.webp' } };
const LINK = (id: string) => ({
  id,
  service: 'other' as const,
  label: id,
  url: `https://${id}.pl`,
});

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:qr');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

describe('panel cards', () => {
  it('greets with the first word of the name', () => {
    expect(firstName(ownerProfile({ draft: { displayName: '  Anna Maria Nowak ' } }))).toBe('Anna');
    expect(firstName(null)).toBeNull();
  });

  it('asks to publish before sharing', async () => {
    renderWith(ownerProfile(), <ShareCard />);

    expect(await screen.findByText(/Po publikacji znajdziesz tu adres/)).toBeInTheDocument();
  });

  it('shares a published page: QR code, copy and downloads', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderWith(
      ownerProfile({ status: 'published', publicUrl: 'https://profilo.pl/user/anna' }),
      <ShareCard />,
    );

    expect(await screen.findByAltText('Kod QR z adresem profilo.pl/user/anna')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Kopiuj adres' }));
    expect(writeText).toHaveBeenCalledWith('https://profilo.pl/user/anna');
    expect(await screen.findByRole('button', { name: 'Skopiowano' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'QR PNG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'QR SVG' })).toBeInTheDocument();
  });

  it('counts what is still missing', async () => {
    const profile = ownerProfile({
      draft: { avatar: IMAGE, bio: 'Opis', publicPhone: '+48601234567', links: [LINK('a')] },
    });
    expect(completionSteps(profile).filter((step) => step.done)).toHaveLength(4);
    renderWith(profile, <ChecklistCard />);

    const card = await screen.findByRole('region', { name: 'Dokończ swoją stronę' });
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
    expect(within(card).getByText('4 z 6')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'dodaj: Grafika tła' })).toHaveAttribute(
      'href',
      '/edytor',
    );
  });

  it('says when the page is complete', async () => {
    renderWith(
      ownerProfile({
        draft: {
          avatar: IMAGE,
          background: IMAGE,
          bio: 'Opis',
          publicEmail: 'anna@example.pl',
          links: [LINK('a'), LINK('b'), LINK('c')],
        },
      }),
      <ChecklistCard />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Twoja strona jest kompletna' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /dodaj/ })).toBeNull();
  });

  it('offers shortcuts with the number of links', async () => {
    renderWith(ownerProfile({ draft: { links: [LINK('a'), LINK('b')] } }), <Shortcuts />);

    const nav = screen.getByRole('navigation', { name: 'Skróty' });
    expect(await within(nav).findByText('2 z 20')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Wygląd/ })).toHaveAttribute(
      'href',
      '/kreator/wyglad',
    );
    expect(within(nav).getByRole('link', { name: /Konto/ })).toHaveAttribute(
      'href',
      '/panel/konto',
    );
  });
});
