/**
 * Helpers for the Create Order (BETA) screen: the menu as the customer site sends it, the lines the admin picks,
 * and the checks that run before anything is sent. Prices shown here are estimates; the customer site works out
 * the real ones (the screen always shows its numbers as the total).
 */

export interface MenuSelectedItem {
  _id: string;
  item?: { name?: string };
  portion?: string;
  price: number;
  isDefault?: boolean;
}

export interface MenuComboSection {
  _id: string;
  title: string;
  isRequired: boolean;
  minSelection: number;
  maxSelection: number;
  selectedItems: MenuSelectedItem[];
}

export interface MenuItem {
  _id: string;
  name: string;
  price: number;
  veg?: boolean;
  description?: string;
  short_description?: string;
  portions?: string[];
  portionPrices?: number[];
  hasSpiceLevel?: boolean;
  spiceLevel?: string[];
  isEcoFriendlyContainer?: boolean;
  ecoContainerCharge?: number;
  hasCombo?: boolean;
  sections?: MenuComboSection[];
}

export interface MenuDate {
  date: string;
  fullDate?: string;
  formattedDate?: string;
  isPast?: boolean;
  isPastCutoff?: boolean;
  flatCategoryEnabled: boolean;
  dayWiseCategoryEnabled: boolean;
}

export interface MenuCategory {
  _id: string;
  name: string;
  listingType: 'flat' | 'day-wise';
  foodItems: MenuItem[];
  dayWiseItems: Record<string, MenuItem[]> | null;
}

export interface MenuPayload {
  categoryItems: Record<string, MenuCategory>;
  dates: MenuDate[];
  openDates: string[];
}

export interface ItemGroup {
  category: string;
  items: MenuItem[];
}

/** Menu items on sale for a day, grouped by category (flat categories every open day, day-wise ones on their own date). */
export function itemGroupsForDay(menu: MenuPayload, date: string): ItemGroup[] {
  const day = menu.dates.find((d) => d.date === date);
  if (!day) return [];
  const groups: ItemGroup[] = [];
  for (const category of Object.values(menu.categoryItems)) {
    let items: MenuItem[] = [];
    if (category.listingType === 'flat') {
      if (day.flatCategoryEnabled) items = category.foodItems ?? [];
    } else if (day.dayWiseCategoryEnabled) {
      items = category.dayWiseItems?.[date] ?? [];
    }
    if (items.length > 0) groups.push({ category: category.name, items });
  }
  return groups;
}

/** What the admin picked for one line, as the customer site expects it. */
export interface OrderLine {
  date: string;
  foodItemId: string;
  quantity: number;
  selectedPortion?: string;
  selectedSpiceLevel?: string;
  isEcoFriendlyContainer?: boolean;
  comboSelections?: Record<string, string[]>;
  notes?: string;
}

/** A line in the screen's list: the pick plus what is needed to show it. */
export interface CartLine extends OrderLine {
  key: string;
  name: string;
  /** Estimated price of one unit (portion + eco + priced combo options) */
  unitPrice: number;
  tags: string[];
}

/** Two picks of the same item with the same options are one line with a bigger quantity. */
export function lineSignature(line: OrderLine): string {
  const combo = Object.keys(line.comboSelections ?? {})
    .sort()
    .map((k) => `${k}:${[...(line.comboSelections?.[k] ?? [])].sort().join('+')}`)
    .join('|');
  return [line.date, line.foodItemId, line.selectedPortion ?? '', line.selectedSpiceLevel ?? '', line.isEcoFriendlyContainer ? 'eco' : '', combo, (line.notes ?? '').trim()].join('~');
}

export function addLine(lines: CartLine[], incoming: Omit<CartLine, 'key'>): CartLine[] {
  const key = lineSignature(incoming);
  const existing = lines.find((l) => l.key === key);
  if (existing) return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, l.quantity + incoming.quantity) } : l));
  return [...lines, { ...incoming, key }];
}

export function setLineQuantity(lines: CartLine[], key: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.key !== key);
  return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, Math.floor(quantity)) } : l));
}

