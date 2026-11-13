export interface RawCategory {
  _id?: unknown;
  name: string;
  parentCategoryId?: unknown;
}

export interface SubCategoryOption {
  _id: string;
  name: string;
  parentName: string;
  label: string;
}

export interface CategoryLookup {
  _id: string;
  name: string;
}

export function toIdString(id: unknown): string {
  if (id == null) return '';
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id !== null && 'toString' in id && typeof id.toString === 'function') {
    return id.toString();
  }
  return String(id);
}

export function categoryHasParent(cat: { parentCategoryId?: unknown }): boolean {
  const p = cat.parentCategoryId;
  if (p === undefined || p === null) return false;
  if (typeof p === 'string') return p.trim().length > 0;
  return true;
}

export function normalizeCategories(raw: RawCategory[]): CategoryLookup[] {
  return raw.map((cat) => ({
    _id: toIdString(cat._id),
    name: cat.name,
  }));
}

export function buildSubCategoryOptions(raw: RawCategory[]): SubCategoryOption[] {
  const all = raw.map((cat) => ({
    _id: toIdString(cat._id),
    name: cat.name,
    parentCategoryId: categoryHasParent(cat) ? toIdString(cat.parentCategoryId) : '',
  }));

  const parentNameById = new Map(
    all.filter((c) => !c.parentCategoryId).map((c) => [c._id, c.name])
  );

  return all
    .filter((c) => c.parentCategoryId)
    .map((c) => {
      const parentName = parentNameById.get(c.parentCategoryId) ?? 'Unknown';
      return {
        _id: c._id,
        name: c.name,
        parentName,
        label: `${parentName} → ${c.name}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveSubCategoryIds(
  categoryIds: string[] | undefined,
  subCategoryIds: Set<string>
): string[] {
  if (!categoryIds?.length) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of categoryIds) {
    if (subCategoryIds.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}

/** Save only the selected sub-category FLAT mappings (deduped). DAY_WISE rows are managed separately. */
export function mergeCategoryIdsForSave(
  selectedSubCategoryIds: string[],
  _existingCategoryIds: string[] | undefined,
  subCategoryIds: Set<string>
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of selectedSubCategoryIds) {
    if (subCategoryIds.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}

/** Resolve unique sub-category display names from a food item's category ID list. */
export function resolveSubCategoryNames(
  categoryIds: string[] | undefined,
  subCategories: SubCategoryOption[]
): string[] {
  if (!categoryIds?.length) return [];

  const subNameById = new Map(subCategories.map((sub) => [sub._id, sub.name]));
  const seen = new Set<string>();
  const names: string[] = [];

  for (const id of categoryIds) {
    const name = subNameById.get(id);
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  return names;
}
