import { APP_STORE_LISTING, C, FONT, SITE_URL, footer, hero, shell } from './emailTemplates';
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
/** An extra box (Indian Mithai, Add-On's ...): a banded title and subtitle over a list of dishes. */
export interface MenuSection {
  title: string;
  subtitle: string;
  /** one dish per line */
  items: string;
  /** the flat category its dishes were filled from (so it can be filled again) */
  categoryId?: string;
  /** the saved box it came from or was saved as (saved boxes start every new menu email) */
  savedId?: string;
}
export interface MenuEmailData {
  headline: string;
  intro: string;
  photos: MenuPhoto[];
  days: MenuDay[];
  /** Extra boxes under the days; a box without a title or dishes is left out */
  sections?: MenuSection[];
  /** The date the menu starts (YYYY-MM-DD, the first day, a Tuesday by default); every day box gets its own date from it */
  weekOf?: string;
}

export const MENU_DAYS = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export const MAX_MENU_PHOTOS = 4;
export const MAX_MENU_DISHES = 40;
export const MAX_MENU_SECTIONS = 6;
export const SECTION_SUBTITLE = "Club with any day's delivery";
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
  return { sections: [{ title: 'Indian Mithai', subtitle: SECTION_SUBTITLE, items: '' }, { title: "Add-On's", subtitle: SECTION_SUBTITLE, items: '' }], weekOf: nextMenuStart(), headline: 'The new menu is here', intro: 'Fresh Indian food, cooked for the days below.', photos: [], days: MENU_DAYS.map((day) => ({ day, dishes: '' })) };
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
export const filledSections = (data: MenuEmailData): Array<{ title: string; subtitle: string; items: string[] }> =>
  (data.sections ?? []).map((x) => ({ title: String(x.title ?? '').trim(), subtitle: String(x.subtitle ?? '').trim(), items: dishesOf(x.items) })).filter((x) => x.title && x.items.length > 0).slice(0, MAX_MENU_SECTIONS);

export function menuEmailProblem(data: MenuEmailData): string | null {
  if (!data.headline.trim()) return 'Write a headline.';
  if (filledDays(data).length === 0 && filledSections(data).length === 0) return 'Put at least one dish in a day box.';
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

/** More dishes than this and the day takes the full width with its dishes in two columns (so a long menu does not make a long email). */
export const WIDE_DAY_DISHES = 8;

/** The dishes centred, one under the other, with room to breathe (no lines between them). */
const dishRows = (list: string[]) =>
  list
    .map(
      (d, i) =>
        `<tr><td align="center" style="padding:${i === 0 ? 0 : 5}px 4px ${i === list.length - 1 ? 0 : 5}px;font-family:${FONT};font-size:15px;line-height:21px;font-weight:600;letter-spacing:0.15px;color:${C.text};">${oneLine(d)}</td></tr>`
    )
    .join('');

/** A thin gold rule, a small diamond, a thin gold rule. */
const ornament = `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:10px auto 0;"><tr>
        <td valign="middle" style="padding:0;font-size:1px;line-height:1px;"><table role="presentation" width="30" cellpadding="0" cellspacing="0"><tr><td width="30" height="1" bgcolor="${C.brand}" style="width:30px;height:1px;line-height:1px;font-size:1px;padding:0;background:${C.brand};">&nbsp;</td></tr></table></td>
        <td valign="middle" style="padding:0 9px;font-family:${FONT};font-size:8px;line-height:8px;color:${C.brand};">◆</td>
        <td valign="middle" style="padding:0;font-size:1px;line-height:1px;"><table role="presentation" width="30" cellpadding="0" cellspacing="0"><tr><td width="30" height="1" bgcolor="${C.brand}" style="width:30px;height:1px;line-height:1px;font-size:1px;padding:0;background:${C.brand};">&nbsp;</td></tr></table></td>
      </tr></table>`;

/** One day, like a card on a restaurant menu: its date in small gold capitals, the day in a large serif face, an ornament, then the dishes. */
function dayCard(day: string, dishes: string[], date: string): string {
  const wide = dishes.length > WIDE_DAY_DISHES;
  const half = Math.ceil(dishes.length / 2);
  const rows = wide
    ? `<tr><td class="stack" width="48%" valign="top" style="width:48%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dishRows(dishes.slice(0, half))}</table></td><td class="gap" width="4%" style="width:4%;font-size:1px;line-height:1px;">&nbsp;</td><td class="stack" width="48%" valign="top" style="width:48%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dishRows(dishes.slice(half))}</table></td></tr>`
    : dishRows(dishes);
  const eyebrow = date ? `<div style="font-family:${FONT};font-size:11px;line-height:14px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${C.brandText};padding:0 0 6px;">${esc(shortDate(date))}</div>` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.card}" style="background:${C.card};border-radius:18px;border-collapse:separate;border:1px solid ${C.line};">
      <tr><td align="center" style="padding:18px 20px 0;">${eyebrow}<div style="font-family:${SERIF};font-size:28px;line-height:32px;font-weight:700;letter-spacing:0.3px;color:${C.text};">${oneLine(day)}</div>${ornament}</td></tr>
      <tr><td style="padding:12px 20px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    </table>`;
}

