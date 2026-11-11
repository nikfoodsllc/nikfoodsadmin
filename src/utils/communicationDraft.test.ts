import { describe, expect, it } from 'vitest';
import { MAX_DRAFT_PEOPLE, draftPreview, draftTitle, parseDraftContent, worthSaving } from './communicationDraft';

const id = (n: number) => n.toString(16).padStart(24, '0');

describe('parseDraftContent', () => {
  it('keeps a full draft as it is', () => {
    const d = parseDraftContent({ kind: 'ordered_between', date: '2026-11-11', from: '2026-11-01', to: '2026-11-05', people: [], extra: [{ id: id(1), name: 'A', email: 'a@x.test', phone: '2065550100' }], email: true, text: false, subject: 'Hi', emailBody: 'Body', emailFormat: 'text', textBody: '', when: 'later', local: '2026-11-12T09:30' });
    expect(d).toMatchObject({ kind: 'ordered_between', from: '2026-11-01', to: '2026-11-05', subject: 'Hi', when: 'later', local: '2026-11-12T09:30' });
    expect(d.extra).toEqual([{ id: id(1), name: 'A', email: 'a@x.test', phone: '2065550100' }]);
  });
  it('falls back to safe defaults for junk and never throws', () => {
    for (const junk of [null, undefined, 5, 'x', [], { kind: 'nope', date: 'tomorrow', when: 'whenever', local: 'soon', emailFormat: 'pdf', people: 'all' }]) {
      const d = parseDraftContent(junk);
      expect(d.kind).toBe('delivery_date');
      expect(d.date).toBe('');
      expect(d.when).toBe('now');
      expect(d.local).toBe('');
      expect(d.emailFormat).toBe('text');
      expect(d.people).toEqual([]);
    }
  });
  it('turns email on by default and text off, like a new message', () => {
    expect(parseDraftContent({})).toMatchObject({ email: true, text: false });
    expect(parseDraftContent({ email: false, text: true })).toMatchObject({ email: false, text: true });
  });
  it('drops bad and repeated ids and caps the people', () => {
    const d = parseDraftContent({ people: [{ id: id(1) }, { id: id(1) }, { id: 'nope' }, { name: 'no id' }, 7, { id: id(2).toUpperCase() }] });
    expect(d.people.map((p) => p.id)).toEqual([id(1), id(2)]);
    const many = parseDraftContent({ extra: Array.from({ length: MAX_DRAFT_PEOPLE + 40 }, (_, i) => ({ id: id(i + 1) })) });
    expect(many.extra.length).toBe(MAX_DRAFT_PEOPLE);
  });
  it('cuts overlong text to the limits (a custom HTML email may be long, a plain one may not)', () => {
    expect(parseDraftContent({ subject: 'x'.repeat(500) }).subject.length).toBe(150);
    expect(parseDraftContent({ emailBody: 'x'.repeat(9000), emailFormat: 'text' }).emailBody.length).toBe(5000);
    expect(parseDraftContent({ emailBody: 'x'.repeat(95000), emailFormat: 'html' }).emailBody.length).toBe(90000);
    expect(parseDraftContent({ textBody: 'x'.repeat(900) }).textBody.length).toBe(320);
  });
  it('accepts only real days and send times', () => {
    expect(parseDraftContent({ date: '2026-11-11' }).date).toBe('2026-11-11');
    expect(parseDraftContent({ date: '11/11/2026' }).date).toBe('');
    expect(parseDraftContent({ local: '2026-11-12T09:30' }).local).toBe('2026-11-12T09:30');
    expect(parseDraftContent({ local: '2026-11-12 09:30' }).local).toBe('');
  });
});

describe('worthSaving, title and preview', () => {
  it('an untouched form is not worth saving; anything typed or picked is', () => {
    expect(worthSaving(parseDraftContent({}))).toBe(false);
    expect(worthSaving(parseDraftContent({ subject: '   ' }))).toBe(false);
    expect(worthSaving(parseDraftContent({ subject: 'Hello' }))).toBe(true);
    expect(worthSaving(parseDraftContent({ textBody: 'x' }))).toBe(true);
    expect(worthSaving(parseDraftContent({ extra: [{ id: id(1) }] }))).toBe(true);
    expect(worthSaving(parseDraftContent({ people: [{ id: id(1) }] }))).toBe(true);
  });
  it('names a draft by its subject, else by what it holds', () => {
    expect(draftTitle({ subject: ' New menu ', emailBody: '', textBody: '' })).toBe('New menu');
    expect(draftTitle({ subject: '', emailBody: '', textBody: 'Hi' })).toBe('Text message');
    expect(draftTitle({ subject: '', emailBody: '<p>x</p>', textBody: '' })).toBe('Untitled email');
    expect(draftTitle({ subject: '', emailBody: '<p>x</p>', textBody: 'Hi' })).toBe('Untitled email');
    expect(draftTitle({ subject: '', emailBody: '', textBody: '' })).toBe('Untitled message');
  });
  it('previews plain text, strips HTML tags and styles, and shortens', () => {
    expect(draftPreview({ emailBody: 'Hello   there\n\nfriend', emailFormat: 'text', textBody: '' })).toBe('Hello there friend');
    expect(draftPreview({ emailBody: '<style>p{color:red}</style><p>Hi&nbsp;<b>you</b></p>', emailFormat: 'html', textBody: '' })).toBe('Hi you');
    expect(draftPreview({ emailBody: '', emailFormat: 'text', textBody: 'Text only' })).toBe('Text only');
    expect(draftPreview({ emailBody: 'a'.repeat(300), emailFormat: 'text', textBody: '' }).length).toBe(138);
  });
});
