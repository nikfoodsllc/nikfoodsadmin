/**
 * What the Kitchen Report's Excel file contains: three sheets (Kitchen Prep, Stickers, Day totals), described as plain
 * rows with a colour for each so the file can be written (and tested) without a spreadsheet library.
 *
 * Colours follow Kunal's own sheet: rows alternate red and white so no row is missed (each item's block starts with a
 * red row), and an ECO row is green whatever its place in the pattern.
 */
import { deliveryNote, formatDayShort, type KitchenDay } from './kitchenDashboard';
import { blockTotal, type PrepBlock, type StickerLine } from './kitchenReport';

export type RowTone = 'red' | 'white' | 'eco';

/** The colour of the n-th row (counting from 0) of a block: red, white, red ...; an ECO row is always green. */
export function rowTone(index: number, isEco: boolean): RowTone {
  if (isEco) return 'eco';
  return index % 2 === 0 ? 'red' : 'white';
}

/** The fill of each tone, as 6-digit hex (used on screen and in the file). */
export const TONE_COLORS: Record<RowTone, string> = { red: 'FDE2E2', white: 'FFFFFF', eco: 'D5F0DB' };

/** A cell: text, a number, or a date ('YYYY-MM-DD') shown like "Tue, Oct 13". */
export type SheetCell = string | number | { date: string | null };

export interface SheetRow {
  kind: 'header' | 'data' | 'section' | 'blank';
  cells: SheetCell[];
  tone?: RowTone;
  /** Cells to show in bold (indexes) */
  boldCells?: number[];
}

export interface SheetModel {
  name: string;
  /** Column widths in characters */
  widths: number[];
  rows: SheetRow[];
}

const date = (value: string | null | undefined): SheetCell => ({ date: value || null });

const PREP_HEADER = ['Item', 'Item total', 'Eco containers', 'Customer', 'Spice', 'Size', 'Qty', 'Amount', 'Eco', 'With combo', 'Order date', 'Kitchen date', 'Delivery date'];

function prepRows(blocks: PrepBlock[], rows: SheetRow[]): void {
  blocks.forEach((block, bi) => {
    if (bi > 0) rows.push({ kind: 'blank', cells: [] });
    block.lines.forEach((line, li) => {
      rows.push({
        kind: 'data',
        tone: rowTone(li, line.isEco),
        // the item total and its eco count sit on the first row of the block, like in Kunal's sheet
        boldCells: li === 0 ? [0, 1] : [],
        cells: [
          block.name,
          li === 0 ? blockTotal(block) : '',
          li === 0 && block.eco ? block.eco : '',
          line.customerName,
          line.spice ?? '',
          line.portion ?? '',
          line.quantity,
          line.amountText,
          line.isEco ? 'ECO' : '',
          line.viaCombo ? `${line.viaCombo}${line.viaSpice ? ` (${line.viaSpice})` : ''}` : '',
          date(line.orderedOn),
          date(line.day),
          date(line.deliveryDate),
        ],
      });
    });
  });
}

export function prepSheet(cooked: PrepBlock[], notSet: PrepBlock[]): SheetModel {
  const rows: SheetRow[] = [{ kind: 'header', cells: PREP_HEADER }];
  prepRows(cooked, rows);
  if (notSet.length > 0) {
    if (cooked.length > 0) rows.push({ kind: 'blank', cells: [] });
    rows.push({ kind: 'section', cells: ['Preparation type not set yet (set Cooked or Ready to eat in Food Items)'] });
    prepRows(notSet, rows);
  }
  return { name: 'Kitchen Prep', widths: [30, 16, 10, 22, 14, 9, 6, 16, 6, 28, 15, 15, 15], rows };
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
