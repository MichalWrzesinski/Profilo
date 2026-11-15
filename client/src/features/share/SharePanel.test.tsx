import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStore } from '@/lib/api/client';
import { mockFetch } from '@/test/fetch';
import { SharePanel, shortAddress } from './SharePanel';

const URL_ = 'https://profilo.pl/user/anna';

function qrResponse(request: Request): Response {
  const format = new URL(request.url).searchParams.get('format');
  return new Response(format === 'svg' ? '<svg/>' : 'png', {
    status: 200,
    headers: { 'Content-Type': format === 'svg' ? 'image/svg+xml' : 'image/png' },
  });
}

function setup(handler: (request: Request) => Response | Promise<Response> = qrResponse) {
  tokenStore.set('token');
  const fetch = mockFetch(handler);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<SharePanel publicUrl={URL_} nick="anna" />);
  return { fetch, user };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  let next = 0;
  URL.createObjectURL = vi.fn(() => `blob:qr-${(next += 1)}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.set(null);
});

it('shortens the address the way people write it', () => {
  expect(shortAddress('https://profilo.pl/user/anna')).toBe('profilo.pl/user/anna');
  expect(shortAddress('http://localhost:8080/user/anna')).toBe('localhost:8080/user/anna');
});

it('shows the address, the page link and the QR preview with the access token', async () => {
  const { fetch } = setup();

  expect(screen.getByRole('textbox', { name: 'Adres strony' })).toHaveValue('profilo.pl/user/anna');
  expect(screen.getByRole('link', { name: /Otwórz stronę/ })).toHaveAttribute('href', URL_);
  const image = await screen.findByRole('img', { name: 'Kod QR z adresem profilo.pl/user/anna' });
  expect(image).toHaveAttribute('src', 'blob:qr-1');
  const [url, init] = fetch.mock.calls[0]!;
  expect(String(url)).toMatch(/\/api\/v1\/me\/profile\/qr\?format=svg$/);
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');
});

it('copies the link and shows a toast for a moment', async () => {
  const { user } = setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

  await user.click(screen.getByRole('button', { name: 'Kopiuj link' }));

  expect(writeText).toHaveBeenCalledWith(URL_);
  expect(await screen.findByText('Skopiowano link')).toBeVisible();
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(screen.queryByText('Skopiowano link')).toBeNull();
});

it('falls back to the copy command without the Clipboard API', async () => {
  const { user } = setup();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  let copiedText = '';
  document.execCommand = vi.fn(() => {
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Adres strony' });
    copiedText = field.value.slice(field.selectionStart!, field.selectionEnd!);
    return true;
  });

  await user.click(screen.getByRole('button', { name: 'Kopiuj link' }));

  expect(await screen.findByText('Skopiowano link')).toBeVisible();
  expect(copiedText).toBe(URL_); // the full address, with the scheme
  expect(screen.getByRole('textbox', { name: 'Adres strony' })).toHaveValue('profilo.pl/user/anna');
});

it('selects the address when copying is not possible at all', async () => {
  const { user } = setup();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  document.execCommand = vi.fn(() => false);

  await user.click(screen.getByRole('button', { name: 'Kopiuj link' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('skopiuj go skrótem Ctrl+C');
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Adres strony' });
  expect(input.selectionEnd! - input.selectionStart!).toBe(input.value.length);
});

it.each(['png', 'svg'])('downloads the %s file under the page name', async (format) => {
  const { user, fetch } = setup();
  const clicks: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push(this);
  });
  await screen.findByRole('img');

  await user.click(screen.getByRole('button', { name: `Pobierz ${format.toUpperCase()}` }));

  await waitFor(() => expect(clicks).toHaveLength(1));
  expect(clicks[0]!.download).toBe(`profilo-anna.${format}`);
  expect(clicks[0]!.getAttribute('href')).toBe('blob:qr-2');
  expect(String(fetch.mock.calls[1]![0])).toMatch(new RegExp(`\\?format=${format}$`));
  expect(document.querySelector('a[download]')).toBeNull(); // removed again
  await act(() => vi.advanceTimersByTimeAsync(10_000));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:qr-2');
});

it('reports a failed download', async () => {
  const { user } = setup((request) =>
    new URL(request.url).searchParams.get('format') === 'png'
      ? new Response(null, { status: 500 })
      : qrResponse(request),
  );
  await screen.findByRole('img');

  await user.click(screen.getByRole('button', { name: 'Pobierz PNG' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się pobrać pliku.');
  expect(screen.getByRole('button', { name: 'Pobierz PNG' })).toBeEnabled();
});

it('offers a retry when the QR preview fails', async () => {
  let fail = true;
  const { user } = setup((request) =>
    fail ? new Response(null, { status: 500 }) : qrResponse(request),
  );

  const retry = await screen.findByRole('button', { name: 'Spróbuj ponownie' });
  expect(screen.getByText(/Nie udało się wczytać kodu/)).toBeVisible();
  fail = false;
  await user.click(retry);

  expect(await screen.findByRole('img', { name: /Kod QR/ })).toBeInTheDocument();
});
