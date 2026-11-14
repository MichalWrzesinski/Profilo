import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { owner } from './helpers';

// TASK-012: every layout and accent at 320 and 1440 px — no horizontal scroll, WCAG AA (axe);
// on a very light background image the text keeps ≥ 4.5:1 (pixel sampling).

const LAYOUTS = ['classic', 'split', 'card'] as const;
const ACCENTS = ['granat', 'niebieski', 'blekit', 'morski', 'zielen', 'bordo', 'miedz', 'fiolet'];
const run = Date.now().toString(36);
const links = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ url: `example.com/${run}/${i}`, label: `Link ${i}` }));

function luminance([r, g, b]: number[]): number {
  const [R, G, B] = [r!, g!, b!].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R! + 0.7152 * G! + 0.0722 * B!;
}

const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

/** Lowest contrast between each text element and the pixels behind it (text hidden). */
async function worstTextContrast(
  page: Page,
  selector: string,
): Promise<{ ratio: number; element: string }> {
  let worst = { ratio: Infinity, element: '' };
  // The dev server's floating indicator is not part of the page.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  for (const element of await page.locator(selector).all()) {
    if (!(await element.isVisible())) continue;
    const colour = await element.evaluate((el) =>
      getComputedStyle(el).color.match(/\d+/g)!.slice(0, 3).map(Number),
    );
    // Hide the text and everything inside the element (icons), keep its own background.
    await element.evaluate((el) => {
      (el as HTMLElement).style.color = 'transparent';
      el.querySelectorAll<HTMLElement>('*').forEach((child) => (child.style.visibility = 'hidden'));
    });
    const png = PNG.sync.read(await element.screenshot());
    await element.evaluate((el) => {
      (el as HTMLElement).style.color = '';
      el.querySelectorAll<HTMLElement>('*').forEach((child) => (child.style.visibility = ''));
    });
    for (let i = 0; i < png.data.length; i += 4 * 7) {
      const ratio = contrast(colour, [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!]);
      if (ratio < worst.ratio)
        worst = { ratio, element: await element.evaluate((el) => el.outerHTML.slice(0, 80)) };
    }
  }
  return worst;
}

async function check(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('nextjs-portal') // the dev server's own overlay
    .analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual(
    [],
  );
}

test('every layout and accent is readable at phone and desktop widths', async ({
  page,
  request,
}) => {
  const anna = await owner(request, 'Anna Kontrast', `e2e-layout-${run}@example.pl`);
  const { nick } = await anna.call('PUT', '/api/v1/me/profile/nick', { nick: `kontrast-${run}` });
  await anna.publish({
    headline: 'Projektantka usług',
    city: 'Toruń',
    company: 'Studio',
    bio: 'Krótki opis, który ma kilka słów.',
    publicEmail: `kontakt-${run}@example.pl`,
    publicPhone: '601234567',
  });
  for (const link of links(3)) await anna.call('POST', '/api/v1/me/profile/links', link);

  for (const layout of LAYOUTS) {
    for (const accent of ACCENTS) {
      await anna.publish({ layout, accent });
      await check(page, `/user/${nick}`, 1440);
    }
    await check(page, `/user/${nick}`, 320);
  }
});

test('text stays readable on a very light background image', async ({ page, request }) => {
  const ola = await owner(request, 'Ola Jasna', `e2e-light-${run}@example.pl`);
  const { nick } = await ola.call('PUT', '/api/v1/me/profile/nick', { nick: `jasna-${run}` });
  const upload = await request.put('/api/v1/me/profile/images/background', {
    headers: ola.headers,
    multipart: {
      file: {
        name: 'light-background.jpg',
        mimeType: 'image/jpeg',
        buffer: readFileSync('fixtures/light-background.jpg'), // tests run from e2e/,
      },
    },
  });
  expect(upload.ok()).toBe(true);
  for (const link of links(7)) await ola.call('POST', '/api/v1/me/profile/links', link);

  for (const layout of ['card', 'classic'] as const) {
    await ola.publish({ layout, accent: 'blekit', headline: 'Nagłówek na jasnym tle' });
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/user/${nick}`);
      await expect(page.locator('img[src*="/media/"]').first()).toBeVisible();
      const worst = await worstTextContrast(
        page,
        '.pp h1, .pp .headline, .pp .label-caps, .pp footer a, .pp .link-card strong',
      );
      expect(worst.ratio, `${layout} at ${width}px: ${worst.element}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
