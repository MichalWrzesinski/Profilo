import { render, screen, within } from '@testing-library/react';
import { SessionProvider } from '@/lib/session';
import Home, { generateMetadata } from './page';

afterEach(() => vi.unstubAllEnvs());

describe('Home', () => {
  it('offers to reserve an address that goes to registration', () => {
    vi.stubEnv('PUBLIC_BASE_URL', 'https://profilo.pl');
    render(
      <SessionProvider>
        <Home />
      </SessionProvider>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Twoja wizytówka w sieci gotowa w 5 minut',
    );
    const field = screen.getByRole('textbox', { name: 'Wybrany adres strony' });
    expect(field).toHaveAttribute('name', 'adres');
    const form = field.closest('form')!;
    expect(form).toHaveAttribute('action', '/rejestracja');
    expect(form).toHaveAttribute('method', 'get');
    expect(within(form).getByText('/user/')).toBeInTheDocument();
    expect(field).toHaveAccessibleDescription('profilo.pl/user/twoja-nazwa');
    expect(screen.getByTitle('Przykładowa strona w Profilo')).toHaveAttribute('src', '/przyklad');
  });

  it('links to sign-up, login and the legal pages', () => {
    render(
      <SessionProvider>
        <Home />
      </SessionProvider>,
    );

    expect(screen.getByRole('link', { name: 'Załóż stronę' })).toHaveAttribute(
      'href',
      '/rejestracja',
    );
    expect(screen.getByRole('link', { name: 'Zaloguj się' })).toHaveAttribute('href', '/logowanie');
    expect(screen.getByRole('link', { name: 'Regulamin' })).toHaveAttribute('href', '/regulamin');
    expect(screen.getByRole('link', { name: 'Polityka prywatności' })).toHaveAttribute(
      'href',
      '/prywatnosc',
    );
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });

  it('has a canonical address and sharing tags', () => {
    vi.stubEnv('PUBLIC_BASE_URL', 'https://profilo.pl');

    const metadata = generateMetadata();

    expect(metadata.alternates?.canonical).toBe('https://profilo.pl/');
    expect(metadata.openGraph).toMatchObject({ url: 'https://profilo.pl/', locale: 'pl_PL' });
  });
});
