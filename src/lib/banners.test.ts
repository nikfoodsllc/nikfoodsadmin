import { describe, it, expect } from 'vitest';
import { bannerStatus, moveId, validateBanner } from './banners';

const base = { imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg' };

describe('validateBanner', () => {
  it('accepts a picture alone and fills defaults', () => {
    const r = validateBanner(base);
    expect(r.ok && r.value).toMatchObject({ title: '', subtitle: '', linkType: 'none', categoryId: '', url: '', active: true, startsAt: null, endsAt: null });
  });
  it('needs a picture that is a secure address', () => {
    expect(validateBanner({}).ok).toBe(false);
    expect(validateBanner({ imageUrl: 'http://x.com/a.jpg' }).ok).toBe(false);
    expect(validateBanner({ imageUrl: 'javascript:alert(1)' }).ok).toBe(false);
  });
  it('limits the words', () => {
    expect(validateBanner({ ...base, title: 'x'.repeat(61) }).ok).toBe(false);
    expect(validateBanner({ ...base, subtitle: 'x'.repeat(101) }).ok).toBe(false);
    expect(validateBanner({ ...base, title: 'x'.repeat(60), subtitle: 'y'.repeat(100) }).ok).toBe(true);
  });
  it('a category link needs a category id, a web link needs https', () => {
    expect(validateBanner({ ...base, linkType: 'category' }).ok).toBe(false);
    expect(validateBanner({ ...base, linkType: 'category', categoryId: '65f1a2b3c4d5e6f7a8b9c0d1' }).ok).toBe(true);
    expect(validateBanner({ ...base, linkType: 'url', url: 'http://x.com' }).ok).toBe(false);
    expect(validateBanner({ ...base, linkType: 'url', url: 'https://nikfoods.com/offer' }).ok).toBe(true);
  });
  it('drops the link fields that do not belong to the chosen type', () => {
    const r = validateBanner({ ...base, linkType: 'none', categoryId: '65f1a2b3c4d5e6f7a8b9c0d1', url: 'https://x.com' });
    expect(r.ok && r.value.categoryId).toBe('');
    expect(r.ok && r.value.url).toBe('');
  });
  it('checks the dates', () => {
    expect(validateBanner({ ...base, startsAt: 'nonsense' }).ok).toBe(false);
    expect(validateBanner({ ...base, startsAt: '2026-10-22T00:00:00Z', endsAt: '2026-10-21T00:00:00Z' }).ok).toBe(false);
    const r = validateBanner({ ...base, startsAt: '2026-10-21T00:00:00Z', endsAt: '2026-10-22T00:00:00Z' });
    expect(r.ok && r.value.startsAt instanceof Date && r.value.endsAt instanceof Date).toBe(true);
  });
  it('off stays off', () => {
    const r = validateBanner({ ...base, active: false });
    expect(r.ok && r.value.active).toBe(false);
  });
});

describe('bannerStatus', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  it('tells live, scheduled, ended and off', () => {
    expect(bannerStatus({}, now)).toBe('live');
    expect(bannerStatus({ active: false }, now)).toBe('off');
    expect(bannerStatus({ startsAt: '2026-10-22T00:00:00Z' }, now)).toBe('scheduled');
    expect(bannerStatus({ endsAt: '2026-10-20T00:00:00Z' }, now)).toBe('ended');
    expect(bannerStatus({ startsAt: '2026-10-20T00:00:00Z', endsAt: '2026-10-22T00:00:00Z' }, now)).toBe('live');
    expect(bannerStatus({ active: false, startsAt: '2026-10-22T00:00:00Z' }, now)).toBe('off');
  });
});

describe('moveId', () => {
  it('moves one banner to a place', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'c', 0)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 3)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveId(['a', 'b'], 'b', 99)).toEqual(['a', 'b']);
    expect(moveId(['a', 'b'], 'zzz', 0)).toEqual(['a', 'b']);
  });
});
