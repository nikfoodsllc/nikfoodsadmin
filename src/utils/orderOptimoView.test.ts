import { describe, expect, it } from 'vitest';
import { orderOptimoView } from './orderOptimoView';

describe('orderOptimoView', () => {
  it('shows a dash when nothing was sent', () => {
    expect(orderOptimoView(undefined)).toMatchObject({ label: '-', tone: 'none' });
    expect(orderOptimoView(null)).toMatchObject({ label: '-', tone: 'none' });
    expect(orderOptimoView({})).toMatchObject({ label: '-', tone: 'none' });
  });

  it('shows In OptimoRoute (green) with the delivery days for sent and adopted stops', () => {
    const v = orderOptimoView({ state: 'sent', stops: [{ date: '2026-10-09', result: 'sent', orderNo: 'ORD-1-1009' }, { date: '2026-10-15', result: 'adopted' }] });
    expect(v).toMatchObject({ label: 'In OptimoRoute', tone: 'good', detail: 'Oct 9 · Oct 15' });
    expect(v.title).toContain('ORD-1-1009');
    expect(v.title).toContain('already there');
  });

  it('treats a stop shared with another order as in OptimoRoute', () => {
    expect(orderOptimoView({ state: 'sent', stops: [{ date: '2026-10-09', result: 'already' }] }).label).toBe('In OptimoRoute');
  });

  it('shows Failed (red) with the error and retry note', () => {
    const v = orderOptimoView({ state: 'failed', stops: [{ date: '2026-10-09', result: 'failed', error: 'ERR_LOC_GEOCODING address not found' }] });
    expect(v).toMatchObject({ label: 'Failed', tone: 'bad', detail: 'Oct 9' });
    expect(v.title).toContain('ERR_LOC_GEOCODING');
    expect(v.title).toContain('30 minutes');
  });

  it('shows Remove failed (red) before anything else', () => {
    const v = orderOptimoView({ state: 'failed', stops: [{ date: '2026-10-09', result: 'remove_failed', error: 'ERR_OPT_RUNNING' }, { date: '2026-10-15', result: 'sent' }] });
    expect(v).toMatchObject({ label: 'Remove failed', tone: 'bad' });
    expect(v.title).toContain('by hand');
  });

  it('shows Removed (amber) for a cancelled or refunded order', () => {
    expect(orderOptimoView({ state: 'removed', stops: [{ date: '2026-10-09', result: 'removed' }] })).toMatchObject({ label: 'Removed', tone: 'warn', detail: 'Oct 9' });
  });

  it('never throws on odd data', () => {
    expect(orderOptimoView({ state: 'sent', stops: [null as never, { date: 'x', result: 'sent' }] }).label).toBe('In OptimoRoute');
    expect(orderOptimoView({ state: 'weird', stops: [] }).tone).toBe('warn');
  });
});

import { OPTIMO_FILTER_OPTIONS, optimoFilterFor } from './orderOptimoView';

describe('optimoFilterFor', () => {
  it('maps each choice to the matching database filter', () => {
    expect(optimoFilterFor('in')).toEqual({ 'optimo.state': 'sent' });
    expect(optimoFilterFor('failed')).toEqual({ 'optimo.state': 'failed' });
    expect(optimoFilterFor('removed')).toEqual({ 'optimo.state': 'removed' });
    expect(optimoFilterFor('none')).toEqual({ optimo: { $exists: false } });
  });

  it('means no filter for all, nothing or an unknown word', () => {
    for (const v of ['all', '', undefined, null, 'x', '$ne']) expect(optimoFilterFor(v as never)).toBeNull();
  });

  it('every dropdown choice is handled', () => {
    for (const o of OPTIMO_FILTER_OPTIONS) if (o.value !== 'all') expect(optimoFilterFor(o.value)).not.toBeNull();
  });
});
