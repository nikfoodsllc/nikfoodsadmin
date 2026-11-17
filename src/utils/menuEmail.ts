import { C, FONT, SITE_URL, button, footer, hero, shell } from './emailTemplates';
import { addDays, pacificToday } from './communication';

/**
 * The "New menu" email: Kunal fills a short form (a headline, a line or two, 1 to 4 photos with the dish names, and one box of dishes
 * per day) and this builds the email from it. The photos arrange themselves by how many there are, and the HTML carries a hidden copy
 * of the form so a saved draft opens as the form again.
 */
export interface MenuPhoto {
  url: string;
  caption: string;
}
export interface MenuDay {
  day: string;
  /** one dish per line */
  dishes: string;
}
export interface MenuEmailData {
  headline: string;
  intro: string;
  photos: MenuPhoto[];
  days: MenuDay[];
  /** The date the menu starts (YYYY-MM-DD, the first day, a Tuesday by default); every day box gets its own date from it */
  weekOf?: string;
}

export const MENU_DAYS = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export const MAX_MENU_PHOTOS = 4;
export const MAX_MENU_DISHES = 40;
export const MENU_DEFAULT_SUBJECT = "This week's new menu";

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayIndex = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const validDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(`${d}T12:00:00Z`).getTime());

/** The next Tuesday on or after today (Pacific): where a new menu usually starts. */
export function nextMenuStart(today: string = pacificToday()): string {
  const diff = (2 - weekdayIndex(today) + 7) % 7;
  return addDays(today, diff);
}

/** The date of a day box: the first date on or after `weekOf` that falls on that weekday ('' when the name is not a weekday). */
export function dateForDay(weekOf: string | undefined, day: string): string {
  const want = WEEKDAYS.findIndex((w) => w.toLowerCase() === day.trim().toLowerCase());
  if (want < 0 || !validDate(weekOf)) return '';
  return addDays(weekOf, (want - weekdayIndex(weekOf) + 7) % 7);
}

/** "Nov 17" for 2026-11-17. */
export function shortDate(date: string): string {
  return validDate(date) ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
}

