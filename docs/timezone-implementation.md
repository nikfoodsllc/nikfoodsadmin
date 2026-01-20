# PST Timezone Implementation Guide

## Overview

This document describes the PST (Pacific Standard Time) timezone implementation approach for the NikFood Admin application. The implementation follows a **server-side UTC storage, client-side PST display** architecture.

## Table of Contents

1. [Architecture Approach](#architecture-approach)
2. [Backend API Behavior](#backend-api-behavior)
3. [Client-Side Implementation](#client-side-implementation)
4. [Timezone Utilities](#timezone-utilities)
5. [Updated Components](#updated-components)
6. [Adding PST Formatting to New Components](#adding-pst-formatting-to-new-components)
7. [Dependencies](#dependencies)
8. [Examples](#examples)

---

## Architecture Approach

### Core Principle

**All dates are stored and transmitted in UTC (ISO 8601 format), and converted to PST only for display in the UI.**

This approach ensures:
- ✅ Consistent date storage in the database
- ✅ Timezone-agnostic API responses
- ✅ Flexible client-side display in any timezone
- ✅ No timezone-specific logic on the server
- ✅ Easy to support multiple timezones in the future

### Data Flow

```
Database (UTC) → API (ISO 8601 UTC) → Client (PST Display)
     ↓               ↓                    ↓
   Native         ISO String          Formatted PST
  Date          "2025-01-15...    "Jan 15, 2025"
                T10:00:00Z"
```

---

## Backend API Behavior

### Date Storage

All dates in MongoDB are stored as native BSON Date objects (UTC):
- `createdAt`
- `updatedAt`
- `deliveryDate`
- Any timestamp fields

### API Response Format

All backend API routes return dates in **ISO 8601 format (UTC)** without any timezone-specific formatting:

#### `/api/admin/stats`
```typescript
// Response includes dates in ISO 8601 format
{
  dateRange: {
    startDate: "2025-01-01T00:00:00.000Z",  // UTC
    endDate: "2025-01-15T23:59:59.999Z"     // UTC
  },
  lastUpdated: "2025-01-15T10:30:00.000Z"   // UTC
}
```

#### `/api/admin/orders`
```typescript
// Orders returned with native Date objects (serialized as ISO strings)
{
  createdAt: "2025-01-15T10:00:00.000Z",   // UTC
  updatedAt: "2025-01-15T11:30:00.000Z"    // UTC
}
```

#### `/api/admin/available-dates`
```typescript
// Available dates with ISO date strings
{
  date: "2025-01-15",                        // Date string (timezone-agnostic)
  createdAt: "2025-01-10T08:00:00.000Z",    // UTC
  updatedAt: "2025-01-10T09:00:00.000Z"     // UTC
}
```

### ✅ Verification

**All backend routes correctly return ISO 8601 dates without timezone formatting:**

- ✅ `/api/admin/stats` - Lines 564-568 return `toISOString()`
- ✅ `/api/admin/orders` - Returns raw Date objects (MongoDB native)
- ✅ `/api/admin/available-dates` - Returns Date objects and ISO date strings

**No server-side timezone conversion is performed**, which is the correct approach.

---

## Client-Side Implementation

### Timezone Conversion Responsibility

**All PST conversion happens on the client-side** using the centralized timezone utilities:

```typescript
import { formatPSTDate, formatPSTDateTime } from '@/utils/timezone';

// Convert UTC date from API to PST for display
const displayDate = formatPSTDate(order.createdAt);
// Input:  "2025-01-15T10:00:00.000Z" (UTC)
// Output: "Jan 15, 2025" (PST)
```

### Key Implementation Points

1. **API responses contain UTC dates** (ISO 8601 format or native Date objects)
2. **Client components format dates in PST** using `@/utils/timezone` utilities
3. **No server-side timezone logic** - ensures consistent behavior regardless of server location
4. **Browser handles timezone conversion** via `date-fns-tz` library

---

## Timezone Utilities

### Location

`src/utils/timezone.ts`

### Core Constant

```typescript
export const PST_TIMEZONE = 'America/Los_Angeles';
```

### Available Functions

#### Formatting Functions

| Function | Format | Example |
|----------|--------|---------|
| `formatPSTDate(date)` | "MMM DD, YYYY" | "Jan 15, 2025" |
| `formatPSTDateTime(date)` | "MMM DD, YYYY HH:MM" | "Jan 15, 2025 14:30" |
| `formatPSTTime(date)` | "HH:MM" | "14:30" |
| `formatPSTDateISO(date)` | "YYYY-MM-DD" | "2025-01-15" |
| `formatPSTDateWithDay(date)` | "Day (MMM DD)" | "Wed (Jan 15)" |
| `formatPSTDateShort(date)` | "MMM DD" | "Jan 15" |

#### Conversion Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `toPSTDate(date)` | Convert to PST Date object | `Date \| null` |
| `formatInPST(date, formatStr)` | Custom format in PST | `string` |
| `getCurrentPSTDate()` | Current time in PST | `Date` |
| `isValidPSTDate(date)` | Validate date | `boolean` |

### Input Types

All functions accept flexible input types:

```typescript
type DateInput = Date | string | number | null | undefined;
```

---

## Updated Components

The following components have been updated to use PST formatting:

### Dashboard Components

| Component | File | Usage |
|-----------|------|-------|
| Dashboard | `src/app/admin/components/Dashboard.tsx` | `formatPSTDate()`, `formatPSTDateTime()` |
| DateRangeSelector | `src/app/admin/components/DateRangeSelector.tsx` | Creates UTC date ranges |

**Example:**
```typescript
// Dashboard.tsx - Lines 632-636
<Typography variant="body2">
  Showing data from{' '}
  <strong>{formatPSTDate(stats.dateRange.startDate)}</strong> to{' '}
  <strong>{formatPSTDate(stats.dateRange.endDate)}</strong>
</Typography>
<Typography variant="body2">
  Last updated: {formatPSTDateTime(stats.lastUpdated)}
</Typography>
```

### Order Management Components

| Component | File | Usage |
|-----------|------|-------|
| OrderTableRow | `src/app/admin/orders/components/OrderTableRow.tsx` | `formatPSTDate()` |
| OrderDetailsDialog | `src/app/admin/orders/components/OrderDetailsDialog.tsx` | `formatPSTDateTime()`, `formatPSTDate()` |

**Example:**
```typescript
// OrderTableRow.tsx - Line 74
<Cell>
  {formatPSTDate(order.createdAt)}
</Cell>

// OrderDetailsDialog.tsx - Lines 130, 220
<Typography variant="body2">
  {formatPSTDateTime(order.createdAt)}
</Typography>
<Typography variant="body2">
  {dayOrder.day} - {formatPSTDate(dayOrder.deliveryDate)}
</Typography>
```

### Other Updated Components

The following 31 components also use PST formatting utilities:
- Admin user management (`AdminUsersTable`, `UserDetailsDialog`, etc.)
- Food item management (`FoodItemsPage`, `ComboFoodItemDialog`, etc.)
- Reports (`DeliveryReportPage`, `KitchenReportPage`)
- Min cart value management
- And more...

### Verification

All components follow this pattern:
```typescript
import { formatPSTDate, formatPSTDateTime } from '@/utils/timezone';

// Component displays UTC dates from API in PST
<>{formatPSTDate(apiDate)}</>
```

---

## Adding PST Formatting to New Components

### Step-by-Step Guide

When adding date display to a new component:

#### 1. Import the timezone utilities

```typescript
import { formatPSTDate, formatPSTDateTime } from '@/utils/timezone';
```

#### 2. Apply formatting to dates from the API

```typescript
interface MyComponentProps {
  orders: Order[];  // Order has createdAt: Date (UTC from API)
}

export default function MyComponent({ orders }: MyComponentProps) {
  return (
    <div>
      {orders.map(order => (
        <div key={order._id}>
          {/* Format UTC date in PST for display */}
          <span>{formatPSTDate(order.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
```

#### 3. Choose the appropriate formatting function

Based on your display needs:

```typescript
// Date only
formatPSTDate(date)  // "Jan 15, 2025"

// Date and time
formatPSTDateTime(date)  // "Jan 15, 2025 14:30"

// Time only
formatPSTTime(date)  // "14:30"

// Short format
formatPSTDateShort(date)  // "Jan 15"

// ISO format (for inputs/storage)
formatPSTDateISO(date)  // "2025-01-15"
```

#### 4. Handle null/undefined dates

The utilities handle these gracefully:

```typescript
// These all return empty string for null/undefined
formatPSTDate(null)         // ""
formatPSTDate(undefined)    // ""
formatPSTDate(invalid)      // ""
```

With fallback:
```typescript
{formatPSTDate(order.createdAt) || 'N/A'}
```

### Common Patterns

#### Pattern 1: Table Column

```typescript
<TableCell>
  {formatPSTDate(order.createdAt)}
</TableCell>
```

#### Pattern 2: Detail View

```typescript
<Box>
  <Typography variant="caption">Created</Typography>
  <Typography variant="body2">
    {formatPSTDateTime(item.createdAt)}
  </Typography>
</Box>
```

#### Pattern 3: Date Range Display

```typescript
<Typography>
  From {formatPSTDate(range.startDate)} to {formatPSTDate(range.endDate)}
</Typography>
```

#### Pattern 4: With Fallback

```typescript
<Typography>
  {formatPSTDate(order.updatedAt) || 'Not updated'}
</Typography>
```

---

## Dependencies

### Required Package

```json
{
  "dependencies": {
    "date-fns-tz": "^3.2.0"
  }
}
```

### Why date-fns-tz?

The `date-fns-tz` library was chosen for PST timezone implementation because:

1. **Built on date-fns**: Familiar API if you've used date-fns
2. **Lightweight**: Smaller bundle than moment-timezone
3. **TypeScript support**: Excellent type definitions
4. **IANA timezone support**: Uses standard 'America/Los_Angeles' timezone
5. **Tree-shakeable**: Only import what you need
6. **Active maintenance**: Regularly updated
7. **Browser support**: Works in all modern browsers

### Installation

If not already installed:

```bash
npm install date-fns-tz
```

---

## Examples

### Example 1: Display Order Creation Date

```typescript
import { formatPSTDateTime } from '@/utils/timezone';

interface OrderRowProps {
  order: {
    _id: string;
    createdAt: Date;  // UTC from API
  };
}

export function OrderRow({ order }: OrderRowProps) {
  return (
    <tr>
      <td>{formatPSTDateTime(order.createdAt)}</td>
    </tr>
  );
}

// Input:  order.createdAt = "2025-01-15T18:30:00.000Z" (UTC)
// Output: "Jan 15, 2025 10:30" (PST, assuming PST is UTC-8)
```

### Example 2: Dashboard Date Range

```typescript
import { formatPSTDate } from '@/utils/timezone';

interface DashboardProps {
  dateRange: {
    startDate: Date;  // UTC from API
    endDate: Date;    // UTC from API
  };
}

export function Dashboard({ dateRange }: DashboardProps) {
  return (
    <div>
      <p>
        Showing data from{' '}
        <strong>{formatPSTDate(dateRange.startDate)}</strong> to{' '}
        <strong>{formatPSTDate(dateRange.endDate)}</strong>
      </p>
    </div>
  );
}

// Input:  startDate = "2025-01-01T00:00:00.000Z" (UTC)
//         endDate = "2025-01-31T23:59:59.999Z" (UTC)
// Output: "Jan 01, 2025" to "Jan 31, 2025" (PST)
```

### Example 3: Date Input with PST Conversion

```typescript
import { formatPSTDateISO } from '@/utils/timezone';

interface DateInputProps {
  value: Date;  // UTC from API
  onChange: (date: string) => void;
}

export function DateInput({ value, onChange }: DateInputProps) {
  // Convert UTC date to ISO format for input
  const isoValue = formatPSTDateISO(value);

  return (
    <input
      type="date"
      value={isoValue}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Input:  value = "2025-01-15T10:00:00.000Z" (UTC)
// Output: "2025-01-15" (ISO date string in PST)
```

### Example 4: Handling Multiple Date Formats

```typescript
import {
  formatPSTDate,
  formatPSTDateTime,
  formatPSTDateShort,
  formatPSTTime
} from '@/utils/timezone';

interface EventCardProps {
  event: {
    name: string;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
  };
}

export function EventCard({ event }: EventCardProps) {
  return (
    <div>
      <h3>{event.name}</h3>
      {/* Date range in short format */}
      <p>
        {formatPSTDateShort(event.startDate)} - {formatPSTDateShort(event.endDate)}
      </p>
      {/* Creation timestamp */}
      <small>
        Created: {formatPSTDateTime(event.createdAt)}
      </small>
    </div>
  );
}

// Output:
// "Jan 15 - Jan 17"
// "Created: Jan 10, 2025 14:30"
```

---

## Best Practices

### ✅ DO

- ✅ Store all dates in UTC in the database
- ✅ Return ISO 8601 format (UTC) from API routes
- ✅ Convert to PST on the client-side for display
- ✅ Use centralized timezone utilities from `@/utils/timezone`
- ✅ Handle null/undefined dates gracefully
- ✅ Use appropriate format functions for the context

### ❌ DON'T

- ❌ Don't format dates on the server-side
- ❌ Don't store timezone-specific strings in the database
- ❌ Don't use `toLocaleString()` or similar (displays user's local timezone)
- ❌ Don't manually calculate timezone offsets
- ❌ Don't create custom date formatting functions

---

## Testing Considerations

### Unit Testing Components

When testing components with dates:

```typescript
import { render } from '@testing-library/react';
import MyComponent from './MyComponent';

test('displays date in PST format', () => {
  const mockDate = new Date('2025-01-15T10:00:00.000Z');
  const { getByText } = render(<MyComponent createdAt={mockDate} />);

  // Should display PST-formatted date
  expect(getByText(/Jan 15, 2025/)).toBeInTheDocument();
});
```

### Manual Testing Checklist

- [ ] Verify dates display in PST timezone (not browser timezone)
- [ ] Check dates around DST transitions (March, November)
- [ ] Test with null/undefined dates
- [ ] Verify date range filters work correctly
- [ ] Check date sorting in tables
- [ ] Confirm date inputs accept PST dates

---

## Troubleshooting

### Issue: Dates showing wrong timezone

**Cause**: Not using PST formatting utilities.

**Solution**:
```typescript
// ❌ Wrong - shows user's local timezone
<Date>{new Date(order.createdAt).toLocaleDateString()}</Date>

// ✅ Correct - shows PST
<Date>{formatPSTDate(order.createdAt)}</Date>
```

### Issue: Inconsistent date formats

**Cause**: Using different formatting methods across components.

**Solution**: Always use utilities from `@/utils/timezone`:
```typescript
import { formatPSTDate } from '@/utils/timezone';
```

### Issue: Date one day off

**Cause**: Timezone conversion happening at wrong time.

**Solution**: Ensure you're formatting the UTC date from API, not converting it first:
```typescript
// ❌ Wrong - converts before formatting
const localDate = new Date(utcDate);
formatPSTDate(localDate);

// ✅ Correct - format UTC date directly
formatPSTDate(utcDate);
```

---

## Related Documentation

- [PST Timezone Utility Module](./pst-timezone-utility.md) - Detailed API reference
- [Timezone Implementation Summary](./timezone-implementation-summary.md) - Implementation summary
- [Manage Days Page](./manage-days-page.md) - Date handling in specific features
- [Database Structure](./database-structure.md) - Date storage in MongoDB

---

## Summary

### Key Points

1. **Server-side**: All dates stored/transmitted in UTC (ISO 8601)
2. **Client-side**: All dates displayed in PST using `@/utils/timezone`
3. **No server-side timezone formatting**: Ensures consistency and flexibility
4. **Centralized utilities**: Use `formatPSTDate()` and related functions
5. **date-fns-tz**: Chosen for lightweight, reliable timezone support

### Architecture

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│  Database   │─────▶│  API Route  │─────▶│   Client     │
│  (UTC)      │      │  (ISO 8601) │      │   (PST)       │
└─────────────┘      └─────────────┘      └──────────────┘
                      No timezone       formatPSTDate()
                      formatting        formatPSTDateTime()
                                        utils/timezone.ts
```

### Updated Components Count

- **3** Backend API routes (verified ISO 8601 output)
- **31+** Client components using PST formatting
- **1** Centralized timezone utility module
- **2** Updated utility modules (`timezone.ts`, `days.ts`)

---

**Document Version**: 1.0
**Last Updated**: January 2026
**Maintained By**: Development Team
