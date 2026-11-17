import { vi } from 'vitest';

/** next/font only works in the Next.js compiler: tests get a font with a fixed class name. */
vi.mock('next/font/google', () => {
  const font = () => ({ className: 'font', style: { fontFamily: 'font' }, variable: 'font' });
  return { Caveat: font, Plus_Jakarta_Sans: font };
});
