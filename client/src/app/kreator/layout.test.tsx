import { render, screen, waitFor } from '@testing-library/react';
import { router } from '@/test/navigation';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider } from '@/lib/session';
import WizardLayout from './layout';

afterEach(() => {
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
    expect(screen.getByRole('link', { name: /później/ })).toHaveAttribute('href', '/panel');
    expect(screen.getByText('krok')).toBeInTheDocument();
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
