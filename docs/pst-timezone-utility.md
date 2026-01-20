# PST Timezone Utility Module

## Overview

Centralized timezone utility module for handling Pacific Standard Time (PST/PDT) conversions and formatting throughout the application. This module uses the `date-fns-tz` library to ensure consistent timezone-aware date operations.

## Installation

**Required Dependency:**
```bash
npm install date-fns-tz
```

## Module Location

`src/utils/timezone.ts`

## Core Constant

```typescript
export const PST_TIMEZONE = 'America/Los_Angeles';
```

This constant represents the PST/PDT timezone and is exported for reuse across the application.

## API Reference

### Type Definitions

```typescript
type DateInput = Date | string | number | null | undefined;
```

All utility functions accept this flexible input type and handle `null`/`undefined` gracefully.

### Core Functions

#### `toPSTDate(date: DateInput): Date | null`

Converts a date to PST timezone Date object.

**Parameters:**
- `date` - Date to convert (Date, string, timestamp, or null/undefined)

**Returns:**
- `Date` object in PST timezone, or `null` if input is invalid

**Example:**
```typescript
const pstDate = toPSTDate('2025-01-15T10:00:00Z');
// Returns Date object converted to PST timezone
```

---

#### `formatInPST(date: DateInput, formatStr: string): string`

Formats a date in PST timezone with a custom format string.

**Parameters:**
- `date` - Date to format
- `formatStr` - Format string (e.g., 'yyyy-MM-dd', 'MMM dd, yyyy')

**Returns:**
- Formatted date string in PST timezone, or empty string if input is invalid

**Examples:**
```typescript
formatInPST('2025-01-15', 'yyyy-MM-dd') // '2025-01-15'
formatInPST(new Date(), 'MMM dd, yyyy HH:mm') // 'Jan 15, 2025 14:30'
formatInPST('2025-01-15', 'EEE (MMM dd)') // 'Wed (Jan 15)'
```

---

#### `formatPSTDate(date: DateInput): string`

Formats a date as "MMM DD, YYYY" in PST timezone (e.g., "Jan 15, 2025").

**Parameters:**
- `date` - Date to format

**Returns:**
- Formatted date string, or empty string if input is invalid

**Example:**
```typescript
formatPSTDate('2025-01-15') // 'Jan 15, 2025'
```

---

#### `formatPSTDateTime(date: DateInput): string`

Formats a date with time as "MMM DD, YYYY HH:MM" in PST timezone (e.g., "Jan 15, 2025 14:30").

**Parameters:**
- `date` - Date to format

**Returns:**
- Formatted date-time string, or empty string if input is invalid

**Example:**
```typescript
formatPSTDateTime('2025-01-15T14:30:00Z') // 'Jan 15, 2025 14:30'
```

---

#### `formatPSTTime(date: DateInput): string`

Formats a time as "HH:MM" in PST timezone (e.g., "14:30").

**Parameters:**
- `date` - Date to format

**Returns:**
- Formatted time string, or empty string if input is invalid

**Example:**
```typescript
formatPSTTime('2025-01-15T14:30:00Z') // '14:30'
```

---

#### `formatPSTDateISO(date: DateInput): string`

Formats a date as "YYYY-MM-DD" in PST timezone (e.g., "2025-01-15").

Useful for database storage and API responses.

**Parameters:**
- `date` - Date to format

**Returns:**
- Formatted date string in ISO format, or empty string if input is invalid

**Example:**
```typescript
formatPSTDateISO('2025-01-15T10:00:00Z') // '2025-01-15'
```

---

#### `formatPSTDateWithDay(date: DateInput): string`

Formats a date as "Day (MMM DD)" in PST timezone (e.g., "Sat (Jan 3)").

**Parameters:**
- `date` - Date to format

**Returns:**
- Formatted date string with day name, or empty string if input is invalid

**Example:**
```typescript
formatPSTDateWithDay('2025-01-04') // 'Sat (Jan 4)'
```

---

#### `formatPSTDateShort(date: DateInput): string`

Formats a date as "MMM DD" in PST timezone (e.g., "Jan 15").

**Parameters:**
- `date` - Date to format

**Returns:**
- Formatted date string (month and day only), or empty string if input is invalid

