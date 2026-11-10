import { vi } from 'vitest';

export const router = { push: vi.fn(), replace: vi.fn() };

vi.mock('next/navigation', () => ({ useRouter: () => router }));
