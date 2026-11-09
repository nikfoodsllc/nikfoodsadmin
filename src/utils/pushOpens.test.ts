import { describe, expect, it } from 'vitest';
import { hasRecipients, openedText, sendLabel } from './pushOpens';

describe('openedText', () => {
  it('shows opens out of customers with a percentage', () => {
    expect(openedText(3, 12)).toBe('3 of 12 opened (25%)');
    expect(openedText(0, 5)).toBe('0 of 5 opened (0%)');
  });
  it('never goes over 100% when the customer count is behind', () => {
    expect(openedText(4, 3)).toBe('4 of 4 opened (100%)');
  });
  it('is a dash when nothing was sent', () => {
    expect(openedText(0, 0)).toBe('–');
  });
});

describe('sendLabel', () => {
  it('prefers the automatic event, then the kind', () => {
    expect(sendLabel({ kind: 'orders', event: 'delivered' })).toBe('Delivered');
    expect(sendLabel({ kind: 'menu', event: '' })).toBe('Menu alert');
    expect(sendLabel({ kind: 'x', event: '' })).toBe('Message');
  });
});

describe('hasRecipients', () => {
  it('needs a phone or a customer', () => {
    expect(hasRecipients({ sent: 0, customers: 0 })).toBe(false);
    expect(hasRecipients({ sent: 2, customers: 1 })).toBe(true);
  });
});
