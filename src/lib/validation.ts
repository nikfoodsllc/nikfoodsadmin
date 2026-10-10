import { passwordProblem } from '@/lib/passwordRules';
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
}

/** Rule for a NEW password. Login does not use it: any non-empty password may try to sign in. */
export function validatePassword(password: string): ValidationResult {
  const problem = passwordProblem(password);
  return problem ? { isValid: false, error: problem } : { isValid: true };
}

export function validateLoginForm(email: string, password: string): {
  isValid: boolean;
  errors: {
    email?: string;
    password?: string;
  };
} {
  const emailValidation = validateEmail(email);
  const passwordValidation: ValidationResult = password
    ? { isValid: true }
    : { isValid: false, error: 'Password is required' };

  const errors: { email?: string; password?: string } = {};

  if (!emailValidation.isValid) {
    errors.email = emailValidation.error;
  }

  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.error;
  }

  return {
    isValid: emailValidation.isValid && passwordValidation.isValid,
    errors,
  };
}
