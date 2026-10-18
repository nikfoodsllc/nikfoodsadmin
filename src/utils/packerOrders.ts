/**
 * The Orders list a packer sees: confirmed orders with what is needed to pack and deliver them, and nothing about money
 * (prices, totals, tips, fees, payments, refunds), email tracking or OptimoRoute. Built from an order by listing the allowed
 * fields one by one, so a field added to orders later never reaches a packer by accident.
 */
import { comboChoiceLines, toDayString, type KitchenRow } from './kitchenDashboard';

export interface PackerItem {
  name: string;
  quantity: number;
  portion: string;
  spice: string;
  eco: boolean;
  notes: string;
  /** What was picked inside a combo, one line per section */
  choices: string[];
}

export interface PackerDay {
  /** The menu day the items were picked for, 'YYYY-MM-DD' ('' when unknown) */
  menuDate: string;
  /** The day they are delivered, 'YYYY-MM-DD' */
  deliveryDate: string;
  items: PackerItem[];
}

export interface PackerOrder {
  orderId: string;
  placedAt: string | null;
  status: string;
  customerName: string;
  phone: string;
  street: string;
  apartment: string;
  gateCode: string;
  instruction: string;
  days: PackerDay[];
}

const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** The database fields a packer's list needs: ask for these only, so prices are never even read. */
export const PACKER_ORDER_PROJECTION = {
  orderId: 1,
  createdAt: 1,
  status: 1,
  'customerInfo.name': 1,
  'customerInfo.phone': 1,
  'address.street': 1,
  'address.apartment': 1,
  'address.floor': 1,
  'address.entrance': 1,
  'items.deliveryDate': 1,
  'items.actualDeliveryDate': 1,
  'items.items.quantity': 1,
  'items.items.spiceLevel': 1,
  'items.items.selectedPortion': 1,
  'items.items.isEcoFriendlyContainer': 1,
  'items.items.comboSelections': 1,
  'items.items.notes': 1,
  'items.items.food.name': 1,
  'items.items.food.sections._id': 1,
  'items.items.food.sections.title': 1,
  'items.items.food.sections.selectedItems._id': 1,
  'items.items.food.sections.selectedItems.portion': 1,
  'items.items.food.sections.selectedItems.quantity': 1,
  'items.items.food.sections.selectedItems.item.name': 1,
  // only to leave out items an admin gave store credit for (never sent on: toPackerOrder copies fields one by one)
  'creditsIssued.items.line': 1,
  'creditsIssued.items.item': 1,
  'creditsIssued.items.quantity': 1,
} as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toPackerOrder(order: any): PackerOrder {
  const created = order?.createdAt ? new Date(order.createdAt) : null;
  const days: PackerDay[] = (Array.isArray(order?.items) ? order.items : []).map((day: any) => {
    const menuDate = toDayString(day?.deliveryDate) ?? '';
    const deliveryDate = toDayString(day?.actualDeliveryDate) ?? menuDate;
    const items: PackerItem[] = (Array.isArray(day?.items) ? day.items : []).map((item: any) => {
      const row: Pick<KitchenRow, 'sections' | 'comboSelections'> = { sections: item?.food?.sections ?? null, comboSelections: item?.comboSelections ?? null };
      return {
        name: text(item?.food?.name),
        quantity: Math.max(1, Math.round(num(item?.quantity, 1))),
        portion: text(item?.selectedPortion),
        spice: text(item?.spiceLevel),
        eco: item?.isEcoFriendlyContainer === true,
        notes: text(item?.notes),
        choices: comboChoiceLines(row),
      };
    });
    return { menuDate, deliveryDate, items };
  });
  return {
    orderId: text(order?.orderId),
    placedAt: created && !Number.isNaN(created.getTime()) ? created.toISOString() : null,
    status: text(order?.status),
    customerName: text(order?.customerInfo?.name),
    phone: text(order?.customerInfo?.phone),
    street: text(order?.address?.street),
    apartment: text(order?.address?.apartment),
    gateCode: text(order?.address?.entrance),
    instruction: text(order?.address?.floor),
    days,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
