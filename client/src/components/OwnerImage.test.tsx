import { render, waitFor } from '@testing-library/react';
import { tokenStore } from '@/lib/api/client';
import { json, mockFetch } from '@/test/fetch';
import { OwnerImage } from './OwnerImage';

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:owner');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
});

describe('OwnerImage', () => {
  it('fetches the draft image with the access token and shows it', async () => {
    tokenStore.set('access-1');
    const fetch = mockFetch(async () => new Response(new Blob(['x'], { type: 'image/webp' })));

    const { container, unmount } = render(
      <OwnerImage url="http://localhost/media/a/256.webp" alt="Anna" />,
    );

    await waitFor(() =>
      expect(container.querySelector('img')).toHaveAttribute('src', 'blob:owner'),
    );
    const request = fetch.mock.calls[0]!;
    expect(new Headers((request[1] as RequestInit).headers).get('Authorization')).toBe(
      'Bearer access-1',
    );
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:owner');
  });

  it('shows nothing when the image cannot be read', async () => {
    tokenStore.set('access-1');
    const fetch = mockFetch(async () => json(404, { status: 404 }));

    const { container } = render(<OwnerImage url="http://localhost/media/a/256.webp" alt="" />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows nothing when the network fails', async () => {
    const fetch = mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const { container } = render(<OwnerImage url="http://localhost/media/a/256.webp" alt="" />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelector('img')).toBeNull();
  });
});
