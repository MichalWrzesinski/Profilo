import { render, screen, waitFor } from '@testing-library/react';
import { tokenStore } from '@/lib/api/client';
import { mockFetch } from '@/test/fetch';
import '@/test/navigation';
import { SessionProvider } from '@/lib/session';
import AccountDeletedPage from './konto-usuniete/page';
import LoginPage from './logowanie/page';
import ResetRequestPage from './nie-pamietam-hasla/page';
import NewPasswordPage from './nowe-haslo/page';
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

  it('renders the password reset pages', () => {
    render(<ResetRequestPage />);
    expect(screen.getByRole('heading', { name: 'Nie pamiętasz hasła?' })).toBeInTheDocument();
    render(
      <SessionProvider>
        <NewPasswordPage />
      </SessionProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Ustaw nowe hasło' })).toBeInTheDocument();
  });

  it('renders the goodbye page after deletion and signs out', async () => {
    tokenStore.set('access-1');
    const fetch = mockFetch(() => new Response(null, { status: 204 }));
    render(
      <SessionProvider>
        <AccountDeletedPage />
      </SessionProvider>,
    );
    await waitFor(() => expect(tokenStore.get()).toBeNull());
    expect(String((fetch.mock.calls[0]![0] as Request).url)).toMatch(/\/auth\/logout$/);
    expect(screen.getByRole('heading', { name: 'Konto usunięte' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wróć na stronę główną' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
