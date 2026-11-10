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

  it('leaves out empty fields without gaps', () => {
    render(<ClassicPage profile={publicProfile({ headline: null })} />);

    expect(screen.queryByRole('link', { name: 'Napisz e-mail' })).toBeNull();
    expect(document.querySelector('.headline')).toBeNull();
    expect(document.querySelector('.contact')).toBeNull();
  });
});
