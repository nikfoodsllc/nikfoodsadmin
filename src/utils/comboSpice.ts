/**
 * Spice inside combos.
 *
 * A combo has one spice level for the whole combo (selectedSpiceLevel on the line). An admin can change that per section:
 *  - takesSpice: does the combo's spice level apply to what is picked in this section? (missing = every section except
 *    staples/breads, the rule used before the setting existed)
 *  - ownSpice: the customer picks a spice level for this section separately (only for sections that take spice).
 *
 * A section's own pick is stored next to the item picks, in the same `comboSelections` object, under the key
 * `spice:<sectionId>` with the level as the only value. That way it travels with the cart line, the order, reorders,
 * drafts and admin-entered orders without new fields; code that looks sections up by id never sees these keys.
 * Keep this file in step with livesite/src/lib/comboSpice.ts and nikfoods-mobile/lib/comboSpice.ts.
 */

export const COMBO_SPICE_PREFIX = 'spice:';

export interface SpiceSection {
  _id?: string;
  title?: string | null;
  takesSpice?: boolean | null;
  ownSpice?: boolean | null;
  selectedItems?: unknown[];
}

type Selections = Record<string, string[]> | null | undefined;

export function sectionTakesSpice(section: Pick<SpiceSection, 'title' | 'takesSpice'>): boolean {
  if (typeof section.takesSpice === 'boolean') return section.takesSpice;
  return !/staple|bread/i.test((section.title ?? '').trim());
}

/** The customer picks this section's spice separately. */
export function sectionOwnsSpice(section: SpiceSection): boolean {
  return section.ownSpice === true && sectionTakesSpice(section);
}

export function comboSpiceKey(sectionId: string): string {
  return `${COMBO_SPICE_PREFIX}${sectionId}`;
}

export function isComboSpiceKey(key: string): boolean {
  return key.startsWith(COMBO_SPICE_PREFIX);
}

/** The spice level picked for a section, or null. */
export function getSectionSpice(selections: Selections, sectionId: string | undefined): string | null {
  if (!selections || !sectionId) return null;
  const value = selections[comboSpiceKey(sectionId)];
  const level = Array.isArray(value) ? value[0] : (value as unknown as string | undefined);
  return typeof level === 'string' && level.trim() ? level.trim() : null;
}

/** A copy of the selections with a section's spice set (null / '' removes it). */
export function withSectionSpice(selections: Selections, sectionId: string, level: string | null): Record<string, string[]> {
  const next: Record<string, string[]> = { ...(selections ?? {}) };
  if (level && level.trim()) next[comboSpiceKey(sectionId)] = [level.trim()];
  else delete next[comboSpiceKey(sectionId)];
  return next;
}

/** The item picks only (without the spice keys). */
export function itemSelectionsOnly(selections: Selections): Record<string, string[]> {
  return Object.fromEntries(Object.entries(selections ?? {}).filter(([key]) => !isComboSpiceKey(key)));
}

/** Sections whose spice the customer picks on their own. */
export function ownSpiceSections<T extends SpiceSection>(sections: T[] | null | undefined): T[] {
  return (sections ?? []).filter(sectionOwnsSpice);
}

/**
 * Whether the customer still picks ONE spice level for the whole combo: yes, unless some section has its own choice and
 * no section is left that shares the combo's level. (Combos without the new settings behave as before.)
 */
export function comboNeedsOverallSpice(food: { hasSpiceLevel?: boolean | null; sections?: SpiceSection[] | null }): boolean {
  if (!food.hasSpiceLevel) return false;
  const own = ownSpiceSections(food.sections);
  if (own.length === 0) return true;
  return (food.sections ?? []).some((s) => sectionTakesSpice(s) && !sectionOwnsSpice(s));
}

/** Sections with their own spice choice that the customer has picked something in but not yet chosen a level for. */
export function sectionsMissingSpice<T extends SpiceSection>(
  food: { hasSpiceLevel?: boolean | null; spiceLevel?: string[] | null; sections?: T[] | null },
  selections: Selections,
): T[] {
  if (!food.hasSpiceLevel || (food.spiceLevel?.length ?? 0) === 0) return [];
  return ownSpiceSections(food.sections).filter((s) => {
    const picked = (s._id && selections?.[s._id]) || [];
    return picked.length > 0 && !getSectionSpice(selections, s._id);
  });
}

/** The spice level that applies to the parts picked in a section of an ordered combo ('' = none). */
export function spiceForSection(
  section: SpiceSection,
  selections: Selections,
  comboLevel: string | null | undefined,
): string {
  if (!sectionTakesSpice(section)) return '';
  if (sectionOwnsSpice(section)) return getSectionSpice(selections, section._id) ?? (comboLevel ?? '').trim();
  return (comboLevel ?? '').trim();
}

/** Drops spice picks that no longer mean anything: the section has no pick left, or it no longer has its own spice choice. */
export function pruneSectionSpice(sections: SpiceSection[] | null | undefined, selections: Selections): Record<string, string[]> {
  const out: Record<string, string[]> = { ...(selections ?? {}) };
  for (const key of Object.keys(out)) {
    if (!isComboSpiceKey(key)) continue;
    const id = key.slice(COMBO_SPICE_PREFIX.length);
    const section = (sections ?? []).find((s) => s._id === id);
    const picked = (out[id] ?? []).length > 0;
    if (!section || !sectionOwnsSpice(section) || !picked) delete out[key];
  }
  return out;
}
