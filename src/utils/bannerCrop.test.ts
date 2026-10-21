import { describe, expect, it } from 'vitest';
import { clampPosition, frameSize, outputSize, resizeAroundCentre } from './bannerCrop';

describe('bannerCrop', () => {
  it('fills the width of a picture that is wider than the shape, and the height of one that is taller', () => {
    expect(frameSize(2000, 1000, 2, 1)).toEqual({ width: 2000, height: 1000 });
    expect(frameSize(1000, 1000, 2, 1)).toEqual({ width: 1000, height: 500 });
    expect(frameSize(3000, 1000, 2, 1)).toEqual({ width: 2000, height: 1000 });
  });
  it('zooming makes the frame smaller, never past 4x or below 1x', () => {
    expect(frameSize(2000, 1000, 2, 2).width).toBe(1000);
    expect(frameSize(2000, 1000, 2, 99).width).toBe(500);
    expect(frameSize(2000, 1000, 2, 0.2).width).toBe(2000);
    expect(frameSize(2000, 1000, 2, NaN).width).toBe(2000);
  });
  it('keeps the frame inside the picture', () => {
    const size = { width: 1000, height: 500 };
    expect(clampPosition(2000, 1000, size, -50, 900)).toEqual({ x: 0, y: 500 });
    expect(clampPosition(2000, 1000, size, 5000, -1)).toEqual({ x: 1000, y: 0 });
    expect(clampPosition(1000, 500, { width: 1000, height: 500 }, 40, 40)).toEqual({ x: 0, y: 0 });
  });
  it('a new shape or zoom keeps the centre', () => {
    const first = resizeAroundCentre(2000, 1000, null, 2, 2);
    expect(first).toEqual({ x: 500, y: 250, width: 1000, height: 500 });
    const moved = { x: 1000, y: 500, width: 1000, height: 500 };
    const zoomed = resizeAroundCentre(2000, 1000, moved, 2, 4);
    expect(zoomed.x + zoomed.width / 2).toBe(1500);
    expect(zoomed.y + zoomed.height / 2).toBe(750);
  });
  it('a new frame that would stick out is pulled back in', () => {
    const corner = { x: 1500, y: 750, width: 500, height: 250 };
    expect(resizeAroundCentre(2000, 1000, corner, 2, 1)).toEqual({ x: 0, y: 0, width: 2000, height: 1000 });
  });
  it('the uploaded picture is at most 1600 wide and keeps the shape', () => {
    expect(outputSize({ x: 0, y: 0, width: 3200, height: 1600 })).toEqual({ width: 1600, height: 800 });
    expect(outputSize({ x: 0, y: 0, width: 800, height: 450 })).toEqual({ width: 800, height: 450 });
  });
});
