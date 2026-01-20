# Availability Calendar Component

A comprehensive Material-UI based calendar component for managing food category availability by date in the admin dashboard.

## 📋 Overview

The `AvailabilityCalendar` component provides an intuitive interface for administrators to:
- View monthly calendar grid with availability status for each date
- Toggle `flatCategoryEnabled` and `dayWiseCategoryEnabled` flags per date
- Perform bulk actions (enable/disable all dates for a month)
- Navigate between months with intuitive controls
- Visual indicators showing category status at a glance

## 📁 Location

```
src/components/admin/AvailabilityCalendar.tsx
```

## 🚀 Usage

### Basic Usage

```tsx
import AvailabilityCalendar from '@/components/admin/AvailabilityCalendar';

export default function AvailabilityCalendarPage() {
  return <AvailabilityCalendar />;
}
```

### With Custom Initial Month

```tsx
import AvailabilityCalendar from '@/components/admin/AvailabilityCalendar';

export default function AvailabilityCalendarPage() {
  const initialMonth = new Date('2024-01-01');
  return <AvailabilityCalendar initialMonth={initialMonth} />;
}
```

### With Date Click Handler

```tsx
import AvailabilityCalendar from '@/components/admin/AvailabilityCalendar';

export default function AvailabilityCalendarPage() {
  const handleDateClick = (date: string, availability: AvailableDate | undefined) => {
    console.log('Date clicked:', date);
    console.log('Availability:', availability);
  };

  return <AvailabilityCalendar onDateClick={handleDateClick} />;
}
```

## ✨ Features