/** A card for the grid: its HTML, and whether it takes the full width (a long list in two columns). */
interface GridCard {
  html: string;
  wide: boolean;
}

/**
 * Cards on a computer: a short card sits next to the next short card (one under the other on a phone); a long card takes the full
 * width with its dishes in two columns; a short card left alone takes the full width too.
 */
function cardGrid(cards: GridCard[]): string {
  const full = (c: GridCard) => `<tr><td style="padding:0 0 12px;">${c.html}</td></tr>`;
  const rows: string[] = [];
  let waiting: GridCard | null = null;
  for (const c of cards) {
    if (c.wide) {
      if (waiting) rows.push(full(waiting));
      waiting = null;
      rows.push(full(c));
    } else if (waiting) {
      rows.push(`<tr><td style="padding:0 0 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="stack" width="49%" valign="top" style="width:49%;">${waiting.html}</td>
        <td class="gap" width="12" style="width:12px;font-size:1px;line-height:1px;">&nbsp;</td>
        <td class="stack" width="49%" valign="top" style="width:49%;">${c.html}</td>
      </tr></table></td></tr>`);
      waiting = null;
    } else {
      waiting = c;
    }
  }
  if (waiting) rows.push(full(waiting));
  return rows.join('');
}

const dayGrid = (days: Array<{ day: string; dishes: string[]; date: string }>) => cardGrid(days.map((d) => ({ html: dayCard(d.day, d.dishes, d.date), wide: d.dishes.length > WIDE_DAY_DISHES })));

/** An extra box: a coloured band with the title and subtitle, then the dishes centred (two columns when there are many). */
function sectionCard(title: string, subtitle: string, items: string[], band: string): string {
  const wide = items.length > WIDE_DAY_DISHES;
  const half = Math.ceil(items.length / 2);
  const rows = wide
    ? `<tr><td class="stack" width="48%" valign="top" style="width:48%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dishRows(items.slice(0, half))}</table></td><td class="gap" width="4%" style="width:4%;font-size:1px;line-height:1px;">&nbsp;</td><td class="stack" width="48%" valign="top" style="width:48%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dishRows(items.slice(half))}</table></td></tr>`
    : dishRows(items);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.card}" style="background:${C.card};border-radius:18px;border-collapse:separate;border:1px solid ${C.line};">
      <tr><td align="center" bgcolor="${band}" style="background:${band};border-radius:17px 17px 0 0;padding:15px 16px 14px;"><div style="font-family:${SERIF};font-size:23px;line-height:28px;font-weight:700;letter-spacing:0.3px;color:${C.cream};">${oneLine(title)}</div>${subtitle ? `<div style="font-family:${FONT};font-size:12px;line-height:17px;font-weight:600;letter-spacing:0.6px;color:#E9DCC4;padding-top:3px;">${oneLine(subtitle)}</div>` : ''}</td></tr>
      <tr><td style="padding:14px 20px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    </table>`;
}

const SECTION_BANDS = [C.strip, '#7A5B20'];
const sectionGrid = (sections: Array<{ title: string; subtitle: string; items: string[] }>) =>
  cardGrid(sections.map((x, i) => ({ html: sectionCard(x.title, x.subtitle, x.items, SECTION_BANDS[i % SECTION_BANDS.length]), wide: x.items.length > WIDE_DAY_DISHES })));

