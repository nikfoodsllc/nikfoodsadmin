import { describe, expect, it } from 'vitest';
import { passwordProblem } from './passwordRules';

describe('passwordProblem', () => {
  it('allows simple passwords of 8 or more characters', () => {
    expect(passwordProblem('password')).toBeNull();
    expect(passwordProblem('12345678')).toBeNull();
    expect(passwordProblem('correct horse-battery.staple?')).toBeNull();
    expect(passwordProblem('pässwörd1')).toBeNull();
  });

  it('refuses short, empty and blank passwords', () => {
    expect(passwordProblem('abcdefg')).toBe('Password must be at least 8 characters long');
    expect(passwordProblem('')).toBe('Password is required');
    expect(passwordProblem('        ')).toBe('Password is required');
    expect(passwordProblem(undefined)).toBe('Password is required');
    expect(passwordProblem(12345678)).toBe('Password is required');
  });

  it('counts bytes, not characters, against the 72 limit', () => {
    expect(passwordProblem('a'.repeat(72))).toBeNull();
    expect(passwordProblem('a'.repeat(73))).toBe('Password is too long');
    expect(passwordProblem('😀'.repeat(19))).toBe('Password is too long');
  });
});
