# AvailableDates API - Quick Start Guide

## What Was Implemented

A complete MongoDB collection and REST API system for managing available dates with category listing type settings.

## Files Created

1. **Migration**: `/src/lib/migrations/available-dates.ts`
2. **Migration API**: `/src/app/api/admin/migrations/available-dates/route.ts`
3. **Main API**: `/src/app/api/admin/available-dates/route.ts`
4. **Types**: Updated `/src/types/order.ts` with `AvailableDate` interface
5. **Docs**: `/src/lib/migrations/README-AVAILABLE-DATES.md`
6. **Summary**: `/IMPLEMENTATION-SUMMARY-AVAILABLE-DATES.md`

## Quick Start

### Step 1: Run Migration

```bash
curl -X POST "http://localhost:3000/api/admin/migrations/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

### Step 2: Create a Date

```bash
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": false
  }'
```

### Step 3: Query Dates

```bash
curl -X GET "http://localhost:3000/api/admin/available-dates?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/available-dates` | Fetch dates by range |
| POST | `/api/admin/available-dates` | Create/upsert single date |
| PUT | `/api/admin/available-dates` | Bulk update (delete + insert) |
| DELETE | `/api/admin/available-dates` | Delete dates by range |
| POST | `/api/admin/migrations/available-dates` | Run/rollback migration |

## Database Schema

**Collection**: `availableDates`

```json
{
  "_id": "ObjectId",
  "date": "2024-01-15",           // YYYY-MM-DD (unique)
  "flatCategoryEnabled": true,    // Boolean
  "dayWiseCategoryEnabled": false, // Boolean
  "createdAt": "2024-01-10T10:00:00.000Z",
  "updatedAt": "2024-01-10T10:00:00.000Z"
}
```

## Key Features

✅ Unique date constraint (no duplicates)
✅ Date range queries
✅ Bulk operations
✅ JWT authentication
✅ Admin role verification
✅ Input validation (YYYY-MM-DD format, boolean flags)
✅ Standardized response format
✅ Comprehensive error handling

## Response Format

**Success:**
```json
{
  "data": { ... },
  "message": "Operation successful"
}
```

**Error:**
```json
{
  "error": "Error message"
}
```

## Documentation

- Full API documentation: `/src/lib/migrations/README-AVAILABLE-DATES.md`
- Implementation summary: `/IMPLEMENTATION-SUMMARY-AVAILABLE-DATES.md`

## Next Steps

1. ✅ Run migration to create collection
2. ✅ Test API endpoints
3. ⏳ Build admin UI
4. ⏳ Integrate with category listing logic
