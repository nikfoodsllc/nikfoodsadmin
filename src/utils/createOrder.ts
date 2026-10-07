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

/** One order in the "Recent orders entered here" list. */
export interface OrderListRow {
  orderId: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  linkOrder: boolean;
  /** A payment link order the customer has not paid yet */
  awaitingPayment: boolean;
  linkSentAt?: string;
  /** What the email provider reported about the latest pay-link email */
  linkEmail?: { status: string; sentAt?: string; deliveredAt?: string; bounceReason?: string; opened?: { firstAt: string; lastAt: string; count: number } };
  /** When the customer's browser loaded the pay page (not email scanners) */
  linkViews?: { firstAt: string; lastAt: string; count: number };
  deliveryDates: string[];
  offlinePaymentNote?: string;
}

export type OrderTab = 'waiting' | 'paid' | 'all';

/**
 * Which orders a tab shows, newest first. Waiting = unpaid link orders (an order leaves it as soon as it is paid);
 * Paid = paid orders; All = everything, with the unpaid ones on top.
 */
export function rowsForTab(rows: OrderListRow[], tab: OrderTab): OrderListRow[] {
  const newestFirst = (a: OrderListRow, b: OrderListRow) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (tab === 'waiting') return rows.filter((r) => r.awaitingPayment).sort(newestFirst);
  if (tab === 'paid') return rows.filter((r) => r.paymentStatus === 'paid').sort(newestFirst);
  return [...rows].sort((a, b) => Number(b.awaitingPayment) - Number(a.awaitingPayment) || newestFirst(a, b));
}

// ---------------------------------------------------------------------------------------------------------------
// The whole menu (Create Order is a master tool: no cutoffs, any date, any item)

export interface CatalogCategory {
  _id: string;
  name: string;
  listingType: 'flat' | 'day-wise';
  flatItemIds: string[];
  allItemIds: string[];
  dayWise: Record<string, string[]>;
  children: CatalogCategory[];
}

export interface CatalogDate {
  date: string;
  formattedDate: string;
  state: 'open' | 'closed' | 'past' | 'unscheduled';
  flatCategoryEnabled: boolean;
  dayWiseCategoryEnabled: boolean;
  hasDayWiseMenu: boolean;
}

export interface CatalogPayload {
  items: Record<string, MenuItem>;
  categories: CatalogCategory[];
  dates: CatalogDate[];
  today: string;
}

/** A category (or sub-category) of the menu as shown in the picker, with the items it holds for the chosen view. */
export interface MenuNode {
  id: string;
  name: string;
  /** Items directly in this category */
  itemIds: string[];
  children: MenuNode[];
  /** Items in this category and all its sub-categories */
  total: number;
}

/**
 * One category as a node. A day-wise category (Food Menu) lists its items per date and its sub-categories only group
 * those items, so under it each sub-category shows the date's items that are tagged to it and the rest stay in the
 * parent. A flat category's sub-categories hold their own items. In the whole-menu view a sub-category shows every item
 * tagged to it, whatever its date. An item is shown once per place it is grouped.
 */
function toNode(category: CatalogCategory, base: (c: CatalogCategory) => string[], scope: string[] | null, limitChildrenToDate: boolean): MenuNode | null {
  // Under a day-wise category the order is the order of the day's menu (what the website shows), so when a scope is given
  // (the day's items) its order wins over the sub-category's own order.
  const wanted = new Set(base(category));
  const own = scope ? [...new Set(scope)].filter((id) => wanted.has(id)) : [...new Set(base(category))];
  const dayWise = category.listingType === 'day-wise';
  const children = category.children
    .map((child) => toNode(child, (c) => c.allItemIds ?? [], dayWise && limitChildrenToDate ? own : null, limitChildrenToDate))
    .filter((n): n is MenuNode => n !== null);
  const grouped = new Set(children.flatMap((c) => uniqueIds([c])));
  const direct = own.filter((id) => !grouped.has(id));
  const total = uniqueIds([{ id: category._id, name: category.name, itemIds: direct, children, total: 0 }]).length;
  if (total === 0) return null;
  return { id: category._id, name: category.name, itemIds: direct, children, total };
}

/** Every distinct item id inside the nodes (an item grouped in two places is counted once). */
export function uniqueIds(nodes: MenuNode[]): string[] {
  const seen = new Set<string>();
  const walk = (n: MenuNode) => {
    n.itemIds.forEach((id) => seen.add(id));
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return [...seen];
}

/** What is on the menu for one date: the flat categories' items and the day-wise items listed for that date. */
export function dayMenuNodes(catalog: CatalogPayload, date: string): MenuNode[] {
  return catalog.categories
    .map((c) => toNode(c, (cat) => (cat.listingType === 'day-wise' ? cat.dayWise?.[date] ?? [] : cat.flatItemIds ?? []), null, true))
    .filter((n): n is MenuNode => n !== null);
}

/** Every item of every category, whatever its date. */
export function allMenuNodes(catalog: CatalogPayload): MenuNode[] {
  return catalog.categories.map((c) => toNode(c, (cat) => cat.allItemIds ?? [], null, false)).filter((n): n is MenuNode => n !== null);
}

/** Keeps only the items whose name matches, and the categories that still hold something. */
export function filterNodes(nodes: MenuNode[], items: Record<string, MenuItem>, query: string): MenuNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const walk = (node: MenuNode): MenuNode | null => {
    const itemIds = node.itemIds.filter((id) => (items[id]?.name ?? '').toLowerCase().includes(q));
    const children = node.children.map(walk).filter((n): n is MenuNode => n !== null);
    const total = uniqueIds([{ ...node, itemIds, children, total: 0 }]).length;
    return total === 0 ? null : { ...node, itemIds, children, total };
  };
  return nodes.map(walk).filter((n): n is MenuNode => n !== null);
}

