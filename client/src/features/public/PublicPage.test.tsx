import { render, screen } from '@testing-library/react';
import { publicProfile } from '@/test/profiles';
import { CARD_ICON_LINKS, PublicPage } from './PublicPage';

describe('PublicPage', () => {
  it('shows identity, the e-mail button and the footer', () => {
    const { container } = render(
      <PublicPage profile={publicProfile({ publicEmail: 'kontakt@example.pl' })} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Anna Wiśniewska' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Anna Wiśniewska' })).toHaveTextContent('AW');
    expect(screen.getByText('Projektantka UX')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Napisz e-mail' })).toHaveAttribute(
      'href',
      'mailto:kontakt@example.pl',
    );
    expect(screen.getByRole('link', { name: 'Utworzono w Profilo' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Zgłoś nadużycie' })).toHaveAttribute(
      'href',
      'mailto:naduzycia@profilo.pl?subject=Zg%C5%82oszenie%20nadu%C5%BCycia%3A%20https%3A%2F%2Fprofilo.pl%2Fuser%2Fanna-wisniewska',
    );
    expect(container.firstElementChild?.getAttribute('style')).toContain(
      '--page-accent: var(--page-accent-morski)',
    );
  });

  it('shows details, the call button with the grouped number and the bio', () => {
    render(
      <PublicPage
        profile={publicProfile({
          position: 'Właścicielka',
          company: 'Studio W',
          city: 'Kraków',
          publicPhone: '+48601234567',
          bio: 'Projektuję aplikacje.\nKraków i zdalnie.',
        })}
      />,
    );

    expect(screen.getByText('Właścicielka, Studio W')).toBeInTheDocument();
    expect(screen.getByText('Kraków')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zadzwoń: +48 601 234 567' })).toHaveAttribute(
      'href',
      'tel:+48601234567',
    );
    expect(screen.getByText('+48 601 234 567')).toBeInTheDocument();
    expect(screen.getByText(/Projektuję aplikacje\./)).toHaveClass('bio');
  });

  it('shows the company alone when there is no position', () => {
    render(<PublicPage profile={publicProfile({ company: 'Studio W' })} />);

    expect(screen.getByText('Studio W')).toBeInTheDocument();
  });

  it('shows links as cards that open safely in a new tab', () => {
    render(
      <PublicPage
        profile={publicProfile({
          links: [
            {
              id: '00000000-0000-7000-8000-00000000000a',
              url: 'https://www.linkedin.com/in/anna/',
              label: 'LinkedIn',
              service: 'linkedin',
            },
          ],
        })}
      />,
    );

    const link = screen.getByRole('link', { name: /LinkedIn/ });
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/anna/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'nofollow ugc noopener noreferrer');
    expect(link).toHaveTextContent('linkedin.com/in/anna');
    expect(link).toHaveTextContent('(otwiera się w nowej karcie)');
    expect(screen.getByRole('list', { name: 'Znajdziesz mnie tutaj' })).toBeInTheDocument();
  });

  it('shows the photo and the background in responsive sizes', () => {
    render(
      <PublicPage
        profile={publicProfile({
          avatar: {
            id: 'a1',
            urls: { '128': '/media/a1/128.webp', '256': '/media/a1/256.webp', '512': '/media/a1/512.webp' },
          },
          background: {
            id: 'b1',
            urls: { '960': '/media/b1/960.webp', '1600': '/media/b1/1600.webp', '2400': '/media/b1/2400.webp' },
          },
        })}
      />,
    );

    const photo = screen.getByRole('img', { name: 'Anna Wiśniewska' });
    expect(photo.tagName).toBe('IMG');
    expect(photo).toHaveAttribute('srcset', '/media/a1/128.webp 128w, /media/a1/256.webp 256w, /media/a1/512.webp 512w');
    const banner = document.querySelector('.banner img');
    expect(banner).toHaveAttribute('src', '/media/b1/1600.webp');
    expect(banner).toHaveAttribute('alt', '');
    expect(document.querySelector('.no-banner')).toBeNull();
  });

  it('leaves out empty fields without gaps', () => {
    render(<PublicPage profile={publicProfile({ headline: null })} />);

    expect(screen.queryByRole('link', { name: 'Napisz e-mail' })).toBeNull();
    expect(document.querySelector('.headline')).toBeNull();
    expect(document.querySelector('.contact')).toBeNull();
    expect(document.querySelector('.meta')).toBeNull();
    expect(document.querySelector('.bio')).toBeNull();
    expect(document.querySelector('.links')).toBeNull();
    expect(screen.queryByRole('link', { name: /Zadzwoń/ })).toBeNull();
  });

  const links = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `00000000-0000-7000-8000-0000000000${String(i).padStart(2, '0')}`,
      url: `https://example.com/${i}`,
      label: `Link ${i}`,
      service: (i === 0 ? 'github' : 'other') as 'github' | 'other',
    }));
  const background = {
    id: 'b1',
    urls: { '960': '/media/b1/960.webp', '1600': '/media/b1/1600.webp', '2400': '/media/b1/2400.webp' },
  };

  it('uses the default graphic in the accent colour without a background', () => {
    const { container } = render(<PublicPage profile={publicProfile({ accent: 'bordo' })} />);

    expect(container.querySelector('.banner.hero-art')).not.toBeNull();
    expect(container.firstElementChild?.getAttribute('style')).toContain('var(--page-accent-bordo)');
  });

  it('renders the Split layout with the image on one side', () => {
    const { container } = render(
      <PublicPage profile={publicProfile({ layout: 'split', background, links: links(2) })} />,
    );

    expect(container.querySelector('.pp-split > .side img')).toHaveAttribute('src', '/media/b1/1600.webp');
    expect(container.querySelector('.pp-split > main.main h1')).toHaveTextContent('Anna Wiśniewska');
    expect(screen.getByRole('list', { name: 'Znajdziesz mnie tutaj' })).toHaveClass('links');
  });

  it('renders the Card layout with icon links on the default graphic', () => {
    const { container } = render(
      <PublicPage profile={publicProfile({ layout: 'card', links: links(CARD_ICON_LINKS) })} />,
    );

    expect(container.querySelector('.pp-card > .bgfill.hero-art')).not.toBeNull();
    const icons = screen.getByRole('list', { name: 'Znajdziesz mnie tutaj' });
    expect(icons).toHaveClass('icon-links');
    const first = screen.getByRole('link', { name: 'Link 0 (otwiera się w nowej karcie)' });
    expect(first).toHaveTextContent('GH');
    expect(first).toHaveAttribute('rel', 'nofollow ugc noopener noreferrer');
    expect(container.querySelectorAll('.vcard')).toHaveLength(1);
  });

  it('lists more than six links in a second card below the card', () => {
    const { container } = render(
      <PublicPage profile={publicProfile({ layout: 'card', background, links: links(7) })} />,
    );

    expect(container.querySelector('.bgfill img')).toHaveAttribute('src', '/media/b1/1600.webp');
    expect(container.querySelectorAll('.vcard')).toHaveLength(2);
    expect(container.querySelector('.icon-links')).toBeNull();
    expect(screen.getAllByRole('link', { name: /Link \d/ })).toHaveLength(7);
  });

  it('shows a card without links and without the links section', () => {
    const { container } = render(<PublicPage profile={publicProfile({ layout: 'card' })} />);

    expect(container.querySelector('.icon-links')).toBeNull();
    expect(container.querySelector('.links')).toBeNull();
  });
});
