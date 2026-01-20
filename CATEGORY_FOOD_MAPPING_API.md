# Category-Food Mapping API Documentation

## Overview

The Category-Food Mapping API has been enhanced to support both **FLAT** and **DAY_WISE** mapping types. This allows food items to be organized in categories using different listing strategies:

- **FLAT**: Standard flat listing where food items appear in category sequence
- **DAY_WISE**: Day-wise listing where food items are organized by day (e.g., Monday, Tuesday, etc.)

All existing endpoints maintain **backward compatibility** with consumers that don't specify a `mappingType` - these will default to `FLAT`.

---

## Base Endpoint

### `GET/POST/PUT/DELETE /api/admin/category-food-mapping`

---

## GET /api/admin/category-food-mapping

Get category mappings for a food item or category with optional filtering.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `foodItemId` | string | No* | Filter by food item ID |
| `categoryId` | string | No* | Filter by category ID |
| `mappingType` | string | No | Filter by mapping type (`'FLAT'` or `'DAY_WISE'`) |
| `day` | string | No | Filter by day (only for `DAY_WISE` mappings) |

*At least one filter parameter is required.

### Response Format

```json
{
  "data": {
    "mappings": [
      {
        "_id": "...",
        "foodItemId": "...",
        "categoryId": "...",
        "sequence": 0,
        "mappingType": "FLAT",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "_id": "...",
        "foodItemId": "...",
        "categoryId": "...",
        "sequence": 0,
        "mappingType": "DAY_WISE",
        "day": "Monday",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 2,
    "flatMappings": [...],
    "dayWiseMappings": [...],
    "flatCount": 1,
    "dayWiseCount": 1
  },
  "message": "Category mappings fetched successfully"
}
```

### Example Requests

```bash
# Get all FLAT mappings for a food item
GET /api/admin/category-food-mapping?foodItemId=123&mappingType=FLAT

# Get all DAY_WISE mappings for a category
GET /api/admin/category-food-mapping?categoryId=456&mappingType=DAY_WISE

# Get all Monday mappings for a food item
GET /api/admin/category-food-mapping?foodItemId=123&day=Monday

# Get all mappings (both FLAT and DAY_WISE) for a category
GET /api/admin/category-food-mapping?categoryId=456
```

---

## POST /api/admin/category-food-mapping

Create a new category mapping or bulk create mappings.

### Single Mapping Request

```json
{
  "foodItemId": "string",
  "categoryId": "string",
  "sequence": 0,
  "mappingType": "FLAT" | "DAY_WISE",
  "day": "Monday"  // Required only for DAY_WISE
}
```

### Bulk Mapping Request

```json
{
  "foodItemId": "string",
  "mappingType": "FLAT" | "DAY_WISE",
  "categories": [
    {
      "categoryId": "string",
      "sequence": 0,
      "day": "Monday"  // Required only for DAY_WISE
    }
  ]
}
```

### Backward Compatibility

If `mappingType` is not provided, it defaults to `FLAT`:

```json
{
  "foodItemId": "string",
  "categoryId": "string",
  "sequence": 0
}
```

### Example Requests

```bash
# Create a FLAT mapping
POST /api/admin/category-food-mapping
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "sequence": 0,
  "mappingType": "FLAT"
}

# Create a DAY_WISE mapping
POST /api/admin/category-food-mapping
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "sequence": 0,
  "mappingType": "DAY_WISE",
  "day": "Monday"
}

# Bulk create FLAT mappings
POST /api/admin/category-food-mapping
{
  "foodItemId": "food123",
  "mappingType": "FLAT",
  "categories": [
    { "categoryId": "cat456", "sequence": 0 },
    { "categoryId": "cat789", "sequence": 1 }
  ]
}

# Bulk create DAY_WISE mappings
POST /api/admin/category-food-mapping
{
  "foodItemId": "food123",
  "mappingType": "DAY_WISE",
  "categories": [
    { "categoryId": "cat456", "sequence": 0, "day": "Monday" },
    { "categoryId": "cat456", "sequence": 0, "day": "Tuesday" }
  ]
}
```

