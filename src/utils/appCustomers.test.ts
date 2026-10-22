import { describe, it, expect } from 'vitest';
import { filterAppCustomers, getsMenuAlerts, menuStatus, phoneText, seenText, type AppCustomer } from './appCustomers';

const c = (over: Partial<AppCustomer>): AppCustomer => ({ permission: 'allowed', userId: 'x', name: 'Amy Rao', email: 'amy@example.com', phone: '2065550101', phones: [{ permission: 'allowed', platform: 'ios', deviceName: "Amy's iPhone", appVersion: '1.0.1', lastSeenAt: null, firstSeenAt: null }], lastSeenAt: null, orders: true, menuSwitch: true, menuSubscribed: true, reminders: false, ...over });

describe('menu alerts wording', () => {
  it('needs the switch and the email list', () => {
    expect(menuStatus(c({}))).toEqual({ label: 'On', on: true });
    expect(menuStatus(c({ menuSwitch: false }))).toEqual({ label: 'Off', on: false });
    expect(menuStatus(c({ menuSubscribed: false }))).toEqual({ label: 'Not subscribed', on: false });
    expect(getsMenuAlerts(c({ menuSwitch: false, menuSubscribed: true }))).toBe(false);
  });
});

describe('filterAppCustomers', () => {
  const list = [c({ userId: 'a' }), c({ userId: 'b', name: 'Bob', email: 'bob@example.com', phone: '4255550202', orders: false, phones: [{ permission: 'allowed', platform: 'ios', deviceName: 'Work phone', appVersion: '', lastSeenAt: null, firstSeenAt: null }] }), c({ userId: 'd', name: 'Dev', email: 'd@example.com', orders: false, menuSubscribed: false, reminders: false }), c({ userId: 'e', name: 'Eve', email: 'e@example.com', reminders: true })];
  const ids = (l: AppCustomer[]) => l.map((x) => x.userId);
  it('filters by switch', () => {
    expect(ids(filterAppCustomers(list, '', 'all'))).toEqual(['a', 'b', 'd', 'e']);
    expect(ids(filterAppCustomers(list, '', 'ordersOff'))).toEqual(['b', 'd']);
    expect(ids(filterAppCustomers(list, '', 'menuOff'))).toEqual(['d']);
    expect(ids(filterAppCustomers(list, '', 'remindersOn'))).toEqual(['e']);
    expect(ids(filterAppCustomers(list, '', 'allOff'))).toEqual(['d']);
  });
  it('searches name, email, phone digits and the phone model', () => {
    expect(ids(filterAppCustomers(list, 'bob', 'all'))).toEqual(['b']);
    expect(ids(filterAppCustomers(list, 'D@EXAMPLE', 'all'))).toEqual(['d']);
    expect(ids(filterAppCustomers(list, '(425) 555-0202', 'all'))).toEqual(['b']);
    expect(ids(filterAppCustomers(list, '0202', 'all'))).toEqual(['b']);
    expect(ids(filterAppCustomers(list, 'work', 'all'))).toEqual(['b']);
    expect(ids(filterAppCustomers(list, 'zzz', 'all'))).toEqual([]);
  });
  it('combines search and filter', () => {
    expect(ids(filterAppCustomers(list, 'bob', 'menuOff'))).toEqual([]);
    expect(ids(filterAppCustomers(list, 'bob', 'ordersOff'))).toEqual(['b']);
  });
});

describe('permission', () => {
  const list = [c({ userId: 'a' }), c({ userId: 'n', permission: 'denied', orders: false }), c({ userId: 'u', permission: 'notAsked', reminders: true })];
  const ids = (l: AppCustomer[]) => l.map((x) => x.userId);
  it('filters by what the phone allows', () => {
    expect(ids(filterAppCustomers(list, '', 'allowed'))).toEqual(['a']);
    expect(ids(filterAppCustomers(list, '', 'denied'))).toEqual(['n']);
    expect(ids(filterAppCustomers(list, '', 'notAsked'))).toEqual(['u']);
  });
  it('switch filters only look at customers who allowed notifications', () => {
    expect(ids(filterAppCustomers(list, '', 'ordersOff'))).toEqual([]);
    expect(ids(filterAppCustomers(list, '', 'remindersOn'))).toEqual([]);
    expect(ids(filterAppCustomers(list, '', 'allOff'))).toEqual([]);
  });
  it('a phone that is not allowed says so', () => {
    expect(phoneText({ permission: 'denied', platform: 'ios', deviceName: 'Pat', appVersion: '1.0.2', lastSeenAt: null, firstSeenAt: null })).toBe('Pat · app 1.0.2 (said no)');
    expect(phoneText({ permission: 'notAsked', platform: 'ios', deviceName: '', appVersion: '', lastSeenAt: null, firstSeenAt: null })).toBe('iPhone (not asked yet)');
  });
});

describe('text helpers', () => {
  it('phone and time text', () => {
    expect(phoneText({ permission: 'allowed', platform: 'ios', deviceName: "Amy's iPhone", appVersion: '1.0.1', lastSeenAt: null, firstSeenAt: null })).toBe("Amy's iPhone · app 1.0.1");
    expect(phoneText({ permission: 'allowed', platform: 'ios', deviceName: '', appVersion: '', lastSeenAt: null, firstSeenAt: null })).toBe('iPhone');
    expect(seenText(null)).toBe('–');
    expect(seenText('nonsense')).toBe('–');
    expect(seenText('2026-10-21T17:32:00.000Z')).toBe('Oct 21, 10:32 AM');
  });
});
