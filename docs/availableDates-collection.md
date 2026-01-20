# AvailableDates Collection Documentation

## Overview

The `availableDates` collection is a new MongoDB collection that manages specific calendar dates and their category listing type enablement settings. Unlike `availableDays` (which manages recurring weekly days), `availableDates` allows administrators to configure category availability for specific dates (e.g., "2024-01-15"), enabling granular control over flat and day-wise category listings.

## Purpose

### Why availableDates?

While `availableDays` provides day-of-week configuration (Monday, Tuesday, etc.), `availableDates` offers date-specific configuration capabilities:

1. **Date-Specific Control**: Configure category availability for specific calendar dates
2. **Category Type Management**: Enable/disable flat or day-wise category types per date
3. **Special Events**: Handle holidays, special promotions, or one-off events
4. **Future Planning**: Pre-configure dates weeks or months in advance

### Use Cases

- **Holiday Management**: Disable certain category types on holidays
- **Special Promotions**: Enable specific category types for promotional events
- **Seasonal Changes**: Configure different category availability for seasons
- **One-Day Events**: Handle special days with unique category configurations

## Collection Schema

### Database Structure

**Collection Name:** `availableDates`

```typescript
interface AvailableDate {
  _id?: ObjectId;                      // MongoDB document ID
  date: string;                        // Date in YYYY-MM-DD format (unique)
  flatCategoryEnabled: boolean;        // Enable flat category listing
  dayWiseCategoryEnabled: boolean;     // Enable day-wise category listing
  createdAt?: Date;                    // Creation timestamp
  updatedAt?: Date;                    // Last update timestamp
}
```

### Field Descriptions

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `_id` | ObjectId | Auto | Yes | MongoDB document identifier |
| `date` | string | Yes | **Yes** | Date in YYYY-MM-DD format (e.g., "2024-01-15") |
| `flatCategoryEnabled` | boolean | Yes | No | Whether flat category listing is enabled for this date |
| `dayWiseCategoryEnabled` | boolean | Yes | No | Whether day-wise category listing is enabled for this date |
| `createdAt` | Date | Auto | No | Document creation timestamp (UTC) |
| `updatedAt` | Date | Auto | No | Last update timestamp (UTC) |

### Database Indexes

The collection includes the following indexes for optimal performance:

1. **Unique Index** on `date` field
   - Ensures no duplicate dates
   - Optimizes date lookup queries

2. **Index** on `flatCategoryEnabled` field
   - Optimizes queries filtering by flat category status

3. **Index** on `dayWiseCategoryEnabled` field
   - Optimizes queries filtering by day-wise category status

4. **Date Range Index** on `date` field
   - Optimizes date range queries (e.g., startDate to endDate)

## AvailableDates vs AvailableDays

### Key Differences

| Aspect | availableDays | availableDates |
|--------|---------------|----------------|
| **Granularity** | Day of week (Monday, Tuesday, etc.) | Specific calendar date (2024-01-15) |
| **Recurrence** | Recurs every week | One-time specific date |
| **Purpose** | General weekly schedule | Date-specific configuration |
| **Fields** | `day`, `label`, `enabled`, `sequence` | `date`, `flatCategoryEnabled`, `dayWiseCategoryEnabled` |
| **API Route** | `/api/admin/days` | `/api/admin/available-dates` |
| **Customer Access** | Yes (`/api/days`, `/api/enabled-days`) | No (admin-only) |
| **Use Case** | Regular weekly operations | Holidays, events, special dates |

### Relationship

- **availableDays**: Controls which days of the week are generally available for ordering
- **availableDates**: Provides additional, date-specific control over category types for specific dates

### Example Comparison

**availableDays document:**
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7n0",
  "day": "monday",
  "label": "Monday",
  "enabled": true,
  "sequence": 1,
  "createdAt": "2024-01-15T10:50:00Z",
  "updatedAt": "2024-01-15T10:50:00Z"
}
```

**availableDates document:**
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7p0",
  "date": "2024-01-15",
  "flatCategoryEnabled": true,
  "dayWiseCategoryEnabled": false,
  "createdAt": "2024-01-10T10:00:00Z",
  "updatedAt": "2024-01-10T10:00:00Z"
}
```

