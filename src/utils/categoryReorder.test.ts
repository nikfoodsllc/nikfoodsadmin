import { describe, expect, it } from 'vitest';
import { moveItem, planReorder } from './categoryReorder';

describe('moveItem', () => {
  it('moves forward and backward without changing the input', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });
  it('ignores a no-op or out-of-range move', () => {
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
  });
});

describe('planReorder', () => {
  const sibs = [
    { id: 'a', sequence: 1 },
    { id: 'b', sequence: 2 },
    { id: 'c', sequence: 3 },
  ];
  it('renumbers from 1 and only lists the categories whose rank changes', () => {
    expect(planReorder(sibs, ['b', 'a', 'c'])).toEqual({
      ok: true,
      updates: [
        { id: 'b', sequence: 1 },
        { id: 'a', sequence: 2 },
      ],
    });
  });
  it('lists nothing when the order is unchanged', () => {
    expect(planReorder(sibs, ['a', 'b', 'c'])).toEqual({ ok: true, updates: [] });
  });
  it('repairs missing or duplicate ranks (e.g. everything 0)', () => {
    const messy = [{ id: 'a', sequence: 0 }, { id: 'b' }, { id: 'c', sequence: 2 }];
    expect(planReorder(messy, ['c', 'a', 'b'])).toEqual({
      ok: true,
      updates: [
        { id: 'c', sequence: 1 },
        { id: 'a', sequence: 2 },
        { id: 'b', sequence: 3 },
      ],
    });
  });
  it('rejects a list that is not exactly the group', () => {
    for (const bad of [
      ['a', 'b'],
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'x'],
      ['a', 'a', 'b'],
    ]) {
      expect(planReorder(sibs, bad).ok).toBe(false);
    }
  });
  it('rejects junk input', () => {
    for (const bad of [undefined, null, 'abc', [], [1, 2, 3], [''], {}]) {
      expect(planReorder(sibs, bad).ok).toBe(false);
    }
  });
});
