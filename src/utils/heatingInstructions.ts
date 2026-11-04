/**
 * Heating / storage instructions: the short line printed on a packing sticker ("Keep Refrigerated, Shake Well").
 * Each food item can have one. The list to pick from starts with the instructions the kitchen already uses, and any new
 * instruction typed on an item is added to the list automatically so it can be picked next time.
 * Admin only: the customer site never sees it.
 */

/** The instructions in use today (the starting list). */
export const DEFAULT_HEATING_INSTRUCTIONS: string[] = [
  'Keep Refrigerated, Shake Well',
  'Contains Nuts',
  'Contains Nuts, Consume Same Day',
  'Airfry at 360Deg for 2Min.',
  'Airfry at 360Deg for 45 Seconds',
  'Do not refrigerate',
  'Keep Refrigerated',
  'Keep Refrigerated, Contains Nuts',
  'Keep Refrigerated, take out an Hr. before use',
  'MW for 20 Sec, wrapped in moist kitchen towel',
  'MW for 1Min.,along with a glass of water',
  'Replace Lid to Keep Fresh',
  'Store in an airtight container',
  'Stir Well n Micro for 1 to 1.5Min.',
  'Enjoy with Khatta Meetha Paani',
];

/** The longest instruction that is kept (a sticker has little room). */
export const MAX_HEATING_INSTRUCTION_LENGTH = 120;

/** What to keep from a typed or stored value: one line, trimmed, at most 120 characters; null when there is nothing. */
export function cleanHeatingInstruction(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim().slice(0, MAX_HEATING_INSTRUCTION_LENGTH).trim();
  return text === '' ? null : text;
}

/** The key two spellings of the same instruction share (case and spacing do not matter). */
export function heatingInstructionKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** The list to pick from: the starting list and the saved ones, each instruction once, A to Z. */
export function mergeHeatingInstructions(saved: string[]): string[] {
  const seen = new Map<string, string>();
  for (const text of [...DEFAULT_HEATING_INSTRUCTIONS, ...saved]) {
    const clean = cleanHeatingInstruction(text);
    if (clean && !seen.has(heatingInstructionKey(clean))) seen.set(heatingInstructionKey(clean), clean);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
