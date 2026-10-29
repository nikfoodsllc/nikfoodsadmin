import { describe, expect, it } from 'vitest';
import type { AppCustomer } from '@/utils/appCustomers';
import { reachableCustomers, searchReachable, selectedSendNotice, setChosen, stillReachable } from './pickCustomers';

const c = (userId: string, name: string, email: string, phone: string, permission: AppCustomer['permission'] = 'allowed'): AppCustomer => ({
  userId, name, email, phone, phones: [], lastSeenAt: null, permission, orders: true, menuSwitch: true, menuSubscribed: true, reminders: false,
});
const all = [c('1', 'Amy Rao', 'amy@example.com', '2065550101'), c('2', 'Ben Cole', 'ben@example.com', '4255550102'), c('3', 'Cara Lin', 'cara@example.com', '2065550103', 'denied')];

describe('pickCustomers', () => {
  it('only offers customers who allowed notifications', () => {
    expect(reachableCustomers(all).map((x) => x.userId)).toEqual(['1', '2']);
  });
  it('searches by name, email and phone, and never offers someone who said No', () => {
    expect(searchReachable(all, 'amy').map((x) => x.userId)).toEqual(['1']);
    expect(searchReachable(all, 'BEN@').map((x) => x.userId)).toEqual(['2']);
    expect(searchReachable(all, '(425) 555').map((x) => x.userId)).toEqual(['2']);
    expect(searchReachable(all, 'cara')).toEqual([]);
    expect(searchReachable(all, '').length).toBe(2);
  });
  it('adds and removes ids without duplicates', () => {
    expect(setChosen(['1'], ['1', '2'], true)).toEqual(['1', '2']);
    expect(setChosen(['1', '2'], ['1'], false)).toEqual(['2']);
    expect(setChosen([], [], true)).toEqual([]);
  });
  it('drops chosen customers who are no longer reachable', () => {
    expect(stillReachable(['1', '3', '9'], all)).toEqual(['1']);
  });
  it('words the result', () => {
    expect(selectedSendNotice({ mode: 'on', audience: 3, skipped: 1, unavailable: 0, phones: 3, sent: 3, failed: 0 })).toBe('Sent to 3 phones. 1 customer skipped (menu alerts switched off in the app).');
    expect(selectedSendNotice({ mode: 'dry', audience: 2, skipped: 0, unavailable: 1, phones: 2, sent: 0, failed: 0 })).toContain('Test run: it would go to 2 phones of 2 customers. Nothing was sent.');
    expect(selectedSendNotice({ mode: 'on', audience: 1, skipped: 0, unavailable: 0, phones: 1, sent: 1, failed: 0 })).toBe('Sent to 1 phone.');
  });
});
