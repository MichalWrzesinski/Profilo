import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { tokenStore } from './api/client';
import { draftStorageKey } from './draftStorage';
import { SessionProvider, useSession } from './session';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
);

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
});

describe('SessionProvider', () => {
  it('restores the session from the refresh cookie', async () => {
    mockFetch(() => json(200, SESSION));
    const { result } = renderHook(() => useSession(), { wrapper });

    await act(() => result.current.ensure());

    expect(result.current.status).toBe('authenticated');
    expect(result.current.account?.email).toBe('anna@example.pl');
  });

  it('becomes anonymous without a valid refresh cookie', async () => {
    mockFetch(() => json(401, { code: 'unauthorized', status: 401 }));
    const { result } = renderHook(() => useSession(), { wrapper });

    await act(() => result.current.ensure());

    expect(result.current.status).toBe('anonymous');
  });

  it('does not refresh again when already signed in', async () => {
    const fetch = mockFetch(() => json(200, SESSION));
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.signIn(SESSION));

    await act(() => result.current.ensure());

    expect(fetch).not.toHaveBeenCalled();
    expect(tokenStore.get()).toBe('access-1');
  });

  it('signs out locally even when the logout request fails', async () => {
    mockFetch(() => Promise.reject(new TypeError('offline')));
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.signIn(SESSION));

    await act(async () => {
      await result.current.signOut().catch(() => undefined);
    });

    expect(result.current.status).toBe('anonymous');
    expect(tokenStore.get()).toBeNull();
  });

  it('requires the provider', () => {
    const Broken = () => <span>{useSession().status}</span>;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Broken />)).toThrow('useSession must be used inside <SessionProvider>');
    expect(screen.queryByText('unknown')).toBeNull();
  });

  it('removes drafts kept in this browser at logout', async () => {
    mockFetch(() => json(204));
    window.localStorage.setItem(draftStorageKey('a1'), '{}');
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.signIn(SESSION));

    await act(() => result.current.signOut());

    expect(window.localStorage.getItem(draftStorageKey('a1'))).toBeNull();
  });
});
