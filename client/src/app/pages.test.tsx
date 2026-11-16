import { render, screen, waitFor } from '@testing-library/react';
import { tokenStore } from '@/lib/api/client';
import { markDeleted } from '@/features/account/SignOutAfterDeletion';
import { mockFetch } from '@/test/fetch';
import { router } from '@/test/navigation';
import { SessionProvider } from '@/lib/session';
import AccountDeletedPage from './konto-usuniete/page';
import LoginPage from './logowanie/page';
import ResetRequestPage from './nie-pamietam-hasla/page';
import NewPasswordPage from './nowe-haslo/page';
import ConfirmPage from './potwierdz-email/page';
import PrivacyPage from './prywatnosc/page';
import ExamplePage from './przyklad/page';
import TermsPage from './regulamin/page';
import RegisterPage from './rejestracja/page';

afterEach(() => vi.unstubAllEnvs());

describe('public pages', () => {
  it.each([
    [TermsPage, 'Regulamin', 'zgloszenia'],
    [PrivacyPage, 'Polityka prywatności', 'okres'],
  ])('renders the legal draft %#', (Page, title, section) => {
    const { container } = render(
      <SessionProvider>
        <Page />
      </SessionProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText('Wersja robocza.')).toBeInTheDocument();
    // Operator data filled in; a missing value would be marked (TASK-019 scenario 2).
    expect(screen.getAllByText(/Michał Wrzesiński Webhome/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/9671286620/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/\[do uzupełnienia: nazwa operatora\]/)).toBeNull();
    expect(container.querySelector(`#${section}`)).not.toBeNull();
  });

  it('shows the configured abuse address in the terms', () => {
    vi.stubEnv('ABUSE_EMAIL', 'zgloszenia@operator.pl');
    render(
      <SessionProvider>
        <TermsPage />
      </SessionProvider>,
    );
    expect(screen.getByText(/zgloszenia@operator\.pl/)).toBeInTheDocument();
    expect(screen.queryByText(/\[do uzupełnienia: adres do zgłoszeń nadużyć\]/)).toBeNull();
  });

  it('names the processors and the 30-day backups in the privacy policy', () => {
    render(
      <SessionProvider>
        <PrivacyPage />
      </SessionProvider>,
    );
    for (const text of ['Hetzner Online GmbH', 'Brevo SAS', '(Sentry)', 'przez 30 dni']) {
      expect(screen.getAllByText(new RegExp(text.replace(/[()]/g, '\\$&')))[0]).toBeInTheDocument();
    }
  });

  it('renders the example page for the landing', () => {
    render(<ExamplePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Anna Wiśniewska' })).toBeInTheDocument();
  });

  it('carries the address chosen on the landing', async () => {
    render(
      <SessionProvider>
        {await RegisterPage({ searchParams: Promise.resolve({ adres: ['  Anna Nowak  ', 'x'] }) })}
      </SessionProvider>,
    );
    expect(screen.getByText(/Adres „anna-nowak” sprawdzimy/)).toBeInTheDocument();
  });

  it('renders the registration page', async () => {
    render(
      <SessionProvider>
        {await RegisterPage({ searchParams: Promise.resolve({}) })}
      </SessionProvider>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Załóż swoją stronę' }),
    ).toBeInTheDocument();
    // The top bar and the line under the form.
    for (const link of screen.getAllByRole('link', { name: 'Zaloguj się' })) {
      expect(link).toHaveAttribute('href', '/logowanie');
    }
    expect(screen.getByText(/Masz już konto\?/)).toBeInTheDocument();
  });

  it.each([
    [{}, false],
    [{ potwierdzono: '1' }, true],
  ])('renders the login page (%o)', async (params, notice) => {
    const page = await LoginPage({ searchParams: Promise.resolve(params) });
    render(<SessionProvider>{page}</SessionProvider>);
    expect(screen.getByRole('heading', { level: 1, name: 'Zaloguj się' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Załóż stronę' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zarejestruj się' })).toHaveAttribute(
      'href',
      '/rejestracja',
    );
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

  it('sends a visitor who did not delete an account home', async () => {
    tokenStore.set('access-1');
    render(
      <SessionProvider>
        <AccountDeletedPage />
      </SessionProvider>,
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(tokenStore.get()).toBe('access-1');
    tokenStore.set(null);
  });

  it('renders the goodbye page after deletion and signs out', async () => {
    markDeleted();
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