**Example:**
```typescript
formatPSTDateShort('2025-01-15') // 'Jan 15'
```

---

#### `getCurrentPSTDate(): Date`

Gets the current time in PST timezone.

**Returns:**
- Current `Date` object in PST timezone

**Example:**
```typescript
const now = getCurrentPSTDate();
// Returns current Date in PST timezone
```

---

#### `isValidPSTDate(date: DateInput): boolean`

Checks if a date is valid.

**Parameters:**
- `date` - Date to validate

**Returns:**
- `true` if date is valid, `false` otherwise

**Example:**
```typescript
isValidPSTDate('2025-01-15') // true
isValidPSTDate('invalid-date') // false
isValidPSTDate(null) // false
```

## Integration with Existing Code

### Updated `src/utils/days.ts`

The existing date utility functions in `src/utils/days.ts` have been updated to use PST formatting:

#### `formatDateLabel(dateString: string): string`
- Now uses `formatPSTDate()` internally
- Returns dates in "MMM DD, YYYY" format in PST timezone
- Maintains backward compatibility (same return type)

#### `formatDateShort(dateString: string): string`
- Now uses `formatPSTDateShort()` internally
- Returns dates in "MMM DD" format in PST timezone
- Maintains backward compatibility (same return type)

#### `formatDateWithDay(dateString: string): string`
- Now uses `formatPSTDateWithDay()` internally
- Returns dates in "Day (MMM DD)" format in PST timezone
- Maintains backward compatibility (same return type)

#### New function: `formatDateISO(dateString: string): string`
- Uses `formatPSTDateISO()` internally
- Returns dates in "YYYY-MM-DD" format in PST timezone
- Useful for consistent date representation

### Re-exports

The `src/utils/days.ts` module now re-exports all timezone utilities for convenience:

```typescript
// Can import from either module
import { formatPSTDate, PST_TIMEZONE } from '@/utils/timezone';
import { formatPSTDate, PST_TIMEZONE } from '@/utils/days'; // Also works
```

## Migration Guide

### Before (without timezone support):

```typescript
const date = new Date('2025-01-15');
const formatted = date.toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
// Result varies based on server/client timezone
```

### After (with PST support):

```typescript
import { formatPSTDate } from '@/utils/timezone';

const formatted = formatPSTDate('2025-01-15');
// Result: 'Jan 15, 2025' (always in PST)
```

### Updating Existing Components

Components that previously used inline date formatting can now use the centralized utilities:

**Before:**
```typescript
const formatDate = (date: Date | string | undefined) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
```

**After:**
```typescript
import { formatPSTDateTime } from '@/utils/timezone';

const formatted = formatPSTDateTime(date) || 'N/A';
```

## Error Handling

All functions handle edge cases gracefully:

1. **Null/Undefined Input**: Returns empty string (formatting functions) or null (conversion functions)
2. **Invalid Date**: Returns empty string or null
3. **Parsing Errors**: Caught and logged, returns fallback value

## Benefits

1. **Consistency**: All dates displayed in PST timezone across the application
2. **Centralization**: Single source of truth for date formatting logic
3. **Maintainability**: Easy to update timezone or formatting patterns
4. **Type Safety**: Full TypeScript support with proper type definitions
5. **Graceful Degradation**: Handles invalid inputs without throwing errors
6. **Backward Compatibility**: Existing functions maintain same return types

## Testing Considerations

When testing components that use these utilities:

1. Mock dates in PST timezone for consistent test results
2. Test edge cases: null, undefined, invalid dates
3. Verify format strings match expected output
4. Consider testing timezone conversions (especially around DST transitions)

## Future Enhancements

Possible future improvements:

1. Support for multiple timezones (e.g., user-specific timezones)
2. Locale-specific formatting options
3. Relative time formatting (e.g., "2 hours ago")
4. Business day calculations in PST
5. Holiday calendar integration

## Related Documentation

- [Date Formatting in Days Utility](./manage-days-page.md)
- [Available Dates Collection](./availableDates-collection.md)
- [Database Structure](./database-structure.md)

## Changelog

### January 2026
- Created centralized timezone utility module
- Implemented PST conversion functions using date-fns-tz
- Updated existing date utility functions to use PST formatting
- Added comprehensive documentation
