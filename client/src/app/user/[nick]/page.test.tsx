import { render, screen } from '@testing-library/react';
import { NavigationThrow } from '@/test/navigation';
import { publicProfile } from '@/test/profiles';
import PublicPage, { generateMetadata } from './page';

const getPublicProfile = vi.hoisted(() => vi.fn());
vi.mock('@/lib/publicProfile', async (original) => ({
  ...(await original<typeof import('@/lib/publicProfile')>()),
  getPublicProfile,
}));

const params = (nick: string) => ({ params: Promise.resolve({ nick }) });

afterEach(() => getPublicProfile.mockReset());

describe('/user/[nick]', () => {
  it('renders the published page', async () => {
    getPublicProfile.mockResolvedValue(publicProfile());

    render(await PublicPage(params('anna-wisniewska')));

    expect(screen.getByRole('heading', { name: 'Anna Wiśniewska' })).toBeVisible();
    expect(getPublicProfile).toHaveBeenCalledWith('anna-wisniewska');
  });

  it('shows the 404 page for a hidden or unknown nick', async () => {
    getPublicProfile.mockResolvedValue(null);

    await expect(PublicPage(params('nie-ma'))).rejects.toThrow('not-found');
  });

  it('shows the 404 page for a malformed address', async () => {
    await expect(PublicPage(params('%E0'))).rejects.toBeInstanceOf(NavigationThrow);
    expect(getPublicProfile).not.toHaveBeenCalled();
  });

  it('redirects to the canonical nick', async () => {
    getPublicProfile.mockResolvedValue(publicProfile());

    await expect(PublicPage(params('Anna-Wisniewska'))).rejects.toThrow(
      'redirect:/user/anna-wisniewska',
    );
  });

  it.each([
    ['Projektantka UX', 'Anna Wiśniewska — Projektantka UX'],
    [null, 'Anna Wiśniewska'],
  ])('builds the title from the name and headline (%s)', async (headline, title) => {
    getPublicProfile.mockResolvedValue(publicProfile({ headline }));

    expect((await generateMetadata(params('anna-wisniewska'))).title).toBe(title);
  });

  it('uses the 404 title for a hidden page', async () => {
    getPublicProfile.mockResolvedValue(null);

    expect((await generateMetadata(params('nie-ma'))).title).toBe(
      'Nie znaleźliśmy tej strony — Profilo',
    );
  });
});
