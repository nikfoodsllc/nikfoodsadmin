import { describe, expect, it } from 'vitest';
import {
  ColumnDef,
  MAX_COLUMN_WIDTH,
  MAX_STORED_COLUMNS,
  MIN_COLUMN_WIDTH,
  clampWidth,
  emptyColumnPrefs,
  isDefaultColumnPrefs,
  moveColumnInPrefs,
  orderedColumns,
  parseColumnPrefs,
  resolveWidths,
  sanitizeColumnPrefs,
  totalColumnsWidth,
  userScopedStorageKey,
  validateColumnPrefsPayload,
  visibleColumns,
} from './columnPreferences';

const defs: ColumnDef[] = [
  { key: 'select', label: '', defaultWidth: 58, locked: true },
  { key: 'a', label: 'A', defaultWidth: 100 },
  { key: 'b', label: 'B', defaultWidth: 200, minWidth: 90 },
  { key: 'c', label: 'C', defaultWidth: 150 },
  { key: 'd', label: 'D', defaultWidth: 120 },
  { key: 'actions', label: 'Actions', defaultWidth: 150, locked: true },
];
const keys = (cols: ColumnDef[]) => cols.map((c) => c.key);
const prefs = (p: Partial<ReturnType<typeof emptyColumnPrefs>> = {}) => ({ ...emptyColumnPrefs(), ...p });

describe('clampWidth', () => {
  it('keeps widths inside the allowed range', () => {
    expect(clampWidth(10)).toBe(MIN_COLUMN_WIDTH);
    expect(clampWidth(5000)).toBe(MAX_COLUMN_WIDTH);
    expect(clampWidth(123.6)).toBe(124);
  });
  it('uses a column-specific minimum', () => {
    expect(clampWidth(70, { minWidth: 90 })).toBe(90);
    expect(clampWidth(95, { minWidth: 90 })).toBe(95);
  });
});

describe('orderedColumns', () => {
  it('is the default order when nothing is saved', () => {
    expect(keys(orderedColumns(defs, prefs()))).toEqual(['select', 'a', 'b', 'c', 'd', 'actions']);
  });
  it('follows the saved order and keeps locked columns in their slots', () => {
    expect(keys(orderedColumns(defs, prefs({ order: ['d', 'b', 'a', 'c'] })))).toEqual(['select', 'd', 'b', 'a', 'c', 'actions']);
  });
  it('puts columns missing from the saved order after the saved ones, in default order', () => {
    expect(keys(orderedColumns(defs, prefs({ order: ['c'] })))).toEqual(['select', 'c', 'a', 'b', 'd', 'actions']);
  });
  it('ignores unknown, locked and repeated keys in the saved order', () => {
    expect(keys(orderedColumns(defs, prefs({ order: ['ghost', 'select', 'b', 'b', 'actions'] })))).toEqual(['select', 'b', 'a', 'c', 'd', 'actions']);
  });
});

describe('moveColumnInPrefs', () => {
  it('moves a column to a position among the unlocked ones', () => {
    const out = moveColumnInPrefs(defs, prefs(), 'd', 0);
    expect(keys(orderedColumns(defs, out))).toEqual(['select', 'd', 'a', 'b', 'c', 'actions']);
  });
  it('moves forward as well', () => {
    const out = moveColumnInPrefs(defs, prefs(), 'a', 2);
    expect(keys(orderedColumns(defs, out))).toEqual(['select', 'b', 'c', 'a', 'd', 'actions']);
  });
  it('clamps an out-of-range position', () => {
    expect(keys(orderedColumns(defs, moveColumnInPrefs(defs, prefs(), 'a', 99)))).toEqual(['select', 'b', 'c', 'd', 'a', 'actions']);
    expect(keys(orderedColumns(defs, moveColumnInPrefs(defs, prefs(), 'd', -5)))).toEqual(['select', 'd', 'a', 'b', 'c', 'actions']);
  });
  it('does nothing for locked or unknown columns', () => {
    expect(moveColumnInPrefs(defs, prefs(), 'select', 2)).toEqual(prefs());
    expect(moveColumnInPrefs(defs, prefs(), 'ghost', 2)).toEqual(prefs());
  });
  it('goes back to the default (empty) order when moved back into place', () => {
    const moved = moveColumnInPrefs(defs, prefs(), 'd', 0);
    expect(moved.order.length).toBe(4);
    const back = moveColumnInPrefs(defs, moved, 'd', 3);
    expect(back.order).toEqual([]);
    expect(isDefaultColumnPrefs(back)).toBe(true);
  });
  it('keeps widths and hidden columns', () => {
    const out = moveColumnInPrefs(defs, prefs({ widths: { a: 130 }, hidden: ['c'] }), 'd', 0);
    expect(out.widths).toEqual({ a: 130 });
    expect(out.hidden).toEqual(['c']);
  });
});

