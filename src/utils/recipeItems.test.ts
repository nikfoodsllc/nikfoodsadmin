import { describe, expect, it } from 'vitest';
import { amountForLine, amountLabel, cleanRecipeLines, expandRecipeRows, isRecipeUnit, isUsableAmount, normalizeRecipeUnit, recipeFoodIds, recipeLinesProblem, type RecipeUnit } from './recipeItems';
import { buildItemOrders, buildKitchenDays, type KitchenRow } from './kitchenDashboard';

const id = (n: number) => n.toString(16).padStart(24, '0');
const BIRYANI = id(1);
const RAITA = id(2);
const CHUTNEY = id(3);
const row = (over: Partial<KitchenRow>): KitchenRow => ({ orderId: 'ORD-1', day: '2026-11-13', name: 'Veg Biryani', foodId: BIRYANI, quantity: 1, customerName: 'Asha', ...over });
const recipes = new Map<string, { name: string; unit?: RecipeUnit }>([[RAITA, { name: 'Raita', unit: 'oz' }], [CHUTNEY, { name: 'Mint Chutney', unit: 'oz' }]]);

describe('units', () => {
  it('knows the five units, and an old recipe item without one is in ounces', () => {
    for (const u of ['oz', 'lb', 'g', 'kg', 'pc']) expect(isRecipeUnit(u)).toBe(true);
    expect(isRecipeUnit('cup')).toBe(false);
    expect(normalizeRecipeUnit(undefined)).toBe('oz');
    expect(normalizeRecipeUnit('lb')).toBe('lb');
    expect(normalizeRecipeUnit('cup')).toBe('oz');
  });
  it('turns an amount and a unit into the size label the reports add up', () => {
    expect(amountLabel(4, 'oz')).toBe('4Oz');
    expect(amountLabel(0.5, 'lb')).toBe('0.5Lb');
    expect(amountLabel(100, 'g')).toBe('100g');
    expect(amountLabel(2, 'kg')).toBe('2Kg');
    expect(amountLabel(3, 'pc')).toBe('3Pc');
    expect(amountLabel(0.333, 'oz')).toBe('0.33Oz');
  });
});

describe('cleanRecipeLines', () => {
  it('keeps real lines with number amounts (also typed as text), and drops the rest', () => {
    const lines = cleanRecipeLines([
      { recipeItemId: RAITA.toUpperCase(), amount: 2, bySize: { '16Oz': 4, '12Oz': '3', '8Oz': 'lots', ' ': 1, '4Oz': 0, '2Oz': -1 } },
      { recipeItemId: RAITA, amount: 9 }, // the same recipe item twice
      { recipeItemId: 'nope', amount: 1 },
      { recipeItemId: CHUTNEY },
      { recipeItemId: CHUTNEY, amount: 'a lot' },
      { recipeItemId: CHUTNEY, amount: 1.256 },
    ]);
    expect(lines).toEqual([{ recipeItemId: RAITA, amount: 2, bySize: { '16Oz': 4, '12Oz': 3 } }, { recipeItemId: CHUTNEY, amount: 1.26 }]);
  });
  it('is empty for anything else', () => {
    expect(cleanRecipeLines(undefined)).toEqual([]);
    expect(cleanRecipeLines('x')).toEqual([]);
    expect(cleanRecipeLines({})).toEqual([]);
  });
  it('knows a usable amount', () => {
    for (const ok of [4, 0.5, 100, '2', '0.25']) expect(isUsableAmount(ok)).toBe(true);
    for (const bad of ['', 'lots', null, 0, -2, '0', 20000, NaN]) expect(isUsableAmount(bad)).toBe(false);
  });
});

describe('amountForLine', () => {
  const line = { recipeItemId: RAITA, amount: 2, bySize: { '16Oz': 4, '12Oz': 3 } };
  it('takes the amount of the ordered size, ignoring case and spaces', () => {
    expect(amountForLine(line, '16Oz')).toBe(4);
    expect(amountForLine(line, ' 12oz ')).toBe(3);
  });
  it('falls back to the default amount for another size or no size', () => {
    expect(amountForLine(line, '8Oz')).toBe(2);
    expect(amountForLine(line, null)).toBe(2);
  });
  it('is null when nothing is set for it', () => {
    expect(amountForLine({ recipeItemId: RAITA, bySize: { '16Oz': 4 } }, '8Oz')).toBeNull();
  });
});

