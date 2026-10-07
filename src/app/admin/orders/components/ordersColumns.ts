import { ColumnDef } from '@/utils/columnPreferences';

/** What the loading placeholder for a column looks like. */
export type SkeletonShape = 'checkbox' | 'text' | 'pill' | 'button';

export interface OrdersColumnDef extends ColumnDef {
  skeleton: SkeletonShape;
  skeletonWidth?: number;
}

export const ORDERS_COLUMNS_STORAGE_KEY = 'admin_orders_table_columns';

/**
 * Columns of the Orders table, in display order. The select box and View Details are locked: always
 * shown and not resizable, so an admin can never lose the way to open or bulk-update an order.
 * Default widths are what the table uses until an admin drags a column edge.
 */
export const ORDERS_COLUMNS: OrdersColumnDef[] = [
  { key: 'select', label: 'Select', defaultWidth: 64, locked: true, skeleton: 'checkbox' },
  { key: 'orderDate', label: 'Order Date', defaultWidth: 110, skeleton: 'text', skeletonWidth: 80 },
  { key: 'orderId', label: 'Order ID', defaultWidth: 200, skeleton: 'text', skeletonWidth: 130 },
  { key: 'customerName', label: 'Customer Name', defaultWidth: 160, skeleton: 'text', skeletonWidth: 100 },
  { key: 'orderStatus', label: 'Order Status', defaultWidth: 115, skeleton: 'pill', skeletonWidth: 85 },
  { key: 'paymentStatus', label: 'Payment Status', defaultWidth: 150, skeleton: 'pill', skeletonWidth: 80 },
  { key: 'instruction', label: 'Instruction to Driver', defaultWidth: 150, skeleton: 'text', skeletonWidth: 100 },
  { key: 'paymentMethod', label: 'Payment Method', defaultWidth: 135, skeleton: 'text', skeletonWidth: 75 },
  { key: 'emailStatus', label: 'Email Status', defaultWidth: 150, skeleton: 'pill', skeletonWidth: 70 },
  { key: 'subtotal', label: 'Sub Total', defaultWidth: 90, align: 'right', skeleton: 'text', skeletonWidth: 55 },
  { key: 'serviceFee', label: 'Platform Fee', defaultWidth: 115, align: 'right', skeleton: 'text', skeletonWidth: 55 },
  { key: 'tax', label: 'Tax', defaultWidth: 70, align: 'right', skeleton: 'text', skeletonWidth: 50 },
  { key: 'tip', label: 'Tip', defaultWidth: 70, align: 'right', skeleton: 'text', skeletonWidth: 50 },
  { key: 'stripeFee', label: 'Stripe Fee', defaultWidth: 100, align: 'right', skeleton: 'text', skeletonWidth: 50 },
  { key: 'refunded', label: 'Refunded Amt', defaultWidth: 115, align: 'right', skeleton: 'text', skeletonWidth: 55 },
  { key: 'grandTotal', label: 'Grand Total', defaultWidth: 105, align: 'right', skeleton: 'text', skeletonWidth: 55 },
  { key: 'phone', label: 'Phone', defaultWidth: 120, skeleton: 'text', skeletonWidth: 85 },
  { key: 'email', label: 'Email', defaultWidth: 210, skeleton: 'text', skeletonWidth: 160 },
  { key: 'address', label: 'Address', defaultWidth: 190, skeleton: 'text', skeletonWidth: 130 },
  { key: 'apartment', label: 'Apt. No.', defaultWidth: 110, skeleton: 'text', skeletonWidth: 50 },
  { key: 'gateCode', label: 'Gate Code', defaultWidth: 100, skeleton: 'text', skeletonWidth: 50 },
  { key: 'actions', label: 'Actions', defaultWidth: 150, locked: true, skeleton: 'button' },
];
