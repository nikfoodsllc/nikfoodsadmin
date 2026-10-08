import { describe, expect, it } from 'vitest';
import { csvCell, normalizeUsPhone, resolveRegistrationRange, splitName, usersToCsv, validateAddressInput } from './userAdmin';

describe('normalizeUsPhone', () => {
  it('accepts common ways of typing a US number', () => {
    for (const p of ['2065550100', '(206) 555-0100', '206.555.0100', '1-206-555-0100', '+1 206 555 0100']) expect(normalizeUsPhone(p)).toBe('2065550100');
  });
  it('rejects anything else', () => {
    for (const p of ['', '12345', '206555010', '20655501000', 'abc', null, undefined, {}]) expect(normalizeUsPhone(p as never)).toBeNull();
  });
});

describe('splitName', () => {
  it('first word is the first name, the rest the last name', () => {
    expect(splitName('Kunal Mehra')).toEqual({ first: 'Kunal', last: 'Mehra' });
    expect(splitName('  Mary   Ann  Smith ')).toEqual({ first: 'Mary', last: 'Ann Smith' });
    expect(splitName('Cher')).toEqual({ first: 'Cher', last: '' });
    expect(splitName('')).toEqual({ first: '', last: '' });
    expect(splitName(undefined)).toEqual({ first: '', last: '' });
  });
});

describe('csvCell / usersToCsv', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell(null)).toBe('');
  });
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
  it('builds the four columns with a header and a BOM', () => {
    const csv = usersToCsv([
      { name: 'Kunal Mehra', email: 'k@example.com', phone: '(206) 555-0100' },
      { name: 'Cher', email: 'c@example.com', phone: '' },
      { name: 'Mary Ann Smith', email: 'm@example.com', phone: '1-425-555-0111' },
      { name: '', email: 'nobody@example.com', phone: undefined },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'First Name,Last Name,Email,Phone',
      'Kunal,Mehra,k@example.com,2065550100',
      'Cher,,c@example.com,',
      'Mary,Ann Smith,m@example.com,4255550111',
      ',,nobody@example.com,',
      '',
    ]);
  });
  it('keeps a phone it cannot read as typed instead of dropping it', () => {
    expect(usersToCsv([{ name: 'A B', email: 'a@b.co', phone: 'ext 5' }])).toContain('A,B,a@b.co,ext 5');
  });
  it('an empty list still has the header', () => {
    expect(usersToCsv([])).toBe('﻿First Name,Last Name,Email,Phone\r\n');
  });
});

describe('resolveRegistrationRange', () => {
  const now = new Date('2026-10-07T20:00:00Z'); // 1 PM on Oct 7 in Seattle
  it('both ends included, in Pacific days', () => {
    const r = resolveRegistrationRange({ from: '2026-10-01', to: '2026-10-07' }, now);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.since?.toISOString()).toBe('2026-10-01T07:00:00.000Z');
    expect(r.until?.toISOString()).toBe('2026-10-08T07:00:00.000Z');
  });
  it('an empty end or start means open ended', () => {
    const a = resolveRegistrationRange({ from: '2026-09-01' }, now);
    const b = resolveRegistrationRange({ to: '2026-09-01' }, now);
    const c = resolveRegistrationRange({}, now);
    expect(a).toMatchObject({ until: null });
    expect(b).toMatchObject({ since: null });
    expect(c).toMatchObject({ since: null, until: null });
  });
  it('refuses bad input with a message', () => {
    expect(resolveRegistrationRange({ from: '2026-10-08', to: '2026-10-01' }, now)).toHaveProperty('error');
    expect(resolveRegistrationRange({ to: '2026-10-08' }, now)).toHaveProperty('error'); // tomorrow
    expect(resolveRegistrationRange({ from: '2026-02-31' }, now)).toHaveProperty('error');
    expect(resolveRegistrationRange({ from: 'yesterday' }, now)).toHaveProperty('error');
  });
  it('the end may be today', () => {
    expect('error' in resolveRegistrationRange({ to: '2026-10-07' }, now)).toBe(false);
  });
});

describe('validateAddressInput', () => {
  const good = { name: 'Home', email: 'A@Example.com', phone: '(206) 555-0100', street_address: '400 Broad Street', city: 'Seattle', postal_code: '98109', apartment: '7C', floor: 'Leave at door', entrance: '4455', isDefault: true };
  it('cleans a good address', () => {
    const r = validateAddressInput(good);
    expect(r).toEqual({ ok: true, value: { ...good, email: 'a@example.com', phone: '2065550100' } });
  });
  it('phone is optional', () => {
    expect(validateAddressInput({ ...good, phone: '' })).toMatchObject({ ok: true, value: { phone: '' } });
  });
  it('names the first problem', () => {
    expect(validateAddressInput({ ...good, name: 'A' })).toMatchObject({ ok: false });
    expect(validateAddressInput({ ...good, email: 'nope' })).toMatchObject({ ok: false });
    expect(validateAddressInput({ ...good, street_address: '1' })).toMatchObject({ ok: false });
    expect(validateAddressInput({ ...good, city: '' })).toMatchObject({ ok: false });
    expect(validateAddressInput({ ...good, postal_code: '9810' })).toMatchObject({ ok: false });
    expect(validateAddressInput({ ...good, postal_code: '98109-1234' })).toMatchObject({ ok: true });
    expect(validateAddressInput({ ...good, apartment: '12345678901' })).toMatchObject({ ok: false });
    expect(validateAddressInput({ ...good, floor: 'x'.repeat(30) })).toMatchObject({ ok: true });
    expect(validateAddressInput({ ...good, floor: 'x'.repeat(31) })).toMatchObject({ ok: false });
    expect(validateAddressInput({ ...good, phone: '123' })).toMatchObject({ ok: false, error: 'The phone number must be 10 digits' });
    expect(validateAddressInput(null)).toMatchObject({ ok: false });
  });
  it('isDefault is only true when it is exactly true', () => {
    expect(validateAddressInput({ ...good, isDefault: 'yes' })).toMatchObject({ ok: true, value: { isDefault: false } });
  });
});
