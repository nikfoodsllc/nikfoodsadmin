/**
 * What the Orders table shows for OptimoRoute (the route planner): whether the order's delivery stop(s) are in it.
 * The live site writes `order.optimo` when it sends a stop: { state, at, stops: [{ date, result, orderNo, error }] }.
 * An order with no record shows a dash: nothing was sent (unpaid, cancelled, older than the sync, or a day already past).
 */
export interface OptimoStopLike {
  date?: string | null;
  result?: string | null;
  orderNo?: string | null;
  error?: string | null;
}

export interface OptimoLike {
  state?: string | null;
  at?: string | Date | null;
  stops?: OptimoStopLike[] | null;
}

export type OptimoTone = 'good' | 'bad' | 'warn' | 'none';

export interface OptimoView {
  label: string;
  tone: OptimoTone;
  /** Under the label: the delivery day(s), or the first problem */
  detail: string;
  /** Full text for the tooltip */
  title: string;
}

const NONE: OptimoView = { label: '-', tone: 'none', detail: '', title: 'Not sent to OptimoRoute: unpaid, cancelled, an older order, or nothing to send' };

function shortDate(date: string | null | undefined): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function datesOf(stops: OptimoStopLike[]): string {
  return [...new Set(stops.map((s) => shortDate(s.date)).filter(Boolean))].join(' · ');
}

export function orderOptimoView(optimo: OptimoLike | null | undefined): OptimoView {
  const stops = (optimo?.stops ?? []).filter((s): s is OptimoStopLike => Boolean(s));
  if (!optimo || (!optimo.state && stops.length === 0)) return NONE;

  const removeFailed = stops.filter((s) => s.result === 'remove_failed');
  if (removeFailed.length > 0) {
    const error = (removeFailed[0].error ?? '').trim();
    return {
      label: 'Remove failed',
      tone: 'bad',
      detail: datesOf(removeFailed),
      title: `The order was cancelled or refunded but its stop could not be removed from OptimoRoute${error ? ` (${error})` : ''}. Delete it there by hand. It is retried every 30 minutes.`,
    };
  }
  const failed = stops.filter((s) => s.result === 'failed');
  if (failed.length > 0 || optimo.state === 'failed') {
    const error = (failed[0]?.error ?? '').trim();
    return {
      label: 'Failed',
      tone: 'bad',
      detail: failed.length > 0 ? datesOf(failed) : '',
      title: `The stop could not be sent to OptimoRoute${error ? `: ${error}` : ''}. It is tried again every 30 minutes.`,
    };
  }
  if (optimo.state === 'removed' || (stops.length > 0 && stops.every((s) => s.result === 'removed'))) {
    return { label: 'Removed', tone: 'warn', detail: datesOf(stops), title: 'The order was cancelled or fully refunded, so its stop was removed from OptimoRoute' };
  }
  const kept = stops.filter((s) => s.result === 'kept');
  const there = stops.filter((s) => s.result === 'sent' || s.result === 'adopted' || s.result === 'already');
  if (there.length > 0 || optimo.state === 'sent') {
    const orderNos = [...new Set(there.map((s) => s.orderNo).filter(Boolean))].join(', ');
    const adopted = there.some((s) => s.result === 'adopted');
    return {
      label: 'In OptimoRoute',
      tone: 'good',
      detail: datesOf(there.length > 0 ? there : stops),
      title: `The delivery stop is in OptimoRoute${orderNos ? ` (${orderNos})` : ''}.${adopted ? ' It was already there from an upload.' : ''}${kept.length ? ' Another order of the same customer shares this stop.' : ''}`,
    };
  }
  return { label: optimo.state ? optimo.state.charAt(0).toUpperCase() + optimo.state.slice(1) : '-', tone: 'warn', detail: datesOf(stops), title: `OptimoRoute status: ${optimo.state ?? 'unknown'}` };
}
