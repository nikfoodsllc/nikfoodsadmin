/**
 * What the Kitchen Report's Excel file contains: three sheets (Kitchen Prep, Stickers, Day totals), described as plain
 * rows with a colour for each so the file can be written (and tested) without a spreadsheet library.
 *
 * Colours follow Kunal's own sheet: rows alternate red and white so no row is missed (each item's block starts with a
 * red row), and an ECO row is green whatever its place in the pattern.
 */
import { deliveryNote, formatDayShort, type KitchenDay } from './kitchenDashboard';
import { sheetAmounts, type PrepBlock, type StickerLine } from './kitchenReport';
import type { ColumnDef } from './columnPreferences';

export type RowTone = 'red' | 'white' | 'eco';

/** The colour of the n-th row (counting from 0) of a block: red, white, red ...; an ECO row is always green. */
export function rowTone(index: number, isEco: boolean): RowTone {
  if (isEco) return 'eco';
  return index % 2 === 0 ? 'red' : 'white';
}

/** The fill of each tone, as 6-digit hex (used on screen and in the file). */
export const TONE_COLORS: Record<RowTone, string> = { red: 'FDE2E2', white: 'FFFFFF', eco: 'D5F0DB' };

/** A cell: text, a number, or a date ('YYYY-MM-DD') shown like "Tue, Oct 13". */
export type SheetCell = string | number | { date: string | null } | { n: number; unit: 'oz' | 'lb' | 'units' };

export interface SheetRow {
  kind: 'header' | 'data' | 'section' | 'blank';
  cells: SheetCell[];
  tone?: RowTone;
  /** Cells to show in bold (indexes) */
  boldCells?: number[];
  /** Cells to right-align (indexes) */
  rightCells?: number[];
  /** A row inside an item's box: the box has a thick outline; `top` / `bottom` say whether this row carries its top / bottom edge. */
  box?: { top: boolean; bottom: boolean };
}

export type SheetKey = 'prep' | 'ready' | 'stickers' | 'totals';

export interface SheetModel {
  /** Which sheet this is (the admin's chosen columns are saved per key) */
  key: SheetKey;
  /** One key per column, in the same order as `widths` and every row's cells (see the *_COLUMNS lists) */
  columnKeys: string[];
  name: string;
  /** Column widths in characters (of the cells, not counting the margin) */
  widths: number[];
  /** Empty narrow columns before the first cell, like the two empty columns in Kunal's sheet */
  margin?: number;
  rows: SheetRow[];
}

const date = (value: string | null | undefined): SheetCell => ({ date: value || null });

const col = (key: string, label: string, defaultWidth: number): ColumnDef => ({ key, label, defaultWidth });

/** The columns the admin can switch on and off for each sheet (the order here is the order in the file). */
export const PREP_COLUMNS: ColumnDef[] = [
  col('item', 'Item Name', 28),
  col('customer', 'Customer Name', 22),
  col('spice', 'Spice Level', 18),
  col('qty', 'Total Ordered Qty (oz)', 22),
  col('total', 'Item total (lb) / ECO', 20),
  col('kitchenDate', 'Kitchen date', 17),
  col('deliveryDate', 'Delivery date', 17),
  col('combo', 'With combo', 24),
];
export const STICKER_COLUMNS: ColumnDef[] = [
  col('deliveryDate', 'Delivery date', 17),
  col('customer', 'Customer', 22),
  col('item', 'Item', 30),
  col('size', 'Size', 9),
  col('qty', 'Qty', 6),
  col('spice', 'Spice', 14),
  col('eco', 'Eco', 6),
  col('combo', 'With combo', 24),
  col('order', 'Order', 24),
  col('orderDate', 'Order date', 17),
  col('kitchenDate', 'Kitchen date', 17),
];
export const TOTALS_COLUMNS: ColumnDef[] = [
  col('day', 'Day', 17),
  col('item', 'Item', 40),
  col('quantity', 'Quantity', 10),
  col('amount', 'Total amount', 18),
  col('later', 'Delivered later', 28),
];

/** The sheets whose columns the admin can choose, with the name shown in the dialog and the table the choice is saved under. */
export const SHEET_CHOICES: Array<{ key: SheetKey; title: string; serverTable: string; columns: ColumnDef[] }> = [
  { key: 'prep', title: 'Kitchen Prep', serverTable: 'kitchen-report-prep', columns: PREP_COLUMNS },
  { key: 'ready', title: 'Ready to Eat', serverTable: 'kitchen-report-ready', columns: PREP_COLUMNS },
  { key: 'stickers', title: 'Stickers', serverTable: 'kitchen-report-stickers', columns: STICKER_COLUMNS },
  { key: 'totals', title: 'Day totals', serverTable: 'kitchen-report-totals', columns: TOTALS_COLUMNS },
];

/** Kunal's columns first (Item Name, Customer Name, Spice Level, Total Ordered Qty, and the item total / ECO column), then the kitchen and delivery dates (the day the order was placed is not needed here). */
const PREP_HEADER = PREP_COLUMNS.map((c) => c.label);
const PREP_WIDTHS = PREP_COLUMNS.map((c) => c.defaultWidth);

