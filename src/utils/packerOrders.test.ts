import { describe, expect, it } from 'vitest';
import { PACKER_ORDER_PROJECTION, toPackerOrder } from './packerOrders';

const order = {
  _id: 'x1',
  orderId: 'ORD-1',
  createdAt: '2026-10-12T20:00:00.000Z',
  status: 'confirmed',
  user: 'u1',
  customerInfo: { name: 'Asha Rao', email: 'asha@example.com', phone: '2065550100' },
  address: { street: '1 Main St, Seattle, WA 98109, USA', apartment: '4B', floor: 'Leave at door', entrance: '1234', city: 'Seattle', zipCode: '98109' },
  subtotal: 40, platformFee: 1.9, deliveryFee: 0, taxes: 4.1, tip: 2, totalPaid: 48, refundedAmount: 0, stripeFee: 1.7, stripePaymentIntentId: 'pi_1',
  paymentStatus: 'paid', paymentMethod: 'Credit Card',
  emailStatus: { status: 'sent' }, emailDelivery: { status: 'delivered' }, optimo: { state: 'sent' }, paymentLinkToken: 'secret',
  items: [
    {
      day: 'Wednesday', deliveryDate: '2026-10-14', actualDeliveryDate: '2026-10-15', dayTotal: 40,
      items: [
        { quantity: 2, price: 20, spiceLevel: 'Medium Spice', selectedPortion: '12Oz', isEcoFriendlyContainer: true, ecoContainerCharge: 0.75, notes: 'extra onion', food: { _id: 'f1', name: 'Rajma', price: 18, description: 'long text', image: 'x.png' } },
        {
          quantity: 1, price: 25,
          comboSelections: { s1: ['o1'] },
          food: { name: 'Veg Combo', price: 25, sections: [{ _id: 's1', title: 'Staple', selectedItems: [{ _id: 'o1', portion: '', quantity: 4, price: 1, item: { name: 'Chapati', price: 1 } }] }] },
        },
      ],
    },
  ],
};

describe('toPackerOrder', () => {
  const view = toPackerOrder(order);

  it('keeps what is needed to pack and deliver', () => {
    expect(view).toMatchObject({ orderId: 'ORD-1', status: 'confirmed', customerName: 'Asha Rao', phone: '2065550100', apartment: '4B', gateCode: '1234', instruction: 'Leave at door' });
    expect(view.days).toHaveLength(1);
    expect(view.days[0]).toMatchObject({ menuDate: '2026-10-14', deliveryDate: '2026-10-15' });
    expect(view.days[0].items[0]).toEqual({ name: 'Rajma', quantity: 2, portion: '12Oz', spice: 'Medium Spice', eco: true, notes: 'extra onion', choices: [] });
    expect(view.days[0].items[1].choices).toEqual(['Staple: Chapati × 4']);
  });

  it('carries no money, no email and no tracking', () => {
    const text = JSON.stringify(view);
    for (const secret of ['asha@example.com', 'pi_1', 'secret', 'Credit Card', 'paymentStatus', 'platformFee', 'taxes', 'tip', 'price', 'Total', 'total', 'refund', 'stripe', 'optimo', 'emailStatus', 'emailDelivery', '48', '1.9', '0.75']) {
      expect(text, secret).not.toContain(secret);
    }
    expect(Object.keys(view).sort()).toEqual(['apartment', 'customerName', 'days', 'gateCode', 'instruction', 'orderId', 'phone', 'placedAt', 'status', 'street'].sort());
  });

  it('asks the database for no price field at all', () => {
    const keys = Object.keys(PACKER_ORDER_PROJECTION).join(' ');
    expect(keys).not.toMatch(/price|total|tip|fee|tax|payment|refund|stripe|email|optimo|discount/i);
    expect(keys).not.toContain('customerInfo.email');
  });

  it('copes with a thin order', () => {
    const thin = toPackerOrder({ orderId: 'ORD-2' });
    expect(thin).toMatchObject({ orderId: 'ORD-2', customerName: '', days: [], placedAt: null });
  });
});
