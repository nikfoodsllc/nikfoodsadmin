/**
 * Centralized currency formatting utility for the admin interface.
 * Handles null/undefined/NaN values gracefully to prevent runtime errors.
 */

/**
 * Type definition for input values that can be formatted as currency
 */
export type CurrencyValue = number | string | null | undefined;

/**
 * Configuration options for currency formatting
 */
export interface CurrencyFormatOptions {
  /** Enable console warnings for invalid inputs (default: false) */
  enableWarnings?: boolean;
  /** Fallback value for invalid inputs (default: 0) */
  fallback?: number;
  /** Number of decimal places (default: 2) */
  decimals?: number;
  /** Currency symbol (default: '$') */
  symbol?: string;
}

/**
 * Validates and converts input to a safe number for currency formatting
 */
const validateCurrencyValue = (
  value: CurrencyValue,
  options: CurrencyFormatOptions = {}
): number => {
  const { fallback = 0, enableWarnings = false } = options;

  // Handle null and undefined
  if (value === null || value === undefined) {
    if (enableWarnings) {
      console.warn('Currency value is null or undefined, using fallback:', fallback);
    }
    return fallback;
  }

  // Convert string to number if necessary
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;

  // Handle invalid numbers (NaN, non-numeric)
  if (typeof numericValue !== 'number' || isNaN(numericValue) || !isFinite(numericValue)) {
    if (enableWarnings) {
      console.warn('Invalid currency value provided, using fallback:', { value, fallback });
    }
    return fallback;
  }

  // Ensure we have a finite number
  return numericValue;
};

/**
 * Safely formats a value as currency with comprehensive validation
 *
 * @param value - The value to format (number, string, null, or undefined)
 * @param options - Formatting configuration options
 * @returns Formatted currency string (e.g., "$0.00")
 */
export const safeFormatCurrency = (
  value: CurrencyValue,
  options: CurrencyFormatOptions = {}
): string => {
  const { decimals = 2, symbol = '$' } = options;

  try {
    const safeValue = validateCurrencyValue(value, options);
    return `${symbol}${safeValue.toFixed(decimals)}`;
  } catch (error) {
    console.error('Unexpected error in safeFormatCurrency:', error);
    // Ultimate fallback
    return `${symbol}${(options.fallback || 0).toFixed(decimals)}`;
  }
};

/**
 * Formats currency using Intl.NumberFormat for more advanced localization
 *
 * @param value - The value to format (number, string, null, or undefined)
 * @param options - Additional formatting options
 * @returns Formatted currency string using Intl.NumberFormat
 */
export const formatCurrencyIntl = (
  value: CurrencyValue,
  options: CurrencyFormatOptions & { locale?: string } = {}
): string => {
  const { locale = 'en-US', enableWarnings = false } = options;

  try {
    const safeValue = validateCurrencyValue(value, options);

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: options.decimals ?? 2,
      maximumFractionDigits: options.decimals ?? 2,
    }).format(safeValue);
  } catch (error) {
    console.error('Error in formatCurrencyIntl, falling back to safeFormatCurrency:', error);
    return safeFormatCurrency(value, options);
  }
};

/**
 * Legacy formatCurrency function for backwards compatibility
 * Uses simple formatting with $ prefix and 2 decimal places
 */
export const formatCurrency = (value: CurrencyValue): string => {
  return safeFormatCurrency(value, {
    enableWarnings: false,
    decimals: 2,
    symbol: '$',
    fallback: 0
  });
};

/**
 * Default export object containing all formatting functions
 */
export default {
  safeFormatCurrency,
  formatCurrencyIntl,
  formatCurrency,
  validateCurrencyValue,
};

/**
 * Constants for consistent currency formatting across the app
 */
export const CURRENCY_CONSTANTS = {
  DEFAULT_DECIMALS: 2,
  DEFAULT_SYMBOL: '$',
  DEFAULT_LOCALE: 'en-US',
  FALLBACK_VALUE: 0,
} as const;