### 1. **Monthly Calendar Grid**
- Displays all days of the selected month in a responsive grid layout
- Shows weekday headers (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
- Highlights today's date with a purple border
- Smooth hover effects on date cells

### 2. **Visual Status Indicators**
Each date cell shows:
- **Date number** (large, bold)
- **Flat Category status** (green chip with ✓ if enabled, red chip with ✗ if disabled)
- **Day-wise Category status** (purple chip with ✓ if enabled, red chip with ✗ if disabled)
- **Cell background color** based on combined status:
  - **Green**: Both categories enabled
  - **Blue**: Only flat category enabled
  - **Purple**: Only day-wise category enabled
  - **Gray**: Neither category enabled

### 3. **Click to Toggle Availability**
- Click any date cell to open the edit dialog
- Toggle switches for both Flat and Day-wise categories
- Instant updates to the backend
- Visual feedback during save operations

### 4. **Legend**
Visual guide showing all status colors:
- Both Enabled (green)
- Flat Only (blue)
- Day-wise Only (purple)
- None Disabled (gray)

### 5. **Bulk Actions**
- **Enable All**: Enables both flat and day-wise categories for all dates in the current month
- **Disable All**: Disables both flat and day-wise categories for all dates in the current month
- Loading indicators during bulk operations
- Success/error notifications

### 6. **Month Navigation**
- **Previous Month** button
- **Next Month** button
- **Today** button to jump to current month
- Current month/year display (e.g., "January 2024")

### 7. **Loading States**
- Spinner during initial data load
- Per-cell spinner when updating individual dates
- Bulk operation spinner during enable/disable all
- Disabled buttons during operations

### 8. **Error Handling**
- Error alerts display at the top of the calendar
- Snackbar notifications for success/error messages
- Automatic retry on failed operations
- Authentication validation

## 🎨 Styling

The component uses Material-UI with custom styling consistent with existing admin pages:

- **Primary Color**: Purple gradient (#8B5CF6 to #6366F1)
- **Success Color**: Green (#10B981)
- **Error Color**: Red (#EF4444)
- **Info Color**: Blue (#4F8CFF)
- **Background**: Light gray (#f8fafc)
- **Border Radius**: 12px - 16px for cards
- **Shadows**: Subtle elevation on hover

## 🔌 API Integration

The component integrates with the existing API endpoints:

### GET /api/admin/available-dates
Fetches availability data for a date range.

**Query Parameters:**
- `startDate` (string): Start date in YYYY-MM-DD format
- `endDate` (string): End date in YYYY-MM-DD format

### POST /api/admin/available-dates
Creates or updates a single date's availability.

**Request Body:**
```json
{
  "date": "2024-01-15",
  "flatCategoryEnabled": true,
  "dayWiseCategoryEnabled": false
}
```

### PUT /api/admin/available-dates
Bulk update dates in a range.

**Request Body:**
```json
{
  "dates": [
    {
      "date": "2024-01-01",
      "flatCategoryEnabled": true,
      "dayWiseCategoryEnabled": true
    }
  ],
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

## 📦 Dependencies

The component requires the following dependencies:

### Required (Already in package.json)
- `@mui/material`: ^7.3.5
- `@emotion/react`: ^11.14.0
- `@emotion/styled`: ^11.14.1
- `@tabler/icons-react`: ^3.35.0
- `react`: ^18.3.1
- `react-dom`: ^18.3.1
- `date-fns`: ^4.1.0

### Installation

If date-fns is not already installed:

```bash
npm install date-fns
```

## 🗂️ Data Structure

### AvailableDate Interface

```typescript
export interface AvailableDate {
  _id?: ObjectId | string;
  date: string; // YYYY-MM-DD format
  flatCategoryEnabled: boolean;
  dayWiseCategoryEnabled: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
```

## 🎯 Props Interface

```typescript
interface AvailabilityCalendarProps {
  onDateClick?: (date: string, availability: AvailableDate | undefined) => void;
  initialMonth?: Date;
}
```

## 🔄 Component Flow

1. **Initial Load**
   - Component mounts with current month (or initialMonth prop)
   - Fetches availability data for the month from API
   - Renders calendar grid with fetched data

2. **Navigation**
   - User clicks prev/next month buttons
   - Component updates currentMonth state
   - Fetches new data for the selected month
   - Re-renders calendar with new data

3. **Single Date Update**
   - User clicks a date cell
   - Dialog opens with current status
   - User toggles flat/day-wise switches
   - Component sends POST request to API
   - Updates local state with response
   - Shows success/error snackbar

4. **Bulk Update**
   - User clicks "Enable All" or "Disable All"
   - Component generates data for all dates in month
   - Sends PUT request to API with date array
   - Refetches all data for the month
   - Shows success/error snackbar

## 🎨 Color Scheme

### Status Colors

| Status | Background | Border | Text |
|--------|------------|--------|------|
| Both Enabled | #D1FAE5 | #10B981 | #065F46 |
| Flat Only | #DBEAFE | #4F8CFF | #1E40AF |
| Day-wise Only | #EDE9FE | #8B5CF6 | #5B21B6 |
| None Disabled | #F3F4F6 | #D1D5DB | #6B7280 |

### Chip Colors

| Category | Enabled | Disabled |
|----------|---------|----------|
| Flat | Green (#10B981) | Red (#EF4444) |
| Day-wise | Purple (#8B5CF6) | Red (#EF4444) |

## 📱 Responsive Design

- Grid adjusts automatically based on screen size
- Controls stack on smaller screens
- Dialog is full-width on mobile
- Touch-friendly button sizes

## 🔐 Authentication

The component uses the `useAuth` hook to:
- Get authentication token
- Validate admin permissions
- Include token in API requests
- Show authentication error if not logged in

## 🐛 Error Handling

The component handles various error scenarios:

1. **Authentication Errors**: Shows error message if not authenticated
2. **Network Errors**: Displays error alert and snackbar
3. **Validation Errors**: Shows specific error messages from API
4. **Loading Failures**: Shows error state with retry option

## 📄 Example Page Location

The demo page is available at:
```
src/app/admin/availability-calendar/page.tsx
```

Access the calendar at: `/admin/availability-calendar`

## 🎯 Best Practices

1. **Always wrap with AuthProvider**: Ensure the component is used within an AuthProvider context
2. **Handle loading states**: The component manages its own loading states
3. **Use optimistic updates**: Component updates UI immediately and rolls back on error
4. **Implement error boundaries**: Consider wrapping in error boundary for additional safety
5. **Cache data**: Component fetches data per month, consider implementing caching for better performance

## 🔮 Future Enhancements

Potential improvements:
- Date range picker for quick navigation
- Copy availability from previous month
- Export availability as CSV/JSON
- Import availability from CSV/JSON
- Filter by specific category types
- Undo/redo functionality
- Keyboard navigation
- Touch gesture support for mobile

## 📝 Notes

- All dates are stored and processed in YYYY-MM-DD format
- The component uses `date-fns` for all date calculations
- Month changes trigger automatic data refresh
- Bulk operations replace all dates in the specified range
- Today's date is highlighted with a special border
- Component is fully responsive and works on all screen sizes

## 🤝 Integration with Existing Code

This component integrates seamlessly with:
- Existing authentication system (`useAuth` hook)
- Existing API endpoints (`/api/admin/available-dates`)
- Existing type definitions (`AvailableDate` from `@/types/order`)
- Existing Material-UI theme and styling patterns
- Existing admin page layout structure
