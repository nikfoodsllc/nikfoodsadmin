/**
 * Home-page banners (shown on the website and in the app). What an admin may save, and how a banner stands right now.
 * The customer site reads the same `banners` collection (GET /api/banners there).
 */
export type BannerLinkType = 'none' | 'category' | 'url';
export type BannerStatus = 'live' | 'scheduled' | 'ended' | 'off';

export interface BannerInput {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkType: BannerLinkType;
  categoryId: string;
  url: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

export const MAX_BANNERS = 20;
export const TITLE_MAX = 60;
export const SUBTITLE_MAX = 100;

const isHttps = (v: string) => /^https:\/\/[^\s]+$/i.test(v);
const dateOrNull = (v: unknown): Date | null | 'bad' => {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : 'bad';
};

/** Checks what the admin typed. Returns the cleaned banner or a plain sentence saying what is wrong. */
export function validateBanner(body: unknown): { ok: true; value: BannerInput } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const title = String(b.title ?? '').trim();
  const subtitle = String(b.subtitle ?? '').trim();
  const imageUrl = String(b.imageUrl ?? '').trim();
  const linkType = (b.linkType === 'category' || b.linkType === 'url' ? b.linkType : 'none') as BannerLinkType;
  const categoryId = String(b.categoryId ?? '').trim();
  const url = String(b.url ?? '').trim();

  if (!imageUrl) return { ok: false, error: 'Add a picture' };
  if (!isHttps(imageUrl) || imageUrl.length > 600) return { ok: false, error: 'The picture address is not valid' };
  if (title.length > TITLE_MAX) return { ok: false, error: `The title can be ${TITLE_MAX} characters` };
  if (subtitle.length > SUBTITLE_MAX) return { ok: false, error: `The line under the title can be ${SUBTITLE_MAX} characters` };
  if (linkType === 'category' && !/^[a-f0-9]{24}$/i.test(categoryId)) return { ok: false, error: 'Choose a category' };
  if (linkType === 'url' && (!isHttps(url) || url.length > 500)) return { ok: false, error: 'The web link must start with https://' };
  const startsAt = dateOrNull(b.startsAt);
  const endsAt = dateOrNull(b.endsAt);
  if (startsAt === 'bad' || endsAt === 'bad') return { ok: false, error: 'A date is not valid' };
  if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) return { ok: false, error: 'The end must be after the start' };

  return {
    ok: true,
    value: {
      title,
      subtitle,
      imageUrl,
      linkType,
      categoryId: linkType === 'category' ? categoryId : '',
      url: linkType === 'url' ? url : '',
      active: b.active === false ? false : true,
      startsAt,
      endsAt,
    },
  };
}

/** Where a banner stands at `now`: Live (customers see it), Scheduled (starts later), Ended, or Off (switched off). */
export function bannerStatus(b: { active?: boolean; startsAt?: Date | string | null; endsAt?: Date | string | null }, now: Date = new Date()): BannerStatus {
  if (b.active === false) return 'off';
  const start = b.startsAt ? new Date(b.startsAt).getTime() : null;
  const end = b.endsAt ? new Date(b.endsAt).getTime() : null;
  if (start !== null && Number.isFinite(start) && now.getTime() < start) return 'scheduled';
  if (end !== null && Number.isFinite(end) && now.getTime() > end) return 'ended';
  return 'live';
}

/** The banner ids in the order they should now have (a moved one first moved to `to`); ids not in the list are left out. */
export function moveId(ids: string[], id: string, to: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const out = ids.slice();
  out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, id);
  return out;
}
