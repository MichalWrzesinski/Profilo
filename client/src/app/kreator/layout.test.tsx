import { render, screen, waitFor } from '@testing-library/react';
import { pathname, router } from '@/test/navigation';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider } from '@/lib/session';
import WizardLayout from './layout';

afterEach(() => {
  pathname.current = '/';
  tokenStore.set(null);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('WizardLayout', () => {
  it('shows the stepper and the exit link for a signed-in owner', async () => {
    mockFetch(() => json(200, SESSION));

    render(
      <SessionProvider>
        <WizardLayout>
          <p>krok</p>
        </WizardLayout>
      </SessionProvider>,
    );

    expect(await screen.findByLabelText('Krok 1 z 4: Nazwa i adres')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /później/ })).toHaveAttribute('href', '/edytor');
    expect(screen.getByText('krok')).toBeInTheDocument();
  });

  it.each([
    ['/kreator', 'Krok 1 z 4: Nazwa i adres'],
    ['/kreator/tresc', 'Krok 3 z 4: Treść'],
    ['/kreator/podglad', 'Krok 4 z 4: Podgląd'],
    ['/kreator/nieznany', 'Krok 1 z 4: Nazwa i adres'],
  ])('shows the step of %s', async (path, label) => {
    pathname.current = path;
    mockFetch(() => json(200, SESSION));

    render(
      <SessionProvider>
        <WizardLayout>
          <p>krok</p>
        </WizardLayout>
      </SessionProvider>,
    );

    expect(await screen.findByLabelText(label)).toBeInTheDocument();
  });

  it('sends anonymous visitors to the login page', async () => {
    mockFetch(() => json(401, { status: 401 }));

    render(
      <SessionProvider>
        <WizardLayout>
          <p>krok</p>
        </WizardLayout>
      </SessionProvider>,
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/logowanie'));
  });
});
