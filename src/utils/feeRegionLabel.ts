/**
 * Why an order paid the international Platform Fee (6% + $0.30): a card issued outside the US (the website checks the card when Pay is
 * pressed) or the mobile app's App Store outside the US. '' for an ordinary order.
 */
export function intlFeeReason(order: { feeRegion?: string; cardCountry?: string; storeCountry?: string }): string {
  if (order.feeRegion !== 'intl') return '';
  if (order.cardCountry && order.cardCountry !== 'US') return `card from ${order.cardCountry}`;
  return `international App Store${order.storeCountry ? `: ${order.storeCountry}` : ''}`;
}
