import { db } from '@/lib/db';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { SavedImage, removedPublicIds, storedImages } from '@/utils/itemImages';
import type { Filter, Document } from 'mongodb';

/**
 * The images an incoming save wants stored: its `images` list, or (older clients) its single url / public_id. The first
 * image is the item's main photo, so url / public_id are set from it.
 */
export function incomingImages(data: { url?: string | null; public_id?: string | null; images?: Array<{ url?: string; public_id?: string }> | null }): SavedImage[] {
  const out: SavedImage[] = [];
  for (const entry of data.images ?? []) {
    if (entry?.url && !out.some((i) => i.url === entry.url)) out.push({ url: entry.url, ...(entry.public_id ? { public_id: entry.public_id } : {}) });
  }
  if (out.length === 0 && data.url) out.push({ url: data.url, ...(data.public_id ? { public_id: data.public_id } : {}) });
  return out;
}

/** The fields to write for a set of images (empty list clears them). */
export function imageFields(images: SavedImage[]): { url: string; public_id: string; images: SavedImage[] } {
  return { url: images[0]?.url ?? '', public_id: images[0]?.public_id ?? '', images };
}

/** Deletes Cloudinary photos that no food item uses any more. A photo another item (for example a duplicate) still points at is kept. */
export async function deleteUnusedPhotos(publicIds: string[], exceptItemId?: unknown): Promise<void> {
  for (const id of new Set(publicIds.filter(Boolean))) {
    const filter: Filter<Document> = { $or: [{ public_id: id }, { 'images.public_id': id }] };
    if (exceptItemId) (filter as Record<string, unknown>)._id = { $ne: exceptItemId };
    const used = await db.count<Document>('fooditems', filter);
    if (used.success && (used.count ?? 0) > 0) continue;
    const result = await deleteFromCloudinary(id);
    if (!result.success) console.error('Failed to delete photo from Cloudinary:', id, result.error);
  }
}

/** After an update: remove the photos the item no longer has. */
export async function deleteRemovedPhotos(before: Parameters<typeof storedImages>[0], after: SavedImage[], itemId: unknown): Promise<void> {
  await deleteUnusedPhotos(removedPublicIds(storedImages(before), after), itemId);
}
