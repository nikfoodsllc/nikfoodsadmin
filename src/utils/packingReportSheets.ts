/**
 * The Packing Report as sheets (Excel file and PDF): "Packing List", one box per stop in route order with a band for every
 * route, and "Item totals", the day's pick list. Same sheet model, colours and boxes as the Kitchen Report, so the same
 * Excel and PDF writers draw them.
 */
import type { ColumnDef } from './columnPreferences';
import { rowTone, type SheetModel, type SheetRow } from './kitchenReportSheets';
import type { PackLine, PackStop, PackingReport } from './packingReport';
import { heldReasonText, type HeldReport } from './packingHeld';

const col = (key: string, label: string, defaultWidth: number): ColumnDef => ({ key, label, defaultWidth });

export const PACKING_COLUMNS: ColumnDef[] = [
  col('route', 'Route', 11),
  col('stop', 'Stop', 9),
  col('time', 'Time', 10),
  col('customer', 'Customer', 24),
  col('order', 'Order', 20),
  col('item', 'Item', 26),
  col('size', 'Size', 10),
  col('qty', 'Qty', 8),
  col('spice', 'Spice', 14),
  col('eco', 'Eco', 10),
  col('picks', 'Combo picks', 28),
  col('pickedFor', 'Picked for', 12),
];

export const PACK_TOTAL_COLUMNS: ColumnDef[] = [
  col('item', 'Item', 36),
  col('sizes', 'Sizes', 28),
  col('qty', 'Quantity', 10),
  col('eco', 'Eco', 10),
];

/** The sheets whose columns the admin can choose, with the table each choice is saved under. */
export const PACKING_SHEET_CHOICES: Array<{ key: 'packing' | 'packTotals'; title: string; serverTable: string; baseKey: string; columns: ColumnDef[] }> = [
  { key: 'packing', title: 'Packing sheets (one per route)', serverTable: 'packing-list', baseKey: 'admin_packing_list_columns', columns: PACKING_COLUMNS },
  { key: 'packTotals', title: 'Item totals', serverTable: 'packing-totals', baseKey: 'admin_packing_totals_columns', columns: PACK_TOTAL_COLUMNS },
];

const QTY_INDEX = PACKING_COLUMNS.findIndex((c) => c.key === 'qty');
const dayLabel = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(d);
};

function stopRows(route: string | number, stop: PackStop): SheetRow[] {
  const lines: Array<PackLine | null> = stop.lines.length > 0 ? stop.lines : [null];
  return lines.map((line, i) => ({
    kind: 'data' as const,
    tone: rowTone(i, Boolean(line?.isEco)),
    box: { top: i === 0, bottom: i === lines.length - 1 },
    rightCells: [QTY_INDEX],
    cells: [
      route,
      stop.number > 0 ? stop.number : '',
      stop.scheduledAt,
      stop.customerName,
      stop.orderIds.join(', '),
      line ? line.name : '(nothing to pack for this date: check the order)',
      line?.portion ?? '',
      line ? line.quantity : '',
      line?.spice ?? '',
      line?.isEco ? 'ECO' : '',
      line ? line.choices.join('\n') : '',
      line?.pickedFor ? dayLabel(line.pickedFor) : '',
    ],
  }));
}

const HEADER_ROW = (): SheetRow => ({ kind: 'header', cells: PACKING_COLUMNS.map((c) => c.label), box: { top: true, bottom: false }, boldCells: PACKING_COLUMNS.map((_, i) => i), rightCells: [QTY_INDEX] });

/** One packing sheet: the header, a band with the title, and a box per stop (a blank row between boxes). */
function stopsSheet(name: string, band: string, route: string | number, stops: PackStop[]): SheetModel {
  const rows: SheetRow[] = [HEADER_ROW(), { kind: 'section', cells: [band] }];
  stops.forEach((stop, si) => {
    if (si > 0) rows.push({ kind: 'blank', cells: [] });
    rows.push(...stopRows(route, stop));
  });
  return { key: 'packing', columnKeys: PACKING_COLUMNS.map((c) => c.key), name, widths: PACKING_COLUMNS.map((c) => c.defaultWidth), margin: 2, rows };
}