describe('expandRecipeRows', () => {
  const lines = new Map([[BIRYANI, cleanRecipeLines([{ recipeItemId: RAITA, bySize: { '16Oz': 4, '12Oz': 3 } }, { recipeItemId: CHUTNEY, amount: 1 }])]]);

  it('adds one line per recipe item, in the amount of the size ordered, for the quantity ordered', () => {
    const out = expandRecipeRows([row({ quantity: 3, portion: '16Oz' })], lines, recipes);
    expect(out).toHaveLength(3);
    const raita = out.find((r) => r.name === 'Raita')!;
    expect(raita).toMatchObject({ foodId: RAITA, quantity: 3, portion: '4Oz', recipeOf: 'Veg Biryani', orderId: 'ORD-1', customerName: 'Asha', isEco: false });
    expect(out.find((r) => r.name === 'Mint Chutney')).toMatchObject({ quantity: 3, portion: '1Oz', recipeOf: 'Veg Biryani' });
  });
  it('uses the unit of the recipe item: pounds, grams, pieces', () => {
    const units = new Map<string, { name: string; unit: RecipeUnit }>([[RAITA, { name: 'Raita', unit: 'lb' }], [CHUTNEY, { name: 'Mint Chutney', unit: 'pc' }]]);
    const out = expandRecipeRows([row({ portion: '16Oz' })], new Map([[BIRYANI, cleanRecipeLines([{ recipeItemId: RAITA, bySize: { '16Oz': 0.5 } }, { recipeItemId: CHUTNEY, amount: 2 }])]]), units);
    expect(out.find((r) => r.name === 'Raita')!.portion).toBe('0.5Lb');
    expect(out.find((r) => r.name === 'Mint Chutney')!.portion).toBe('2Pc');
  });
  it('a recipe item with no unit saved counts in ounces', () => {
    const out = expandRecipeRows([row({ portion: '16Oz' })], lines, new Map([[RAITA, { name: 'Raita' }]]));
    expect(out.find((r) => r.name === 'Raita')!.portion).toBe('4Oz');
  });
  it('skips a recipe whose size has no amount, and a recipe item that no longer exists', () => {
    const out = expandRecipeRows([row({ portion: '8Oz' })], lines, new Map([[CHUTNEY, { name: 'Mint Chutney', unit: 'oz' as RecipeUnit }]]));
    expect(out.map((r) => r.name)).toEqual(['Veg Biryani', 'Mint Chutney']);
  });
  it('does nothing for items without a recipe, and does not change its input', () => {
    const rows = [row({ foodId: id(9) })];
    expect(expandRecipeRows(rows, lines, recipes)).toBe(rows);
    const own = [row({ portion: '12Oz' })];
    expandRecipeRows(own, lines, recipes);
    expect(own).toHaveLength(1);
  });
  it('follows the items picked inside a combo (quantity per combo and the size of the part)', () => {
    const combo = row({
      name: 'Biryani Combo',
      foodId: id(7),
      quantity: 2,
      sections: [{ _id: 's1', selectedItems: [{ _id: 'o1', portion: '12Oz', quantity: 2, item: { _id: BIRYANI, name: 'Veg Biryani' } }] }],
      comboSelections: { s1: ['o1'] },
    });
    const out = expandRecipeRows([combo], lines, recipes);
    const raita = out.find((r) => r.name === 'Raita')!;
    expect(raita).toMatchObject({ quantity: 4, portion: '3Oz', recipeOf: 'Veg Biryani' }); // 2 combos x 2 biryanis, 12Oz -> 3
    expect(raita.sections).toBeNull();
  });
  it('lists the item ids that may have recipes', () => {
    const combo = row({ foodId: id(7), sections: [{ _id: 's1', selectedItems: [{ _id: 'o1', item: { _id: BIRYANI, name: 'Veg Biryani' } }] }], comboSelections: { s1: ['o1'] } });
    expect(recipeFoodIds([combo, row({ foodId: RAITA }), row({ foodId: null })]).sort()).toEqual([BIRYANI, RAITA].sort());
  });
});

describe('recipe lines in the kitchen counts', () => {
  const lines = new Map([[BIRYANI, cleanRecipeLines([{ recipeItemId: RAITA, bySize: { '16Oz': 4, '12Oz': 3 } }])]]);
  const rows = expandRecipeRows(
    [row({ orderId: 'A', quantity: 2, portion: '16Oz' }), row({ orderId: 'B', quantity: 1, portion: '12Oz', customerName: 'Ben' })],
    lines,
    recipes
  );
  it('counts the recipe item like any item with its size totals, and leaves it out of the units sold', () => {
    const day = buildKitchenDays(rows, ['2026-11-13'])[0];
    const raita = day.items.find((i) => i.name === 'Raita')!;
    expect(raita.quantity).toBe(3);
    expect(raita.portions.map((p) => [p.label, p.quantity])).toEqual(expect.arrayContaining([['4Oz', 2], ['3Oz', 1]]));
    expect(raita.totalText).toBe('11 oz (0.69 lb)'); // 2 x 4oz + 1 x 3oz
    expect(day.totals.units).toBe(3); // 3 biryanis sold; the 3 raitas are not dishes sold
    expect(day.totals.orders).toBe(2);
  });
  it('traces the recipe item to the item it goes with', () => {
    const lines2 = buildItemOrders(rows, 'Raita');
    expect(lines2.map((l) => [l.orderId, l.quantity, l.portion, l.viaCombo])).toEqual(expect.arrayContaining([['A', 2, '4Oz', 'Veg Biryani'], ['B', 1, '3Oz', 'Veg Biryani']]));
  });
});

describe('recipeLinesProblem', () => {
  it('an item without sizes needs a usable amount on every line', () => {
    expect(recipeLinesProblem([], false)).toBeNull();
    expect(recipeLinesProblem(undefined, false)).toBeNull();
    expect(recipeLinesProblem([{ recipeItemId: RAITA, amount: 4 }], false)).toBeNull();
    expect(recipeLinesProblem([{ recipeItemId: RAITA }], false)).toMatch(/amount/);
    expect(recipeLinesProblem([{ recipeItemId: RAITA, amount: 0 }], false)).toMatch(/numbers above 0/);
  });
  it('a sized item needs a usable amount for at least one size, and every filled size must be usable', () => {
    expect(recipeLinesProblem([{ recipeItemId: RAITA, bySize: { '16Oz': 4 } }], true)).toBeNull();
    expect(recipeLinesProblem([{ recipeItemId: RAITA, bySize: {} }], true)).toMatch(/at least one size/);
    expect(recipeLinesProblem([{ recipeItemId: RAITA, bySize: { '16Oz': 4, '12Oz': -3 } }], true)).toMatch(/numbers above 0/);
  });
});
