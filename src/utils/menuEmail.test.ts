import { describe, expect, it } from 'vitest';
import { buildMenuEmailHtml, dateForDay, nextMenuStart, shortDate, dishesOf, emptyMenuEmail, menuEmailProblem, menuPhotoUrl, parseMenuEmail, usablePhotos, type MenuEmailData } from './menuEmail';
import { htmlProblem, previewHtml } from './communication';
import { EMAIL_TEMPLATES } from './emailTemplates';

const url = (n: number) => `https://res.cloudinary.com/demo/image/upload/v1/menu${n}.jpg`;
const data = (photos: number): MenuEmailData => ({
  ...emptyMenuEmail(),
  photos: Array.from({ length: photos }, (_, i) => ({ url: url(i), caption: `Dish ${i + 1}` })),
  days: [{ day: 'Tuesday', dishes: 'Paneer Tikka\n- Dal Makhani\n\n  Jeera Rice ' }, { day: 'Wednesday', dishes: '' }, { day: 'Friday', dishes: 'Chole <Bhature> & more' }],
});

describe('menu email', () => {
  it('reads dishes one per line', () => {
    expect(dishesOf('Paneer Tikka\n- Dal Makhani\n\n  Jeera Rice ')).toEqual(['Paneer Tikka', 'Dal Makhani', 'Jeera Rice']);
  });
  it('cuts Cloudinary pictures for mail and leaves other links alone', () => {
    expect(menuPhotoUrl(url(1), 564, 423)).toBe('https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_564,h_423,q_auto,f_jpg/v1/menu1.jpg');
    expect(menuPhotoUrl('https://res.cloudinary.com/demo/image/upload/c_fill,w_10/v1/a.jpg', 5, 5)).toContain('c_fill,w_10/v1');
    expect(menuPhotoUrl('https://example.com/a.jpg', 5, 5)).toBe('https://example.com/a.jpg');
  });
  it('arranges 1 to 4 photos and skips empty days', () => {
    const count = (h: string, s: string) => h.split(s).length - 1;
    for (const n of [1, 2, 3, 4]) {
      const h = buildMenuEmailHtml(data(n));
      expect(count(h, '<img src="https://res.cloudinary')).toBe(n);
    }
    expect(count(buildMenuEmailHtml(data(1)), 'w_1152')).toBe(1);
    expect(count(buildMenuEmailHtml(data(3)), 'w_1152')).toBe(1);
    expect(count(buildMenuEmailHtml(data(3)), 'w_564')).toBe(2);
    expect(count(buildMenuEmailHtml(data(4)), 'w_1152')).toBe(0);
    const h = buildMenuEmailHtml(data(2));
    expect(h).toContain('Tuesday');
    expect(h).toContain('Friday');
    expect(h).not.toContain('Wednesday');
    expect(h).toContain('Order now');
    expect(h).toContain('{unsubscribeUrl}');
  });
  it('escapes what is typed and passes the HTML check', () => {
    const h = buildMenuEmailHtml({ ...data(1), headline: 'Fresh <b>&</b>', photos: [{ url: url(1), caption: 'A "hot" <dish>' }] });
    expect(h).not.toContain('<b>&</b>');
    expect(h).toContain('Chole &lt;Bhature&gt; &amp; more');
    expect(h).toContain('A &quot;hot&quot; &lt;dish&gt;');
    expect(htmlProblem(h)).toBeNull();
  });
  it('ignores photos that are not https links', () => {
    expect(usablePhotos({ ...data(0), photos: [{ url: 'http://x.com/a.jpg', caption: '' }, { url: 'javascript:alert(1)', caption: '' }, { url: url(1), caption: '' }] })).toHaveLength(1);
  });
  it('a saved email opens as the form again', () => {
    const d = { ...data(3), headline: 'Café ☕ menu', intro: 'Line one\nLine two' };
    const back = parseMenuEmail(buildMenuEmailHtml(d));
    expect(back).toEqual(d);
    expect(parseMenuEmail('<p>my own html</p>')).toBeNull();
  });
  it('says what is missing', () => {
    expect(menuEmailProblem(emptyMenuEmail())).toMatch(/dish/);
    expect(menuEmailProblem({ ...data(0), headline: ' ' })).toMatch(/headline/);
    expect(menuEmailProblem(data(0))).toBeNull();
  });
  it('every email carries the App Store badge exactly once', () => {
    const count = (h: string, s: string) => h.split(s).length - 1;
    const v = { firstName: 'A', orderNumber: '1', date: 'd' };
    expect(count(buildMenuEmailHtml(data(2)), 'cid:app-store-badge')).toBe(1);
    for (const tpl of EMAIL_TEMPLATES) expect(count(tpl.html, 'cid:app-store-badge') + count(tpl.html, 'apps.apple.com/app/id') > 0, tpl.id).toBe(true);
    for (const tpl of EMAIL_TEMPLATES) expect(count(previewHtml(tpl.html, v), 'app-store-badge.png') <= 1, tpl.id).toBe(true);
    // pasted HTML without a badge gets one in the preview, like the real send; one with its own is not doubled
    expect(count(previewHtml('<p>Hi</p>', v), 'app-store-badge.png')).toBe(1);
    expect(count(previewHtml('<html><body><img src="cid:app-store-badge"></body></html>', v), 'app-store-badge.png')).toBe(1);
  });
});

