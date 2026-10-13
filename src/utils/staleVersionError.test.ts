import { describe, expect, it } from 'vitest';
import { isStaleVersionError, mayAutoReload } from './staleVersionError';

describe('isStaleVersionError', () => {
  it('recognises the errors a page gets after a new version went live', () => {
    expect(isStaleVersionError({ name: 'ChunkLoadError', message: 'Loading chunk 123 failed.' })).toBe(true);
    expect(isStaleVersionError({ message: 'Failed to fetch dynamically imported module: https://x/_next/static/a.js' })).toBe(true);
    expect(isStaleVersionError({ message: 'error loading dynamically imported module' })).toBe(true);
    expect(isStaleVersionError({ message: "Unexpected token '<'" })).toBe(true);
  });
  it('leaves real errors alone', () => {
    expect(isStaleVersionError({ name: 'TypeError', message: "Cannot read properties of undefined (reading 'rows')" })).toBe(false);
    expect(isStaleVersionError(null)).toBe(false);
    expect(isStaleVersionError(undefined)).toBe(false);
  });
});

describe('mayAutoReload', () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it('reloads once, then not again for a minute', () => {
    const s = store();
    expect(mayAutoReload(s, 1_000_000)).toBe(true);
    expect(mayAutoReload(s, 1_030_000)).toBe(false);
    expect(mayAutoReload(s, 1_061_000)).toBe(true);
  });
  it('never reloads when storage cannot be used (no loop)', () => {
    expect(mayAutoReload({ getItem: () => { throw new Error('blocked'); }, setItem: () => undefined })).toBe(false);
    expect(mayAutoReload(null)).toBe(true);
  });
});
