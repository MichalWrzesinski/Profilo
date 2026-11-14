import { render, screen, waitFor } from '@testing-library/react';
import { pathname, router } from '@/test/navigation';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider } from '@/lib/session';
import { useWizardExit } from '@/features/wizard/WizardExit';
import userEvent from '@testing-library/user-event';
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

  it('lets the current step save before the top-bar links leave', async () => {
    mockFetch(() => json(200, SESSION));
    const leave = vi.fn();
    function Step() {
      useWizardExit(leave);
      return <p>krok 3</p>;
    }

    render(
      <SessionProvider>
        <WizardLayout>
          <Step />
        </WizardLayout>
      </SessionProvider>,
    );

    await userEvent.click(await screen.findByRole('link', { name: /później/ }));
    await userEvent.click(screen.getByRole('link', { name: 'Profilo — strona główna' }));

    expect(leave.mock.calls).toEqual([['/edytor'], ['/']]);

    // Other clicks and opening in a new tab are left alone.
    await userEvent.click(screen.getByText('krok 3'));
    await userEvent.click(screen.getByText(/Krok 1 z 4/));
    const user = userEvent.setup();
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: /później/ }));
    await user.keyboard('{/Control}');
    expect(leave).toHaveBeenCalledTimes(2);
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
