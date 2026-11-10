import { vi } from 'vitest';

export const router = { push: vi.fn(), replace: vi.fn() };
export const searchParams = { current: new URLSearchParams() };

/** Thrown by the mocked `notFound()` and `permanentRedirect()` (Next.js throws too). */
export class NavigationThrow extends Error {}

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams.current,
  notFound: () => {
    throw new NavigationThrow('not-found');
  },
  permanentRedirect: (url: string) => {
    throw new NavigationThrow(`redirect:${url}`);
  },
}));