## API Endpoints

### Base URL
```
/api/admin/available-dates
```

### Authentication

All endpoints require:
- **JWT Token** in Authorization header: `Bearer YOUR_JWT_TOKEN`
- **Admin Role**: Token must have `role: 'admin'`

### 1. GET /api/admin/available-dates

Fetch available dates by date range.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | No | Start date in YYYY-MM-DD format |
| `endDate` | string | No | End date in YYYY-MM-DD format |

#### Examples

```bash
# Get all dates
curl -X GET "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get dates in range
curl -X GET "http://localhost:3000/api/admin/available-dates?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get dates from start date
curl -X GET "http://localhost:3000/api/admin/available-dates?startDate=2024-01-01" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

```json
{
  "data": [
    {
      "id": "659c12345678901234567890",
      "date": "2024-01-15",
      "flatCategoryEnabled": true,
      "dayWiseCategoryEnabled": false,
      "createdAt": "2024-01-10T10:00:00.000Z",
      "updatedAt": "2024-01-10T10:00:00.000Z"
    }
  ],
  "message": "Available dates fetched successfully"
}
```

### 2. POST /api/admin/available-dates

Create a new date or update an existing one (upsert).

#### Request Body

```json
{
  "date": "2024-01-15",
  "flatCategoryEnabled": true,
  "dayWiseCategoryEnabled": false
}
```

#### Example

```bash
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": false
  }'
```

#### Response (Created - 201)

```json
{
  "data": {
    "id": "659c12345678901234567890",
    "date": "2024-01-15",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": false,
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-10T10:00:00.000Z"
  },
  "message": "Date created successfully"
}
```

#### Response (Updated - 200)

```json
{
  "data": {
    "id": "659c12345678901234567890",
    "date": "2024-01-15",
    "flatCategoryEnabled": false,
    "dayWiseCategoryEnabled": true,
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-11T11:00:00.000Z"
  },
  "message": "Date updated successfully"
}
```

### 3. PUT /api/admin/available-dates

Bulk update: Delete all dates in range (optional) and insert new dates.

#### Request Body

```json
{
  "dates": [
    {
      "date": "2024-01-15",
      "flatCategoryEnabled": true,
      "dayWiseCategoryEnabled": false
    },
    {
      "date": "2024-01-16",
      "flatCategoryEnabled": false,
      "dayWiseCategoryEnabled": true
    }
  ],
  "startDate": "2024-01-01",  // Optional - for deletion
  "endDate": "2024-01-31"      // Optional - for deletion
}
```

#### Example

```bash
curl -X PUT "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dates": [
      {
        "date": "2024-01-15",
        "flatCategoryEnabled": true,
        "dayWiseCategoryEnabled": false
      },
      {
        "date": "2024-01-16",
        "flatCategoryEnabled": true,
        "dayWiseCategoryEnabled": true
      }
    ],
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }'
```

#### Response

```json
{
  "data": {
    "updated": [
      {
        "id": "659c12345678901234567890",
        "date": "2024-01-15",
        "flatCategoryEnabled": true,
        "dayWiseCategoryEnabled": false,
        "createdAt": "2024-01-10T10:00:00.000Z",
        "updatedAt": "2024-01-10T10:00:00.000Z"
      },
      {
        "id": "659c12345678901234567891",
        "date": "2024-01-16",
        "flatCategoryEnabled": true,
        "dayWiseCategoryEnabled": true,
        "createdAt": "2024-01-10T10:00:00.000Z",
        "updatedAt": "2024-01-10T10:00:00.000Z"
      }
    ],
    "deletedCount": 15,
    "createdCount": 2
  },
  "message": "Bulk update completed. 15 deleted, 2 created"
}
```

### 4. DELETE /api/admin/available-dates

Delete all dates within a specified range.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | Start date in YYYY-MM-DD format |
| `endDate` | string | Yes | End date in YYYY-MM-DD format |

#### Example

```bash
curl -X DELETE "http://localhost:3000/api/admin/available-dates?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

```json
{
  "data": {
    "deletedCount": 31,
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  },
  "message": "31 date(s) deleted successfully"
}
```

### 5. POST /api/admin/migrations/available-dates

Run or rollback the availableDates collection migration.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | No | `migrate` (default) or `rollback` |

