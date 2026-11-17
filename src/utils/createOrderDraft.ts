import { TIP_OTHER, lineSignature, type AddressForm, type CartLine, type CustomerForm, type PaidChoice } from '@/utils/createOrder';

/**
 * An offline order being entered in Create Order, saved as it is typed so nothing is lost and any admin can carry on.
 * Pure rules shared by the screen and the routes. A draft keeps what was typed and picked; prices are worked out again by the server.
 */
export interface OrderDraftContent {
  date: string;
  customer: CustomerForm;
  address: AddressForm;
  lines: CartLine[];
  tip: number;
  tipOther: string;
  discount: string;
  waiveFee: boolean;
  countNow: boolean;
  payment: 'link' | 'zelle' | 'paid' | 'quote';
  paidChoice: PaidChoice;
  paidTyped: string;
  note: string;
}

export const MAX_DRAFT_LINES = 100;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function cleanLine(raw: unknown): CartLine | null {
  const l = obj(raw);
  const date = typeof l.date === 'string' && DAY.test(l.date) ? l.date : '';
  const foodItemId = str(l.foodItemId, 40);
  if (!date || !foodItemId) return null;
  const quantity = Math.min(99, Math.max(1, Math.floor(Number(l.quantity) || 1)));
  const combo: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(obj(l.comboSelections)).slice(0, 30)) {
    if (Array.isArray(v)) combo[str(k, 40)] = v.filter((x): x is string => typeof x === 'string').slice(0, 30).map((x) => x.slice(0, 40));
  }
  const edited = Number(l.unitPriceEdited);
  const pick = {
    date,
    ...(typeof l.deliverOn === 'string' && DAY.test(l.deliverOn) ? { deliverOn: l.deliverOn } : {}),
    foodItemId,
    quantity,
    ...(str(l.selectedPortion, 60) ? { selectedPortion: str(l.selectedPortion, 60) } : {}),
    ...(str(l.selectedSpiceLevel, 60) ? { selectedSpiceLevel: str(l.selectedSpiceLevel, 60) } : {}),
    ...(l.isEcoFriendlyContainer === true ? { isEcoFriendlyContainer: true } : {}),
    ...(Object.keys(combo).length ? { comboSelections: combo } : {}),
    ...(str(l.notes, 300) ? { notes: str(l.notes, 300) } : {}),
    ...(l.unitPriceEdited !== undefined && l.unitPriceEdited !== null && Number.isFinite(edited) && edited >= 0 && edited < 10000 ? { unitPriceEdited: edited } : {}),
  };
  const unitPrice = Number(l.unitPrice);
  return {
    ...pick,
    key: lineSignature(pick),
    name: str(l.name, 200),
    unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
    tags: Array.isArray(l.tags) ? l.tags.filter((t): t is string => typeof t === 'string').slice(0, 10).map((t) => t.slice(0, 60)) : [],
  };
}

/** Cleans whatever the browser sent into a draft the screen can load back. Never throws. */
export function parseOrderDraft(input: unknown): OrderDraftContent {
  const b = obj(input);
  const c = obj(b.customer);
  const a = obj(b.address);
  const lines: CartLine[] = [];
  if (Array.isArray(b.lines)) {
    for (const raw of b.lines) {
      const l = cleanLine(raw);
      if (l) lines.push(l);
      if (lines.length >= MAX_DRAFT_LINES) break;
    }
  }
  const tip = Number(b.tip);
  const payment = b.payment === 'zelle' || b.payment === 'paid' || b.payment === 'quote' ? b.payment : 'link';
  const paidChoice: PaidChoice = b.paidChoice === 'Zelle' || b.paidChoice === 'Other' ? b.paidChoice : 'Cash';
  return {
    date: typeof b.date === 'string' && DAY.test(b.date) ? b.date : '',
    customer: { name: str(c.name, 120), email: str(c.email, 200), phone: str(c.phone, 40) },
    address: {
      street_address: str(a.street_address, 200),
      apartment: str(a.apartment, 60),
      city: str(a.city, 80),
      postal_code: str(a.postal_code, 12),
      entrance: str(a.entrance, 60),
      floor: str(a.floor, 60),
    },
    lines,
    tip: tip === TIP_OTHER || (Number.isFinite(tip) && tip >= 0 && tip <= 100) ? tip : 0,
    tipOther: str(b.tipOther, 10),
    discount: str(b.discount, 8),
    waiveFee: b.waiveFee === true,
    countNow: b.countNow === true,
    payment,
    paidChoice,
    paidTyped: str(b.paidTyped, 40),
    note: str(b.note, 300),
  };
}

/** True when there is something worth keeping (a draft is not created for an untouched form). */
export function orderDraftWorthSaving(d: OrderDraftContent): boolean {
  return Boolean(d.lines.length || d.customer.name.trim() || d.customer.email.trim() || d.customer.phone.trim() || d.address.street_address.trim());
}

/** The name shown for a draft in the list. */
export function orderDraftTitle(d: Pick<OrderDraftContent, 'customer'>): string {
  return d.customer.name.trim() || d.customer.email.trim() || d.customer.phone.trim() || 'Customer not entered yet';
}

/** What the draft holds, in a few words ("3 items · Tue, Nov 17 + 1 more day · about $24.00"). */
export function orderDraftSummary(d: Pick<OrderDraftContent, 'lines'>): string {
  const units = d.lines.reduce((s, l) => s + l.quantity, 0);
  if (units === 0) return 'No items yet';
  const days = [...new Set(d.lines.map((l) => l.date))].sort();
  const label = new Date(`${days[0]}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const more = days.length > 1 ? ` + ${days.length - 1} more day${days.length > 2 ? 's' : ''}` : '';
  const total = d.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  return `${units} item${units === 1 ? '' : 's'} · ${label}${more} · about $${total.toFixed(2)} before fees`;
}