/**
 * One box per item, like Kunal's Kitchen Prep sheet: a thick outline round the block, the item's total (pounds, or pieces
 * when it has no sizes) in bold on the first row of the last-but-four column, "ECO" on the rows that come in an eco
 * container (green), and a blank row between boxes. The first box continues the header row, as in his sheet.
 */
function prepRows(blocks: PrepBlock[], rows: SheetRow[], firstBlockJoinsHeader: boolean): void {
  blocks.forEach((block, bi) => {
    if (bi > 0) rows.push({ kind: 'blank', cells: [] });
    const amounts = sheetAmounts(block);
    block.lines.forEach((line, li) => {
      const eco = line.isEco;
      rows.push({
        kind: 'data',
        tone: rowTone(li, eco),
        box: { top: li === 0 && !(bi === 0 && firstBlockJoinsHeader), bottom: li === block.lines.length - 1 },
        boldCells: li === 0 ? [4] : eco ? [4] : [],
        rightCells: [3, 4],
        cells: [
          block.name,
          line.customerName,
          line.spice ?? '',
          amounts.values[li],
          // the item's total on its first row; an eco row says ECO (a first row that is also eco is marked by its green)
          li === 0 ? amounts.total : eco ? 'ECO' : '',
          date(line.day),
          date(line.deliveryDate),
          [line.viaCombo ? `${line.viaCombo}${line.viaSpice ? ` (${line.viaSpice})` : ''}` : '', line.movedFrom ? `Moved from ${dateCellText(line.movedFrom)}` : ''].filter(Boolean).join(' · '),
        ],
      });
    });
  });
}

/** A sheet of boxes (one per item): the Kitchen Prep sheet (cooked items) and the Ready to Eat sheet (the rest, with the items that have no type yet at the end). */
function boxSheet(key: SheetKey, name: string, main: PrepBlock[], notSet: PrepBlock[]): SheetModel {
  const rows: SheetRow[] = [{ kind: 'header', cells: PREP_HEADER, box: { top: true, bottom: false }, boldCells: [0, 1, 2, 3, 4, 5, 6, 7], rightCells: [3, 4] }];
  prepRows(main, rows, true);
  if (notSet.length > 0) {
    if (main.length > 0) rows.push({ kind: 'blank', cells: [] });
    rows.push({ kind: 'section', cells: ['Preparation type not set yet (set Cooked or Ready to eat in Food Items)'] });
    prepRows(notSet, rows, false);
  }
  return { key, columnKeys: PREP_COLUMNS.map((c) => c.key), name, widths: PREP_WIDTHS, margin: 2, rows };
}

/** Kitchen Prep: only the items marked Cooked. */
export function prepSheet(cooked: PrepBlock[]): SheetModel {
  return boxSheet('prep', 'Kitchen Prep', cooked, []);
}

/** Ready to Eat: every item that is not cooked (ready-to-eat items, then the ones with no preparation type yet). */
export function readyToEatSheet(readyToEat: PrepBlock[], notSet: PrepBlock[]): SheetModel {
  return boxSheet('ready', 'Ready to Eat', readyToEat, notSet);
}

export function stickersSheet(stickers: StickerLine[]): SheetModel {
  const rows: SheetRow[] = [{ kind: 'header', cells: ['Delivery date', 'Customer', 'Item', 'Size', 'Qty', 'Spice', 'Eco', 'With combo', 'Order', 'Order date', 'Kitchen date'] }];
  stickers.forEach((s, i) => {
    rows.push({
      kind: 'data',
      tone: rowTone(i, s.isEco),
      cells: [date(s.deliveryDate), s.customerName, s.item, s.portion ?? '', s.quantity, s.spice ?? '', s.isEco ? 'ECO' : '', [s.viaCombo ?? '', s.movedFrom ? `Moved from ${dateCellText(s.movedFrom)}` : ''].filter(Boolean).join(' · '), s.orderId, date(s.orderedOn), date(s.day)],
    });
  });
  return { key: 'stickers', columnKeys: STICKER_COLUMNS.map((c) => c.key), name: 'Stickers', widths: STICKER_COLUMNS.map((c) => c.defaultWidth), rows };
}

export function dayTotalsSheet(days: KitchenDay[]): SheetModel {
  const rows: SheetRow[] = [{ kind: 'header', cells: ['Day', 'Item', 'Quantity', 'Total amount', 'Delivered later'] }];
  for (const day of days) {
    let n = 0;
    for (const item of day.items) rows.push({ kind: 'data', tone: rowTone(n++, false), cells: [date(day.day), item.name, item.quantity, item.totalText, deliveryNote(item.deliveries, item.quantity)] });
    for (const combo of day.combos) rows.push({ kind: 'data', tone: rowTone(n++, false), cells: [date(day.day), `${combo.name} (combo)`, combo.quantity, '', deliveryNote(combo.deliveries, combo.quantity)] });
  }
  return { key: 'totals', columnKeys: TOTALS_COLUMNS.map((c) => c.key), name: 'Day totals', widths: TOTALS_COLUMNS.map((c) => c.defaultWidth), rows };
}

