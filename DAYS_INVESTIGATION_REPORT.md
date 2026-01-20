# Days Configuration Investigation Report

## Issue Summary
**Problem**: ManageDaysPage shows all days as enabled, while DayWiseItemSelector correctly shows some days as disabled.

## Root Cause Identified

### The Bug: ID Mismatch in ManageDaysPage

**Location**: `src/app/admin/manage-days/components/ManageDaysPage.tsx` (Line 94)

**Problem Code**:
```typescript
const apiDay = data.data?.find((d: any) => d.id === defaultDay.id);
```

**Why This Fails**:
1. **API Response Structure** (`/api/admin/days`):
   ```json
   {
     "id": "6765abc123def456789",  // MongoDB ObjectId
     "day": "monday",              // Day name
     "label": "Monday",
     "enabled": false,
     "sequence": 1
   }
   ```

2. **DAYS_CONFIG Structure**:
   ```typescript
   { id: 'monday', name: 'Monday', displayName: 'Mon', order: 1 }
   ```

3. **The Mismatch**:
   - `d.id` = MongoDB ObjectId (e.g., `"6765abc123def456789"`)
   - `defaultDay.id` = Day name (e.g., `"monday"`)
   - These will NEVER match, so `apiDay` is always `undefined`
   - When `apiDay` is `undefined`, the fallback `apiDay?.enabled ?? true` defaults to `true`

### Why DayWiseItemSelector Works Correctly

**Location**: `src/app/admin/food-category/components/DayWiseItemSelector.tsx`

The component uses the `useAvailableDays` hook which:
1. Fetches data from the API
2. Stores it directly in state without any ID matching logic
3. Passes the raw API response to the component
4. The component then uses the `day` field (not `id`) for display and logic

**Key Difference**:
- DayWiseItemSelector: Uses the `day` field from API response directly
- ManageDaysPage: Tries to match by `id` field, which fails

## Data Flow Analysis

### API Endpoint: `/api/admin/days` (GET)
- ✅ Returns correct data from database
- ✅ Returns `enabled` field correctly from database
- ✅ Returns `day` field with day name (e.g., "monday")
- ❌ Returns `id` as MongoDB ObjectId (not day name)

### ManageDaysPage Component Flow
1. Fetches from `/api/admin/days`
2. Tries to match API response with DAYS_CONFIG by `id`
3. **FAILS** because `id` doesn't match
4. Falls back to `enabled: true` for all days
5. Shows all days as enabled

### DayWiseItemSelector Component Flow
1. Uses `useAvailableDays` hook
2. Hook fetches from `/api/admin/days`
3. Hook stores API data as-is in state
4. Component uses `day` field directly (not `id`)
5. ✅ Shows correct enabled/disabled state

## Database State

The database (`availableDays` collection) contains the correct data. The issue is purely in how ManageDaysPage processes the API response.

## Caching Behavior

The `useAvailableDays` hook implements caching with a 5-minute duration. This caching:
- Does NOT cause the issue
- Works correctly for both components
- The bug is in the data processing logic, not caching

## Console Logging Added

To help verify this diagnosis, console logging has been added to:

1. **API Route** (`src/app/api/admin/days/route.ts`):
   - Logs raw database data
   - Logs response data before sending

2. **ManageDaysPage** (`src/app/admin/manage-days/components/ManageDaysPage.tsx`):
   - Logs raw API response
   - Logs processed daysData
   - Logs enabled days list

3. **DayWiseItemSelector** (`src/app/admin/food-category/components/DayWiseItemSelector.tsx`):
   - Logs availableDays when received
   - Logs enabledDays array

4. **useAvailableDays Hook** (`src/hooks/useAvailableDays.ts`):
   - Logs fetched days from API
   - Logs enabled days count

## Fix Required

**Option 1: Fix the ID Matching Logic**
Change ManageDaysPage to match by `day` field instead of `id`:
```typescript
const apiDay = data.data?.find((d: any) => d.day === defaultDay.id);
```

**Option 2: Change API Response Structure**
Change API to return `day` as the `id` field (not recommended as it breaks MongoDB convention)

**Recommendation**: Use Option 1 - change the matching logic in ManageDaysPage.

## Testing Script

A database inspection script has been created at `scripts/check-available-days.js` that can be run to verify the actual database state:
```bash
node scripts/check-available-days.js
```

## Verification Steps

Once the fix is applied:
1. Check browser console for log messages with 🔍 emoji
2. Verify ManageDaysPage shows correct enabled/disabled states
3. Verify it matches DayWiseItemSelector display
4. Test toggling days on/off in ManageDaysPage
5. Verify changes persist and are reflected in both pages

## Summary

This is a **data mapping bug** where ManageDaysPage tries to match API data with local config using the wrong field (`id` instead of `day`). The database, API, and caching all work correctly. Only the matching logic in ManageDaysPage needs to be fixed.
