import { plural } from './plural';

describe('plural', () => {
  it.each([
    [1, 'pole'],
    [2, 'pola'],
    [4, 'pola'],
    [5, 'pól'],
    [12, 'pól'],
    [22, 'pola'],
    [25, 'pól'],
  ])('uses the right form for %i', (n, expected) => {
    expect(plural(n, 'pole', 'pola', 'pól')).toBe(expected);
  });
});
