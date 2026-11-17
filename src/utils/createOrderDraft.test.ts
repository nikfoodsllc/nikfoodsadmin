import { describe, expect, it } from 'vitest';
import { TIP_OTHER } from './createOrder';
import { MAX_DRAFT_LINES, orderDraftSummary, orderDraftTitle, orderDraftWorthSaving, parseOrderDraft } from './createOrderDraft';

const line = { date: '2026-11-17', foodItemId: 'abc123', quantity: 2, name: 'Samosa', unitPrice: 6, tags: ['Eco'] };

describe('parseOrderDraft', () => {
  it('keeps a full draft', () => {
    const d = parseOrderDraft({ date: '2026-11-17', customer: { name: 'A B', email: 'a@x.test', phone: '2065550100' }, address: { street_address: '1 Main St', apartment: '2', city: 'Seattle', postal_code: '98109', entrance: '', floor: '' }, lines: [{ ...line, selectedPortion: '12Oz', isEcoFriendlyContainer: true, comboSelections: { s1: ['o1'] }, unitPriceEdited: 5 }], tip: 10, tipOther: '', discount: '2', waiveFee: true, countNow: true, payment: 'paid', paidChoice: 'Other', paidTyped: 'Check', note: 'n' });
    expect(d.customer.name).toBe('A B');
    expect(d.lines[0]).toMatchObject({ foodItemId: 'abc123', quantity: 2, selectedPortion: '12Oz', isEcoFriendlyContainer: true, unitPriceEdited: 5, comboSelections: { s1: ['o1'] } });
    expect(d.lines[0].key).toContain('abc123');
    expect(d).toMatchObject({ tip: 10, discount: '2', waiveFee: true, countNow: true, payment: 'paid', paidChoice: 'Other', paidTyped: 'Check' });
  });
  it('falls back to safe defaults for junk and never throws', () => {
    for (const junk of [null, undefined, 5, 'x', [], { lines: 'all', payment: 'bitcoin', paidChoice: 'x', tip: 'high', date: 'soon' }]) {
      const d = parseOrderDraft(junk);
      expect(d.lines).toEqual([]);
      expect(d.payment).toBe('link');
      expect(d.paidChoice).toBe('Cash');
      expect(d.tip).toBe(0);
      expect(d.date).toBe('');
    }
  });
  it('drops lines without a day or item, clamps quantity, and caps the number of lines', () => {
    const d = parseOrderDraft({ lines: [{ ...line, date: 'x' }, { ...line, foodItemId: '' }, { ...line, quantity: 500 }, { ...line, quantity: 0 }] });
    expect(d.lines.map((l) => l.quantity)).toEqual([99, 1]);
    const many = parseOrderDraft({ lines: Array.from({ length: 300 }, (_, i) => ({ ...line, foodItemId: `i${i}` })) });
    expect(many.lines).toHaveLength(MAX_DRAFT_LINES);
  });
  it('keeps the other-amount tip choice and rejects absurd tips', () => {
    expect(parseOrderDraft({ tip: TIP_OTHER }).tip).toBe(TIP_OTHER);
    expect(parseOrderDraft({ tip: 5000 }).tip).toBe(0);
  });
  it('is stable: parsing a parsed draft gives the same draft', () => {
    const once = parseOrderDraft({ customer: { name: 'A' }, lines: [line] });
    expect(parseOrderDraft(once)).toEqual(once);
  });
});

describe('worthSaving, title and summary', () => {
  it('ignores an untouched form', () => {
    expect(orderDraftWorthSaving(parseOrderDraft({}))).toBe(false);
    expect(orderDraftWorthSaving(parseOrderDraft({ customer: { name: ' ' } }))).toBe(false);
    expect(orderDraftWorthSaving(parseOrderDraft({ customer: { phone: '206' } }))).toBe(true);
    expect(orderDraftWorthSaving(parseOrderDraft({ lines: [line] }))).toBe(true);
  });
  it('names a draft by its customer', () => {
    expect(orderDraftTitle(parseOrderDraft({ customer: { name: 'Ana' } }))).toBe('Ana');
    expect(orderDraftTitle(parseOrderDraft({ customer: { email: 'a@x.test' } }))).toBe('a@x.test');
    expect(orderDraftTitle(parseOrderDraft({}))).toBe('Customer not entered yet');
  });
  it('summarises the items and days', () => {
    expect(orderDraftSummary({ lines: [] })).toBe('No items yet');
    const d = parseOrderDraft({ lines: [line, { ...line, foodItemId: 'z', date: '2026-11-18', quantity: 1 }] });
    expect(orderDraftSummary(d)).toBe('3 items · Tue, Nov 17 + 1 more day · about $18.00 before fees');
  });
});
