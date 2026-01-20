# Availability Calendar - Installation Guide

## Quick Start

The Availability Calendar component has been successfully created! Follow these steps to get started:

## 1. Install Dependencies

The component requires `date-fns` for date calculations. Install it by running:

```bash
npm install date-fns
```

This will add the dependency to your project. The `package.json` has already been updated to include `date-fns: ^4.1.0`.

## 2. Install All Dependencies

If you haven't installed all dependencies yet:

```bash
npm install
```

## 3. Access the Calendar

The calendar component is available at:

```
/admin/availability-calendar
```

## Component Files

- **Component**: `src/components/admin/AvailabilityCalendar.tsx`
- **Demo Page**: `src/app/admin/availability-calendar/page.tsx`
- **Documentation**: `AVAILABILITY-CALENDAR-COMPONENT.md`
- **Types**: `src/types/order.ts` (AvailableDate interface)

## API Endpoint

The component uses the existing API:

```
/api/admin/available-dates
```

Methods:
- **GET**: Fetch dates by date range
- **POST**: Create/update single date
- **PUT**: Bulk update dates
- **DELETE**: Delete dates by range

## Features Included

✅ Monthly calendar grid with all days
✅ Visual status indicators (flat & day-wise)
✅ Click to toggle availability per date
✅ Bulk actions (enable/disable all for month)
✅ Month navigation (prev/next/today)
✅ Legend showing status colors
✅ Loading states during save operations
✅ Error messages and notifications
✅ Responsive design
✅ Material-UI styling
✅ Authentication integration

## Usage Example

```tsx
import AvailabilityCalendar from '@/components/admin/AvailabilityCalendar';

export default function MyPage() {
  return <AvailabilityCalendar />;
}
```

## Next Steps

1. Install the dependencies (step 1 above)
2. Start the dev server: `npm run dev`
3. Navigate to `/admin/availability-calendar`
4. Start managing your availability calendar!

## Customization

You can customize the component by passing props:

```tsx
<AvailabilityCalendar
  initialMonth={new Date('2024-01-01')}  // Start at specific month
  onDateClick={(date, availability) => {  // Handle date clicks
    console.log(date, availability);
  }}
/>
```

## Need Help?

Refer to the full documentation: `AVAILABILITY-CALENDAR-COMPONENT.md`
