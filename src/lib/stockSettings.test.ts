import { describe, expect, it } from 'vitest';
import { stockFieldsForCreate, stockFieldsForUpdate, stockUnitProblem } from './stockSettings';

const now = new Date('2026-10-29T20:00:00Z');

describe('stock settings of a new item', () => {
  it('nothing when no limit is given', () => {
    expect(stockFieldsForCreate({}, now)).toEqual({});
    expect(stockFieldsForCreate({ stockThreshold: null }, now)).toEqual({});
    expect(stockFieldsForCreate({ stockThreshold: 0 }, now)).toEqual({});
  });
  it('a limit starts the count now', () => {
    expect(stockFieldsForCreate({ stockThreshold: 50 }, now)).toEqual({ stockThreshold: 50, stockUnit: 'units', stockResetAt: now, stockResetMode: 'manual' });
    expect(stockFieldsForCreate({ stockThreshold: 20, stockResetMode: 'daily', stockResetTime: '03:00' }, now)).toEqual({ stockThreshold: 20, stockUnit: 'units', stockResetAt: now, stockResetMode: 'daily', stockResetTime: '03:00' });
    // daily without a time is manual
    expect(stockFieldsForCreate({ stockThreshold: 20, stockResetMode: 'daily' }, now)).toMatchObject({ stockResetMode: 'manual' });
  });
});

describe('stock settings of an existing item', () => {
  it('leaves everything alone when nothing was sent', () => {
    expect(stockFieldsForUpdate({ stockThreshold: 10 }, {}, now)).toEqual({ set: {}, log: [] });
  });
  it('setting a limit where there was none starts the count and is logged', () => {
    const r = stockFieldsForUpdate({}, { stockThreshold: 30 }, now);
    expect(r.set).toMatchObject({ stockThreshold: 30, stockResetAt: now });
    expect(r.log).toEqual([{ kind: 'limit_set', to: '30' }]);
  });
  it('changing the number keeps the count going (no new start) and is logged', () => {
    const r = stockFieldsForUpdate({ stockThreshold: 30 }, { stockThreshold: 40 }, now);
    expect(r.set).toEqual({ stockThreshold: 40, stockUnit: 'units' });
    expect(r.log).toEqual([{ kind: 'limit_changed', from: '30', to: '40' }]);
  });
  it('the same number again does nothing', () => {
    const r = stockFieldsForUpdate({ stockThreshold: 30 }, { stockThreshold: 30 }, now);
    expect(r.log).toEqual([]);
  });
  it('removing the limit is logged', () => {
    const r = stockFieldsForUpdate({ stockThreshold: 30 }, { stockThreshold: null }, now);
    expect(r.set.stockThreshold).toBeNull();
    expect(r.log).toEqual([{ kind: 'limit_removed', from: '30' }]);
  });
  it('switching to a daily reset time is saved and logged', () => {
    const r = stockFieldsForUpdate({ stockThreshold: 30, stockResetMode: 'manual' }, { stockResetMode: 'daily', stockResetTime: '03:30' }, now);
    expect(r.set).toMatchObject({ stockResetMode: 'daily', stockResetTime: '03:30' });
    expect(r.log).toEqual([{ kind: 'reset_mode_changed', from: 'manual', to: 'daily at 03:30' }]);
  });
  it('daily without a valid time falls back to manual', () => {
    const r = stockFieldsForUpdate({ stockThreshold: 30 }, { stockResetMode: 'daily', stockResetTime: 'x' }, now);
    expect(r.set).toMatchObject({ stockResetMode: 'manual', stockResetTime: null });
  });
});

describe('limits in pounds and ounces', () => {
  it('a new item can have a limit in pounds', () => {
    expect(stockFieldsForCreate({ stockThreshold: 40, stockUnit: 'lb' }, now)).toMatchObject({ stockThreshold: 40, stockUnit: 'lb' });
    expect(stockFieldsForCreate({ stockThreshold: 0.1, stockUnit: 'lb' }, now)).toEqual({});
  });
  it('setting a limit in pounds is logged with the unit', () => {
    const r = stockFieldsForUpdate({}, { stockThreshold: 40, stockUnit: 'lb' }, now);
    expect(r.log).toEqual([{ kind: 'limit_set', to: '40 lb' }]);
    expect(r.set).toMatchObject({ stockThreshold: 40, stockUnit: 'lb', stockResetAt: now });
  });
  it('changing the unit starts the count again (the old amounts do not fit the new unit)', () => {
    const r = stockFieldsForUpdate({ stockThreshold: 30, stockUnit: 'units' }, { stockThreshold: 20, stockUnit: 'lb' }, now);
    expect(r.set).toMatchObject({ stockThreshold: 20, stockUnit: 'lb', stockResetAt: now });
    expect(r.log).toEqual([{ kind: 'unit_changed', from: '30', to: '20 lb' }]);
  });
  it('pounds and ounces need an item with sizes', () => {
    expect(stockUnitProblem({ stockThreshold: 40, stockUnit: 'lb' }, false)).toMatch(/needs an item with sizes/);
    expect(stockUnitProblem({ stockThreshold: 40, stockUnit: 'lb' }, true)).toBeNull();
    expect(stockUnitProblem({ stockThreshold: 40, stockUnit: 'units' }, false)).toBeNull();
    expect(stockUnitProblem({ stockUnit: 'oz' }, false)).toBeNull();
  });
});
