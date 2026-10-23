/** Texts the admin sets for the app's home screen (the app reads them from the customer site: GET /api/app-settings there). */
export const HOME_INTRO_MAX = 60;

/** One line, trimmed; an empty text means "use the app's usual greeting". */
export function cleanHomeIntro(input: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (input === undefined || input === null) return { ok: true, value: '' };
  if (typeof input !== 'string') return { ok: false, error: 'The text is not valid' };
  const value = input.replace(/\s+/g, ' ').trim();
  if (value.length > HOME_INTRO_MAX) return { ok: false, error: `Keep it to ${HOME_INTRO_MAX} characters or fewer` };
  return { ok: true, value };
}
