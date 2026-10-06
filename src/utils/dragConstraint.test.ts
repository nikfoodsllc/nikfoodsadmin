import { describe, expect, it } from 'vitest';
import { constrainTransform } from './dragConstraint';

const item = { left: 300, top: 100, width: 250, height: 96 };
const row = { left: 100, top: 90, right: 1100, bottom: 200 };
const column = { left: 300, top: 100, right: 550, bottom: 484 };

describe('constrainTransform', () => {
  it('removes movement on the other axis', () => {
    expect(constrainTransform('translate(120px, 45px)', 'x', item, null)).toBe('translate(120px, 0px)');
    expect(constrainTransform('translate(120px, 45px)', 'y', item, null)).toBe('translate(0px, 45px)');
  });

  it('glues the item to its row / column on the other axis, even if the container has scrolled away from where it started', () => {
    expect(constrainTransform('translate(60px, 300px)', 'x', item, row)).toBe('translate(60px, -10px)'); // row top is 10px above the start
    expect(constrainTransform('translate(300px, 96px)', 'y', item, column)).toBe('translate(0px, 96px)'); // column left == start left
    const scrolledColumn = { ...column, left: 280, right: 530 }; // the table scrolled 20px sideways during the drag
    expect(constrainTransform('translate(0px, 96px)', 'y', item, scrolledColumn)).toBe('translate(-20px, 96px)');
  });

  it('keeps a sideways drag inside the row (left and right edges)', () => {
    expect(constrainTransform('translate(-900px, 10px)', 'x', item, row)).toBe('translate(-200px, -10px)'); // left edge at 100
    expect(constrainTransform('translate(900px, 0px)', 'x', item, row)).toBe('translate(550px, -10px)'); // right edge at 1100
    expect(constrainTransform('translate(50px, 0px)', 'x', item, row)).toBe('translate(50px, -10px)'); // inside: only aligned
  });

  it('keeps an up/down drag inside its column (top and bottom edges)', () => {
    expect(constrainTransform('translate(40px, -500px)', 'y', item, column)).toBe('translate(0px, 0px)'); // already at the top
    expect(constrainTransform('translate(0px, 900px)', 'y', item, column)).toBe('translate(0px, 288px)'); // bottom at 484
    expect(constrainTransform('translate(0px, 96px)', 'y', item, column)).toBe('translate(0px, 96px)');
  });

  it('handles decimals and negative zero-ish values', () => {
    expect(constrainTransform('translate(12.5px, -3.25px)', 'x', item, null)).toBe('translate(12.5px, 0px)');
  });

  it('leaves values it does not understand alone', () => {
    expect(constrainTransform(undefined, 'x', item, row)).toBeUndefined();
    expect(constrainTransform('none', 'x', item, row)).toBe('none');
    expect(constrainTransform('translate3d(5px, 5px, 0)', 'x', item, row)).toBe('translate3d(5px, 5px, 0)');
  });

  it('a container smaller than the item pins it to the start edge instead of failing', () => {
    expect(constrainTransform('translate(80px, 0px)', 'x', item, { left: 300, top: 100, right: 400, bottom: 110 })).toBe(
      'translate(0px, 0px)',
    );
  });
});
