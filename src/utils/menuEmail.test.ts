import { describe, expect, it } from 'vitest';
import { buildMenuEmailHtml, dishesOf, emptyMenuEmail, menuEmailProblem, menuPhotoUrl, parseMenuEmail, usablePhotos, type MenuEmailData } from './menuEmail';
import { htmlProblem } from './communication';

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
});