/** Ids of every node that has sub-categories or items (what "expand all" opens). */
export function allNodeIds(nodes: MenuNode[]): string[] {
  return nodes.flatMap((n) => [n.id, ...allNodeIds(n.children)]);
}

/** How many of this item are in the order for a delivery date. */
export function quantityFor(lines: CartLine[], date: string, foodItemId: string): number {
  return lines.filter((l) => l.date === date && l.foodItemId === foodItemId).reduce((sum, l) => sum + l.quantity, 0);
}

/** Takes one off an item for a delivery date: the most recently added line of it loses one (and goes when it reaches 0). */
export function removeOne(lines: CartLine[], date: string, foodItemId: string): CartLine[] {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].date === date && lines[i].foodItemId === foodItemId) return setLineQuantity(lines, lines[i].key, lines[i].quantity - 1);
  }
  return lines;
}

/** Any calendar date typed or picked (YYYY-MM-DD), not only the ones the site schedules. */
export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

// ---------------------------------------------------------------------------------------------------------------
// How an order that was paid outside the website was paid

export type PaidChoice = 'Cash' | 'Zelle' | 'Other';

/** The method to store: Cash, Zelle, or what was typed. Null while nothing usable is chosen (Other with no text). */
export function paidMethodValue(choice: PaidChoice, typed: string): string | null {
  if (choice !== 'Other') return choice;
  const text = typed.replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text.slice(0, 40) : null;
}

// ---------------------------------------------------------------------------------------------------------------
// What happened to the payment link: was the email delivered, was the pay page opened

export interface ActivityLine {
  /** good = green, bad = red, warn = amber, info = grey */
  tone: 'good' | 'bad' | 'warn' | 'info';
  text: string;
}

const clock = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

/** How long ago, in words ("3 hours", "2 days"). */
export function elapsed(fromIso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(fromIso).getTime()) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}

/**
 * The lines shown under an order's "Link emailed": did the email arrive, and did the customer open the pay page. The pay page
 * opening is the reliable sign; an email "open" is only a hint (Apple Mail and some scanners load images by themselves).
 * Only for link orders that were emailed.
 */
export function linkActivity(row: Pick<OrderListRow, 'linkOrder' | 'paymentStatus' | 'awaitingPayment' | 'linkSentAt' | 'linkEmail' | 'linkViews'>, now: Date = new Date()): ActivityLine[] {
  if (!row.linkOrder || !row.linkSentAt) return [];
  // a link sent before tracking existed has no email record: we cannot say it was not opened, so say nothing about it
  if (!row.linkEmail && !row.linkViews) return [];
  const lines: ActivityLine[] = [];
  const e = row.linkEmail;
  if (e?.status === 'bounced') lines.push({ tone: 'bad', text: `The email bounced${e.bounceReason ? `: ${e.bounceReason}` : ''}. Check the email address.` });
  else if (e?.status === 'complained') lines.push({ tone: 'bad', text: "The customer's mail provider marked the email as spam." });
  else if (e?.status === 'failed') lines.push({ tone: 'bad', text: 'The email could not be delivered.' });
  else if (e?.status === 'delayed') lines.push({ tone: 'warn', text: 'The email is delayed, it has not reached the customer yet.' });
  else if (e?.status === 'delivered') lines.push({ tone: 'info', text: 'Email delivered' });
  if (e?.opened && e.status !== 'bounced') {
    lines.push({ tone: 'info', text: `Email opened ${e.opened.count > 1 ? `${e.opened.count} times, last ` : ''}${clock(e.opened.lastAt)} (can happen automatically, so it is only a hint)` });
  }
  const v = row.linkViews;
  if (v) {
    lines.push({ tone: 'good', text: `Opened the payment page ${v.count > 1 ? `${v.count} times, last ` : ''}${clock(v.lastAt)}${row.paymentStatus === 'paid' ? ' and paid' : ''}` });
  } else if (row.awaitingPayment) {
    const waited = elapsed(row.linkSentAt, now);
    const long = now.getTime() - new Date(row.linkSentAt).getTime() >= 24 * 3600 * 1000;
    lines.push(long ? { tone: 'warn', text: `Has not opened the payment page after ${waited}. Email a new link or call them.` } : { tone: 'info', text: `Has not opened the payment page yet (sent ${waited} ago)` });
  }
  return lines;
}
