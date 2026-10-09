import { describe, expect, it } from 'vitest';
import { smsConsentView } from './smsConsentView';

describe('smsConsentView', () => {
  it('nothing on record', () => {
    expect(smsConsentView(null, null, '2065550100').status).toBe('never');
    expect(smsConsentView({}, undefined).phone).toBeNull();
  });
  it('agreed at checkout', () => {
    const v = smsConsentView({ optedIn: true, phone: '2065550100', optedInAt: '2026-10-09T23:32:28Z', source: 'checkout', version: '2026-10-09b' }, null);
    expect(v).toMatchObject({ status: 'agreed', phone: '2065550100', agreedHow: 'Checkout box', version: '2026-10-09b' });
    expect(v.agreedAt?.toISOString()).toBe('2026-10-09T23:32:28.000Z');
  });
  it('agreed on the public page for the profile number', () => {
    const v = smsConsentView(null, { phone: '2065550100', optedIn: true, optedInAt: '2026-10-09T10:00:00Z', version: 'v' }, '(206) 555-0100');
    expect(v).toMatchObject({ status: 'agreed', phone: '2065550100', agreedHow: 'Text Updates sign-up page' });
  });
  it('stopped by replying STOP', () => {
    const v = smsConsentView({ optedIn: false, phone: '2065550100', optedInAt: '2026-10-01T00:00:00Z', source: 'checkout', optedOutAt: '2026-10-05T00:00:00Z', optedOutVia: 'text_reply' }, null);
    expect(v).toMatchObject({ status: 'stopped', stoppedHow: 'Replied STOP by text', agreedHow: 'Checkout box' });
    expect(v.stoppedAt?.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });
  it('stopped from My Account and from the public record', () => {
    expect(smsConsentView({ optedIn: false, optedInAt: 'x', optedOutAt: '2026-10-05T00:00:00Z', optedOutVia: 'profile' }, null).stoppedHow).toBe('Turned off in My Account');
    expect(smsConsentView(null, { phone: '2065550100', optedIn: false, optedInAt: '2026-10-01T00:00:00Z', optedOutAt: '2026-10-05T00:00:00Z' }).status).toBe('stopped');
  });
  it('an own agreement wins over a public one', () => {
    expect(smsConsentView({ optedIn: true, phone: '2065550111', source: 'profile', optedInAt: '2026-10-09T00:00:00Z' }, { optedIn: true, phone: '2065550100' }).phone).toBe('2065550111');
  });
  it('junk dates and numbers do not throw', () => {
    const v = smsConsentView({ optedIn: true, phone: 'abc', optedInAt: 'not a date', source: 'weird' }, null, '12');
    expect(v.status).toBe('agreed');
    expect(v.agreedAt).toBeNull();
    expect(v.phone).toBeNull();
    expect(v.agreedHow).toBe('weird');
  });
});