/** Excel does not allow these characters in a sheet name and stops at 31 characters. */
export function safeSheetName(name: string, taken: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

/** One sheet for each route (in route order), then a sheet for the customers who are not on a route. */
export function packingRouteSheets(report: PackingReport): SheetModel[] {
  const taken = new Set<string>(['item totals']);
  const sheets = report.routes.map((r, i) =>
    stopsSheet(
      safeSheetName(`${r.title}${r.driverName ? ` - ${r.driverName}` : ''}`, taken),
      `${r.title}${r.driverName ? ` · ${r.driverName}` : ''}${r.vehicle ? ` · ${r.vehicle}` : ''} · ${r.stops.length} stop${r.stops.length === 1 ? '' : 's'}`,
      i + 1,
      r.stops
    )
  );
  if (report.unrouted.length > 0) {
    sheets.push(stopsSheet(safeSheetName('Not on a route yet', taken), `Not on a route yet · ${report.unrouted.length} customer${report.unrouted.length === 1 ? '' : 's'}`, '-', report.unrouted));
  }
  return sheets;
}

/** Item totals: what to pull from stock for the whole day. */
export function packTotalsSheet(report: PackingReport): SheetModel {
  const rows: SheetRow[] = [{ kind: 'header', cells: PACK_TOTAL_COLUMNS.map((c) => c.label), rightCells: [2, 3] }];
  report.totals.forEach((t, i) => {
    rows.push({
      kind: 'data',
      tone: rowTone(i, false),
      rightCells: [2, 3],
      boldCells: [2],
      cells: [t.isCombo ? `${t.name} (combo)` : t.name, t.sizes.map((s) => `${s.label} x ${s.quantity}`).join(', '), t.quantity, t.eco > 0 ? t.eco : ''],
    });
  });
  return { key: 'packTotals', columnKeys: PACK_TOTAL_COLUMNS.map((c) => c.key), name: 'Item totals', widths: PACK_TOTAL_COLUMNS.map((c) => c.defaultWidth), rows };
}

const HELD_COLUMNS: ColumnDef[] = [
  col('customer', 'Customer', 24),
  col('order', 'Order', 20),
  col('item', 'Item', 26),
  col('size', 'Size', 10),
  col('qty', 'Qty', 8),
  col('spice', 'Spice', 14),
  col('eco', 'Eco', 10),
  col('picks', 'Combo picks', 28),
  col('goesOut', 'Goes out', 14),
  col('why', 'Why', 30),
];

/** Food made on the report's date that goes out on a later day: who, what, and when it goes out. */
export function heldSheet(held: HeldReport): SheetModel {
  const qty = HELD_COLUMNS.findIndex((c) => c.key === 'qty');
  const rows: SheetRow[] = [
    { kind: 'header', cells: HELD_COLUMNS.map((c) => c.label), box: { top: true, bottom: false }, boldCells: HELD_COLUMNS.map((_, i) => i), rightCells: [qty] },
    { kind: 'section', cells: [`Not going out today · ${held.stats.customers} customer${held.stats.customers === 1 ? '' : 's'} · ${held.stats.units} unit${held.stats.units === 1 ? '' : 's'}`] },
  ];
  held.customers.forEach((c, ci) => {
    if (ci > 0) rows.push({ kind: 'blank', cells: [] });
    c.lines.forEach((line, i) => {
      rows.push({
        kind: 'data',
        tone: rowTone(i, line.isEco),
        box: { top: i === 0, bottom: i === c.lines.length - 1 },
        rightCells: [qty],
        cells: [c.customerName, line.orderId, line.name, line.portion ?? '', line.quantity, line.spice ?? '', line.isEco ? 'ECO' : '', line.choices.join('\n'), dayLabel(line.goesOutOn), heldReasonText(line.reason) + (c.alsoToday ? ' (also delivering today)' : '')],
      });
    });
  });
  return { key: 'packHeld', columnKeys: HELD_COLUMNS.map((c) => c.key), name: 'Not going out today', widths: HELD_COLUMNS.map((c) => c.defaultWidth), margin: 2, rows };
}

export function buildPackingSheets(report: PackingReport): SheetModel[] {
  const routes = packingRouteSheets(report);
  const held = report.held && report.held.customers.length > 0 ? [heldSheet(report.held)] : [];
  // a day with nothing at all still gets one (empty) packing sheet, so the file is never without one
  return [...(routes.length > 0 ? routes : [stopsSheet('Packing List', 'Nothing to deliver on this date', '-', [])]), packTotalsSheet(report), ...held];
}
