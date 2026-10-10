/**
 * Password rule for NEW admin passwords (same as the customer site):
 * 8 or more characters, any characters allowed, at most 72 bytes
 * (bcrypt ignores everything after 72 bytes). Login accepts any non-empty password,
 * so an older, shorter password can still sign in.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

/** The first thing wrong with a new password, or null when it is fine. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || !password.trim()) return 'Password is required';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return 'Password is too long';
  }
  return null;
}
