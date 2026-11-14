import { act, fireEvent, render, screen } from '@testing-library/react';
import { publicProfile } from '@/test/profiles';
import PreviewPage from './page';

function send(data: unknown, origin = window.location.origin, source: unknown = window.parent) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source: source as Window }));
  });
}

describe('/podglad', () => {
  it('asks for the draft and renders the public page component', () => {
    const post = vi.spyOn(window.parent, 'postMessage');
    render(<PreviewPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie podglądu');
    expect(post).toHaveBeenCalledWith({ type: 'profilo-preview-ready' }, window.location.origin);
    send({ type: 'profilo-preview', profile: publicProfile({ headline: 'Z edytora' }) });

    expect(screen.getByRole('heading', { name: 'Anna Wiśniewska' })).toBeVisible();
    expect(screen.getByText('Z edytora')).toBeInTheDocument();
  });

  it.each([
    [{ type: 'profilo-preview', profile: publicProfile() }, 'https://evil.example', undefined],
    [{ type: 'profilo-preview', profile: publicProfile() }, undefined, null],
    [{ type: 'something-else' }, undefined, undefined],
  ])('ignores messages from elsewhere (%#)', (data, origin, source) => {
    render(<PreviewPage />);

    send(data, origin ?? window.location.origin, source === undefined ? window.parent : source);

    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie podglądu');
  });

  it('does not follow links', () => {
    render(<PreviewPage />);
    send({ type: 'profilo-preview', profile: publicProfile({ publicEmail: 'a@example.pl' }) });

    const link = screen.getByRole('link', { name: 'Napisz e-mail' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    const plain = fireEvent.click(screen.getByRole('heading', { name: 'Anna Wiśniewska' }));

    expect(event.defaultPrevented).toBe(true);
    expect(plain).toBe(true);
  });
});
