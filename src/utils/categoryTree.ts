/**
 * Orders food categories as a tree for the Food Category page: each category followed by its own
 * sub-categories, both by rank (`sequence`, then name). Pure helpers, no React.
 */

export interface TreeCategory {
  _id?: unknown;
  parentCategoryId?: unknown;
  name: string;
  sequence?: number;
}

export interface CategoryGroup<T extends TreeCategory> {
  /** The top-level category, or null when it is not in the list (e.g. hidden by a filter). */
  parent: T | null;
  parentId: string;
  /** Name of the parent even when it is not listed (for the caption); empty when unknown. */
  parentName: string;
  children: T[];
}

const idOf = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

/** True for a category that points at a parent. */
export function hasParent(category: TreeCategory): boolean {
  return idOf(category.parentCategoryId).length > 0;
}

/** Rank order: lowest sequence first (missing counts as 0, like the old page), ties by name. */
export function byRank(a: TreeCategory, b: TreeCategory): number {
  const diff = (a.sequence ?? 0) - (b.sequence ?? 0);
  return diff !== 0 ? diff : a.name.localeCompare(b.name);
}

/**
 * Groups `shown` into [category, its sub-categories] blocks in rank order. `all` is every category
 * (used to order and name the parents of sub-categories whose parent is filtered out of `shown`);
 * it defaults to `shown`. Sub-categories whose parent is unknown go last in one group with parent null.
 */
export function groupCategoriesByParent<T extends TreeCategory>(shown: T[], all: T[] = shown): CategoryGroup<T>[] {
  const allById = new Map(all.map((c) => [idOf(c._id), c]));
  const shownTop = shown.filter((c) => !hasParent(c));
  const childrenByParent = new Map<string, T[]>();
  for (const child of shown.filter(hasParent)) {
    const key = idOf(child.parentCategoryId);
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), child]);
  }

  const groups: CategoryGroup<T>[] = [];
  const used = new Set<string>();

  for (const parent of [...shownTop].sort(byRank)) {
    const key = idOf(parent._id);
    used.add(key);
    groups.push({ parent, parentId: key, parentName: parent.name, children: (childrenByParent.get(key) ?? []).slice().sort(byRank) });
  }

  // sub-categories whose parent is not shown: one group per parent, placed by the parent's rank
  const strays: CategoryGroup<T>[] = [];
  for (const [key, children] of childrenByParent) {
    if (used.has(key)) continue;
    const known = allById.get(key);
    strays.push({ parent: null, parentId: key, parentName: known?.name ?? '', children: children.slice().sort(byRank) });
  }
  strays.sort((a, b) => {
    const pa = allById.get(a.parentId);
    const pb = allById.get(b.parentId);
    if (pa && pb) return byRank(pa, pb);
    if (pa) return -1;
    if (pb) return 1;
    return a.parentId.localeCompare(b.parentId);
  });

  // merge strays between the shown groups by the parent's rank, unknown parents last
  const merged: CategoryGroup<T>[] = [];
  const rankOf = (g: CategoryGroup<T>) => g.parent ?? allById.get(g.parentId) ?? null;
  const pending = [...strays];
  for (const group of groups) {
    while (pending.length > 0) {
      const next = rankOf(pending[0]);
      if (next && byRank(next, group.parent as T) < 0) merged.push(pending.shift() as CategoryGroup<T>);
      else break;
    }
    merged.push(group);
  }
  return [...merged, ...pending];
}

/**
 * The sub-category grid under the category columns: row r holds the r-th sub-category of every group
 * (null where a group has fewer), so each group's sub-categories read top to bottom in its column.
 */
export function categoryTableRows<T extends TreeCategory>(groups: CategoryGroup<T>[]): Array<Array<T | null>> {
  const rowCount = groups.reduce((max, g) => Math.max(max, g.children.length), 0);
  return Array.from({ length: rowCount }, (_, r) => groups.map((g) => g.children[r] ?? null));
}
