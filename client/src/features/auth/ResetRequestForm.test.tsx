import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockFetch } from '@/test/fetch';
import { ResetRequestForm } from './ResetRequestForm';

async function submit(email = 'anna@example.pl') {
  render(<ResetRequestForm />);
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('E-mail do logowania'), email);
  await user.click(screen.getByRole('button', { name: 'Wyślij link' }));
  return user;
}

afterEach(() => vi.unstubAllGlobals());

describe('ResetRequestForm', () => {
  it('says the same thing whether or not the account exists', async () => {
    const fetch = mockFetch(() => new Response(null, { status: 202 }));

    const user = await submit();

    expect(await screen.findByText(/wysłaliśmy na nie link/)).toHaveTextContent(
      'Jeśli konto z adresem anna@example.pl istnieje',
    );
    const request = fetch.mock.calls[0]![0] as Request;
    expect(await request.json()).toEqual({ email: 'anna@example.pl' });
    expect(screen.getByRole('link', { name: 'Wróć do logowania' })).toHaveAttribute(
      'href',
      '/logowanie',
    );
    await user.click(screen.getByRole('button', { name: 'Wyślij jeszcze raz' }));
    expect(screen.getByRole('button', { name: 'Wyślij link' })).toBeInTheDocument();
  });

  it('checks the address before sending', async () => {
    const fetch = mockFetch(() => new Response(null, { status: 202 }));

    await submit('anna');

    expect(await screen.findByText(/Wpisz pełny adres e-mail/)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the rate limit message', async () => {
    mockFetch(() =>
      json(429, {
        status: 429,
        code: 'rate_limited',
        detail: 'Za dużo prób. Spróbuj ponownie później.',
      }),
    );

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Za dużo prób.');
  });

  it('reports a network failure', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się połączyć.');
  });
});
