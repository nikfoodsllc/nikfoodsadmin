import { describe, expect, it } from 'vitest';
import { verticalPassthroughAmount } from './wheelPassthrough';

const w = (deltaX: number, deltaY: number, deltaMode = 0, ctrlKey = false) => ({ deltaX, deltaY, deltaMode, ctrlKey });

describe('verticalPassthroughAmount', () => {
  it('passes a mostly vertical gesture to the page, even with a small sideways part', () => {
    expect(verticalPassthroughAmount(w(0, 120), 800)).toBe(120);
    expect(verticalPassthroughAmount(w(8, 120), 800)).toBe(120);
    expect(verticalPassthroughAmount(w(-30, -90), 800)).toBe(-90);
  });
  it('leaves sideways and equal gestures to the scroll area', () => {
    expect(verticalPassthroughAmount(w(120, 0), 800)).toBeNull();
    expect(verticalPassthroughAmount(w(120, 30), 800)).toBeNull();
    expect(verticalPassthroughAmount(w(50, 50), 800)).toBeNull();
    expect(verticalPassthroughAmount(w(0, 0), 800)).toBeNull();
  });
  it('ignores pinch-zoom (ctrl + wheel)', () => {
    expect(verticalPassthroughAmount(w(0, 100, 0, true), 800)).toBeNull();
  });
  it('converts line and page units to pixels', () => {
    expect(verticalPassthroughAmount(w(0, 3, 1), 800)).toBe(48);
    expect(verticalPassthroughAmount(w(0, 1, 2), 800)).toBe(800);
  });
});
