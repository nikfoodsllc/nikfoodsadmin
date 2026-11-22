/**
 * Special instructions on an item of an order, edited by an admin in Orders > order details. Only items whose food item has the
 * Special instructions switch on (Food Items, allowInstructions) can carry them, the same rule the customer site uses.
 * Like on the website, one item has ONE instruction per delivery day: saving it on one line also sets it on that day's other
 * lines of the same food (e.g. the same dish ordered in two sizes).
 */

/** Same limit as the customer's box on the website and app (livesite INSTRUCTIONS_MAX). */
export const ITEM_NOTE_MAX = 40;

/** Orders whose item instructions can still be changed: not delivered, not cancelled. */
export const ITEM_NOTE_EDITABLE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];

export const canEditItemNotes = (status: string | undefined) => ITEM_NOTE_EDITABLE_STATUSES.includes(String(status));

/** One tidy line: spaces and line breaks squeezed, cut to the limit. Empty text gives '' (= remove the instructions). */
export function cleanItemNote(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, ITEM_NOTE_MAX).trim();
}

interface NoteLine {
  food?: { _id?: unknown; name?: string };
  notes?: string;
}
interface NoteDay<L extends NoteLine> {
  items: L[];
  deliveryDate?: unknown;
}

export type ApplyNoteResult<D> =
  | { ok: true; days: D[]; foodId: string; name: string; from: string; to: string; lines: number }
  | { ok: false; error: string };

/**
 * Sets (or with empty text removes) the instructions of the item at days[line].items[item] and of every other line of that
 * food on the same day. Returns a new array; the input is not changed. Refuses an unknown line or an unchanged text.
 */
export function applyItemNote<L extends NoteLine, D extends NoteDay<L>>(days: D[], line: number, item: number, text: unknown): ApplyNoteResult<D> {
  const day = Number.isInteger(line) ? days[line] : undefined;
  const target = day && Number.isInteger(item) ? day.items[item] : undefined;
  if (!day || !target) return { ok: false, error: 'That item is not on this order.' };
  const foodId = target.food?._id ? String(target.food._id) : '';
  if (!foodId) return { ok: false, error: 'That item is not on this order.' };
  const to = cleanItemNote(text);
  const from = target.notes ?? '';
  if (to === from) return { ok: false, error: 'Nothing changed.' };
  let lines = 0;
  const next = days.map((d, i) => {
    if (i !== line) return d;
    return {
      ...d,
      items: d.items.map((l) => {
        if (!l.food?._id || String(l.food._id) !== foodId) return l;
        lines += 1;
        const copy = { ...l };
        if (to) copy.notes = to;
        else delete copy.notes;
        return copy;
      }),
    };
  });
  return { ok: true, days: next, foodId, name: target.food?.name ?? 'Item', from, to, lines };
}
