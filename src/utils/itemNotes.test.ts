import { describe, expect, it } from 'vitest';
import { ADMIN_NOTE_MAX, applyAdminNote, applyItemNote, canEditItemNotes, cleanAdminNote, cleanItemNote, ITEM_NOTE_MAX } from './itemNotes';

const days = () => [
  { deliveryDate: '2026-11-24', items: [{ food: { _id: 'a', name: 'Dal' }, notes: 'less salt' }, { food: { _id: 'b', name: 'Rice' } }, { food: { _id: 'a', name: 'Dal' } }] },
  { deliveryDate: '2026-11-25', items: [{ food: { _id: 'a', name: 'Dal' }, notes: 'keep' }] },
];

describe('item instructions', () => {
  it('cleans text to one short line', () => {
    expect(cleanItemNote('  no\n onion   please ')).toBe('no onion please');
    expect(cleanItemNote('x'.repeat(60))).toHaveLength(ITEM_NOTE_MAX);
    expect(cleanItemNote(undefined)).toBe('');
    expect(cleanItemNote(5)).toBe('');
  });

  it('only open orders can be edited', () => {
    for (const s of ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery']) expect(canEditItemNotes(s)).toBe(true);
    for (const s of ['delivered', 'cancelled', undefined, '']) expect(canEditItemNotes(s)).toBe(false);
  });

  it('sets the text on every line of that food on that day only', () => {
    const input = days();
    const r = applyItemNote(input, 0, 1, 'extra soft');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.days[0].items[1].notes).toBe('extra soft');
    expect(r.days[0].items[0].notes).toBe('less salt');
    expect(r.days[1].items[0].notes).toBe('keep');
    expect(input[0].items[1]).not.toHaveProperty('notes'); // input untouched

    const r2 = applyItemNote(input, 0, 2, 'no salt');
    expect(r2.ok && r2.days[0].items.map((l) => l.notes)).toEqual(['no salt', undefined, 'no salt']);
    expect(r2.ok && r2.lines).toBe(2);
    expect(r2.ok && r2.from).toBe('');
  });

  it('empty text removes the instructions', () => {
    const r = applyItemNote(days(), 0, 0, '   ');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.days[0].items[0]).not.toHaveProperty('notes');
    expect(r.from).toBe('less salt');
    expect(r.to).toBe('');
  });

  it('refuses unknown lines and unchanged text', () => {
    expect(applyItemNote(days(), 5, 0, 'x').ok).toBe(false);
    expect(applyItemNote(days(), 0, 9, 'x').ok).toBe(false);
    expect(applyItemNote(days(), 0.5, 0, 'x').ok).toBe(false);
    expect(applyItemNote(days(), 0, 0, ' less  salt ')).toEqual({ ok: false, error: 'Nothing changed.' });
  });
});

describe('admin note', () => {
  const sample = () => [{ items: [{ food: { name: 'Dal' } }, { food: { name: 'Dal' }, adminNote: 'old' }] }];
  it('sets only the chosen line, any item', () => {
    const input = sample();
    const r = applyAdminNote(input, 0, 0, '  pack   separately ');
    expect(r.ok && r.days[0].items.map((l) => l.adminNote)).toEqual(['pack separately', 'old']);
    expect(input[0].items[0]).not.toHaveProperty('adminNote');
  });
  it('removes, refuses unchanged and unknown lines, caps the length', () => {
    const r = applyAdminNote(sample(), 0, 1, '');
    expect(r.ok && r.days[0].items[1]).not.toHaveProperty('adminNote');
    expect(r.ok && r.from).toBe('old');
    expect(applyAdminNote(sample(), 0, 1, 'old')).toEqual({ ok: false, error: 'Nothing changed.' });
    expect(applyAdminNote(sample(), 1, 0, 'x').ok).toBe(false);
    expect(cleanAdminNote('y'.repeat(300))).toHaveLength(ADMIN_NOTE_MAX);
  });
});
