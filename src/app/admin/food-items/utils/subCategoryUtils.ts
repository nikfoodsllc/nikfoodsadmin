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

export function resolveSubCategoryId(
  categoryIds: string[] | undefined,
  subCategoryIds: Set<string>
): string {
  if (!categoryIds?.length) return '';
  const match = categoryIds.find((id) => subCategoryIds.has(id));
  return match ?? '';
}
