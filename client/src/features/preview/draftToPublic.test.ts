import type { OwnerProfile, Values } from '@/features/editor/fields';
import { draftToPublic, isPreviewMessage } from './draftToPublic';

const profile = {
  nick: 'anna',
  publicUrl: 'https://profilo.pl/user/anna',
  publishedAt: '2026-11-10T12:00:00Z',
  draft: {
    displayName: 'Anna',
    headline: 'Stary',
    bio: null,
    city: null,
    company: null,
    position: null,
    publicEmail: null,
    publicPhone: null,
    layout: 'classic',
    accent: 'granat',
    avatar: null,
    background: null,
    links: [],
  },
} as unknown as OwnerProfile;

const values: Values = {
  displayName: '',
  headline: 'Nowy  ',
  bio: '',
  position: 'CEO',
  company: '',
  city: '',
  publicEmail: '',
  phoneCountry: 'PL',
  phoneNational: '601 234 567',
};

describe('draftToPublic', () => {
  it('shows typed changes before they are saved', () => {
    const page = draftToPublic(profile, values);

    expect(page.content).toMatchObject({
      displayName: 'Anna', // an emptied name keeps the saved one
      headline: 'Nowy',
      position: 'CEO',
      bio: null,
      publicPhone: '+48 601 234 567',
    });
    expect(page.canonicalUrl).toBe('https://profilo.pl/user/anna');
  });

  it('works for a draft that was never published and has no nick', () => {
    const page = draftToPublic({ ...profile, nick: null, publicUrl: null, publishedAt: null });

    expect(page.nick).toBe('twoj-adres');
    expect(page.canonicalUrl).toBe(`${window.location.origin}/user/twoj-adres`);
    expect(page.content.headline).toBe('Stary');
  });
});

describe('isPreviewMessage', () => {
  it.each([
    [{ type: 'profilo-preview', profile: {} }, true],
    [{ type: 'profilo-preview' }, false],
    [{ type: 'other', profile: {} }, false],
    [null, false],
    ['profilo-preview', false],
  ])('%j → %s', (data, expected) => {
    expect(isPreviewMessage(data)).toBe(expected);
  });
});