describe('sanitizeColumnPrefs', () => {
  it('returns empty preferences for anything that is not an object', () => {
    for (const bad of [null, undefined, 42, 'x', true]) {
      expect(sanitizeColumnPrefs(bad, defs)).toEqual(emptyColumnPrefs());
    }
  });
  it('drops unknown columns, bad numbers and locked columns', () => {
    const out = sanitizeColumnPrefs(
      {
        order: ['ghost', 'select', 'c', 'a'],
        widths: { a: 140, ghost: 300, b: 'wide', c: NaN, select: 400, actions: 10 },
        hidden: ['c', 'ghost', 'select', 'actions', 7],
      },
      defs
    );
    expect(out.widths).toEqual({ a: 140 });
    expect(out.hidden).toEqual(['c']);
    expect(out.order).toEqual(['c', 'a', 'b', 'd']);
  });
  it('clamps saved widths and respects each column minimum', () => {
    const out = sanitizeColumnPrefs({ widths: { a: 5, b: 50, c: 99999 } }, defs);
    expect(out.widths).toEqual({ a: MIN_COLUMN_WIDTH, b: 90, c: MAX_COLUMN_WIDTH });
  });
  it('does not repeat hidden keys and treats the default order as empty', () => {
    expect(sanitizeColumnPrefs({ hidden: ['a', 'a', 'b'] }, defs).hidden).toEqual(['a', 'b']);
    expect(sanitizeColumnPrefs({ order: ['a', 'b', 'c', 'd'] }, defs).order).toEqual([]);
  });
});

describe('validateColumnPrefsPayload (server side)', () => {
  it('rejects non-objects', () => {
    for (const bad of [null, undefined, 5, 'x', [], true]) expect(validateColumnPrefsPayload(bad)).toBeNull();
  });
  it('keeps well-formed keys and clamps widths', () => {
    const out = validateColumnPrefsPayload({ order: ['a', 'b'], hidden: ['c'], widths: { a: 20, b: 9999, c: 150 } });
    expect(out).toEqual({ order: ['a', 'b'], hidden: ['c'], widths: { a: MIN_COLUMN_WIDTH, b: MAX_COLUMN_WIDTH, c: 150 } });
  });
  it('drops odd keys, non-strings, repeats and non-numeric widths', () => {
    const out = validateColumnPrefsPayload({
      order: ['ok', '$where', '', 'has space', 5, 'ok', 'x'.repeat(41), '1leading'],
      hidden: [{}, 'fine'],
      widths: { ok: 'wide', fine: 130, '__proto__': 1, '$gt': 3 },
    });
    expect(out?.order).toEqual(['ok']);
    expect(out?.hidden).toEqual(['fine']);
    expect(out?.widths).toEqual({ fine: 130 });
  });
  it('caps how many columns it will store', () => {
    const many = Array.from({ length: 500 }, (_, i) => `col${i}`);
    const widths = Object.fromEntries(many.map((k) => [k, 100]));
    const out = validateColumnPrefsPayload({ order: many, hidden: many, widths });
    expect(out?.order.length).toBe(MAX_STORED_COLUMNS);
    expect(out?.hidden.length).toBe(MAX_STORED_COLUMNS);
    expect(Object.keys(out?.widths ?? {}).length).toBe(MAX_STORED_COLUMNS);
  });
  it('fills in missing fields with empty values', () => {
    expect(validateColumnPrefsPayload({})).toEqual(emptyColumnPrefs());
  });
});

describe('parseColumnPrefs', () => {
  it('survives empty and corrupt storage values', () => {
    expect(parseColumnPrefs(null, defs)).toEqual(emptyColumnPrefs());
    expect(parseColumnPrefs('', defs)).toEqual(emptyColumnPrefs());
    expect(parseColumnPrefs('{not json', defs)).toEqual(emptyColumnPrefs());
  });
  it('reads a valid value back, including the order', () => {
    const json = JSON.stringify({ order: ['d', 'a', 'b', 'c'], widths: { a: 180 }, hidden: ['c'] });
    expect(parseColumnPrefs(json, defs)).toEqual({ order: ['d', 'a', 'b', 'c'], widths: { a: 180 }, hidden: ['c'] });
  });
  it('reads a value saved before ordering existed', () => {
    expect(parseColumnPrefs(JSON.stringify({ widths: { a: 180 }, hidden: ['c'] }), defs)).toEqual({ order: [], widths: { a: 180 }, hidden: ['c'] });
  });
});

describe('visibleColumns / resolveWidths / totalColumnsWidth', () => {
  it('hides only unlocked hidden columns and keeps the order', () => {
    expect(keys(visibleColumns(defs, prefs({ hidden: ['b'] })))).toEqual(['select', 'a', 'c', 'd', 'actions']);
  });
  it('shows columns in the saved order', () => {
    expect(keys(visibleColumns(defs, prefs({ order: ['d', 'c', 'b', 'a'], hidden: ['c'] })))).toEqual(['select', 'd', 'b', 'a', 'actions']);
  });
  it('never hides a locked column even if asked', () => {
    expect(keys(visibleColumns(defs, prefs({ hidden: ['select', 'actions'] })))).toEqual(['select', 'a', 'b', 'c', 'd', 'actions']);
  });
  it('uses saved widths for resized columns and defaults for the rest', () => {
    expect(resolveWidths(defs, prefs({ widths: { a: 130 } }))).toEqual({ select: 58, a: 130, b: 200, c: 150, d: 120, actions: 150 });
  });
  it('adds up only the visible columns', () => {
    const p = prefs({ widths: { a: 130 }, hidden: ['c'] });
    expect(totalColumnsWidth(visibleColumns(defs, p), resolveWidths(defs, p))).toBe(58 + 130 + 200 + 120 + 150);
  });
});

describe('userScopedStorageKey', () => {
  it('gives each admin their own key', () => {
    expect(userScopedStorageKey('t', 'u1')).toBe('t:u1');
    expect(userScopedStorageKey('t', 'u2')).not.toBe(userScopedStorageKey('t', 'u1'));
    expect(userScopedStorageKey('t', null)).toBe('t');
  });
});
