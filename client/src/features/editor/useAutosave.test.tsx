import { act, renderHook, waitFor } from '@testing-library/react';
import { json, mockFetch } from '@/test/fetch';
import type { OwnerProfile } from './fields';
import { useAutosave } from './useAutosave';

const profile = (version: number) =>
  ({
    nick: 'anna',
    nickLocked: false,
    status: 'never_published',
    hasUnpublishedChanges: false,
    version,
    publicUrl: null,
    draft: {
      displayName: 'Anna',
      headline: null,
      bio: null,
      city: null,
      company: null,
      position: null,
      publicEmail: null,
      publicPhone: null,
      layout: 'classic',
      accent: 'granat',
      links: [],
    },
  }) as unknown as OwnerProfile;

afterEach(() => vi.unstubAllGlobals());

describe('useAutosave.exclusive', () => {
  it('runs queued link changes in order and keeps the newest version', async () => {
    const patches: unknown[] = [];
    mockFetch(async (request) => {
      patches.push(await request.json());
      return json(200, profile(8));
    });
    const { result } = renderHook(() => useAutosave(profile(5), 'profilo:draft:test'));
    const order: string[] = [];
    let releaseFirst: (p: OwnerProfile) => void = () => {};

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.exclusive(
        () =>
          new Promise<OwnerProfile>((resolve) => {
            order.push('first started');
            releaseFirst = resolve;
          }),
      );
      second = result.current.exclusive(async () => {
        order.push('second started');
        return profile(6); // older than what the first change will return
      });
    });
    expect(result.current.busy).toBe(true);
    await waitFor(() => expect(order).toEqual(['first started']));

    await act(async () => {
      releaseFirst(profile(7));
      await first;
      await second;
    });

    expect(order).toEqual(['first started', 'second started']);
    expect(result.current.profile.version).toBe(7);
    expect(result.current.busy).toBe(false);
    expect(patches).toHaveLength(0);
  });

  it('keeps the queue going after a failed change', async () => {
    const { result } = renderHook(() => useAutosave(profile(5), 'profilo:draft:test'));

    await act(async () => {
      await result.current
        .exclusive(async () => {
          throw new Error('boom');
        })
        .catch(() => undefined);
      await result.current.exclusive(async () => profile(6));
    });

    expect(result.current.profile.version).toBe(6);
    expect(result.current.busy).toBe(false);
  });
});