### Important Notes

- **Duplicate Prevention**: The API checks for duplicates based on `foodItemId + categoryId + mappingType`
- **Coexistence**: A food item can have both FLAT and DAY_WISE mappings for the same category
- **Bulk Operations**: When creating bulk mappings, existing mappings of the same `mappingType` are deleted first

---

## PUT /api/admin/category-food-mapping

Update sequence or day field of a mapping.

### Request Body

```json
{
  "_id": "string",
  "sequence": 1,  // Optional
  "day": "Monday"  // Optional (only for DAY_WISE mappings)
}
```

### Response

```json
{
  "success": true,
  "message": "Mapping updated successfully",
  "data": {
    "_id": "...",
    "sequence": 1,
    "day": "Monday"
  }
}
```

### Example Requests

```bash
# Update sequence
PUT /api/admin/category-food-mapping
{
  "_id": "mapping123",
  "sequence": 5
}

# Update day for DAY_WISE mapping
PUT /api/admin/category-food-mapping
{
  "_id": "mapping123",
  "day": "Tuesday"
}

# Update both
PUT /api/admin/category-food-mapping
{
  "_id": "mapping123",
  "sequence": 5,
  "day": "Tuesday"
}
```

---

## DELETE /api/admin/category-food-mapping

Delete a category mapping with optional filtering.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No* | Delete single mapping by ID |
| `foodItemId` | string | No* | Delete all mappings for this food item |
| `mappingType` | string | No | Filter by mapping type (`'FLAT'` or `'DAY_WISE'`) |
| `day` | string | No | Filter by day (only for `DAY_WISE` mappings) |

*Either `id` or `foodItemId` is required.

### Response

```json
{
  "success": true,
  "data": {
    "deletedCount": 5,
    "mappingType": "DAY_WISE",
    "day": "Monday"
  },
  "message": "Deleted 5 mapping(s) successfully"
}
```

### Example Requests

```bash
# Delete single mapping
DELETE /api/admin/category-food-mapping?id=mapping123

# Delete all FLAT mappings for a food item
DELETE /api/admin/category-food-mapping?foodItemId=food123&mappingType=FLAT

# Delete all Monday mappings for a food item
DELETE /api/admin/category-food-mapping?foodItemId=food123&day=Monday

# Delete all mappings (both FLAT and DAY_WISE) for a food item
DELETE /api/admin/category-food-mapping?foodItemId=food123
```

---

## Day-Wise Specific Endpoint

### `/api/admin/category-food-mapping/daywise`

This endpoint provides convenient operations specifically for DAY_WISE mappings.

---

## GET /api/admin/category-food-mapping/daywise

Get all DAY_WISE mappings, optionally filtered by day or category, with automatic grouping.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `day` | string | No | Filter by day (e.g., "Monday", "Tuesday") |
| `categoryId` | string | No | Filter by category ID |
| `foodItemId` | string | No | Filter by food item ID |

### Response Format

```json
{
  "data": {
    "mappings": [...],
    "total": 10,
    "groupedByDay": {
      "Monday": [...],
      "Tuesday": [...],
      "Wednesday": [...]
    },
    "days": ["Monday", "Tuesday", "Wednesday"],
    "mappingsByDay": [
      {
        "day": "Monday",
        "count": 4,
        "mappings": [...]
      },
      {
        "day": "Tuesday",
        "count": 3,
        "mappings": [...]
      },
      {
        "day": "Wednesday",
        "count": 3,
        "mappings": [...]
      }
    ]
  },
  "message": "Day-wise mappings fetched successfully"
}
```

### Example Requests