describe('dates in the day boxes', () => {
  it('works out each day from the start date', () => {
    expect(dateForDay('2026-11-17', 'Tuesday')).toBe('2026-11-17');
    expect(dateForDay('2026-11-17', 'Friday')).toBe('2026-11-20');
    expect(dateForDay('2026-11-18', 'Tuesday')).toBe('2026-11-24');
    expect(dateForDay('2026-11-17', 'Funday')).toBe('');
    expect(dateForDay(undefined, 'Tuesday')).toBe('');
    expect(shortDate('2026-11-17')).toBe('Nov 17');
  });
  it('the next menu starts on the next Tuesday (today counts)', () => {
    expect(nextMenuStart('2026-11-16')).toBe('2026-11-17');
    expect(nextMenuStart('2026-11-17')).toBe('2026-11-17');
    expect(nextMenuStart('2026-11-18')).toBe('2026-11-24');
  });
  it('shows the dates in the email and keeps them in a saved draft', () => {
    const d = { ...data(0), weekOf: '2026-11-17' };
    const h = buildMenuEmailHtml(d);
    expect(h).toContain('NOV 17'.replace('NOV 17', 'Nov 17'));
    expect(h).toContain('Nov 20');
    expect(parseMenuEmail(h)?.weekOf).toBe('2026-11-17');
  });
});

describe('long days', () => {
  const dishes = (n: number) => Array.from({ length: n }, (_, i) => `Dish ${i + 1}`).join('\n');
  const mk = (counts: number[]) => ({ ...emptyMenuEmail(), photos: [], days: counts.map((n, i) => ({ day: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'][i], dishes: dishes(n) })) });
  const count = (h: string, s: string) => h.split(s).length - 1;
  it('a day with many dishes lists them in two columns and takes the full width', () => {
    const h = buildMenuEmailHtml(mk([20]));
    expect(count(h, 'Dish ')).toBe(20);
    expect(count(h, 'width="48%"')).toBe(2);
  });
  it('short days pair up; a short day next to a long one stands alone', () => {
    expect(count(buildMenuEmailHtml(mk([3, 4, 5, 6])), 'width="49%"')).toBe(4);
    expect(count(buildMenuEmailHtml(mk([3, 20, 4, 5])), 'width="49%"')).toBe(2);
    expect(count(buildMenuEmailHtml(mk([20, 20, 20, 20])), 'width="49%"')).toBe(0);
    expect(count(buildMenuEmailHtml(mk([3, 4, 5])), 'width="49%"')).toBe(2);
  });
  it('keeps every dish exactly once', () => {
    const h = buildMenuEmailHtml(mk([9, 3, 16, 1]));
    expect(count(h, '>Dish 1<')).toBe(4);
    expect(count(h, '>Dish 2<')).toBe(3);
    expect(count(h, '>Dish 3<')).toBe(3);
    expect(count(h, '>Dish 16<')).toBe(1);
    expect(count(h, '>Dish 9<')).toBe(2);
  });
});