const MARK = 'nfmenu:';
const toB64 = (s: string) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'));
const fromB64 = (s: string) => (typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'));

/** The whole email for the form. */
export function buildMenuEmailHtml(data: MenuEmailData): string {
  const photos = usablePhotos(data);
  const days = filledDays(data);
  const sections = filledSections(data);
  const intro = esc(data.intro.trim()).replace(/\r?\n/g, '<br>');
  const html = shell(
    oneLine(data.headline) || 'The new menu',
    oneLine(data.intro) || 'Fresh Indian food, ready to order.',
    `${hero('NEW MENU', oneLine(data.headline), intro)}
${photoGrid(photos)}
${days.length ? `  <tr><td class="px" bgcolor="${C.card}" style="padding:${photos.length ? 10 : 24}px 32px 4px;background:${C.card};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr>
      <td width="22%" height="12" valign="top" style="width:22%;height:12px;border-bottom:1px solid ${C.line};font-size:1px;line-height:1px;">&nbsp;</td>
      <td align="center" valign="middle" style="padding:0 14px;white-space:nowrap;font-family:${SERIF};font-size:21px;line-height:26px;font-style:italic;color:${C.text};">This week’s menu</td>
      <td width="22%" height="12" valign="top" style="width:22%;height:12px;border-bottom:1px solid ${C.line};font-size:1px;line-height:1px;">&nbsp;</td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dayGrid(days)}</table>
  </td></tr>` : ''}
${sections.length ? `  <tr><td class="px" bgcolor="${C.card}" style="padding:${days.length || photos.length ? 4 : 24}px 32px 4px;background:${C.card};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sectionGrid(sections)}</table>
  </td></tr>` : ''}
  <tr><td class="px" align="center" bgcolor="${C.card}" style="padding:6px 32px 8px;background:${C.card};">
    <a href="${SITE_URL}" style="display:inline-block;vertical-align:middle;margin:4px 6px;padding:11px 28px;background:${C.brand};border-radius:999px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:800;color:#1A1106;">Order now</a><a href="${APP_STORE_LISTING}" style="display:inline-block;vertical-align:middle;margin:4px 6px;"><img src="cid:app-store-badge" alt="Download on the App Store" width="120" height="40" style="display:block;border:0;width:120px;height:40px;"></a>
  </td></tr>
${footer('You are getting this because you signed up for NikFoods updates.', false)}`
  );
  const state = toB64(JSON.stringify({ sections: data.sections, weekOf: data.weekOf, headline: data.headline, intro: data.intro, photos: data.photos, days: data.days }));
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
      sections: Array.isArray(raw.sections) ? raw.sections.map((x) => ({ title: String(x?.title ?? ''), subtitle: String(x?.subtitle ?? ''), items: String(x?.items ?? ''), ...(typeof x?.categoryId === 'string' ? { categoryId: x.categoryId } : {}), ...(typeof x?.savedId === 'string' ? { savedId: x.savedId } : {}) })).slice(0, MAX_MENU_SECTIONS) : [],
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

// ---------------------------------------------------------------------------------------------
// Saved boxes: extra boxes that stay the same for months (shared by every admin), so a new menu email starts with them filled in
// ---------------------------------------------------------------------------------------------

export interface SavedMenuBox {
  id: string;
  title: string;
  subtitle: string;
  items: string;
  categoryId?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const MAX_SAVED_BOXES = MAX_MENU_SECTIONS;

/** A box as it is saved: title, subtitle and dishes cleaned (one per line), or the problem to show */
export function cleanSavedBox(raw: unknown): { box: Omit<SavedMenuBox, 'id' | 'updatedAt' | 'updatedBy'> } | { error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const title = String(r.title ?? '').trim().slice(0, 40);
  if (!title) return { error: 'Give the box a title first.' };
  const subtitle = String(r.subtitle ?? '').trim().slice(0, 60);
  const dishes = dishesOf(String(r.items ?? '')).map((d) => d.slice(0, 80)).slice(0, MAX_MENU_DISHES);
  if (dishes.length === 0) return { error: 'Add at least one dish to the box first.' };
  const categoryId = typeof r.categoryId === 'string' && /^[0-9a-f]{24}$/i.test(r.categoryId) ? r.categoryId : undefined;
  return { box: { title, subtitle, items: dishes.join('\n'), ...(categoryId ? { categoryId } : {}) } };
}

/** Whether a box in the email still matches its saved copy (same title, subtitle and dishes) */
export function sameAsSaved(section: MenuSection, saved: SavedMenuBox | undefined): boolean {
  if (!saved) return false;
  return section.title.trim() === saved.title && section.subtitle.trim() === saved.subtitle && dishesOf(section.items).join('\n') === dishesOf(saved.items).join('\n');
}

/** A new menu email's boxes: the saved ones when there are any, otherwise the starting boxes */
export function startingSections(saved: SavedMenuBox[]): MenuSection[] {
  if (saved.length === 0) return emptyMenuEmail().sections ?? [];
  return saved.slice(0, MAX_MENU_SECTIONS).map((b) => ({ title: b.title, subtitle: b.subtitle, items: b.items, savedId: b.id, ...(b.categoryId ? { categoryId: b.categoryId } : {}) }));
}

/** True for an email whose boxes nobody has touched yet (no dishes, none from a saved box): it may take the saved boxes */
export function sectionsUntouched(sections: MenuSection[] | undefined): boolean {
  return (sections ?? []).every((x) => !x.savedId && dishesOf(x.items).length === 0);
}
