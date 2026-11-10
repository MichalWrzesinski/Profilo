import { clearDrafts, draftStorageKey, readDraft, writeDraft } from './draftStorage';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('draft storage', () => {
  it('writes, reads and removes a draft per account', () => {
    const key = draftStorageKey('a1');
    writeDraft(key, { city: 'Kraków' });

    expect(readDraft(key)).toEqual({ city: 'Kraków' });
    writeDraft(key, null);
    expect(readDraft(key)).toBeNull();
  });

  it('clears every kept draft and nothing else', () => {
    writeDraft(draftStorageKey('a1'), { city: 'A' });
    writeDraft(draftStorageKey('a2'), { city: 'B' });
    window.localStorage.setItem('inne', 'zostaje');

    clearDrafts();

    expect(Object.keys(window.localStorage)).toEqual(['inne']);
  });

  it('survives blocked or broken storage', () => {
    window.localStorage.setItem(draftStorageKey('a1'), '{nie-json');
    expect(readDraft(draftStorageKey('a1'))).toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeDraft('k', { a: 1 })).not.toThrow();
    expect(() => clearDrafts()).not.toThrow();
  });
});
