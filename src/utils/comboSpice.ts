/**
 * Which parts of a combo take the combo's spice level.
 *
 * An admin can set it per section ("Takes spice" in the combo editor). Sections saved before that setting existed have no
 * value, so they keep the old rule: every section takes spice except the staples and breads (chapati, rice).
 */
export function sectionTakesSpice(section: { title?: string | null; takesSpice?: boolean | null }): boolean {
  if (typeof section.takesSpice === 'boolean') return section.takesSpice;
  return !/staple|bread/i.test((section.title ?? '').trim());
}
