import { db } from '@/lib/db';
import { cleanHeatingInstruction, heatingInstructionKey, mergeHeatingInstructions } from '@/utils/heatingInstructions';

const COLLECTION = 'heatingInstructions';

/** Every instruction to pick from: the starting list plus the ones saved from items. */
export async function readHeatingInstructions(): Promise<string[]> {
  const result = await db.read<{ text?: string }>(COLLECTION, {});
  const saved = result.success ? (result.data ?? []).map((row) => row.text ?? '') : [];
  return mergeHeatingInstructions(saved);
}

/** Remembers an instruction typed on an item so it can be picked next time (once per spelling). Never throws. */
export async function rememberHeatingInstruction(value: unknown): Promise<void> {
  const text = cleanHeatingInstruction(value);
  if (!text) return;
  try {
    const database = await db.getDb();
    await database
      .collection(COLLECTION)
      .updateOne({ textKey: heatingInstructionKey(text) }, { $setOnInsert: { text, textKey: heatingInstructionKey(text), createdAt: new Date() } }, { upsert: true });
  } catch (error) {
    console.error('Could not save the heating instruction to the list', error);
  }
}
