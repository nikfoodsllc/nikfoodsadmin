import { describe, expect, it } from 'vitest';
import { buildAbandonedRows, pacificDayStart, pacificToday, problemText, reachOutEmail, resolveRange, summarize, QUIET_MINUTES, type DraftDoc, type OrderInfo } from './abandonedCheckouts';

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

  it('a person who ordered days ago and left a NEW checkout today is still a lead; their old leftovers are ignored', () => {
    const r = build(
      [
        draft({ paymentIntentId: 'pi_oldleft', userId: 'u1', createdAt: ago(3000), lastActivityAt: ago(3000) }), // before their last order
        draft({ paymentIntentId: 'pi_today', userId: 'u1', createdAt: ago(120), lastActivityAt: ago(100) }),
      ],
      [{ user: 'u1', createdAt: ago(2000) }]
    );
    expect(r.to_contact).toHaveLength(1);
    expect(r.to_contact[0]).toMatchObject({ id: 'pi_today', earlierCheckouts: 0 });
    expect(r.orderedSince).toBe(0);
  });

  it('a person whose every open checkout is older than their last order is not a lead, even with several of them', () => {
    const r = build(
      [
        draft({ paymentIntentId: 'a', userId: 'u1', createdAt: ago(3000), lastActivityAt: ago(3000) }),
        draft({ paymentIntentId: 'b', userId: 'u1', createdAt: ago(2500), lastActivityAt: ago(2500) }),
      ],
      [{ user: 'u1', createdAt: ago(2000) }]
    );
    expect(r.to_contact).toHaveLength(0);
    expect(r.orderedSince).toBe(1);
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

  it('when two checkouts have the same last activity the one started last is shown', () => {
    const r = build([
      draft({ paymentIntentId: 'older', userId: 'u1', createdAt: ago(900), lastActivityAt: ago(200), items: [] }),
      draft({ paymentIntentId: 'newer', userId: 'u1', createdAt: ago(250), lastActivityAt: ago(200) }),
    ]);
    expect(r.to_contact[0].id).toBe('newer');
  });

  it(`leaves out checkouts active in the last ${QUIET_MINUTES} minutes (still shopping)`, () => {
    expect(build([draft({ paymentIntentId: 'pi_1', userId: 'u1', lastActivityAt: ago(5), createdAt: ago(8) })]).to_contact).toHaveLength(0);
    expect(build([draft({ paymentIntentId: 'pi_1', userId: 'u1', lastActivityAt: ago(11), createdAt: ago(40) })]).to_contact).toHaveLength(1);
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

describe('date range of the list', () => {
  // Wed Oct 7 2026, 11:50 Pacific (18:50 UTC)
  const now = new Date('2026-10-07T18:50:00Z');
  it('today in Pacific time, also just after midnight UTC', () => {
    expect(pacificToday(now)).toBe('2026-10-07');
    expect(pacificToday(new Date('2026-10-08T02:30:00Z'))).toBe('2026-10-07'); // 7:30 PM Pacific
    expect(pacificToday(new Date('2026-10-08T07:30:00Z'))).toBe('2026-10-08'); // 00:30 Pacific
  });
  it('a Pacific day starts at 07:00 UTC in summer and 08:00 UTC in winter', () => {
    expect(pacificDayStart('2026-10-07').toISOString()).toBe('2026-10-07T07:00:00.000Z');
    expect(pacificDayStart('2026-12-15').toISOString()).toBe('2026-12-15T08:00:00.000Z');
    expect(pacificDayStart('2026-11-01').toISOString()).toBe('2026-11-01T07:00:00.000Z'); // the day daylight time ends
    expect(pacificDayStart('2026-11-02').toISOString()).toBe('2026-11-02T08:00:00.000Z');
    expect(pacificDayStart('2026-03-08').toISOString()).toBe('2026-03-08T08:00:00.000Z'); // the day daylight time starts
  });
  it('days: last N days, default 14, clamped to 1..60', () => {
    const r = resolveRange({ days: 7 }, now) as { since: Date; until: Date | null; from: string; to: string };
    expect(r.until).toBeNull();
    expect(r.since.toISOString()).toBe('2026-09-30T18:50:00.000Z');
    expect(r.from).toBe('2026-10-01');
    expect(r.to).toBe('2026-10-07');
    expect((resolveRange({}, now) as { from: string }).from).toBe('2026-09-24');
    expect((resolveRange({ days: 500 }, now) as { from: string }).from).toBe('2026-08-09');
    expect((resolveRange({ days: 0 }, now) as { from: string }).from).toBe('2026-10-07');
    expect((resolveRange({ days: Number.NaN }, now) as { from: string }).from).toBe('2026-09-24');
  });
  it('custom range: both end days included', () => {
    const r = resolveRange({ from: '2026-10-05', to: '2026-10-06' }, now) as { since: Date; until: Date };
    expect(r.since.toISOString()).toBe('2026-10-05T07:00:00.000Z');
    expect(r.until.toISOString()).toBe('2026-10-07T07:00:00.000Z'); // the start of Oct 7 = the end of Oct 6
    const one = resolveRange({ from: '2026-10-07', to: '2026-10-07' }, now) as { since: Date; until: Date };
    expect(one.until.getTime() - one.since.getTime()).toBe(24 * 3600 * 1000);
  });
  it('custom range: bad input is refused with a clear message', () => {
    const msg = (i: { from?: string; to?: string }) => (resolveRange(i, now) as { error: string }).error;
    expect(msg({ from: '2026-10-05' })).toMatch(/start and an end/);
    expect(msg({ from: 'x', to: 'y' })).toMatch(/start and an end/);
    expect(msg({ from: '2026-13-01', to: '2026-13-02' })).toMatch(/start and an end/);
    expect(msg({ from: '2026-02-31', to: '2026-03-02' })).toMatch(/start and an end/);
    expect(msg({ from: '2026-10-06', to: '2026-10-05' })).toMatch(/must not be after/);
    expect(msg({ from: '2026-10-05', to: '2026-10-08' })).toMatch(/future/);
    expect(msg({ from: '2026-08-01', to: '2026-10-05' })).toMatch(/only kept for 60 days/);
  });
  it('the oldest allowed start is 59 days back (60 days including today)', () => {
    expect('error' in resolveRange({ from: '2026-08-09', to: '2026-08-10' }, now)).toBe(false);
    expect('error' in resolveRange({ from: '2026-08-08', to: '2026-08-10' }, now)).toBe(true);
  });
});
