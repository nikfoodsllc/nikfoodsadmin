# Manage Days Page - Module Documentation

## 📋 Overview

The **Manage Days** page (`/admin/manage-days`) provides administrators with a streamlined interface for managing food category availability by specific calendar dates. The page features a calendar-based view that allows for granular control over which category types (Flat and Day-wise) are available on any given date.

## 📍 Location

```
src/app/admin/manage-days/
├── page.tsx                          # Next.js page wrapper
└── components/
    └── ManageDaysPage.tsx            # Main page component
```

**URL**: `/admin/manage-days`

## ✨ Current Features (Post-Simplification)

### 1. **Calendar-Only Interface**
The page now exclusively uses a calendar-based view for managing availability. This provides:
- Intuitive visual representation of the entire month
- Quick identification of availability patterns
- Easy navigation between months
- Direct click-to-edit functionality

### 2. **Compact Legend**
A streamlined legend that shows the four possible availability states:
- **Both**: Both Flat and Day-wise categories enabled
- **Flat**: Only Flat category enabled
- **Day-wise**: Only Day-wise category enabled
- **None**: Neither category enabled

The legend uses a compact design with smaller color boxes (16x16px) and shorter labels for better space utilization.

### 3. **AvailabilityCalendar Component**
The core component powering the page (`src/components/admin/AvailabilityCalendar.tsx`) provides:
- Monthly calendar grid with 7-column layout
- Visual status indicators for each date
- Click-to-edit dialog for individual dates
- Bulk actions (Enable All / Disable All)
- Month navigation controls
- Real-time updates with loading states

## 🔄 Recent Changes (January 2026)

### What Was Removed

The following features were removed to simplify the interface and focus on calendar-based management:

#### 1. **Help Text Section**
- **Description**: Expandable help card explaining category types
- **Content**: Detailed explanations of Flat vs Day-wise categories
- **Reason**: Reduced visual clutter; category types are self-explanatory for admin users

#### 2. **Date Range Filter**
- **Description**: Input fields for filtering calendar by start/end dates
- **Features**: Start date picker, end date picker, clear filter button
- **Reason**: Calendar navigation (prev/next/today) provides sufficient date range control

#### 3. **Day List View (Legacy View)**
- **Description**: Traditional list-based view showing all days of the week
- **Features**: Individual day toggles, enable/disable status chips, bulk actions
- **Reason**: Duplicated functionality; calendar view provides better overview for date-specific management

#### 4. **View Toggle**
- **Description**: Toggle button group to switch between Calendar and Day List views
- **Removed**: Calendar and Day List buttons
- **Reason**: Only calendar view remains; toggle no longer needed

#### 5. **Statistics Chips (Header)**
- **Description**: Real-time statistics showing enabled/disabled counts
- **Removed**: "Dates Configured", "Flat Enabled", "Day-wise Enabled" chips in header
- **Reason**: Calendar cells show this information visually; chips were redundant

#### 6. **Bulk Actions Card (Legacy View)**
- **Description**: "Enable All" and "Disable All" buttons for weekly days
- **Features**: Bulk operations for all 7 days of the week
- **Reason**: Calendar view has its own bulk actions for the entire month

### What Remains

#### ✅ Calendar View
- Full monthly calendar with all dates visible
- Color-coded cells showing availability status
- Click any date to edit its availability settings

#### ✅ Compact Legend
- Smaller, space-efficient legend
- Quick reference for understanding cell colors
- Clear labels for each status type

#### ✅ Page Header
- Purple gradient header with title "Manage Availability"
- Subtitle: "Control category availability by date"
- Clean, minimal design

#### ✅ Calendar Features**
- Month navigation (Previous/Next)
- "Today" button for quick return to current month
- Month/year display
- Bulk actions for entire month (Enable All / Disable All)
- Individual date editing via dialog
- Loading states during save operations
- Error handling with snackbar notifications

## 🎯 User Workflow

### Setting Availability for a Date

1. **Navigate to page**: Go to `/admin/manage-days`
2. **View current month**: See all dates with their current availability status
3. **Click a date**: Click any date cell to open the edit dialog
4. **Toggle settings**: Use toggle buttons to enable/disable Flat and Day-wise categories
5. **Save**: Changes are saved immediately with visual feedback

### Bulk Month Configuration

1. **Select month**: Navigate to desired month using prev/next buttons
2. **Choose action**: Click "Enable All" or "Disable All"
3. **Confirm**: All dates in the month are updated
4. **Verify**: Calendar refreshes to show updated status

### Navigating Months

1. **Previous Month**: Click left arrow button
2. **Next Month**: Click right arrow button
3. **Current Month**: Click "Today" button

## 🎨 Visual Design

### Color Scheme

The page uses a consistent Material-UI design system:

| Element | Color | Usage |
|---------|-------|-------|
| Header Gradient | #4f46e5 → #6366f1 | Page title card |
| Background | #f8fafc | Page background |
| Calendar - Both Enabled | #D1FAE5 (bg) / #10B981 (border) | Both categories enabled |
| Calendar - Flat Only | #DBEAFE (bg) / #4F8CFF (border) | Only flat enabled |
| Calendar - Day-wise Only | #EDE9FE (bg) / #8B5CF6 (border) | Only day-wise enabled |
| Calendar - None Enabled | #F3F4F6 (bg) / #D1D5DB (border) | Neither enabled |

### Layout Structure

