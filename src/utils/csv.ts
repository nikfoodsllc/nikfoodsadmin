import { OrderDayItem, DeliveryOrderReport } from '@/types/order';
import { formatPSTDate } from '@/utils/timezone';
import { buildDeliveryDateColumnsBySpec, collectDeliveryDateColumns } from '@/utils/delivery';

/**
 * Escapes CSV values to handle commas, quotes, and newlines
 * Follows RFC 4180 CSV standard
 */
export function escapeCSVValue(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and double internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Converts an Order to a CSV row string for orders listing
 */
function orderToListingCSVRow(
  order: any,
  deliveryDateColumnSpecs: ReturnType<typeof collectDeliveryDateColumns>
): string {
  // Format address fields
  const street = escapeCSVValue(order.address.street);
  const apartment = escapeCSVValue(order.address.apartment || order.address.floor || '');
  const landmark = escapeCSVValue(order.address.landmark || '');

  // Format customer info
  const customerName = escapeCSVValue(order.customerInfo.name);
  const customerEmail = escapeCSVValue(order.customerInfo.email);
  const customerPhone = escapeCSVValue(order.customerInfo.phone);

  // Format dates
  const orderDate = escapeCSVValue(formatPSTDate(order.createdAt));
  
  // Format status and payment
  const status = escapeCSVValue(order.status);
  const paymentStatus = escapeCSVValue(order.paymentStatus);

  // Format monetary values
  const subtotal = order.subtotal.toFixed(2);
  const platformFee = order.platformFee.toFixed(2);
  const taxes = order.taxes.toFixed(2);
  const tip = order.tip.toFixed(2);
  const totalPaid = order.totalPaid.toFixed(2);

  // Build delivery date columns dynamically using processed dates
  const deliveryDateColumns = buildDeliveryDateColumnsBySpec(order, deliveryDateColumnSpecs).map(
    escapeCSVValue
  );

  // Combine all fields into CSV row
  return [
    orderDate,
    escapeCSVValue(order.orderId),
    customerName,
    customerEmail,
    status,
    paymentStatus,
    subtotal,
    platformFee,
    taxes,
    tip,
    totalPaid,
    customerPhone,
    street,
    apartment,
    escapeCSVValue(order.address.entrance || ''),
    escapeCSVValue(order.address.floor || ''),
    landmark,
    ...deliveryDateColumns,
  ].join(',');
}

/**
 * Generates CSV content from orders data for listing page
 * @param orders - Array of orders
 * @returns Complete CSV string with headers and data rows
 */
export function generateOrdersListingCSV(orders: any[]): string {
  const deliveryDateColumnSpecs = collectDeliveryDateColumns(orders);

  // Build static headers
  const staticHeaders = [
    'Order Date',
    'Order ID',
    'Customer Name',
    'Email',
    'Order Status',
    'Payment Status',
    'Sub Total',
    'Service Fee',
    'Tax',
    'Tip',
    'Grand Total',
    'Phone',
    'Address',
    'Apt. No.',
    'Gate Code',
    'Delivery Instructions',
    'Instruction to Driver',
  ];

  const deliveryDayHeaders = deliveryDateColumnSpecs.map((column) => column.header);

  // Combine all headers
  const headers = [...staticHeaders, ...deliveryDayHeaders];

  // Generate rows
  const rows = orders.map((order) => orderToListingCSVRow(order, deliveryDateColumnSpecs));

  // Combine headers and rows
  return [headers.map(escapeCSVValue).join(','), ...rows].join('\n');
}

/**
 * Formats a single item for CSV export
 * Returns a string with item name and customizations
 */
function formatItemForCSV(item: OrderDayItem): string {
  const parts: string[] = [];

  // Item name is always first
  parts.push(item.food.name);

  // Build details in parentheses
  const details: string[] = [];

  // Add quantity
  details.push(`Qty: ${item.quantity}`);

  // Add spice level if present
  if (item.spiceLevel) {
    details.push(`Spice: ${item.spiceLevel}`);
  }

  // Add portion if present
  if (item.selectedPortion) {
    details.push(`Portion: ${item.selectedPortion}`);
  } else if (item.portions !== undefined && item.food.portions?.[item.portions]) {
    details.push(`Portion: ${item.food.portions[item.portions]}`);
  }

  // Add eco container if present
  if (item.isEcoFriendlyContainer) {
    details.push(`Eco: Yes`);
  }

  // Add combo selections marker if present
  if (item.comboSelections && Object.keys(item.comboSelections).length > 0) {
    details.push(`[Combo]`);
  }

  // Add notes if present
  if (item.notes) {
    details.push(`Note: ${item.notes}`);
  }

  // Combine name with details
  if (details.length > 0) {
    return `${item.food.name} (${details.join(', ')})`;
  }

  return item.food.name;
}

/**
 * Combines multiple items into a single CSV cell
 * Uses semicolon as separator to distinguish from comma-separated details
 */
function combineItemsForCSV(items: OrderDayItem[]): string {
  if (!items || items.length === 0) return '';
  return items.map(formatItemForCSV).join('; ');
}

/**
 * Converts a delivery order report to a CSV row string
 */
function orderToCSVRow(order: DeliveryOrderReport): string {
  // Format address fields individually
  const street = escapeCSVValue(order.address.street);
  const apartment = escapeCSVValue(order.address.apartment || '');
  const city = escapeCSVValue(order.address.city);
  const state = escapeCSVValue(order.address.state);
  const zipCode = escapeCSVValue(order.address.zipCode);
  const gateCode = escapeCSVValue(order.address.entrance || '');
  const deliveryInstructions = escapeCSVValue(order.address.floor || '');
  const landmark = escapeCSVValue(order.address.landmark || '');

  // Format customer info
  const customerName = escapeCSVValue(order.customerInfo.name);
  const customerEmail = escapeCSVValue(order.customerInfo.email);
  const customerPhone = escapeCSVValue(order.customerInfo.phone);

  // Format dates
  const orderDate = escapeCSVValue(formatPSTDate(order.orderDate));
  const deliveryDate = escapeCSVValue(formatPSTDate(order.deliveryDate));
  const deliveryDay = escapeCSVValue(order.deliveryDay);

  // Format items
  const items = escapeCSVValue(combineItemsForCSV(order.items));

  // Format status and payment
  const status = escapeCSVValue(order.status);
  const paymentStatus = escapeCSVValue(order.paymentStatus);
  const paymentMethod = escapeCSVValue(order.paymentMethod);

  // Format monetary values
  const subtotal = order.subtotal.toFixed(2);
  const platformFee = order.platformFee.toFixed(2);
  const deliveryFee = order.deliveryFee.toFixed(2);
  const taxes = order.taxes.toFixed(2);
  const tip = order.tip.toFixed(2);
  const totalPaid = order.totalPaid.toFixed(2);

  // Combine all fields into CSV row
  return [
    escapeCSVValue(order.orderId),
    customerName,
    customerEmail,
    customerPhone,
    street,
    apartment,
    city,
    state,
    zipCode,
    gateCode,
    deliveryInstructions,
    landmark,
    orderDate,
    deliveryDate,
    deliveryDay,
    items,
    status,
    paymentStatus,
    paymentMethod,
    subtotal,
    platformFee,
    deliveryFee,
    taxes,
    tip,
    totalPaid,
  ].join(',');
}

/**
 * Generates CSV content from delivery report data
 * @param orders - Array of delivery order reports
 * @returns Complete CSV string with headers and data rows
 */
export function generateDeliveryCSV(orders: DeliveryOrderReport[]): string {
  const headers = [
    'Order ID',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Street',
    'Apartment',
    'City',
    'State',
    'ZIP Code',
    'Gate Code',
    'Delivery Instructions',
    'Landmark',
    'Order Date',
    'Delivery Date',
    'Delivery Day',
    'Items',
    'Order Status',
    'Payment Status',
    'Payment Method',
    'Subtotal',
    'Platform Fee',
    'Delivery Fee',
    'Taxes',
    'Tip',
    'Total Paid',
  ];

  const rows = orders.map(orderToCSVRow);

  // Combine headers and rows
  return [headers.map(escapeCSVValue).join(','), ...rows].join('\n');
}

/**
 * Triggers browser download of CSV file
 * @param csvContent - The CSV content as a string
 * @param filename - The filename for the downloaded file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
