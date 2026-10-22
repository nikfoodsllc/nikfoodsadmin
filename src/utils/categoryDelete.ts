export interface CategoryDeleteImpact {
  subCategories: string[]; // names of the sub-categories still under it
  dayWiseItems: number; // day-wise item rows (one per item per day)
  dayWiseDays: number; // distinct days those rows cover
  flatItems: number;
  lockedItems: number; // repeat-weekly locked rows
}

export interface CategoryDeleteVerdict {
  allowed: boolean;
  needsName: boolean; // the admin must type the category name before the delete is accepted
  blockedReason?: string;
  warnings: string[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function deleteVerdict(impact: CategoryDeleteImpact): CategoryDeleteVerdict {
  if (impact.subCategories.length > 0) {
    const list = impact.subCategories.slice(0, 5).join(', ') + (impact.subCategories.length > 5 ? ', ...' : '');
    return {
      allowed: false,
      needsName: false,
      blockedReason: `This category still has ${plural(impact.subCategories.length, 'sub-category', 'sub-categories')} (${list}). Move or delete ${impact.subCategories.length === 1 ? 'it' : 'them'} first.`,
      warnings: [],
    };
  }
  const warnings: string[] = [];
  if (impact.dayWiseItems > 0) {
    warnings.push(`${plural(impact.dayWiseItems, 'day-wise item', 'day-wise items')} across ${plural(impact.dayWiseDays, 'day', 'days')} will stop showing on the menu.`);
  }
  if (impact.flatItems > 0) {
    warnings.push(`${plural(impact.flatItems, 'item', 'items')} will stop showing under it.`);
  }
  if (impact.lockedItems > 0) {
    warnings.push(`${plural(impact.lockedItems, 'locked row', 'locked rows')} will be lost.`);
  }
  return { allowed: true, needsName: warnings.length > 0, warnings };
}

export function nameMatches(typed: string | null | undefined, categoryName: string): boolean {
  return (typed ?? '').trim() === categoryName.trim() && categoryName.trim() !== '';
}