```bash
# Get all DAY_WISE mappings grouped by day
GET /api/admin/category-food-mapping/daywise

# Get all Monday mappings
GET /api/admin/category-food-mapping/daywise?day=Monday

# Get DAY_WISE mappings for a specific category
GET /api/admin/category-food-mapping/daywise?categoryId=cat456
```

---

## POST /api/admin/category-food-mapping/daywise

Bulk create DAY_WISE mappings with convenient formats.

### Format 1: Array of Mappings

```json
{
  "mappings": [
    {
      "foodItemId": "food123",
      "categoryId": "cat456",
      "day": "Monday",
      "sequence": 0
    },
    {
      "foodItemId": "food123",
      "categoryId": "cat456",
      "day": "Tuesday",
      "sequence": 0
    }
  ]
}
```

### Format 2: Food Item to Multiple Days

```json
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "days": [
    { "day": "Monday", "sequence": 0 },
    { "day": "Tuesday", "sequence": 0 },
    { "day": "Wednesday", "sequence": 0 }
  ]
}
```

### Response

```json
{
  "success": true,
  "data": {
    "insertedCount": 3
  },
  "message": "Created 3 day-wise mappings successfully"
}
```

### Example Requests

```bash
# Assign food item to multiple days in a category
POST /api/admin/category-food-mapping/daywise
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "days": [
    { "day": "Monday", "sequence": 0 },
    { "day": "Tuesday", "sequence": 0 },
    { "day": "Wednesday", "sequence": 0 }
  ]
}

# Bulk create multiple day-wise mappings
POST /api/admin/category-food-mapping/daywise
{
  "mappings": [
    { "foodItemId": "food123", "categoryId": "cat456", "day": "Monday", "sequence": 0 },
    { "foodItemId": "food123", "categoryId": "cat789", "day": "Monday", "sequence": 0 },
    { "foodItemId": "food456", "categoryId": "cat456", "day": "Tuesday", "sequence": 0 }
  ]
}
```

---

## DELETE /api/admin/category-food-mapping/daywise

Delete DAY_WISE mappings with various filter options.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No* | Delete specific mapping by ID |
| `day` | string | No* | Delete all mappings for a specific day |
| `categoryId` | string | No* | Delete all mappings for a category |
| `foodItemId` | string | No* | Delete all mappings for a food item |

*At least one parameter is required.

### Example Requests

```bash
# Delete all Monday mappings
DELETE /api/admin/category-food-mapping/daywise?day=Monday

# Delete all day-wise mappings for a food item
DELETE /api/admin/category-food-mapping/daywise?foodItemId=food123

# Delete specific day-wise mapping
DELETE /api/admin/category-food-mapping/daywise?id=mapping123
```

---

## Migration Notes

### Existing Data Migration

Existing mappings without a `mappingType` field will be automatically defaulted to `FLAT` through the migration process:

```typescript
// Run migration to add mappingType field to existing documents
POST /api/admin/migrations/category-food-mapping-discriminated
```

### Backward Compatibility

All existing API consumers continue to work without changes:

- Requests without `mappingType` default to `FLAT`
- Existing response structure is maintained
- New fields are additive and don't break existing parsing

---

## Best Practices

### 1. Using FLAT Mappings

```bash
# Standard category listing
POST /api/admin/category-food-mapping
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "mappingType": "FLAT",
  "sequence": 0
}
```

### 2. Using DAY_WISE Mappings

```bash
# For menu items that change daily
POST /api/admin/category-food-mapping/daywise
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "days": [
    { "day": "Monday", "sequence": 0 },
    { "day": "Tuesday", "sequence": 0 },
    { "day": "Wednesday", "sequence": 0 }
  ]
}
```

### 3. Mixed Mapping Types

A food item can have both FLAT and DAY_WISE mappings:

```bash
# Add to main menu (FLAT)
POST /api/admin/category-food-mapping
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "mappingType": "FLAT",
  "sequence": 0
}

# Add to daily specials (DAY_WISE)
POST /api/admin/category-food-mapping/daywise
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "days": [
    { "day": "Monday", "sequence": 0 }
  ]
}
```

