import { describe, expect, it } from 'vitest';
import { channelFilterFor, channelOf } from './orderChannel';

describe('channelOf', () => {
  it('older orders (no field) are website', () => expect(channelOf({})).toBe('web'));
  it('web and mobile come from the channel field', () => {
    expect(channelOf({ channel: 'web' })).toBe('web');
    expect(channelOf({ channel: 'mobile' })).toBe('mobile');
  });
  it('an admin-entered order is admin whatever else it says', () => {
    expect(channelOf({ source: 'admin' })).toBe('admin');
    expect(channelOf({ source: 'admin', channel: 'mobile' })).toBe('admin');
  });
  it('unknown values count as website', () => expect(channelOf({ channel: 'something' })).toBe('web'));
});

describe('channelFilterFor', () => {
  it('All and junk give no filter', () => {
    expect(channelFilterFor('all')).toBeNull();
    expect(channelFilterFor(undefined)).toBeNull();
    expect(channelFilterFor('$ne')).toBeNull();
  });
  it('mobile excludes admin-entered orders', () => expect(channelFilterFor('mobile')).toEqual({ channel: 'mobile', source: { $ne: 'admin' } }));
  it('website is everything that is neither mobile nor admin (older orders included)', () => expect(channelFilterFor('web')).toEqual({ source: { $ne: 'admin' }, channel: { $ne: 'mobile' } }));
  it('admin is the source', () => expect(channelFilterFor('admin')).toEqual({ source: 'admin' }));
});
