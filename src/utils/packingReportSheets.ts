/**
 * The Packing Report as sheets (Excel file and PDF): "Packing List", one box per stop in route order with a band for every
 * route, and "Item totals", the day's pick list. Same sheet model, colours and boxes as the Kitchen Report, so the same
 * Excel and PDF writers draw them.
 */
import type { ColumnDef } from './columnPreferences';
import { rowTone, type SheetModel, type SheetRow } from './kitchenReportSheets';
import type { PackLine, PackStop, PackingReport } from './packingReport';

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

/** The two sheets whose columns the admin can choose, with the table each choice is saved under. */
export const PACKING_SHEET_CHOICES: Array<{ key: 'packing' | 'packTotals'; title: string; serverTable: string; baseKey: string; columns: ColumnDef[] }> = [
  { key: 'packing', title: 'Packing List', serverTable: 'packing-list', baseKey: 'admin_packing_list_columns', columns: PACKING_COLUMNS },
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

/** Packing List: header, then for each route a band and a box per stop; customers not on a route come last under their own band. */
export function packingListSheet(report: PackingReport): SheetModel {
  const rows: SheetRow[] = [{ kind: 'header', cells: PACKING_COLUMNS.map((c) => c.label), box: { top: true, bottom: false }, boldCells: PACKING_COLUMNS.map((_, i) => i), rightCells: [QTY_INDEX] }];
  const bands: Array<{ band: string; route: string | number; stops: PackStop[] }> = report.routes.map((r, i) => ({
    band: `${r.title}${r.driverName ? ` · ${r.driverName}` : ''}${r.vehicle ? ` · ${r.vehicle}` : ''} · ${r.stops.length} stop${r.stops.length === 1 ? '' : 's'}`,
    route: i + 1,
    stops: r.stops,
  }));
  if (report.unrouted.length > 0) bands.push({ band: `Not on a route yet · ${report.unrouted.length} customer${report.unrouted.length === 1 ? '' : 's'}`, route: '-', stops: report.unrouted });
  bands.forEach((b, bi) => {
    if (bi > 0 || rows.length > 1) rows.push({ kind: 'blank', cells: [] });
    rows.push({ kind: 'section', cells: [b.band] });
    b.stops.forEach((stop, si) => {
      if (si > 0) rows.push({ kind: 'blank', cells: [] });
      rows.push(...stopRows(b.route, stop));
    });
  });
  return { key: 'packing', columnKeys: PACKING_COLUMNS.map((c) => c.key), name: 'Packing List', widths: PACKING_COLUMNS.map((c) => c.defaultWidth), margin: 2, rows };
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

export function buildPackingSheets(report: PackingReport): SheetModel[] {
  return [packingListSheet(report), packTotalsSheet(report)];
}
