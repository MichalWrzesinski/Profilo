import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch } from '@/test/fetch';
import { ShareDialog } from './ShareDialog';

function props(onClose: () => void) {
  return { publicUrl: 'https://profilo.pl/user/anna', nick: 'anna', onClose };
}

function setup() {
  mockFetch(() => new Response('<svg/>', { status: 200 }));
  URL.createObjectURL = vi.fn(() => 'blob:qr');
  URL.revokeObjectURL = vi.fn();
  const onClose = vi.fn();
  render(<ShareDialog publicUrl="https://profilo.pl/user/anna" nick="anna" onClose={onClose} />);
  return { onClose, user: userEvent.setup() };
}

afterEach(() => vi.unstubAllGlobals());

it('keeps the focus inside the dialog', async () => {
  const { user } = setup();
  await screen.findByRole('img', { name: /Kod QR/ });
  const close = screen.getByRole('button', { name: 'Zamknij' });
  const last = screen.getByRole('button', { name: 'Pobierz SVG' });
  expect(close).toHaveFocus();

  await user.keyboard('{Shift>}{Tab}{/Shift}');
  expect(last).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('textbox', { name: 'Adres strony' })).toHaveFocus();
});

it('closes on a click outside, not inside', async () => {
  const { onClose } = setup();
  await screen.findByRole('img', { name: /Kod QR/ });
  const dialog = screen.getByRole('dialog', { name: 'Udostępnij stronę' });

  fireEvent.mouseDown(dialog);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.mouseDown(dialog.parentElement!);
  expect(onClose).toHaveBeenCalledOnce();
});

it('ignores other keys', async () => {
  const { onClose, user } = setup();

  await user.keyboard('a');

  expect(onClose).not.toHaveBeenCalled();
  expect(await screen.findByRole('img', { name: /Kod QR/ })).toBeInTheDocument();
});

it('keeps the focus where it is when the editor renders it again', async () => {
  mockFetch(() => new Response('<svg/>', { status: 200 }));
  URL.createObjectURL = vi.fn(() => 'blob:qr');
  URL.revokeObjectURL = vi.fn();
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = render(<ShareDialog {...props(first)} />);
  await screen.findByRole('img', { name: /Kod QR/ });
  const user = userEvent.setup();
  await user.tab();
  const address = screen.getByRole('textbox', { name: 'Adres strony' });
  expect(address).toHaveFocus();

  rerender(<ShareDialog {...props(second)} />);
  expect(address).toHaveFocus();
  await user.keyboard('{Escape}');

  expect(second).toHaveBeenCalledOnce();
  expect(first).not.toHaveBeenCalled();
});

it('brings the focus back when it fell out of the dialog', async () => {
  const { user } = setup();
  await screen.findByRole('img', { name: /Kod QR/ });
  (document.activeElement as HTMLElement).blur();

  await user.tab();
  expect(screen.getByRole('button', { name: 'Zamknij' })).toHaveFocus();
  (document.activeElement as HTMLElement).blur();
  await user.keyboard('{Shift>}{Tab}{/Shift}');
  expect(screen.getByRole('button', { name: 'Pobierz SVG' })).toHaveFocus();
});