### 4. Filtering and Querying

```bash
# Get only FLAT mappings for a category
GET /api/admin/category-food-mapping?categoryId=cat456&mappingType=FLAT

# Get only DAY_WISE mappings for a food item
GET /api/admin/category-food-mapping?foodItemId=food123&mappingType=DAY_WISE

# Get Monday-specific mappings
GET /api/admin/category-food-mapping/daywise?day=Monday
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters or validation errors |
| 401 | Unauthorized - Missing or invalid authentication |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Duplicate mapping exists |
| 500 | Internal Server Error - Server error occurred |

---

## Common Use Cases

### Use Case 1: Standard Restaurant Menu

Use FLAT mappings for regular menu items:

```bash
POST /api/admin/category-food-mapping
{
  "foodItemId": "burger123",
  "categoryId": "mains",
  "mappingType": "FLAT",
  "sequence": 0
}
```

### Use Case 2: Weekly Special Menu

Use DAY_WISE mappings for items that change daily:

```bash
POST /api/admin/category-food-mapping/daywise
{
  "foodItemId": "special123",
  "categoryId": "weekly-specials",
  "days": [
    { "day": "Monday", "sequence": 0 },
    { "day": "Wednesday", "sequence": 0 },
    { "day": "Friday", "sequence": 0 }
  ]
}
```

### Use Case 3: Tiffin Service with Daily Menu

```bash
# Create tiffin items for each day
POST /api/admin/category-food-mapping/daywise
{
  "mappings": [
    { "foodItemId": "monday-meal", "categoryId": "tiffin", "day": "Monday", "sequence": 0 },
    { "foodItemId": "tuesday-meal", "categoryId": "tiffin", "day": "Tuesday", "sequence": 0 },
    { "foodItemId": "wednesday-meal", "categoryId": "tiffin", "day": "Wednesday", "sequence": 0 }
  ]
}
```

---

## API Validation

### Request Validation

All requests are validated using Zod schemas:

- **FLAT mappings**: `foodItemId`, `categoryId`, `sequence`, `mappingType: 'FLAT'`
- **DAY_WISE mappings**: `foodItemId`, `categoryId`, `sequence`, `mappingType: 'DAY_WISE'`, `day`

### Error Responses

Validation errors return detailed information:

```json
{
  "error": "Validation failed",
  "details": [
    "foodItemId: Food item ID is required",
    "day: Day is required for DAY_WISE mapping type"
  ]
}
```

---

## Performance Considerations

1. **Indexing**: The API creates indexes on:
   - `mappingType`
   - `mappingType + categoryId`
   - `mappingType + foodItemId`
   - `day` (for DAY_WISE queries)

2. **Query Optimization**:
   - Always provide at least one filter parameter
   - Use specific filters when possible (e.g., `mappingType` + `day`)

3. **Bulk Operations**:
   - Use bulk endpoints for multiple mappings
   - Minimize individual API calls

---

## Testing

### Test FLAT Mapping Creation

```bash
curl -X POST http://localhost:3000/api/admin/category-food-mapping \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "food123",
    "categoryId": "cat456",
    "mappingType": "FLAT",
    "sequence": 0
  }'
```

### Test DAY_WISE Mapping Creation

```bash
curl -X POST http://localhost:3000/api/admin/category-food-mapping/daywise \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "food123",
    "categoryId": "cat456",
    "days": [
      { "day": "Monday", "sequence": 0 },
      { "day": "Tuesday", "sequence": 0 }
    ]
  }'
```

### Test Filtering

```bash
curl -X GET "http://localhost:3000/api/admin/category-food-mapping?foodItemId=food123&mappingType=DAY_WISE" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Support

For issues or questions regarding the Category-Food Mapping API, please contact the development team.
