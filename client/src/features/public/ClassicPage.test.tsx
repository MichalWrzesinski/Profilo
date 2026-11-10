import { render, screen } from '@testing-library/react';
import { publicProfile } from '@/test/profiles';
import { ClassicPage } from './ClassicPage';

describe('ClassicPage', () => {
  it('shows identity, the e-mail button and the footer', () => {
    const { container } = render(
      <ClassicPage profile={publicProfile({ publicEmail: 'kontakt@example.pl' })} />,
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
      <ClassicPage
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
    render(<ClassicPage profile={publicProfile({ company: 'Studio W' })} />);

    expect(screen.getByText('Studio W')).toBeInTheDocument();
  });

  it('leaves out empty fields without gaps', () => {
    render(<ClassicPage profile={publicProfile({ headline: null })} />);

    expect(screen.queryByRole('link', { name: 'Napisz e-mail' })).toBeNull();
    expect(document.querySelector('.headline')).toBeNull();
    expect(document.querySelector('.contact')).toBeNull();
    expect(document.querySelector('.meta')).toBeNull();
    expect(document.querySelector('.bio')).toBeNull();
    expect(screen.queryByRole('link', { name: /Zadzwoń/ })).toBeNull();
  });
});
