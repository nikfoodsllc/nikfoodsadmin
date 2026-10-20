/** Orders whose delivery address can still be changed (the customer site refuses the others too). */
export const ADDRESS_EDITABLE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];

/** Same limit as the customer site's delivery instructions. */
export const MAX_INSTRUCTION_LENGTH = 30;

export interface AddressForm {
  street: string;
  apartment: string;
  city: string;
  zipCode: string;
  entrance: string;
  floor: string;
}

export const canEditAddress = (status: string | undefined) => ADDRESS_EDITABLE_STATUSES.includes(String(status));

/** What is wrong with the form, or '' when it can be saved. */
export function addressFormProblem(form: AddressForm): string {
  if (!form.street.trim()) return 'Enter the street address.';
  if (!form.city.trim()) return 'Enter the city.';
  if (!/^\d{5}$/.test(form.zipCode.trim())) return 'Enter a 5-digit zip code.';
  if (form.floor.trim().length > MAX_INSTRUCTION_LENGTH) return `Delivery instructions can be ${MAX_INSTRUCTION_LENGTH} characters at most.`;
  return '';
}

const norm = (v: string) => v.replace(/\s+/g, ' ').trim().toLowerCase();

export function addressFormChanged(a: AddressForm, b: AddressForm): boolean {
  return (Object.keys(a) as Array<keyof AddressForm>).some((k) => norm(a[k]) !== norm(b[k]));
}

/** The note shown after saving, from the customer site's answer about the route planner. */
export function routeNote(optimo: { mode?: string; updated?: number; recreated?: number; failed?: number } | undefined): { text: string; warn: boolean } {
  if (!optimo || optimo.mode === 'off' || optimo.mode === 'dry') return { text: 'Address saved. The route planner is not switched on for this site.', warn: false };
  if (optimo.mode === 'timeout' || optimo.mode === 'error' || (optimo.failed ?? 0) > 0) return { text: 'Address saved. The route planner could not be updated yet; it will be retried within 30 minutes.', warn: true };
  const n = (optimo.updated ?? 0) + (optimo.recreated ?? 0);
  return { text: n > 0 ? 'Address saved and updated in OptimoRoute.' : 'Address saved. No upcoming OptimoRoute stop needed changing.', warn: false };
}
