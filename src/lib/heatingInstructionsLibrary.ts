import { db } from '@/lib/db';
import { DEFAULT_HEATING_INSTRUCTIONS, cleanHeatingInstruction, heatingInstructionKey } from '@/utils/heatingInstructions';

const COLLECTION = 'heatingInstructions';
const SEED_MARKER_ID = 'seeded';

/** Compares an item's text with an instruction key, ignoring capitals (stored texts have their spaces tidied already). */
const sameKeyExpr = (key: string) => ({ $expr: { $eq: [{ $toLower: { $ifNull: ['$heatingInstructions', ''] } }, key] } });

/**
 * The list is stored in the database. The first time it is read it is filled with the instructions the kitchen uses today (once:
 * after that, an instruction that was deleted stays deleted).
 */
async function ensureSeeded(): Promise<void> {
  const database = await db.getDb();
  const col = database.collection<{ _id: string }>(COLLECTION);
  if (await col.findOne({ _id: SEED_MARKER_ID })) return;
  const now = new Date();
  for (const text of DEFAULT_HEATING_INSTRUCTIONS) {
    await database.collection(COLLECTION).updateOne({ textKey: heatingInstructionKey(text) }, { $setOnInsert: { text, textKey: heatingInstructionKey(text), createdAt: now } }, { upsert: true });
  }
  await col.updateOne({ _id: SEED_MARKER_ID }, { $setOnInsert: { createdAt: now } }, { upsert: true });
}

async function readRows(): Promise<string[]> {
  await ensureSeeded();
  const database = await db.getDb();
  const rows = await database.collection(COLLECTION).find({ textKey: { $exists: true } }).toArray();
  return rows.map((r) => String(r.text ?? '')).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Every instruction to pick from, A to Z. */
export async function readHeatingInstructions(): Promise<string[]> {
  return readRows();
}

/** The same list with the number of food items that use each instruction. */
export async function readHeatingInstructionsWithCounts(): Promise<Array<{ text: string; count: number }>> {
  const texts = await readRows();
  const database = await db.getDb();
  const grouped = await database
    .collection('fooditems')
    .aggregate<{ _id: string; count: number }>([
      { $match: { heatingInstructions: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: { $toLower: '$heatingInstructions' }, count: { $sum: 1 } } },
    ])
    .toArray();
  const counts = new Map(grouped.map((g) => [g._id, g.count]));
  return texts.map((text) => ({ text, count: counts.get(heatingInstructionKey(text)) ?? 0 }));
}

/** Remembers an instruction typed on an item so it can be picked next time (once per spelling). Never throws. */
export async function rememberHeatingInstruction(value: unknown): Promise<void> {
  const text = cleanHeatingInstruction(value);
  if (!text) return;
  try {
    await ensureSeeded();
    const database = await db.getDb();
    await database
      .collection(COLLECTION)
      .updateOne({ textKey: heatingInstructionKey(text) }, { $setOnInsert: { text, textKey: heatingInstructionKey(text), createdAt: new Date() } }, { upsert: true });
  } catch (error) {
    console.error('Could not save the heating instruction to the list', error);
  }
}

export type AddResult = { ok: true; text: string } | { ok: false; error: string; status: number };

/** Adds an instruction to the list without putting it on an item. An instruction already in the list (any capitals) is refused. */
export async function addHeatingInstruction(textRaw: unknown): Promise<AddResult> {
  const text = cleanHeatingInstruction(textRaw);
  if (!text) return { ok: false, error: 'Type the instruction first', status: 400 };
  await ensureSeeded();
  const database = await db.getDb();
  const key = heatingInstructionKey(text);
  const result = await database.collection(COLLECTION).updateOne({ textKey: key }, { $setOnInsert: { text, textKey: key, createdAt: new Date() } }, { upsert: true });
  if (result.upsertedCount === 0) return { ok: false, error: 'That instruction is already in the list', status: 409 };
  return { ok: true, text };
}

export type RenameResult = { ok: true; updatedItems: number; merged: boolean } | { ok: false; error: string; status: number };

/**
 * Renames an instruction everywhere: in the list and on every food item that uses it (so their stickers change too).
 * Renaming to an instruction that already exists merges the two.
 */
export async function renameHeatingInstruction(fromRaw: unknown, toRaw: unknown): Promise<RenameResult> {
  const from = cleanHeatingInstruction(fromRaw);
  const to = cleanHeatingInstruction(toRaw);
  if (!from) return { ok: false, error: 'Which instruction?', status: 400 };
  if (!to) return { ok: false, error: 'The new text is empty', status: 400 };
  await ensureSeeded();
  const database = await db.getDb();
  const col = database.collection(COLLECTION);
  const fromKey = heatingInstructionKey(from);
  const toKey = heatingInstructionKey(to);
  const row = await col.findOne({ textKey: fromKey });
  if (!row) return { ok: false, error: 'That instruction is not in the list', status: 404 };
  let merged = false;
  if (toKey !== fromKey && (await col.findOne({ textKey: toKey }))) {
    // the new text already exists: the old row goes away and its items join the existing one
    await col.deleteOne({ textKey: fromKey });
    merged = true;
  } else {
    await col.updateOne({ textKey: fromKey }, { $set: { text: to, textKey: toKey } });
  }
  const items = await database.collection('fooditems').updateMany(sameKeyExpr(fromKey), { $set: { heatingInstructions: to, updatedAt: new Date() } });
  return { ok: true, updatedItems: items.modifiedCount, merged };
}

export type DeleteResult = { ok: true; clearedItems: number } | { ok: false; error: string; status: number };

/** Takes an instruction out of the list and clears it from every food item that uses it. */
export async function deleteHeatingInstruction(textRaw: unknown): Promise<DeleteResult> {
  const text = cleanHeatingInstruction(textRaw);
  if (!text) return { ok: false, error: 'Which instruction?', status: 400 };
  await ensureSeeded();
  const database = await db.getDb();
  const key = heatingInstructionKey(text);
  const removed = await database.collection(COLLECTION).deleteOne({ textKey: key });
  if (removed.deletedCount === 0) return { ok: false, error: 'That instruction is not in the list', status: 404 };
  const items = await database.collection('fooditems').updateMany(sameKeyExpr(key), { $unset: { heatingInstructions: '' }, $set: { updatedAt: new Date() } });
  return { ok: true, clearedItems: items.modifiedCount };
}
