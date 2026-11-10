import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider, useSession } from '@/lib/session';
import { ConfirmEmailBanner } from './ConfirmEmailBanner';

function SignedIn({ confirmed = false }: { confirmed?: boolean }) {
  const { signIn } = useSession();
  useEffect(() => {
    signIn({ ...SESSION, account: { ...SESSION.account, emailConfirmed: confirmed } });
  }, [signIn, confirmed]);
  return <ConfirmEmailBanner />;
}

function renderBanner(confirmed = false) {
  render(
    <SessionProvider>
      <SignedIn confirmed={confirmed} />
    </SessionProvider>,
  );
}

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
});

describe('ConfirmEmailBanner', () => {
  it('is hidden for a confirmed account', () => {
    renderBanner(true);
    expect(screen.queryByText(/Potwierdź e-mail/)).toBeNull();
  });

  it.each([
    [202, 'Wysłaliśmy nowy link.'],
    [429, 'Nowy link możesz wysłać za minutę.'],
    [500, 'Nie udało się wysłać linku.'],
  ])('reports the result of resending (%i)', async (status, message) => {
    mockFetch(() => (status === 202 ? new Response(null, { status }) : json(status, { status })));
    renderBanner();
    const user = userEvent.setup();

    expect(screen.getByText(/Wysłaliśmy link na anna@example.pl/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Wyślij ponownie' }));

    expect(await screen.findByText(new RegExp(message))).toBeInTheDocument();
  });

  it('disappears when the server says the e-mail is already confirmed', async () => {
    mockFetch(() => json(409, { status: 409, code: 'email_already_confirmed' }));
    renderBanner();
    const user = userEvent.setup();

    await act(() => user.click(screen.getByRole('button', { name: 'Wyślij ponownie' })));

    expect(screen.queryByText(/Potwierdź e-mail/)).toBeNull();
  });
});