export function buildReportSheets(input: { cooked: PrepBlock[]; readyToEat?: PrepBlock[]; notSet: PrepBlock[]; stickers: StickerLine[]; days: KitchenDay[] }): SheetModel[] {
  return [prepSheet(input.cooked), readyToEatSheet(input.readyToEat ?? [], input.notSet), stickersSheet(input.stickers), dayTotalsSheet(input.days)];
}

/**
 * Keeps only the columns the admin chose: `hidden` lists, per sheet, the column keys to leave out. A sheet always keeps at
 * least one column (if every column were hidden, the first one stays), and the section / blank rows are left alone.
 */
export function applyColumnChoice(sheets: SheetModel[], hidden: Partial<Record<SheetKey, string[]>>): SheetModel[] {
  return sheets.map((sheet) => {
    const off = new Set(hidden[sheet.key] ?? []);
    let keep = sheet.columnKeys.map((k) => !off.has(k));
    if (!keep.some(Boolean)) keep = keep.map((_, i) => i === 0);
    if (keep.every(Boolean)) return sheet;
    const newIndex: number[] = [];
    let next = 0;
    keep.forEach((k, i) => { newIndex[i] = k ? next++ : -1; });
    const remap = (list?: number[]) => list?.map((i) => newIndex[i]).filter((i) => i >= 0);
    return {
      ...sheet,
      columnKeys: sheet.columnKeys.filter((_, i) => keep[i]),
      widths: sheet.widths.filter((_, i) => keep[i]),
      rows: sheet.rows.map((row) =>
        row.kind === 'section' || row.kind === 'blank'
          ? row
          : { ...row, cells: row.cells.filter((_, i) => keep[i]), boldCells: remap(row.boldCells), rightCells: remap(row.rightCells) }
      ),
    };
  });
}

/** The text of a date cell: "Tue, Oct 13", or '' when there is no date. */
export function dateCellText(value: string | null): string {
  return value ? formatDayShort(value) : '';
}

// ---------------------------------------------------------------------------------------------
// The PDF: the same sheets, drawn as tables
// ---------------------------------------------------------------------------------------------

/** The text of a cell the way the PDF (and a reader of the sheet) sees it: "24 oz", "1.5 lb", "Tue, Oct 13". */
export function cellText(cell: SheetCell | undefined): string {
  if (cell === undefined || cell === null || cell === '') return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number') return String(cell);
  if ('n' in cell) return `${cell.n} ${cell.unit === 'units' && cell.n === 1 ? 'unit' : cell.unit}`;
  return dateCellText(cell.date);
}

export interface PdfTable {
  /** 'box' = an item's box (thick outline), 'plain' = an ordinary table, 'section' = a heading band */
  kind: 'box' | 'plain' | 'section';
  /** Header cells, only on the first table of a sheet */
  head?: string[];
  rows: Array<{ cells: string[]; tone: RowTone; box?: { top: boolean; bottom: boolean }; boldCells: number[]; rightCells: number[] }>;
}

/**
 * Splits a sheet into the tables the PDF draws one after another. In a sheet of boxes every box is a table of its own
 * (separated, like in Excel, by the gap where the blank row is), so a box can be kept on one page; the header belongs to
 * the first box, as in Kunal's sheet. A sheet without boxes is one table.
 */
export function sheetToPdfTables(sheet: SheetModel): PdfTable[] {
  const header = sheet.rows.find((r) => r.kind === 'header');
  const head = header ? header.cells.map(cellText) : undefined;
  const hasBoxes = sheet.rows.some((r) => r.kind === 'data' && r.box);
  const toRow = (r: SheetRow) => ({ cells: r.cells.map(cellText), tone: r.tone ?? ('white' as RowTone), box: r.box, boldCells: r.boldCells ?? [], rightCells: r.rightCells ?? [] });
  if (!hasBoxes) {
    return [{ kind: 'plain', head, rows: sheet.rows.filter((r) => r.kind === 'data').map(toRow) }];
  }
  const tables: PdfTable[] = [];
  let current: PdfTable | null = null;
  let headUsed = false;
  for (const row of sheet.rows) {
    if (row.kind === 'header') continue;
    if (row.kind === 'blank') {
      current = null;
      continue;
    }
    if (row.kind === 'section') {
      tables.push({ kind: 'section', rows: [{ cells: [cellText(row.cells[0])], tone: 'white', boldCells: [0], rightCells: [] }] });
      current = null;
      continue;
    }
    if (!current) {
      current = { kind: 'box', head: headUsed ? undefined : head, rows: [] };
      headUsed = true;
      tables.push(current);
    }
    current.rows.push(toRow(row));
  }
  // a sheet with a header but no rows still prints its header
  if (tables.length === 0 && head) tables.push({ kind: 'box', head, rows: [] });
  return tables;
}
