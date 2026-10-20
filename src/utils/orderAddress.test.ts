import { describe, expect, it } from 'vitest';
import { addressFormChanged, addressFormProblem, canEditAddress, routeNote, type AddressForm } from './orderAddress';

const form: AddressForm = { street: '400 Broad St', apartment: '12A', city: 'Seattle', zipCode: '98109', entrance: '1234', floor: 'Leave at desk' };

describe('order address form', () => {
  it('allows only orders still to be delivered', () => {
    expect(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].every(canEditAddress)).toBe(true);
    expect(canEditAddress('delivered')).toBe(false);
    expect(canEditAddress('cancelled')).toBe(false);
    expect(canEditAddress(undefined)).toBe(false);
  });
  it('names what is missing', () => {
    expect(addressFormProblem(form)).toBe('');
    expect(addressFormProblem({ ...form, street: ' ' })).toMatch(/street/);
    expect(addressFormProblem({ ...form, city: '' })).toMatch(/city/);
    expect(addressFormProblem({ ...form, zipCode: '9810' })).toMatch(/zip/);
    expect(addressFormProblem({ ...form, floor: 'x'.repeat(31) })).toMatch(/30/);
  });
  it('ignores case and spacing when comparing', () => {
    expect(addressFormChanged(form, { ...form, street: '400  BROAD st' })).toBe(false);
    expect(addressFormChanged(form, { ...form, apartment: '' })).toBe(true);
  });
  it('describes the route planner result', () => {
    expect(routeNote({ mode: 'on', updated: 2, recreated: 0, failed: 0 })).toEqual({ text: 'Address saved and updated in OptimoRoute.', warn: false });
    expect(routeNote({ mode: 'on', updated: 0, recreated: 0, failed: 0 }).text).toMatch(/No upcoming/);
    expect(routeNote({ mode: 'on', failed: 1 }).warn).toBe(true);
    expect(routeNote({ mode: 'timeout' }).warn).toBe(true);
    expect(routeNote({ mode: 'off' }).warn).toBe(false);
    expect(routeNote(undefined).warn).toBe(false);
  });
});