/** Estimated unit price of an item with these options (the site recomputes it). */
export function estimateUnitPrice(
  item: MenuItem,
  pick: { selectedPortion?: string; isEcoFriendlyContainer?: boolean; comboSelections?: Record<string, string[]> }
): number {
  let price = Number(item.price) || 0;
  if (pick.selectedPortion && item.portions) {
    const at = item.portions.indexOf(pick.selectedPortion);
    const portionPrice = at >= 0 ? item.portionPrices?.[at] : undefined;
    if (portionPrice !== undefined && portionPrice !== null) price = Number(portionPrice);
  }
  if (pick.isEcoFriendlyContainer) price += Number(item.ecoContainerCharge) || 0;
  for (const section of item.sections ?? []) {
    for (const id of pick.comboSelections?.[section._id] ?? []) {
      const option = section.selectedItems.find((o) => o._id === id);
      if (option && option.price > 0) price += option.price;
    }
  }
  return Math.round(price * 100 + 1e-9) / 100;
}

/** The problem with a pick (a sentence), or null when it is complete. Mirrors what the site will check. */
export function pickProblem(
  item: MenuItem,
  pick: { selectedPortion?: string; selectedSpiceLevel?: string; comboSelections?: Record<string, string[]> }
): string | null {
  if ((item.portions?.length ?? 0) > 0 && !pick.selectedPortion) return 'Choose a size';
  if (item.hasSpiceLevel && (item.spiceLevel?.length ?? 0) > 0 && !pick.selectedSpiceLevel) return 'Choose a spice level';
  if (item.hasCombo) {
    for (const section of item.sections ?? []) {
      const chosen = pick.comboSelections?.[section._id]?.length ?? 0;
      const min = section.isRequired ? Math.max(section.minSelection || 0, 1) : section.minSelection || 0;
      if (chosen < min) return `Choose at least ${min} for ${section.title}`;
      if (section.maxSelection && chosen > section.maxSelection) return `Choose no more than ${section.maxSelection} for ${section.title}`;
    }
  }
  return null;
}

/** Items whose pick needs the options dialog (anything with a choice); the rest are added with one tap. */
export function needsOptions(item: MenuItem): boolean {
  return (
    (item.portions?.length ?? 0) > 0 ||
    (Boolean(item.hasSpiceLevel) && (item.spiceLevel?.length ?? 0) > 0) ||
    Boolean(item.isEcoFriendlyContainer) ||
    (Boolean(item.hasCombo) && (item.sections?.length ?? 0) > 0)
  );
}

/** Tags shown under a line: size, spice, eco, and the combo choices by name. */
export function lineTags(
  item: MenuItem,
  pick: { selectedPortion?: string; selectedSpiceLevel?: string; isEcoFriendlyContainer?: boolean; comboSelections?: Record<string, string[]> }
): string[] {
  const tags: string[] = [];
  if (pick.selectedPortion) tags.push(pick.selectedPortion);
  if (pick.selectedSpiceLevel) tags.push(pick.selectedSpiceLevel);
  if (pick.isEcoFriendlyContainer) tags.push('Eco container');
  for (const section of item.sections ?? []) {
    const names = (pick.comboSelections?.[section._id] ?? [])
      .map((id) => section.selectedItems.find((o) => o._id === id))
      .filter(Boolean)
      .map((o) => `${o!.item?.name ?? 'Item'}${o!.portion ? ` (${o!.portion})` : ''}`);
    if (names.length > 0) tags.push(`${section.title}: ${names.join(', ')}`);
  }
  return tags;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function phoneDigits(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

export interface AddressForm {
  street_address: string;
  apartment: string;
  city: string;
  postal_code: string;
  entrance: string;
  floor: string;
}

export interface CustomerForm {
  name: string;
  email: string;
  phone: string;
}

/** What is still missing before the order can be created, in the order the screen shows it. */
export function missingForCreate(customer: CustomerForm, address: AddressForm, lineCount: number): string[] {
  const missing: string[] = [];
  if (customer.name.trim().length < 2) missing.push('Customer name');
  if (!EMAIL_RE.test(customer.email.trim())) missing.push('A valid customer email');
  if (phoneDigits(customer.phone).length !== 10) missing.push('A 10 digit phone number');
  if (address.street_address.trim().length < 5) missing.push('Street address');
  if (address.city.trim().length < 2) missing.push('City');
  if (!/^\d{5}(-\d{4})?$/.test(address.postal_code.trim())) missing.push('A 5 digit zip code');
  if (lineCount === 0) missing.push('At least one item');
  return missing;
}
