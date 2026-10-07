import { describe, expect, it } from 'vitest';
import { buildAbandonedRows, problemText, reachOutEmail, summarize, QUIET_MINUTES, type DraftDoc, type OrderInfo } from './abandonedCheckouts';

const NOW = new Date('2026-10-07T12:00:00Z');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000);
const draft = (over: Partial<DraftDoc> & { paymentIntentId: string; userId: string }): DraftDoc => ({
  status: 'open', total: 31.47, itemCount: 6, createdAt: ago(300), lastActivityAt: ago(300), customer: { name: 'Rijul B', email: 'r@example.invalid', phone: '3040000000' }, items: [{ date: '2026-10-09', name: 'Veg Combo', quantity: 2, unitPrice: 26.5, lineTotal: 53 }], ...over,
});
const build = (drafts: DraftDoc[], paid: { user: string; createdAt: Date }[] = [], info = new Map<string, OrderInfo>()) => buildAbandonedRows(drafts, paid, info, NOW);

describe('abandoned checkouts', () => {
  it('lists a person who left a checkout and did not order', () => {
    const r = build([draft({ paymentIntentId: 'pi_1', userId: 'u1' })]);
    expect(r.to_contact).toHaveLength(1);
    expect(r.to_contact[0]).toMatchObject({ id: 'pi_1', name: 'Rijul B', email: 'r@example.invalid', total: 31.47, triedToPay: false });
  });

  it('drops them as soon as they pay: the example of two payments, the second one paid (cart changed 45 s later)', () => {
    const first = draft({ paymentIntentId: 'pi_first', userId: 'u1', createdAt: ago(300), lastActivityAt: ago(300) });
    const paid = [{ user: 'u1', createdAt: new Date(ago(300).getTime() + 74 * 1000) }];
    const r = build([first], paid);
    expect(r.to_contact).toHaveLength(0);
    expect(r.orderedSince).toBe(1);
  });

  it('also drops them when an admin entered and marked an order paid for them later', () => {
    expect(build([draft({ paymentIntentId: 'pi_1', userId: 'u1' })], [{ user: 'u1', createdAt: ago(10) }]).to_contact).toHaveLength(0);
  });

  it('keeps someone who paid BEFORE this checkout (a new abandoned cart)', () => {
    const r = build([draft({ paymentIntentId: 'pi_1', userId: 'u1', createdAt: ago(60), lastActivityAt: ago(60) })], [{ user: 'u1', createdAt: ago(600) }]);
    expect(r.to_contact).toHaveLength(1);
  });

  it('another person\'s order does not hide this one', () => {
    expect(build([draft({ paymentIntentId: 'pi_1', userId: 'u1' })], [{ user: 'u2', createdAt: ago(10) }]).to_contact).toHaveLength(1);
  });

  it('several checkouts of one person are one row, the latest, with a count of the earlier ones', () => {
    const r = build([
      draft({ paymentIntentId: 'pi_old', userId: 'u1', lastActivityAt: ago(500), createdAt: ago(500), total: 10 }),
      draft({ paymentIntentId: 'pi_new', userId: 'u1', lastActivityAt: ago(100), createdAt: ago(120), total: 99 }),
    ]);
    expect(r.to_contact).toHaveLength(1);
    expect(r.to_contact[0]).toMatchObject({ id: 'pi_new', total: 99, earlierCheckouts: 1 });
  });

  it(`leaves out checkouts active in the last ${QUIET_MINUTES} minutes (still shopping)`, () => {
    expect(build([draft({ paymentIntentId: 'pi_1', userId: 'u1', lastActivityAt: ago(10), createdAt: ago(20) })]).to_contact).toHaveLength(0);
    expect(build([draft({ paymentIntentId: 'pi_1', userId: 'u1', lastActivityAt: ago(31), createdAt: ago(40) })]).to_contact).toHaveLength(1);
  });

  it('leaves out dismissed, converted and superseded drafts', () => {
    const r = build([
      draft({ paymentIntentId: 'a', userId: 'u1', dismissedAt: ago(5) }),
      draft({ paymentIntentId: 'b', userId: 'u2', status: 'converted' }),
      draft({ paymentIntentId: 'c', userId: 'u3', status: 'superseded' }),
    ]);
    expect(r.to_contact).toHaveLength(0);
  });

  it('contacted people move to the Contacted view; a newer checkout after being contacted puts them back', () => {
    const contacted = { at: ago(200), by: 'Shrey', note: 'Called, no answer' };
    const r = build([draft({ paymentIntentId: 'pi_1', userId: 'u1', contacted })]);
    expect(r.contacted).toHaveLength(1);
    expect(r.contacted[0].contacted).toMatchObject({ by: 'Shrey', note: 'Called, no answer' });
    const again = build([
      draft({ paymentIntentId: 'pi_old', userId: 'u1', createdAt: ago(400), lastActivityAt: ago(400), contacted }),
      draft({ paymentIntentId: 'pi_new', userId: 'u1', createdAt: ago(100), lastActivityAt: ago(100) }),
    ]);
    expect(again.to_contact).toHaveLength(1);
    expect(again.to_contact[0].previouslyContactedAt).toBeTruthy();
  });

  it('says when they pressed Pay and why it failed', () => {
    const info = new Map<string, OrderInfo>([['ORD-1', { orderId: 'ORD-1', status: 'cancelled', paymentStatus: 'failed', paymentError: { code: 'card_declined', declineCode: 'insufficient_funds', message: 'x' } }]]);
    const r = build([draft({ paymentIntentId: 'pi_1', userId: 'u1', orderId: 'ORD-1' })], [], info);
    expect(r.to_contact[0]).toMatchObject({ triedToPay: true, problem: 'The card was declined: not enough funds' });
  });

  it('older checkouts without items are flagged and name falls back to the email', () => {
    const r = build([draft({ paymentIntentId: 'pi_1', userId: 'u1', items: [], itemCount: 5, customer: { email: 'welcome@example.invalid' } })]);
    expect(r.to_contact[0]).toMatchObject({ noItemDetails: true, itemCount: 5, name: 'welcome' });
  });

  it('sorts newest first and totals the money still to chase', () => {
    const r = build([
      draft({ paymentIntentId: 'a', userId: 'u1', lastActivityAt: ago(300), total: 10 }),
      draft({ paymentIntentId: 'b', userId: 'u2', lastActivityAt: ago(100), total: 20.5 }),
    ]);
    expect(r.to_contact.map((x) => x.id)).toEqual(['b', 'a']);
    expect(summarize(r)).toEqual({ to_contact: 2, contacted: 0, valueToContact: 30.5 });
  });

  it('plain words for common payment problems', () => {
    expect(problemText({ orderId: 'x', paymentStatus: 'failed', paymentError: { code: 'expired_card', message: 'm' } })).toBe('The card has expired');
    expect(problemText({ orderId: 'x', paymentStatus: 'paid' })).toBeUndefined();
    expect(problemText({ orderId: 'x', paymentStatus: 'unpaid' })).toBe('The payment was started but not completed');
  });

  it('a ready-made email names the items and day', () => {
    const r = build([draft({ paymentIntentId: 'pi_1', userId: 'u1', deliveryDates: ['2026-10-09'] })]);
    const mail = reachOutEmail(r.to_contact[0]);
    expect(mail.body).toContain('Hi Rijul,');
    expect(mail.body).toContain('Veg Combo');
    expect(mail.body).toContain('Friday, Oct 9');
  });
});
