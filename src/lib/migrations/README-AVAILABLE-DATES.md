# AvailableDates API Documentation

## Overview

The AvailableDates API allows administrators to manage specific dates and their category listing type enablement settings. This feature enables or disables flat and day-wise category listings for specific dates.

## Collection Schema

**Collection Name:** `availableDates`

```typescript
{
  _id: ObjectId,
  date: string,              // YYYY-MM-DD format (unique indexed)
  flatCategoryEnabled: boolean,    // Enable flat category listing
  dayWiseCategoryEnabled: boolean, // Enable day-wise category listing
  createdAt: Date,
  updatedAt: Date
}
```

## Database Indexes

1. **Unique Index** on `date` field - Ensures no duplicate dates
2. **Index** on `flatCategoryEnabled` - For filtering enabled dates
3. **Index** on `dayWiseCategoryEnabled` - For filtering enabled dates
4. **Date Range Index** on `date` field - For range queries

## API Endpoints

### 1. Migration Endpoint

#### POST `/api/admin/migrations/available-dates`
Run or rollback the availableDates collection migration.

**Query Parameters:**
- `action` (optional): `migrate` (default) or `rollback`

**Authentication:**
- Bearer token required
- Admin role required

**Example Request:**
```bash
# Run migration
curl -X POST "http://localhost:3000/api/admin/migrations/available-dates?action=migrate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Rollback migration
curl -X POST "http://localhost:3000/api/admin/migrations/available-dates?action=rollback" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "data": {
    "indexesCreated": ["date_unique_index", "flatCategoryEnabled_index", "dayWiseCategoryEnabled_index", "date_range_index"],
    "collectionCreated": true
  },
  "message": "AvailableDates collection migration completed successfully"
}
```

---

### 2. Get Available Dates

#### GET `/api/admin/available-dates`
Fetch available dates by date range.

**Query Parameters:**
- `startDate` (optional): Start date in YYYY-MM-DD format
- `endDate` (optional): End date in YYYY-MM-DD format

**Authentication:**
- Bearer token required
- Admin role required

**Example Requests:**
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

# Get dates until end date
curl -X GET "http://localhost:3000/api/admin/available-dates?endDate=2024-12-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
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

---

### 3. Create/Upsert Single Date

#### POST `/api/admin/available-dates`
Create a new date or update an existing one.

**Request Body:**
```json
{
  "date": "2024-01-15",
  "flatCategoryEnabled": true,
  "dayWiseCategoryEnabled": false
}
```

**Authentication:**
- Bearer token required
- Admin role required

**Example Request:**
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

**Response (Created):**
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

**Response (Updated):**
```json
{
  "data": {
    "id": "659c12345678901234567890",
    "date": "2024-01-15",
    "flatCategoryEnabled": false,
    "dayWiseCategoryEnabled": true,
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-10T11:00:00.000Z"
  },
  "message": "Date updated successfully"
}
```

---

### 4. Bulk Update Dates

#### PUT `/api/admin/available-dates`
Delete all dates in range and insert new dates.

**Request Body:**
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

**Authentication:**
- Bearer token required
- Admin role required

**Example Request:**
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

**Response:**
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

---

### 5. Delete Dates by Range

#### DELETE `/api/admin/available-dates`
Delete all dates within a specified range.

**Query Parameters:**
- `startDate` (required): Start date in YYYY-MM-DD format
- `endDate` (required): End date in YYYY-MM-DD format

**Authentication:**
- Bearer token required
- Admin role required

**Example Request:**
```bash
curl -X DELETE "http://localhost:3000/api/admin/available-dates?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
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

---

## Error Responses

All endpoints follow standardized error response format:

```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token or not admin)
- `409` - Conflict (duplicate date)
- `500` - Internal Server Error

**Common Error Messages:**
- "Missing or invalid authorization header"
- "Unauthorized: Admin access required"
- "Invalid token"
- "Invalid date format. Must be YYYY-MM-DD"
- "Start date must be before or equal to end date"
- "Date already exists"
- "Both startDate and endDate query parameters are required"

---

## Input Validation

### Date Format Validation
- Must be in `YYYY-MM-DD` format
- Must be a valid calendar date
- Validated using regex: `/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/`

### Boolean Validation
- `flatCategoryEnabled` must be a boolean
- `dayWiseCategoryEnabled` must be a boolean

### Date Range Validation
- Start date must be before or equal to end date
- Both dates must be valid YYYY-MM-DD format

---

## Security

### Authentication
All endpoints require JWT authentication:
1. Get token from login endpoint
2. Include in Authorization header: `Bearer YOUR_JWT_TOKEN`
3. Token must have `role: 'admin'`

### Authorization
- Only users with `admin` role can access these endpoints
- JWT is verified on every request using `jwtHandler.verifyToken()`

---

## Usage Examples

### Example 1: Enable flat categories for a week

```bash
# Create dates for a week with flat categories enabled
curl -X PUT "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dates": [
      {"date": "2024-01-15", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": false},
      {"date": "2024-01-16", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": false},
      {"date": "2024-01-17", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": false},
      {"date": "2024-01-18", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": false},
      {"date": "2024-01-19", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": false},
      {"date": "2024-01-20", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": false},
      {"date": "2024-01-21", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": false}
    ]
  }'
```

### Example 2: Mixed mode (both flat and day-wise)

```bash
# Enable both category types for a specific date
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": true
  }'
```

### Example 3: Check what's enabled for a date range

```bash
# Query dates for January 2024
curl -X GET "http://localhost:3000/api/admin/available-dates?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Database Migration

To set up the availableDates collection in your database:

1. **Run the migration:**
   ```bash
   curl -X POST "http://localhost:3000/api/admin/migrations/available-dates" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

2. **Verify collection created:**
   - Check MongoDB for collection `availableDates`
   - Verify indexes are created

3. **Rollback if needed:**
   ```bash
   curl -X POST "http://localhost:3000/api/admin/migrations/available-dates?action=rollback" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

---

## Notes

- Date field has a **unique index** - attempting to create duplicate dates will fail with 409 Conflict
- Bulk PUT operation first deletes dates in the specified range (if provided), then inserts new dates
- All timestamps are in UTC
- The API follows the same response format as the existing `/api/admin/days` endpoint for consistency
