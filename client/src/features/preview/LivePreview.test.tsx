import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { publicProfile } from '@/test/profiles';
import { DeviceToggle, LivePreview, type Device } from './LivePreview';

const authorizedFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  authorizedFetch,
}));

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:img');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.clearAllMocks());

function ready(frame: HTMLIFrameElement) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'profilo-preview-ready' },
        origin: window.location.origin,
        source: frame.contentWindow,
      }),
    );
  });
}

const IMAGES = {
  avatar: { id: 'a', urls: { '128': '/media/a/128.webp', '512': '/media/a/512.webp' } },
  background: { id: 'b', urls: { '960': '/media/b/960.webp', '1600': '/media/b/1600.webp' } },
};

describe('LivePreview', () => {
  it('sends the draft with image blob URLs once the frame is ready, and every change', async () => {
    authorizedFetch.mockImplementation(async () => new Response(new Blob(['x'])));
    function Host() {
      const [headline, setHeadline] = useState('Pierwszy');
      return (
        <>
          <button type="button" onClick={() => setHeadline('Drugi')}>
            zmień
          </button>
          <LivePreview profile={publicProfile({ headline, ...IMAGES })} device="desktop" />
        </>
      );
    }
    render(<Host />);
    const frame = screen.getByTitle('Podgląd strony') as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');

    await act(async () => {}); // images resolved
    ready(frame);
    await userEvent.click(screen.getByRole('button', { name: 'zmień' }));
    await act(async () => {});

    const sent = post.mock.calls.map(
      ([message]) => (message as { profile: { content: { headline: string } } }).profile.content,
    );
    expect(sent[0]!.headline).toBe('Pierwszy');
    expect(sent.at(-1)!.headline).toBe('Drugi');
    expect(sent[0]).toMatchObject({
      avatar: { urls: { '128': 'blob:img', '512': 'blob:img' } },
      background: { urls: { '960': 'blob:img', '1600': 'blob:img' } },
    });
    expect(authorizedFetch).toHaveBeenCalledWith('/media/a/512.webp');
    expect(authorizedFetch).toHaveBeenCalledTimes(2); // cached for the second message
    expect(frame).toHaveAttribute('src', '/podglad');
    expect(frame.style.width).toBe('1280px');
  });

  it('shows the page without an image it cannot load', async () => {
    authorizedFetch.mockResolvedValue(new Response(null, { status: 404 }));
    render(<LivePreview profile={publicProfile({ avatar: IMAGES.avatar })} device="phone" />);
    const frame = screen.getByTitle('Podgląd strony') as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');

    await act(async () => {});
    ready(frame);

    const message = post.mock.calls[0]![0] as { profile: { content: { avatar: unknown } } };
    expect(message.profile.content.avatar).toBeNull();
    expect(frame.style.width).toBe('390px');
  });

  it('ignores ready messages from other windows', async () => {
    render(<LivePreview profile={publicProfile()} device="desktop" />);
    const frame = screen.getByTitle('Podgląd strony') as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');
    await act(async () => {});

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'profilo-preview-ready' },
          origin: window.location.origin,
          source: window,
        }),
      );
    });

    expect(post).not.toHaveBeenCalled();
  });
});

describe('DeviceToggle', () => {
  it('switches between computer and phone', async () => {
    const changes: Device[] = [];
    render(<DeviceToggle device="desktop" onChange={(d) => changes.push(d)} />);

    expect(screen.getByRole('button', { name: 'Komputer' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Telefon' }));

    expect(changes).toEqual(['phone']);
  });
});
