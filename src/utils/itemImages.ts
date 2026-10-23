/**
 * Photos of a food item.
 *
 * An item keeps `url` / `public_id` for its main photo (the menu card, emails, the app's lists and everything that needs one
 * photo) and an `images` list of { url, public_id }, main photo first, when it has more than one. While a form is open the
 * photos are DraftPhotos: saved ones (already on Cloudinary) and new ones that still hold their File until the item is saved.
 */

export interface SavedImage {
  url: string;
  public_id?: string;
}

export interface DraftPhoto extends SavedImage {
  /** unique within the form */
  key: string;
  /** present for a photo that has not been uploaded yet */
  file?: File;
}

export const MAX_ITEM_PHOTOS = 8;
/** Cloudinary's limit for one image on the free plan */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** What the file picker is allowed to offer (HEIC/HEIF are named because some browsers do not report their type) */
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif';

const ACCEPTED_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

export function isHeic(file: { name?: string; type?: string }): boolean {
  return /heic|heif/i.test(file.type ?? '') || /\.(heic|heif)$/i.test(file.name ?? '');
}

export function isGif(file: { name?: string; type?: string }): boolean {
  return /gif/i.test(file.type ?? '') || /\.gif$/i.test(file.name ?? '');
}

/** An image the site can show once uploaded: JPG, PNG, WebP, GIF, or HEIC/HEIF (converted to JPG on upload). */
export function isAcceptedPhoto(file: { name?: string; type?: string }): boolean {
  const type = (file.type ?? '').toLowerCase();
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp' || type === 'image/gif' || isHeic(file)) return true;
  // some browsers report no type at all
  return !type && ACCEPTED_EXT.test(file.name ?? '');
}

/** Why a file cannot be added, or null. */
export function photoProblem(file: { name?: string; type?: string; size: number }): string | null {
  if (!isAcceptedPhoto(file)) return `${file.name || 'This file'} is not a photo we can use. Use JPG, PNG, WebP, GIF or HEIC.`;
  if (file.size > MAX_PHOTO_BYTES) return `${file.name || 'This photo'} is bigger than 10 MB.`;
  return null;
}

/**
 * The URL to store for an uploaded photo. A HEIC/HEIF upload would be served as .heic, which most browsers cannot show, so
 * it is stored with a .jpg ending (Cloudinary converts on delivery). Everything else is kept as it is (a GIF stays a GIF).
 */
export function storedPhotoUrl(secureUrl: string, format?: string): string {
  if (/^(heic|heif)$/i.test(format ?? '') || /\.(heic|heif)(\?.*)?$/i.test(secureUrl)) {
    return secureUrl.replace(/\.(heic|heif)(\?.*)?$/i, '.jpg$2');
  }
  return secureUrl;
}

let counter = 0;
export function newPhotoKey(): string {
  counter += 1;
  return `p${Date.now().toString(36)}${counter}`;
}

/** The form's photos for an item: its images, or its single url. */
export function photosFromItem(item: { url?: string | null; public_id?: string | null; images?: Array<SavedImage | string> | null } | null | undefined): DraftPhoto[] {
  if (!item) return [];
  const out: DraftPhoto[] = [];
  const seen = new Set<string>();
  const add = (url: unknown, public_id?: unknown) => {
    if (typeof url !== 'string' || !url.trim() || seen.has(url)) return;
    seen.add(url);
    out.push({ key: newPhotoKey(), url, ...(typeof public_id === 'string' && public_id ? { public_id } : {}) });
  };
  for (const entry of item.images ?? []) {
    if (typeof entry === 'string') add(entry);
    else add(entry?.url, entry?.public_id);
  }
  if (out.length === 0) add(item.url, item.public_id);
  return out.slice(0, MAX_ITEM_PHOTOS);
}

export function movePhoto<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** The images to store: the form's photos in order, new ones replaced by what their upload returned. */
export function imagesForSave(photos: DraftPhoto[], uploaded: Map<string, SavedImage>): SavedImage[] {
  const out: SavedImage[] = [];
  for (const photo of photos) {
    if (photo.file) {
      const done = uploaded.get(photo.key);
      if (done) out.push(done);
    } else if (photo.url) {
      out.push({ url: photo.url, ...(photo.public_id ? { public_id: photo.public_id } : {}) });
    }
  }
  return out;
}

/** Cloudinary ids that were on the item before and are not in the new list. */
export function removedPublicIds(before: Array<{ public_id?: string | null }>, after: Array<{ public_id?: string | null }>): string[] {
  const keep = new Set(after.map((i) => i.public_id).filter((id): id is string => Boolean(id)));
  const out = new Set<string>();
  for (const image of before) if (image.public_id && !keep.has(image.public_id)) out.add(image.public_id);
  return [...out];
}

/** The stored image list of an item document, including a legacy item that only has url / public_id. */
export function storedImages(doc: { url?: string | null; public_id?: string | null; images?: Array<{ url?: string; public_id?: string }> | null }): SavedImage[] {
  const out: SavedImage[] = [];
  for (const entry of doc.images ?? []) if (entry?.url) out.push({ url: entry.url, ...(entry.public_id ? { public_id: entry.public_id } : {}) });
  if (doc.url && !out.some((i) => i.url === doc.url)) out.unshift({ url: doc.url, ...(doc.public_id ? { public_id: doc.public_id } : {}) });
  return out;
}
