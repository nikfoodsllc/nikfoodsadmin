/**
 * What the Kitchen Report's Excel file contains: three sheets (Kitchen Prep, Stickers, Day totals), described as plain
 * rows with a colour for each so the file can be written (and tested) without a spreadsheet library.
 *
 * Colours follow Kunal's own sheet: rows alternate red and white so no row is missed (each item's block starts with a
 * red row), and an ECO row is green whatever its place in the pattern.
 */
import { deliveryNote, formatDayShort, type KitchenDay } from './kitchenDashboard';
import { sheetAmounts, type PrepBlock, type StickerLine } from './kitchenReport';

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

export interface SheetModel {
  name: string;
  /** Column widths in characters (of the cells, not counting the margin) */
  widths: number[];
  /** Empty narrow columns before the first cell, like the two empty columns in Kunal's sheet */
  margin?: number;
  rows: SheetRow[];
}

const date = (value: string | null | undefined): SheetCell => ({ date: value || null });

/** Kunal's columns first (Item Name, Customer Name, Spice Level, Total Ordered Qty, and the item total / ECO column), then the kitchen and delivery dates (the day the order was placed is not needed here). */
const PREP_HEADER = ['Item Name', 'Customer Name', 'Spice Level', 'Total Ordered Qty (oz)', 'Item total (lb) / ECO', 'Kitchen date', 'Delivery date', 'With combo'];
const PREP_WIDTHS = [30, 24, 16, 22, 20, 15, 15, 28];

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
          line.viaCombo ? `${line.viaCombo}${line.viaSpice ? ` (${line.viaSpice})` : ''}` : '',
        ],
      });
    });
  });
}

export function prepSheet(cooked: PrepBlock[], notSet: PrepBlock[]): SheetModel {
  const rows: SheetRow[] = [{ kind: 'header', cells: PREP_HEADER, box: { top: true, bottom: false }, boldCells: [0, 1, 2, 3, 4, 5, 6, 7], rightCells: [3, 4] }];
  prepRows(cooked, rows, true);
  if (notSet.length > 0) {
    if (cooked.length > 0) rows.push({ kind: 'blank', cells: [] });
    rows.push({ kind: 'section', cells: ['Preparation type not set yet (set Cooked or Ready to eat in Food Items)'] });
    prepRows(notSet, rows, false);
  }
  return { name: 'Kitchen Prep', widths: PREP_WIDTHS, margin: 2, rows };
}

export function stickersSheet(stickers: StickerLine[]): SheetModel {
  const rows: SheetRow[] = [{ kind: 'header', cells: ['Delivery date', 'Customer', 'Item', 'Size', 'Qty', 'Spice', 'Eco', 'With combo', 'Order', 'Order date', 'Kitchen date'] }];
  stickers.forEach((s, i) => {
    rows.push({
      kind: 'data',
      tone: rowTone(i, s.isEco),
      cells: [date(s.deliveryDate), s.customerName, s.item, s.portion ?? '', s.quantity, s.spice ?? '', s.isEco ? 'ECO' : '', s.viaCombo ?? '', s.orderId, date(s.orderedOn), date(s.day)],
    });
  });
  return { name: 'Stickers', widths: [15, 22, 30, 9, 6, 14, 6, 24, 24, 15, 15], rows };
}

export function dayTotalsSheet(days: KitchenDay[]): SheetModel {
  const rows: SheetRow[] = [{ kind: 'header', cells: ['Day', 'Item', 'Quantity', 'Total amount', 'Delivered later'] }];
  for (const day of days) {
    let n = 0;
    for (const item of day.items) rows.push({ kind: 'data', tone: rowTone(n++, false), cells: [date(day.day), item.name, item.quantity, item.totalText, deliveryNote(item.deliveries, item.quantity)] });
    for (const combo of day.combos) rows.push({ kind: 'data', tone: rowTone(n++, false), cells: [date(day.day), `${combo.name} (combo)`, combo.quantity, '', deliveryNote(combo.deliveries, combo.quantity)] });
  }
  return { name: 'Day totals', widths: [15, 40, 10, 18, 28], rows };
}

export function buildReportSheets(input: { cooked: PrepBlock[]; notSet: PrepBlock[]; stickers: StickerLine[]; days: KitchenDay[] }): SheetModel[] {
  return [prepSheet(input.cooked, input.notSet), stickersSheet(input.stickers), dayTotalsSheet(input.days)];
}

/** The text of a date cell: "Tue, Oct 13", or '' when there is no date. */
export function dateCellText(value: string | null): string {
  return value ? formatDayShort(value) : '';
}
