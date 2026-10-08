import { describe, expect, it } from 'vitest';
import { GLOSSARY, GLOSSARY_SECTIONS, groupBySection, searchGlossary } from './adminGlossary';

describe('admin glossary', () => {
  it('has unique ids and only known sections', () => {
    expect(new Set(GLOSSARY.map((x) => x.id)).size).toBe(GLOSSARY.length);
    for (const entry of GLOSSARY) expect(GLOSSARY_SECTIONS).toContain(entry.section);
  });

  it('explains every confirmation email status the Orders column can show', () => {
    const terms = GLOSSARY.filter((x) => x.section === 'Orders: Confirmation Email column').map((x) => x.term);
    for (const word of ['Sent', 'Delivered', 'Opened', 'Bounced', 'Spam', 'Failed', 'Retrying', 'Pending', 'Delayed']) expect(terms).toContain(word);
  });

  it('explains every order and payment status', () => {
    const terms = GLOSSARY.map((x) => `${x.section}|${x.term}`);
    for (const s of ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled']) expect(terms).toContain(`Orders: order status|${s}`);
    for (const s of ['Paid', 'Unpaid', 'Failed', 'Refunded', 'Partially refunded']) expect(terms).toContain(`Orders: payment status|${s}`);
  });

  it('search needs every word and ignores case', () => {
    expect(searchGlossary(GLOSSARY, 'BOUNCED').length).toBeGreaterThan(1);
    expect(searchGlossary(GLOSSARY, 'bounced customer mail server').every((x) => /bounce/i.test(x.term + x.meaning))).toBe(true);
    expect(searchGlossary(GLOSSARY, 'zzzz nothing')).toEqual([]);
    expect(searchGlossary(GLOSSARY, '   ')).toEqual(GLOSSARY);
  });

  it('finds an entry by a keyword, a code and the screen it appears on', () => {
    expect(searchGlossary(GLOSSARY, 'cvv').map((x) => x.term)).toContain('incorrect_cvc');
    expect(searchGlossary(GLOSSARY, 'card_declined').map((x) => x.term)).toContain('card_declined');
    expect(searchGlossary(GLOSSARY, 'recent orders delayed').length).toBeGreaterThan(0);
  });

  it('groups in section order and drops empty sections', () => {
    const groups = groupBySection(searchGlossary(GLOSSARY, 'cutoff'));
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.entries.length > 0)).toBe(true);
  });
});
