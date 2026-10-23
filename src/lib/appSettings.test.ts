import { describe, expect, it } from 'vitest';
import { cleanHomeIntro, HOME_INTRO_MAX } from './appSettings';

describe('cleanHomeIntro', () => {
  it('trims and puts the text on one line', () => {
    expect(cleanHomeIntro('  Happy   Diwali,\n {name}!  ')).toEqual({ ok: true, value: 'Happy Diwali, {name}!' });
  });
  it('treats missing or blank as "use the usual greeting"', () => {
    expect(cleanHomeIntro(undefined)).toEqual({ ok: true, value: '' });
    expect(cleanHomeIntro('   ')).toEqual({ ok: true, value: '' });
  });
  it('refuses long or non-text input', () => {
    expect(cleanHomeIntro('x'.repeat(HOME_INTRO_MAX + 1)).ok).toBe(false);
    expect(cleanHomeIntro('x'.repeat(HOME_INTRO_MAX)).ok).toBe(true);
    expect(cleanHomeIntro(5).ok).toBe(false);
  });
});
