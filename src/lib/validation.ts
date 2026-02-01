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

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  return { isValid: true };
}

export function validateLoginForm(email: string, password: string): {
  isValid: boolean;
  errors: {
    email?: string;
    password?: string;
  };
} {
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);

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
