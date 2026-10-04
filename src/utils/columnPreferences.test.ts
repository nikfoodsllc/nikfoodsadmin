import { describe, expect, it } from 'vitest';
import {
  ColumnDef,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  clampWidth,
  parseColumnPrefs,
  resolveWidths,
  sanitizeColumnPrefs,
  totalColumnsWidth,
  visibleColumns,
} from './columnPreferences';

const defs: ColumnDef[] = [
  { key: 'select', label: '', defaultWidth: 58, locked: true },
  { key: 'a', label: 'A', defaultWidth: 100 },
  { key: 'b', label: 'B', defaultWidth: 200, minWidth: 90 },
  { key: 'c', label: 'C', defaultWidth: 150 },
  { key: 'actions', label: 'Actions', defaultWidth: 150, locked: true },
];

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

describe('sanitizeColumnPrefs', () => {
  it('returns empty preferences for anything that is not an object', () => {
    for (const bad of [null, undefined, 42, 'x', [], true]) {
      expect(sanitizeColumnPrefs(bad, defs)).toEqual({ widths: {}, hidden: [] });
    }
  });
  it('drops unknown columns, bad numbers and locked columns', () => {
    const out = sanitizeColumnPrefs(
      { widths: { a: 140, ghost: 300, b: 'wide', c: NaN, select: 400, actions: 10 }, hidden: ['c', 'ghost', 'select', 'actions', 7] },
      defs
    );
    expect(out.widths).toEqual({ a: 140 });
    expect(out.hidden).toEqual(['c']);
  });
  it('clamps saved widths and respects each column minimum', () => {
    const out = sanitizeColumnPrefs({ widths: { a: 5, b: 50, c: 99999 } }, defs);
    expect(out.widths).toEqual({ a: MIN_COLUMN_WIDTH, b: 90, c: MAX_COLUMN_WIDTH });
  });
  it('does not repeat hidden keys', () => {
    expect(sanitizeColumnPrefs({ hidden: ['a', 'a', 'b'] }, defs).hidden).toEqual(['a', 'b']);
  });
});

describe('parseColumnPrefs', () => {
  it('survives empty and corrupt storage values', () => {
    expect(parseColumnPrefs(null, defs)).toEqual({ widths: {}, hidden: [] });
    expect(parseColumnPrefs('', defs)).toEqual({ widths: {}, hidden: [] });
    expect(parseColumnPrefs('{not json', defs)).toEqual({ widths: {}, hidden: [] });
  });
  it('reads a valid value back', () => {
    const json = JSON.stringify({ widths: { a: 180 }, hidden: ['c'] });
    expect(parseColumnPrefs(json, defs)).toEqual({ widths: { a: 180 }, hidden: ['c'] });
  });
});

describe('visibleColumns / resolveWidths / totalColumnsWidth', () => {
  it('hides only unlocked hidden columns and keeps the order', () => {
    const cols = visibleColumns(defs, { widths: {}, hidden: ['b'] });
    expect(cols.map((c) => c.key)).toEqual(['select', 'a', 'c', 'actions']);
  });
  it('never hides a locked column even if asked', () => {
    const cols = visibleColumns(defs, { widths: {}, hidden: ['select', 'actions'] });
    expect(cols.map((c) => c.key)).toEqual(['select', 'a', 'b', 'c', 'actions']);
  });
  it('uses saved widths for resized columns and defaults for the rest', () => {
    const widths = resolveWidths(defs, { widths: { a: 130 }, hidden: [] });
    expect(widths).toEqual({ select: 58, a: 130, b: 200, c: 150, actions: 150 });
  });
  it('adds up only the visible columns', () => {
    const prefs = { widths: { a: 130 }, hidden: ['c'] };
    const cols = visibleColumns(defs, prefs);
    expect(totalColumnsWidth(cols, resolveWidths(defs, prefs))).toBe(58 + 130 + 200 + 150);
  });
});
