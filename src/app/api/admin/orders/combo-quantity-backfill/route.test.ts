import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- mocks: no real database or secrets needed
const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));

const orderRows: unknown[] = [];
const updateOne = vi.fn();
const insertOne = vi.fn();
const comboDocs: unknown[] = [];
vi.mock('@/lib/db', () => ({
  db: {
    getDb: async () => ({
      collection: (name: string) =>
        name === 'orders'
          ? { find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => orderRows }) }) }), updateOne }
          : name === 'fooditems'
            ? { find: () => ({ toArray: async () => comboDocs }) }
            : { insertOne },
    }),
  },
}));

import { POST } from './route';

const OID = 'aaaaaaaaaaaaaaaaaaaaaaaa'; // the combo
const order = {
  orderId: 'ORD-1', status: 'confirmed', paymentStatus: 'paid',
  items: [{ deliveryDate: '2099-10-15', items: [{ food: { _id: OID, name: 'Veg Combo', hasCombo: true, sections: [{ _id: 's3', title: 'Staple', selectedItems: [{ item: { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb' } }] }] } }] }],
};

function req(opts: { body?: unknown; token?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? 'good'}`;
  return new NextRequest('http://localhost/api/admin/orders/combo-quantity-backfill', { method: 'POST', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) => (t === 'good' ? { success: true, payload: { userId: 'admin-1', role: 'admin' } } : t === 'user' ? { success: true, payload: { userId: 'u9', role: 'user' } } : { success: false, error: 'bad' }));
  orderRows.length = 0;
  orderRows.push(JSON.parse(JSON.stringify(order)));
  comboDocs.length = 0;
  comboDocs.push({ _id: OID, sections: [{ _id: 's3', title: 'Staple', selectedItems: [{ item: 'bbbbbbbbbbbbbbbbbbbbbbbb', quantity: 4 }] }] });
  updateOne.mockResolvedValue({ modifiedCount: 1 });
  insertOne.mockResolvedValue({});
});

describe('combo quantity backfill route', () => {
  it('needs an admin', async () => {
    expect((await POST(req({ token: null }))).status).toBe(401);
    expect((await POST(req({ token: 'bad' }))).status).toBe(401);
    expect((await POST(req({ token: 'user' }))).status).toBe(401);
  });
  it('refuses an impossible date', async () => {
    expect((await POST(req({ body: { fromDate: '2026-13-40' } }))).status).toBe(400);
  });
  it('a request with no body is a dry run: it reports and writes nothing', async () => {
    const res = await POST(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toMatchObject({ dryRun: true, ordersChecked: 1, ordersToChange: 1, optionsToChange: 1, orderIds: ['ORD-1'] });
    expect(updateOne).not.toHaveBeenCalled();
    expect(insertOne).not.toHaveBeenCalled();
  });
  it('only an explicit dryRun false writes, guarded by the food item id, and keeps a record', async () => {
    const json = await (await POST(req({ body: { dryRun: false } }))).json();
    expect(json.data.applied).toEqual({ orders: 1, options: 1, skipped: [] });
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter.orderId).toBe('ORD-1');
    // the write only happens where the same food item is still in that place (stored as text or as an id object)
    expect(filter['items.0.items.0.food.sections.0.selectedItems.0.item._id'].$in.map(String)).toEqual(['bbbbbbbbbbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbbbbbbbbbb']);
    expect(update).toEqual({ $set: { 'items.0.items.0.food.sections.0.selectedItems.0.quantity': 4 } });
    expect(insertOne).toHaveBeenCalledTimes(1);
  });
  it('an order that changed in the meantime is skipped, not forced', async () => {
    updateOne.mockResolvedValue({ modifiedCount: 0 });
    const json = await (await POST(req({ body: { dryRun: false } }))).json();
    expect(json.data.applied).toEqual({ orders: 0, options: 0, skipped: ['ORD-1'] });
  });
  it('past deliveries are not touched', async () => {
    const json = await (await POST(req({ body: { fromDate: '2100-01-01' } }))).json();
    expect(json.data.optionsToChange).toBe(0);
  });
});
