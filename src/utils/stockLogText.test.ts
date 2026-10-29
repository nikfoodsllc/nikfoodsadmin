import { describe, expect, it } from 'vitest';
import { stockCellText, stockLogText } from './stockLogText';

describe('stock history wording', () => {
  it('words each kind', () => {
    expect(stockLogText({ kind: 'limit_set', to: '50' })).toBe('Limit set to 50');
    expect(stockLogText({ kind: 'limit_changed', from: '50', to: '60' })).toBe('Limit changed from 50 to 60');
    expect(stockLogText({ kind: 'limit_removed', from: '50' })).toBe('Limit removed (it was 50)');
    expect(stockLogText({ kind: 'reset_mode_changed', from: 'manual', to: 'daily at 03:00' })).toBe('Reset changed from manual to daily at 03:00');
    expect(stockLogText({ kind: 'reset', ordered: 48, limit: 50 })).toBe('Count reset (48 of 50 had been ordered)');
    expect(stockLogText({ kind: 'reset', ordered: 3, limit: null })).toBe('Count reset (3 had been ordered)');
  });
  it('the table cell', () => {
    expect(stockCellText({ limit: 50, ordered: 12, soldOut: false })).toBe('12 / 50');
    expect(stockCellText({ limit: 50, ordered: 50, soldOut: true })).toBe('Sold out');
    expect(stockCellText({ limit: null, ordered: 4, soldOut: false })).toBe('');
    expect(stockCellText(undefined)).toBe('');
  });
});
