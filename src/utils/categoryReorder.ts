/**
 * Re-ranking a group of sibling categories (the top-level categories, or the sub-categories of one
 * category). A group is always renumbered 1..n in the order given. Pure helpers, no React or database.
 */

/** A copy of `list` with the item at `from` moved to `to` (out-of-range indexes leave it unchanged). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export type ReorderPlan = { ok: true; updates: Array<{ id: string; sequence: number }> } | { ok: false; error: string };

/**
 * Checks that `orderedIds` is exactly the group (every sibling once, nothing else, so a stale page
 * cannot silently drop or invent categories) and returns the rank changes: only the categories whose
 * rank actually changes, numbered from 1.
 */
export function planReorder(siblings: Array<{ id: string; sequence?: number | null }>, orderedIds: unknown): ReorderPlan {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 || !orderedIds.every((id) => typeof id === 'string' && id.length > 0)) {
    return { ok: false, error: 'orderedIds must be a non-empty list of category ids' };
  }
  const ids = orderedIds as string[];
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'orderedIds contains the same category twice' };
  const known = new Map(siblings.map((s) => [s.id, s]));
  if (ids.length !== known.size || !ids.every((id) => known.has(id))) {
    return { ok: false, error: 'The list of categories has changed. Refresh the page and try again.' };
  }
  const updates: Array<{ id: string; sequence: number }> = [];
  ids.forEach((id, index) => {
    if (known.get(id)?.sequence !== index + 1) updates.push({ id, sequence: index + 1 });
  });
  return { ok: true, updates };
}