#### Examples

```bash
# Run migration
curl -X POST "http://localhost:3000/api/admin/migrations/available-dates?action=migrate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Rollback migration
curl -X POST "http://localhost:3000/api/admin/migrations/available-dates?action=rollback" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response (Migration)

```json
{
  "data": {
    "indexesCreated": [
      "date_unique_index",
      "flatCategoryEnabled_index",
      "dayWiseCategoryEnabled_index",
      "date_range_index"
    ],
    "collectionCreated": true
  },
  "message": "AvailableDates collection migration completed successfully"
}
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD                                  │
│                     (Admin JWT Required)                                 │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                         │ HTTP Requests
                         │ (GET, POST, PUT, DELETE)
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              /api/admin/available-dates (Route Handler)                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  1. Verify JWT + Admin Role                                     │   │
│  │  2. Validate Request (date format, booleans, ranges)            │   │
│  │  3. Process Request                                             │   │
│  │  4. Return Standardized Response                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                         │ CRUD Operations
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    MongoDB: availableDates Collection                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Indexes:                                                        │   │
│  │  • Unique index on 'date'                                        │   │
│  │  • Index on 'flatCategoryEnabled'                                │   │
│  │  • Index on 'dayWiseCategoryEnabled'                             │   │
│  │  • Date range index on 'date'                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  Document Structure:                                                      │
│  {                                                                        │
│    _id: ObjectId,                                                        │
│    date: "2024-01-15",          // YYYY-MM-DD (unique)                   │
│    flatCategoryEnabled: true,    // Boolean flag                          │
│    dayWiseCategoryEnabled: false, // Boolean flag                         │
│    createdAt: Date,                                                       │
│    updatedAt: Date                                                        │
│  }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘

                         │
                         │ (Future Integration)
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Category Listing Type Validation (Planned)                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Query availableDates for specific date                          │   │
│  │  Check flatCategoryEnabled and dayWiseCategoryEnabled            │   │
│  │  Filter/Display categories based on enabled flags                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Common Query Examples

### 1. Get All Configured Dates

```javascript
// MongoDB query
db.availableDates.find({}).sort({ date: 1 })

// API call
GET /api/admin/available-dates
```

### 2. Get Dates for a Month

```javascript
// MongoDB query
db.availableDates.find({
  date: {
    $gte: "2024-01-01",
    $lte: "2024-01-31"
  }
}).sort({ date: 1 })

// API call
GET /api/admin/available-dates?startDate=2024-01-01&endDate=2024-01-31
```

### 3. Get Dates with Only Flat Categories Enabled

```javascript
// MongoDB query
db.availableDates.find({
  flatCategoryEnabled: true,
  dayWiseCategoryEnabled: false
}).sort({ date: 1 })

// Note: This would need to be implemented as a dedicated API endpoint
```

### 4. Check if a Specific Date is Configured

```javascript
// MongoDB query
db.availableDates.findOne({ date: "2024-01-15" })

// API call (returns all, filter client-side or check if date exists in array)
GET /api/admin/available-dates?startDate=2024-01-15&endDate=2024-01-15
```

### 5. Get Upcoming Dates (From Today)

```javascript
// MongoDB query
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
db.availableDates.find({
  date: { $gte: today }
}).sort({ date: 1 })

// API call
GET /api/admin/available-dates?startDate=2024-01-15
```

## Error Handling

### Standard Error Response Format

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Status Code | Meaning | Example Scenarios |
|-------------|---------|-------------------|
| `200` | Success | GET request successful |
| `201` | Created | POST created new date |
| `400` | Bad Request | Invalid date format, missing required fields |
| `401` | Unauthorized | Missing/invalid token, not admin |
| `409` | Conflict | Duplicate date |
| `500` | Internal Server Error | Database error, unexpected failure |

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Missing or invalid authorization header" | No Bearer token provided | Include `Authorization: Bearer TOKEN` header |
| "Unauthorized: Admin access required" | Non-admin user attempting access | Use admin account |
| "Invalid token" | JWT token is invalid or expired | Obtain new token via login |
| "Invalid date format. Must be YYYY-MM-DD" | Date doesn't match regex | Use format: "2024-01-15" |
| "Start date must be before or equal to end date" | Invalid date range | Ensure startDate ≤ endDate |
| "Date already exists" | Attempting to create duplicate date | Use PUT to update instead |
| "Both startDate and endDate query parameters are required" | Missing parameter for DELETE | Provide both startDate and endDate |

