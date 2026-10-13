/**
 * What a packer (a staff account that is not an admin) may open in the admin panel: the Orders list and the Packing Report with
 * Pack live. Everything else is hidden from their menu and turned back to Orders. The server enforces the same limit on its own
 * (a packer's login token is refused by every admin route except the few packing ones), so this only keeps the screens tidy.
 */
export const PACKER_HOME = '/admin/orders';

/** Pages a packer may open (each one with everything below it) */
const PACKER_PAGES = ['/admin/orders', '/admin/reports/packing'];

/** Below an allowed page but for admins only: how fast the team packs */
const PACKER_BLOCKED = ['/admin/reports/packing/metrics'];

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

export function packerMayOpen(pathname: string | null | undefined): boolean {
  const path = (pathname ?? '').replace(/\/+$/, '') || '/';
  if (PACKER_BLOCKED.some((base) => within(path, base))) return false;
  return PACKER_PAGES.some((base) => within(path, base));
}
