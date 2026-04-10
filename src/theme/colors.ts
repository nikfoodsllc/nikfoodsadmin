/**
 * Global color definitions for the nikfoods app
 * Use these constants throughout the app to maintain consistency
 */

export const colors = {
  // Brand colors (original nikfoods)
  primary: '#f89c35',
  primaryLight: '#fbb76a',
  primaryDark: '#d47b1a',

  // Admin Dashboard Primary (Blue from original admin)
  adminPrimary: '#4F8CFF',
  adminPrimaryLight: '#E6F0FF',
  adminPrimaryHover: '#3B7AE8',

  // UI colors
  background: '#ffffff',
  backgroundDark: '#f5f5f5',
  text: '#333333',
  textLight: '#666666',
  textDark: '#111111',
  categoryCardBg: '#FFF4E4',

  // Status colors (matching original admin)
  success: '#5FD068',
  successLight: '#EBFBEF',
  successDark: '#00B894',

  error: '#FF7675',
  errorLight: '#FFF0F0',
  errorDark: '#EF4444',

  warning: '#FFB84F',
  warningLight: '#FFF5E6',
  warningDark: '#FF9F43',

  info: '#6C5CE7',
  infoLight: '#F0EEFF',
  infoDark: '#5758BB',

  // Accent colors
  teal: '#00B894',
  tealLight: '#E5FAF4',

  purple: '#8B5CF6',
  purpleLight: '#F3EFFF',

  green: '#1DD1A1',
  greenLight: '#E6FBF5',

  // Border and shadow
  border: '#e0e0e0',
  shadow: 'rgba(0, 0, 0, 0.1)',

  // Misc
  divider: '#eeeeee',
  overlay: 'rgba(0, 0, 0, 0.5)',
}

// Aliases for common use cases
export const brandColors = {
  nikfoods: colors.primary,
  accent: colors.primaryLight,
}

// Export individual colors for direct imports
export const {
  primary,
  primaryLight,
  primaryDark,
  background,
  backgroundDark,
  text,
  textLight,
  textDark,
  success,
  error,
  warning,
  info,
  border,
  shadow,
  divider,
  overlay,
} = colors
