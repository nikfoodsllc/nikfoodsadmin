# Availability Calendar - Quick Reference

## 📍 Location
- **Component**: `src/components/admin/AvailabilityCalendar.tsx`
- **Page**: `src/app/admin/availability-calendar/page.tsx`
- **URL**: `/admin/availability-calendar`

## 🚀 Quick Start

```bash
# 1. Install dependency
npm install date-fns

# 2. Start dev server
npm run dev

# 3. Navigate to
http://localhost:3000/admin/availability-calendar
```

## 💡 Basic Usage

```tsx
import AvailabilityCalendar from '@/components/admin/AvailabilityCalendar';

export default function Page() {
  return <AvailabilityCalendar />;
}
```

## 🎯 Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `initialMonth` | `Date` | No | `new Date()` | Initial month to display |
| `onDateClick` | `(date: string, availability: AvailableDate \| undefined) => void` | No | - | Callback when date is clicked |

## 🎨 Features

### Visual Indicators
- 🟢 **Green**: Both Flat & Day-wise enabled
- 🔵 **Blue**: Only Flat enabled
- 🟣 **Purple**: Only Day-wise enabled
- ⚪ **Gray**: Neither enabled

### Interactions
- **Click Date**: Open edit dialog
- **Prev/Next**: Navigate months
- **Today**: Jump to current month
- **Enable All**: Enable all dates in month
- **Disable All**: Disable all dates in month

## 📡 API Endpoints

### GET - Fetch Dates
```
/api/admin/available-dates?startDate=2024-01-01&endDate=2024-01-31
```

### POST - Update Single Date
```
POST /api/admin/available-dates
{
  "date": "2024-01-15",
  "flatCategoryEnabled": true,
  "dayWiseCategoryEnabled": false
}
```

### PUT - Bulk Update
```
PUT /api/admin/available-dates
{
  "dates": [...],
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

## 🗂️ Data Structure

```typescript
interface AvailableDate {
  _id?: ObjectId | string;
  date: string; // YYYY-MM-DD
  flatCategoryEnabled: boolean;
  dayWiseCategoryEnabled: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
```

## 🎨 Component Structure

```
AvailabilityCalendar
├── Header Card (Purple gradient)
├── Controls Card
│   ├── Month Navigation
│   └── Bulk Actions
├── Legend Card
└── Calendar Card
    ├── Weekday Headers
    └── Date Grid (7 columns)
```

## 📦 Dependencies

- `date-fns` - Date calculations
- `@mui/material` - UI components
- `@tabler/icons-react` - Icons
- `react` - React framework

## 🔄 State Management

```typescript
const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
const [datesData, setDatesData] = useState<Record<string, AvailableDate>>({});
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState<Record<string, boolean>>({});
```

## 🔐 Auth Integration

```typescript
const { token, isAuthenticated } = useAuth();
```

## 🎨 Styling

Material-UI with custom theme:
- Primary: Purple (#8B5CF6)
- Success: Green (#10B981)
- Error: Red (#EF4444)
- Background: Light gray (#f8fafc)

## 📱 Responsive

- Desktop: Full grid
- Tablet: Adjusted spacing
- Mobile: Stacked layout

## 🐛 Error Handling

- Authentication errors
- Network errors
- Validation errors
- Loading failures

## 📄 Documentation Files

- `AVAILABILITY-CALENDAR-COMPONENT.md` - Full documentation
- `INSTALL-AVAILABILITY-CALENDAR.md` - Installation guide
- `AVAILABILITY-CALENDAR-SUMMARY.md` - Implementation summary
- `QUICK-REF-AVAILABILITY-CALENDAR.md` - This file

## ✅ Checklist

- [x] Monthly calendar grid
- [x] Date navigation (prev/next)
- [x] Visual status indicators
- [x] Click to toggle availability
- [x] Legend with colors
- [x] Bulk actions
- [x] Loading states
- [x] Error handling
- [x] Material-UI components
- [x] date-fns integration
- [x] Responsive design
- [x] Authentication

## 🔗 Related Files

- API: `src/app/api/admin/available-dates/route.ts`
- Types: `src/types/order.ts` (AvailableDate interface)
- Auth: `src/contexts/AuthContext.tsx`

## 💡 Tips

1. **Always authenticate**: Component checks auth on mount
2. **Date format**: All dates are YYYY-MM-DD
3. **Optimistic updates**: UI updates immediately, rolls back on error
4. **Bulk operations**: Replace entire month data
5. **Today highlight**: Current date has purple border

## 🎯 Common Tasks

### Add to Admin Menu
```tsx
<Link href="/admin/availability-calendar">
  <MenuItem>Availability Calendar</MenuItem>
</Link>
```

### Customize Initial Month
```tsx
<AvailabilityCalendar initialMonth={new Date('2024-06-01')} />
```

### Handle Date Clicks
```tsx
<AvailabilityCalendar
  onDateClick={(date, availability) => {
    console.log('Clicked:', date, availability);
  }}
/>
```

## 📞 Support

For issues or questions:
1. Check `AVAILABILITY-CALENDAR-COMPONENT.md`
2. Review API docs in `src/app/api/admin/available-dates/route.ts`
3. Check types in `src/types/order.ts`

## 🎉 Done!

The Availability Calendar is ready to use. Navigate to `/admin/availability-calendar` to start managing your food category availability!
