import { describe, expect, it } from 'vitest';
import { intlFeeReason } from './feeRegionLabel';

describe('intlFeeReason', () => {
  it('names a foreign card, the App Store, or nothing', () => {
    expect(intlFeeReason({ feeRegion: 'intl', cardCountry: 'BR' })).toBe('card from BR');
    expect(intlFeeReason({ feeRegion: 'intl', storeCountry: 'IND' })).toBe('international App Store: IND');
    expect(intlFeeReason({ feeRegion: 'intl', cardCountry: 'US', storeCountry: 'IND' })).toBe('international App Store: IND');
    expect(intlFeeReason({ feeRegion: 'intl' })).toBe('international App Store');
    expect(intlFeeReason({ cardCountry: 'BR' })).toBe('');
  });
});
