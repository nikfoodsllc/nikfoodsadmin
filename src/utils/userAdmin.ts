import { addDaysToDay, pacificDayStart, pacificToday } from '@/utils/abandonedCheckouts';

/** 10 digits for a US number typed in any common way ("(206) 555-0100", "1-206-555-0100"), or null when it is not one. */
export function normalizeUsPhone(input: unknown): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const digits = String(input).replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return /^\d{10}$/.test(ten) ? ten : null;
}

// ---------------------------------------------------------------------------------------------------------------
// The customer export (First Name, Last Name, Email, Phone)

/** "Kunal Mehra" -> Kunal / Mehra; "Mary Ann Smith" -> Mary / Ann Smith; one word -> first name only. */
export function splitName(name: unknown): { first: string; last: string } {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { first: '', last: '' };
  return { first: words[0], last: words.slice(1).join(' ') };
}

/** One CSV cell: quoted when needed, and a leading = + - @ is neutralised so a spreadsheet never runs a typed name as a formula. */
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface ExportUser {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export const EXPORT_HEADER = ['First Name', 'Last Name', 'Email', 'Phone'];

/** The whole file: a header and one row per customer. A BOM first so Excel reads accents correctly. */
export function usersToCsv(users: ExportUser[]): string {
  const rows = users.map((u) => {
    const { first, last } = splitName(u.name);
    const phone = normalizeUsPhone(u.phone) ?? String(u.phone ?? '').trim();
    return [first, last, u.email ?? '', phone].map(csvCell).join(',');
  });
  return `﻿${[EXPORT_HEADER.join(','), ...rows].join('\r\n')}\r\n`;
}

const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function isRealDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false;
  const d = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

export interface RegistrationRange {
  /** Start of the first day, Pacific time (inclusive); null = from the beginning */
  since: Date | null;
  /** Start of the day after the last day (exclusive); null = up to now */
  until: Date | null;
  from: string | null;
  to: string | null;
}

/**
 * The registration date range of the export, in Pacific days, both ends included. Either end may be left empty
 * (no start / up to today). The end cannot be in the future and the start cannot be after the end.
 */
export function resolveRegistrationRange(input: { from?: string | null; to?: string | null }, now: Date = new Date()): RegistrationRange | { error: string } {
  const from = (input.from ?? '').trim();
  const to = (input.to ?? '').trim();
  if (from && !isRealDay(from)) return { error: 'The start date is not a valid date' };
  if (to && !isRealDay(to)) return { error: 'The end date is not a valid date' };
  if (from && to && from > to) return { error: 'The start date must not be after the end date' };
  if (to && to > pacificToday(now)) return { error: 'The end date cannot be in the future' };
  return {
    since: from ? pacificDayStart(from) : null,
    until: to ? pacificDayStart(addDaysToDay(to, 1)) : null,
    from: from || null,
    to: to || null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Editing an address

export interface AddressInput {
  name: string;
  email: string;
  phone: string;
  street_address: string;
  city: string;
  postal_code: string;
  apartment: string;
  floor: string;
  entrance: string;
  isDefault: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks an address typed by an admin and returns it cleaned up (the phone as 10 digits), or the first problem. */
export function validateAddressInput(body: unknown): { ok: true; value: AddressInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof b[key] === 'string' ? (b[key] as string).trim() : '');
  const name = text('name');
  const email = text('email').toLowerCase();
  const street = text('street_address');
  const city = text('city');
  const zip = text('postal_code');
  const apartment = text('apartment');
  const floor = text('floor');
  const entrance = text('entrance');
  const rawPhone = text('phone');

  if (name.length < 2) return { ok: false, error: 'Enter a name for this address (at least 2 characters)' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address' };
  if (street.length < 5) return { ok: false, error: 'The street address is too short' };
  if (city.length < 2) return { ok: false, error: 'Enter the city' };
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { ok: false, error: 'The zip code must be 5 digits (12345) or 12345-6789' };
  if (apartment.length > 10) return { ok: false, error: 'The apartment can be at most 10 characters' };
  if (floor.length > 30) return { ok: false, error: 'The delivery instructions can be at most 30 characters' };
  if (entrance.length > 30) return { ok: false, error: 'The gate / entrance code can be at most 30 characters' };
  let phone = '';
  if (rawPhone) {
    const normalized = normalizeUsPhone(rawPhone);
    if (!normalized) return { ok: false, error: 'The phone number must be 10 digits' };
    phone = normalized;
  }
  return { ok: true, value: { name, email, phone, street_address: street, city, postal_code: zip, apartment, floor, entrance, isDefault: b.isDefault === true } };
}