export function emptyMenuEmail(): MenuEmailData {
  return { weekOf: nextMenuStart(), headline: 'The new menu is here', intro: 'Fresh Indian food, cooked for the days below.', photos: [], days: MENU_DAYS.map((day) => ({ day, dishes: '' })) };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const oneLine = (s: string) => esc(String(s ?? '').replace(/\s+/g, ' ').trim());

/** The dishes of a day box: one per line, empty lines dropped. */
export function dishesOf(text: string): string[] {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((d) => d.replace(/^\s*[-*•]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, MAX_MENU_DISHES);
}

/** A Cloudinary picture cut to a size mail apps can show (JPEG, cropped to the shape, sharp on phones). Other links stay as they are. */
export function menuPhotoUrl(url: string, width: number, height: number): string {
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
  if (!m || /^(?:[a-z]{1,3}_[^/]*,?)+\//.test(m[2])) return url;
  return `${m[1]}c_fill,g_auto,w_${width},h_${height},q_auto,f_jpg/${m[2]}`;
}

const isHttps = (u: string) => /^https:\/\/[^\s"'<>]+$/i.test(u);
export const usablePhotos = (data: MenuEmailData): MenuPhoto[] => data.photos.filter((p) => isHttps(p.url)).slice(0, MAX_MENU_PHOTOS);
export const filledDays = (data: MenuEmailData): Array<{ day: string; dishes: string[]; date: string }> =>
  data.days.map((d) => ({ day: String(d.day ?? '').trim(), dishes: dishesOf(d.dishes), date: dateForDay(data.weekOf, String(d.day ?? '')) })).filter((d) => d.day && d.dishes.length > 0);

/** What is still missing before the email makes sense, or null. */
export function menuEmailProblem(data: MenuEmailData): string | null {
  if (!data.headline.trim()) return 'Write a headline.';
  if (filledDays(data).length === 0) return 'Put at least one dish in a day box.';
  return null;
}

function photo(p: MenuPhoto, w: number, h: number, widthAttr: string): string {
  return `<td class="${w > 700 ? 'full' : 'half'}" width="${widthAttr}" valign="top" style="width:${widthAttr};padding:0;">
      <img src="${esc(menuPhotoUrl(p.url, w, h))}" alt="${oneLine(p.caption)}" width="${Math.round(w / 2)}" style="display:block;width:100%;height:auto;border:0;border-radius:16px;background:${C.tile};">
      ${p.caption.trim() ? `<div style="font-family:${FONT};font-size:15px;line-height:20px;font-weight:800;color:${C.text};padding:9px 4px 0;">${oneLine(p.caption)}</div>` : ''}
    </td>`;
}
const gapCell = `<td width="12" style="width:12px;font-size:1px;line-height:1px;">&nbsp;</td>`;
const rowOf = (cells: string, bottom = 14) => `<tr><td style="padding:0 0 ${bottom}px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>`;

/** The photos, arranged by how many there are: 1 wide; 2 side by side; 3 one wide and two; 4 in a 2 x 2 grid. */
function photoGrid(photos: MenuPhoto[]): string {
  if (photos.length === 0) return '';
  const wide = (p: MenuPhoto) => rowOf(photo(p, 1152, 648, '100%'));
  const pair = (a: MenuPhoto, b: MenuPhoto) => rowOf(`${photo(a, 564, 423, '49%')}${gapCell}${photo(b, 564, 423, '49%')}`);
  const rows =
    photos.length === 1 ? wide(photos[0])
    : photos.length === 2 ? pair(photos[0], photos[1])
    : photos.length === 3 ? wide(photos[0]) + pair(photos[1], photos[2])
    : pair(photos[0], photos[1]) + pair(photos[2], photos[3]);
  return `  <tr><td class="px" bgcolor="${C.card}" style="padding:28px 32px 6px;background:${C.card};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

const SERIF = "Georgia,'Times New Roman',Times,serif";

/** One day: the day name in a serif face with its date in small caps, a thin gold rule, then the dishes divided by hairlines. */
function dayCard(day: string, dishes: string[], date: string): string {
  const rows = dishes
    .map(
      (d, i) =>
        `<tr><td style="padding:${i === 0 ? 2 : 8}px 0 ${i === dishes.length - 1 ? 2 : 8}px;${i === dishes.length - 1 ? '' : `border-bottom:1px solid ${C.rule};`}font-family:${FONT};font-size:15px;line-height:21px;font-weight:600;letter-spacing:0.1px;color:${C.text};">${oneLine(d)}</td></tr>`
    )
    .join('');
  const dateCell = date ? `<td align="right" valign="bottom" style="font-family:${FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.brandText};padding-bottom:3px;">${esc(shortDate(date))}</td>` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:14px;border-collapse:separate;border:1px solid ${C.line};">
      <tr><td height="3" bgcolor="${C.brand}" style="height:3px;line-height:3px;font-size:1px;background:${C.brand};border-radius:14px 14px 0 0;">&nbsp;</td></tr>
      <tr><td style="padding:14px 18px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="bottom" style="font-family:${SERIF};font-size:22px;line-height:26px;font-weight:700;color:${C.text};">${oneLine(day)}</td>${dateCell}</tr></table></td></tr>
      <tr><td style="padding:10px 18px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" bgcolor="${C.brand}" style="height:1px;line-height:1px;font-size:1px;background:${C.brand};">&nbsp;</td></tr></table></td></tr>
      <tr><td style="padding:8px 18px 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    </table>`;
}

/** The day cards two to a row on a computer (one under the other on a phone); a last one on its own takes the full width. */
function dayGrid(days: Array<{ day: string; dishes: string[]; date: string }>): string {
  const card = (d: { day: string; dishes: string[]; date: string }) => dayCard(d.day, d.dishes, d.date);
  const rows: string[] = [];
  for (let i = 0; i < days.length; i += 2) {
    const a = days[i];
    const b = days[i + 1];
    rows.push(
      b
        ? `<tr><td style="padding:0 0 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="stack" width="49%" valign="top" style="width:49%;">${card(a)}</td>
        <td class="gap" width="12" style="width:12px;font-size:1px;line-height:1px;">&nbsp;</td>
        <td class="stack" width="49%" valign="top" style="width:49%;">${card(b)}</td>
      </tr></table></td></tr>`
        : `<tr><td style="padding:0 0 12px;">${card(a)}</td></tr>`
    );
  }
  return rows.join('');
}

const MARK = 'nfmenu:';
const toB64 = (s: string) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'));
const fromB64 = (s: string) => (typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'));

/** The whole email for the form. */
export function buildMenuEmailHtml(data: MenuEmailData): string {
  const photos = usablePhotos(data);
  const days = filledDays(data);
  const intro = esc(data.intro.trim()).replace(/\r?\n/g, '<br>');
  const html = shell(
    oneLine(data.headline) || 'The new menu',
    oneLine(data.intro) || 'Fresh Indian food, ready to order.',
    `${hero('NEW MENU', oneLine(data.headline), intro)}
${photoGrid(photos)}
  <tr><td class="px" bgcolor="${C.card}" style="padding:${photos.length ? 10 : 24}px 32px 4px;background:${C.card};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr>
      <td valign="middle" style="border-bottom:1px solid ${C.line};font-size:1px;line-height:1px;">&nbsp;</td>
      <td valign="middle" align="center" width="1" style="white-space:nowrap;padding:0 14px;font-family:${SERIF};font-size:20px;line-height:24px;font-style:italic;color:${C.text};">This week&rsquo;s menu</td>
      <td valign="middle" style="border-bottom:1px solid ${C.line};font-size:1px;line-height:1px;">&nbsp;</td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dayGrid(days)}</table>
  </td></tr>
  <tr><td class="px" align="center" bgcolor="${C.card}" style="padding:12px 32px 16px;background:${C.card};">
    ${button('Order now', SITE_URL)}
  </td></tr>
${footer('You are getting this because you signed up for NikFoods updates.')}`
  );
  const state = toB64(JSON.stringify({ weekOf: data.weekOf, headline: data.headline, intro: data.intro, photos: data.photos, days: data.days }));
  return html.replace('</body>', `<!--${MARK}${state}-->\n</body>`);
}

/** The form behind an email made here (a saved draft), or null for any other HTML. */
export function parseMenuEmail(html: string): MenuEmailData | null {
  const m = String(html ?? '').match(new RegExp(`<!--${MARK}([A-Za-z0-9+/=]+)-->`));
  if (!m) return null;
  try {
    const raw = JSON.parse(fromB64(m[1])) as Partial<MenuEmailData>;
    const base = emptyMenuEmail();
    return {
      weekOf: validDate(raw.weekOf) ? raw.weekOf : base.weekOf,
      headline: typeof raw.headline === 'string' ? raw.headline : base.headline,
      intro: typeof raw.intro === 'string' ? raw.intro : base.intro,
      photos: Array.isArray(raw.photos) ? raw.photos.filter((p) => p && typeof p.url === 'string').map((p) => ({ url: p.url, caption: String(p.caption ?? '') })).slice(0, MAX_MENU_PHOTOS) : [],
      days: Array.isArray(raw.days) && raw.days.length > 0 ? raw.days.map((d) => ({ day: String(d?.day ?? ''), dishes: String(d?.dishes ?? '') })) : base.days,
    };
  } catch {
    return null;
  }
}
