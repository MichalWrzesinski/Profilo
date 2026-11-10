import { render, screen } from '@testing-library/react';
import '@/test/navigation';
import { SessionProvider } from '@/lib/session';
import LoginPage from './logowanie/page';
import ConfirmPage from './potwierdz-email/page';
import PrivacyPage from './prywatnosc/page';
import TermsPage from './regulamin/page';
import RegisterPage from './rejestracja/page';

describe('public pages', () => {
  it.each([
    [TermsPage, 'Regulamin'],
    [PrivacyPage, 'Polityka prywatności'],
  ])('shows a placeholder for %#', (Page, title) => {
    render(<Page />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('Dokument w przygotowaniu.')).toBeInTheDocument();
  });

  it('renders the registration page', () => {
    render(
      <SessionProvider>
        <RegisterPage />
      </SessionProvider>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Załóż swoją stronę' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zaloguj się' })).toBeInTheDocument();
  });

  it.each([
    [{}, false],
    [{ potwierdzono: '1' }, true],
  ])('renders the login page (%o)', async (params, notice) => {
    const page = await LoginPage({ searchParams: Promise.resolve(params) });
    render(<SessionProvider>{page}</SessionProvider>);
    expect(screen.getByRole('heading', { level: 1, name: 'Zaloguj się' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Załóż stronę' })).toBeInTheDocument();
    expect(screen.queryByText('Adres potwierdzony — zaloguj się.') !== null).toBe(notice);
  });

  it('renders the confirmation page', () => {
    render(
      <SessionProvider>
        <ConfirmPage />
      </SessionProvider>,
    );
    expect(
      screen.getByRole('heading', { name: 'Potwierdzenie adresu e-mail' }),
    ).toBeInTheDocument();
  });
});
