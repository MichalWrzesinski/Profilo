import { render, screen } from '@testing-library/react';
import '@/test/navigation';
import { SessionProvider } from '@/lib/session';
import LoginPage from './logowanie/page';
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

  it.each([
    [RegisterPage, 'Załóż swoją stronę', 'Zaloguj się'],
    [LoginPage, 'Zaloguj się', 'Załóż stronę'],
  ])('renders the auth page %#', (Page, heading, topbarLink) => {
    render(
      <SessionProvider>
        <Page />
      </SessionProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: topbarLink })).toBeInTheDocument();
  });
});
