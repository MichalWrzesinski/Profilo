import { vi } from 'vitest';

export const router = { push: vi.fn(), replace: vi.fn() };
export const searchParams = { current: new URLSearchParams() };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams.current,
}));