## Input Validation

### Date Format Validation

- **Pattern:** `/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/`
- **Format:** YYYY-MM-DD
- **Examples:**
  - ✅ Valid: "2024-01-15", "2024-12-31"
  - ❌ Invalid: "01-15-2024", "2024/01/15", "2024-1-5"

### Boolean Validation

- `flatCategoryEnabled` must be `true` or `false`
- `dayWiseCategoryEnabled` must be `true` or `false`
- String values like "true" or "false" are not accepted

### Date Range Validation

- Start date must be before or equal to end date
- Both dates must be valid YYYY-MM-DD format
- Dates must represent real calendar dates (no "2024-02-30")

## Migration Guide

### Initial Setup

1. **Run the Migration:**
   ```bash
   curl -X POST "http://localhost:3000/api/admin/migrations/available-dates" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

2. **Verify Collection Creation:**
   - Connect to your MongoDB database
   - Check for collection named `availableDates`
   - Verify indexes are created:
     ```javascript
     db.availableDates.getIndexes()
     ```

### Seeding Initial Data

You can create initial dates using the POST or PUT endpoints:

```bash
# Create a single date
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": true
  }'

# Bulk create dates for a week
curl -X PUT "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dates": [
      {"date": "2024-01-15", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": true},
      {"date": "2024-01-16", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": true},
      {"date": "2024-01-17", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": true},
      {"date": "2024-01-18", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": true},
      {"date": "2024-01-19", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": true},
      {"date": "2024-01-20", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": true},
      {"date": "2024-01-21", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": true}
    ]
  }'
```

### Rollback

If you need to remove the collection:

```bash
curl -X POST "http://localhost:3000/api/admin/migrations/available-dates?action=rollback" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

⚠️ **Warning:** Rollback will permanently delete the collection and all its data.

## Customer App Compatibility

### Important Notes

✅ **NO CHANGES REQUIRED** in the customer-facing application (TDN9IL)

The customer app uses different endpoints and is **NOT affected** by the introduction of `availableDates`:

### Customer App Endpoints (Unchanged)

1. **GET /api/days**
   - Returns enabled days from `availableDays` collection
   - Used for day selection UI
   - **No changes needed**

2. **GET /api/enabled-days**
   - Returns list of enabled day names
   - Used for availability checks
   - **No changes needed**

### Separation of Concerns

| Collection | API Routes | Access | Purpose |
|------------|------------|--------|---------|
| `availableDays` | `/api/admin/days`, `/api/days`, `/api/enabled-days` | Admin + Customer | Weekly day management |
| `availableDates` | `/api/admin/available-dates` | **Admin Only** | Date-specific category configuration |

### Future Customer Integration

Currently, `availableDates` is **admin-only** and does not affect customer-facing functionality. Future integration may include:

1. **Category Filtering**: Filter categories based on date settings
2. **Promotional Display**: Show special category configurations on specific dates
3. **Holiday Modes**: Automatically adjust category display for holidays

**No immediate action required** in the customer app.

## Security Considerations

### Authentication & Authorization

- All endpoints require valid JWT token
- Token must have `role: 'admin'`
- Tokens are verified using `jwtHandler.verifyToken()`
- Unauthorized access returns 401 status

### Data Validation

- All inputs are validated before database operations
- Date format validation prevents injection attacks
- Boolean type validation ensures data integrity
- Range validation prevents logical errors

### Best Practices

1. **Always use HTTPS** in production
2. **Keep JWT tokens secure** - never expose in client-side code
3. **Validate dates on client side** before sending to API
4. **Handle errors gracefully** - don't expose internal errors to users
5. **Use environment variables** for sensitive configuration

## Performance Considerations

### Index Usage

The collection includes optimized indexes for common query patterns:

1. **Date lookups**: Unique index on `date` field
2. **Date range queries**: Date range index on `date` field
3. **Category type filtering**: Indexes on boolean flags

### Query Optimization Tips

1. **Use date ranges** instead of fetching all dates and filtering in code
2. **Limit query results** when possible (e.g., specific month vs. all dates)
3. **Avoid duplicate date creation** - check if date exists before POST
4. **Use bulk operations** (PUT) for multiple dates instead of multiple POST calls

### Caching Strategy

Consider implementing caching for frequently accessed dates:

```javascript
// Example: Cache dates for current week
const cacheKey = `availableDates:${weekStart}:${weekEnd}`;
const cached = await cache.get(cacheKey);

if (!cached) {
  const dates = await db.read('availableDates', {
    date: { $gte: weekStart, $lte: weekEnd }
  });
  await cache.set(cacheKey, dates, 3600); // 1 hour TTL
}
```

## Best Practices

### 1. Date Management

- Use **YYYY-MM-DD** format consistently
- Always validate dates before API calls
- Handle timezone issues (store in UTC)
- Consider using date libraries like `date-fns` or `luxon`

### 2. Bulk Operations

- Use **PUT endpoint** for multiple dates
- Include `startDate` and `endDate` for atomic replacement
- Validate all dates before sending bulk request
- Check response for `deletedCount` and `createdCount`

### 3. Error Handling

- Always check HTTP status codes
- Parse error messages for user feedback
- Implement retry logic for transient failures
- Log errors for debugging

### 4. Admin Workflow

1. **Plan dates in advance** - Create dates weeks/months ahead
2. **Use bulk operations** - Configure multiple dates at once
3. **Test configuration** - Verify settings before going live
4. **Monitor usage** - Track which dates are most commonly configured

## Troubleshooting

### Issue: "Date already exists" error

**Cause:** Attempting to create a date that already exists in the database.

**Solution:**
```bash
# Check if date exists
GET /api/admin/available-dates?startDate=2024-01-15&endDate=2024-01-15

# If exists, use POST to update (upsert) instead
POST /api/admin/available-dates
{
  "date": "2024-01-15",
  "flatCategoryEnabled": true,
  "dayWiseCategoryEnabled": false
}
```

### Issue: Query returns no results

**Cause:** No dates configured for the specified range.

**Solution:**
- Verify dates exist in the database
- Check date range is correct
- Use broader range or remove range filters

### Issue: "Invalid date format" error

**Cause:** Date doesn't match YYYY-MM-DD format.

**Solution:**
```javascript
// Correct format
"2024-01-15"  // ✅

// Incorrect formats
"01-15-2024"  // ❌
"2024/01/15"  // ❌
"2024-1-5"    // ❌
```

### Issue: Bulk operation fails partially

**Cause:** Some dates in the bulk request are invalid.

**Solution:**
- Check response `errors` array for specific failures
- Validate all dates before sending
- Remove duplicates from request
- Ensure all dates follow YYYY-MM-DD format

## Additional Resources

### Documentation Files

- `/src/lib/migrations/README-AVAILABLE-DATES.md` - Detailed API documentation
- `/IMPLEMENTATION-SUMMARY-AVAILABLE-DATES.md` - Implementation details
- `/QUICK-START-AVAILABLE-DATES.md` - Quick start guide
- `/docs/database-structure.md` - Complete database schema

### Related Collections

- `availableDays` - Weekly day configuration
- `foodcategories` - Category definitions with listing types
- `weeklymenu` - Weekly menu planning

### Type Definitions

```typescript
// Location: /src/types/order.ts
export interface AvailableDate {
  _id?: ObjectId | string;
  date: string; // YYYY-MM-DD format
  flatCategoryEnabled: boolean;
  dayWiseCategoryEnabled: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
```

---

## Summary

The `availableDates` collection provides powerful date-specific configuration capabilities for category listing types. It complements the existing `availableDays` collection by offering granular control over specific calendar dates, enabling administrators to handle special events, holidays, and promotional periods with ease.

**Key Takeaways:**

- ✅ Fully functional with comprehensive API endpoints
- ✅ Admin-only access - no customer app changes needed
- ✅ Unique date constraint prevents duplicates
- ✅ Optimized indexes for performance
- ✅ Comprehensive validation and error handling
- ⏳ Future: Category filtering integration

For questions or issues, refer to the related documentation files or contact the development team.
