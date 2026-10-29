import { filterAppCustomers, type AppCustomer } from '@/utils/appCustomers';

/** Customers a hand-picked notification can reach: the app, with notifications allowed on the phone. */
export const reachableCustomers = (all: AppCustomer[]): AppCustomer[] => all.filter((c) => c.permission === 'allowed');

/** The reachable customers matching the typed search (name, email, phone number). */
export const searchReachable = (all: AppCustomer[], search: string): AppCustomer[] => filterAppCustomers(reachableCustomers(all), search, 'all');

/** Adds (on) or removes (off) the given ids from the chosen list, without duplicates, keeping the existing order. */
export function setChosen(chosen: string[], ids: string[], on: boolean): string[] {
  if (on) {
    const have = new Set(chosen);
    return [...chosen, ...ids.filter((id) => !have.has(id))];
  }
  const drop = new Set(ids);
  return chosen.filter((id) => !drop.has(id));
}

/** Chosen ids that are still reachable (a customer can drop off the list between opening the picker and sending). */
export const stillReachable = (chosen: string[], all: AppCustomer[]): string[] => {
  const ok = new Set(reachableCustomers(all).map((c) => c.userId));
  return chosen.filter((id) => ok.has(id));
};

/** What to tell the admin after a hand-picked send. */
export function selectedSendNotice(d: { mode: string; audience: number; skipped: number; unavailable: number; phones: number; sent: number; failed: number }): string {
  const people = (n: number) => `${n} customer${n === 1 ? '' : 's'}`;
  const extra: string[] = [];
  if (d.skipped > 0) extra.push(`${people(d.skipped)} skipped (menu alerts switched off in the app)`);
  if (d.unavailable > 0) extra.push(`${people(d.unavailable)} could not be reached`);
  const tail = extra.length ? ` ${extra.join('; ')}.` : '';
  if (d.mode === 'dry') return `Test run: it would go to ${d.phones} phone${d.phones === 1 ? '' : 's'} of ${people(d.audience - d.skipped)}. Nothing was sent.${tail}`;
  return `Sent to ${d.sent} phone${d.sent === 1 ? '' : 's'}${d.failed ? ` (${d.failed} could not be reached)` : ''}.${tail}`;
}
