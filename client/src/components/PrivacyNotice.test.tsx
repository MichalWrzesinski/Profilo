import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pathname } from '@/test/navigation';
import { PRIVACY_NOTICE_KEY, PrivacyNotice } from './PrivacyNotice';

afterEach(() => {
  pathname.current = '/';
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('PrivacyNotice', () => {
  it('tells a new visitor about cookies and personal data until closed', async () => {
    const { unmount } = render(<PrivacyNotice />);
    const dialog = screen.getByRole('dialog', { name: 'Pliki cookie i Twoje dane' });
    expect(dialog).toHaveAccessibleDescription(/tylko niezbędnego pliku cookie/);
    expect(screen.getByRole('link', { name: 'Polityka prywatności' })).toHaveAttribute(
      'href',
      '/prywatnosc',
    );
    expect(screen.getByRole('button', { name: 'Rozumiem' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Rozumiem' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem(PRIVACY_NOTICE_KEY)).toBe('1');
    unmount();
    render(<PrivacyNotice />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('counts Escape as read', async () => {
    render(<PrivacyNotice />);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem(PRIVACY_NOTICE_KEY)).toBe('1');
  });

  it.each(['/user/anna', '/podglad', '/przyklad'])('stays off %s', (path) => {
    pathname.current = path;
    render(<PrivacyNotice />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('still shows and closes when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    render(<PrivacyNotice />);

    await userEvent.click(screen.getByRole('button', { name: 'Rozumiem' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