```
┌─────────────────────────────────────────────┐
│  Header Card (Purple Gradient)              │
│  - Icon: Calendar Event                     │
│  - Title: Manage Availability               │
│  - Subtitle: Control category availability  │
└─────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│  AvailabilityCalendar Component            │
│  ┌─────────────────────────────────────┐   │
│  │ Month Navigation & Bulk Actions     │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ Legend (Compact)                    │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ Calendar Grid (7 columns)           │   │
│  │ - Weekday headers                   │   │
│  │ - Date cells with status colors     │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## 🔌 API Integration

The page integrates with the following API endpoints:

### GET /api/admin/available-dates
Fetches availability data for a date range.

**Query Parameters:**
- `startDate` (string): Start date in YYYY-MM-DD format
- `endDate` (string): End date in YYYY-MM-DD format

**Usage:** Calendar automatically fetches data for the visible month when navigating.

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

**Usage:** Called when a user edits a single date via the dialog.

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

**Usage:** Called when using "Enable All" or "Disable All" bulk actions.

## 📦 Component Dependencies

### ManageDaysPage Component
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { useAvailableDays } from '@/hooks/useAvailableDays';
import AvailabilityCalendar from '@/components/admin/AvailabilityCalendar';
```

### AvailabilityCalendar Component
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { AvailableDate } from '@/types/order';
import { format, startOfMonth, endOfMonth, ... } from 'date-fns';
```

## 🔐 Authentication

The page requires authentication and admin privileges:
- Uses `useAuth` hook to verify authentication
- Redirects to login if not authenticated
- Includes JWT token in all API requests
- Shows error message if authentication fails

## 📱 Responsive Design

- **Desktop**: Full calendar grid with all controls visible
- **Tablet**: Adjusted spacing, stacked controls if needed
- **Mobile**: Full-width calendar, stacked navigation controls

## 🐛 Error Handling

The page handles various error scenarios:

1. **Authentication Errors**: Shows error message and prompts re-login
2. **Network Errors**: Displays error alert and snackbar notification
3. **Loading Failures**: Shows error state with retry capability
4. **Validation Errors**: Displays specific error messages from API

## 📝 Data Structures

### AvailableDate Interface
```typescript
interface AvailableDate {
  _id?: ObjectId | string;
  date: string; // YYYY-MM-DD format
  flatCategoryEnabled: boolean;
  dayWiseCategoryEnabled: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
```

## 🎯 Use Cases

### 1. Holiday Configuration
Disable specific category types on holidays:
- Click holiday date
- Disable day-wise categories (keep flat for standard menu)
- Save

### 2. Special Events
Enable both category types for special events:
- Navigate to event date
- Click date cell
- Enable both Flat and Day-wise categories
- Save

### 3. Monthly Planning
Configure entire months for seasons:
- Navigate to target month
- Click "Enable All" or "Disable All"
- All dates in month are updated

### 4. Quick Adjustments
Make immediate changes:
- Navigate to current month
- Click affected date
- Toggle category types as needed
- Save

## ⚖️ Comparison with Legacy Features

| Feature | Before (Legacy) | After (Current) | Reason for Change |
|---------|----------------|-----------------|-------------------|
| **View Modes** | Calendar + Day List | Calendar only | Calendar provides better date-specific overview |
| **Help Text** | Expandable help card | Removed | Admin users understand category types |
| **Date Filter** | Start/end date inputs | Month navigation | Calendar navigation is more intuitive |
| **Statistics** | Header chips showing counts | Visual cell colors | Calendar cells show status directly |
| **Legend** | Full-size with descriptions | Compact with labels | Saves space, labels are self-explanatory |
| **Bulk Actions** | Separate cards for each view | Integrated in calendar | Cleaner interface, less duplication |

## 🚀 Getting Started

### Access the Page

1. Navigate to `/admin/manage-days`
2. Ensure you're logged in as an admin
3. The current month's calendar will load automatically

### Basic Operations

1. **View Status**: Look at cell colors to see availability
2. **Edit Date**: Click any date cell to edit its settings
3. **Navigate**: Use prev/next buttons to view other months
4. **Bulk Update**: Use "Enable All" or "Disable All" for entire month

## 🔮 Future Enhancements

Potential improvements for the page:
- Date range picker for quick navigation to specific dates
- Copy availability from previous month
- Undo/redo functionality for bulk operations
- Export availability configuration as CSV/JSON
- Import availability configuration
- Keyboard shortcuts for navigation
- Advanced filtering (show only dates with specific configurations)

## 📄 Related Documentation

- [AvailabilityCalendar Component](./AVAILABILITY-CALENDAR-COMPONENT.md) - Full component documentation
- [availableDates Collection](./availableDates-collection.md) - Database collection documentation
- [availableDates Migration Guide](./availableDates-migration-guide.md) - Setup and migration guide
- [Database Structure](./database-structure.md) - Complete database schema

## 🎉 Summary

The **Manage Days** page provides a streamlined, calendar-based interface for managing food category availability by date. Following the January 2026 simplification, the page now focuses exclusively on calendar-based management, removing redundant features and providing a cleaner, more intuitive user experience.

**Key Benefits:**
- ✅ Single, unified interface (calendar-only)
- ✅ Visual at-a-glance status for entire month
- ✅ Direct click-to-edit functionality
- ✅ Efficient bulk operations
- ✅ Compact, space-efficient design
- ✅ Clear visual indicators and legend
- ✅ Seamless integration with existing APIs

**Page Statistics:**
- **Route**: `/admin/manage-days`
- **Component**: `ManageDaysPage` (~117 lines)
- **Calendar Component**: `AvailabilityCalendar` (~850 lines)
- **API Endpoints**: 3 (GET, POST, PUT /api/admin/available-dates)
- **Authentication Required**: Yes (Admin only)

---

**Last Updated**: January 3, 2026
**Version**: 2.0.0 (Post-Simplification)
**Status**: Production Ready ✅
