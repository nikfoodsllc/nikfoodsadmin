# Category-Food Mapping API - Usage Examples

## Quick Start

### 1. Create a FLAT Mapping (Standard Menu Item)

```bash
curl -X POST http://localhost:3000/api/admin/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "507f1f77bcf86cd799439011",
    "categoryId": "507f191e810c19729de860ea",
    "mappingType": "FLAT",
    "sequence": 0
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "foodItemId": "507f1f77bcf86cd799439011",
    "categoryId": "507f191e810c19729de860ea",
    "sequence": 0,
    "mappingType": "FLAT",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Created FLAT category mapping successfully"
}
```

---

### 2. Create a DAY_WISE Mapping (Daily Special)

```bash
curl -X POST http://localhost:3000/api/admin/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "507f1f77bcf86cd799439011",
    "categoryId": "507f191e810c19729de860ea",
    "mappingType": "DAY_WISE",
    "day": "Monday",
    "sequence": 0
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "foodItemId": "507f1f77bcf86cd799439011",
    "categoryId": "507f191e810c19729de860ea",
    "sequence": 0,
    "mappingType": "DAY_WISE",
    "day": "Monday",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Created DAY_WISE category mapping successfully"
}
```

---

### 3. Bulk Assign Food Item to Multiple Days

Using the specialized day-wise endpoint:

```bash
curl -X POST http://localhost:3000/api/admin/category-food-mapping/daywise \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "507f1f77bcf86cd799439011",
    "categoryId": "507f191e810c19729de860ea",
    "days": [
      { "day": "Monday", "sequence": 0 },
      { "day": "Wednesday", "sequence": 0 },
      { "day": "Friday", "sequence": 0 }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "insertedCount": 3
  },
  "message": "Created 3 day-wise mappings successfully"
}
```

---

## Querying Examples

### Get All Mappings for a Food Item

```bash
curl -X GET "http://localhost:3000/api/admin/category-food-mapping?foodItemId=507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "data": {
    "mappings": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "foodItemId": "507f1f77bcf86cd799439011",
        "categoryId": "507f191e810c19729de860ea",
        "sequence": 0,
        "mappingType": "FLAT"
      },
      {
        "_id": "507f1f77bcf86cd799439013",
        "foodItemId": "507f1f77bcf86cd799439011",
        "categoryId": "507f191e810c19729de860ea",
        "sequence": 0,
        "mappingType": "DAY_WISE",
        "day": "Monday"
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

### Get Only FLAT Mappings

```bash
curl -X GET "http://localhost:3000/api/admin/category-food-mapping?foodItemId=507f1f77bcf86cd799439011&mappingType=FLAT" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Get Only DAY_WISE Mappings for Monday

```bash
curl -X GET "http://localhost:3000/api/admin/category-food-mapping?foodItemId=507f1f77bcf86cd799439011&mappingType=DAY_WISE&day=Monday" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Get All DAY_WISE Mappings Grouped by Day

```bash
curl -X GET "http://localhost:3000/api/admin/category-food-mapping/daywise?categoryId=507f191e810c19729de860ea" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "data": {
    "mappings": [...],
    "total": 10,
    "groupedByDay": {
      "Monday": [ {...}, {...} ],
      "Tuesday": [ {...} ],
      "Wednesday": [ {...}, {...}, {...} ]
    },
    "days": ["Monday", "Tuesday", "Wednesday"],
    "mappingsByDay": [
      {
        "day": "Monday",
        "count": 2,
        "mappings": [...]
      },
      {
        "day": "Tuesday",
        "count": 1,
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

---

## Updating Examples

### Update Mapping Sequence

```bash
curl -X PUT http://localhost:3000/api/admin/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "507f1f77bcf86cd799439012",
    "sequence": 5
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Mapping updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "sequence": 5
  }
}
```

### Update Day for DAY_WISE Mapping

```bash
curl -X PUT http://localhost:3000/api/admin/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "507f1f77bcf86cd799439013",
    "day": "Tuesday"
  }'
```

---

## Deleting Examples

### Delete Single Mapping

```bash
curl -X DELETE "http://localhost:3000/api/admin/category-food-mapping?id=507f1f77bcf86cd799439012" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Delete All FLAT Mappings for a Food Item

```bash
curl -X DELETE "http://localhost:3000/api/admin/category-food-mapping?foodItemId=507f1f77bcf86cd799439011&mappingType=FLAT" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Delete All Monday Mappings

```bash
curl -X DELETE "http://localhost:3000/api/admin/category-food-mapping?foodItemId=507f1f77bcf86cd799439011&day=Monday" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Delete All DAY_WISE Mappings for a Category

```bash
curl -X DELETE "http://localhost:3000/api/admin/category-food-mapping/daywise?categoryId=507f191e810c19729de860ea" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## JavaScript/TypeScript Client Examples

### Using Fetch API

```typescript
// Create FLAT mapping
const createFlatMapping = async () => {
  const response = await fetch('/api/admin/category-food-mapping', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      foodItemId: '507f1f77bcf86cd799439011',
      categoryId: '507f191e810c19729de860ea',
      mappingType: 'FLAT',
      sequence: 0
    })
  });

  const data = await response.json();
  console.log(data);
};

// Create DAY_WISE mappings for multiple days
const createDayWiseMappings = async () => {
  const response = await fetch('/api/admin/category-food-mapping/daywise', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      foodItemId: '507f1f77bcf86cd799439011',
      categoryId: '507f191e810c19729de860ea',
      days: [
        { day: 'Monday', sequence: 0 },
        { day: 'Wednesday', sequence: 0 },
        { day: 'Friday', sequence: 0 }
      ]
    })
  });

  const data = await response.json();
  console.log(data);
};

// Query mappings with filters
const queryMappings = async () => {
  const response = await fetch(
    '/api/admin/category-food-mapping?foodItemId=507f1f77bcf86cd799439011&mappingType=DAY_WISE',
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const data = await response.json();
  console.log(data);
};

// Get day-wise mappings grouped by day
const getDayWiseGrouped = async () => {
  const response = await fetch(
    '/api/admin/category-food-mapping/daywise?categoryId=507f191e810c19729de860ea',
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const data = await response.json();
  console.log(data.data.mappingsByDay); // Array grouped by day
};
```

---

## Common Workflows

### Workflow 1: Add Item to Main Menu (FLAT)

```bash
# Step 1: Create FLAT mapping
curl -X POST http://localhost:3000/api/admin/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "burger123",
    "categoryId": "mains",
    "mappingType": "FLAT",
    "sequence": 0
  }'
```

### Workflow 2: Add Weekly Special (DAY_WISE)

```bash
# Step 1: Assign to specific days
curl -X POST http://localhost:3000/api/admin/category-food-mapping/daywise \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "special123",
    "categoryId": "weekly-specials",
    "days": [
      { "day": "Monday", "sequence": 0 },
      { "day": "Wednesday", "sequence": 0 },
      { "day": "Friday", "sequence": 0 }
    ]
  }'
```

### Workflow 3: Tiffin Service - Daily Menu Planning

```bash
# Step 1: Create day-wise mappings for entire week
curl -X POST http://localhost:3000/api/admin/category-food-mapping/daywise \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": [
      { "foodItemId": "monday-meal", "categoryId": "tiffin", "day": "Monday", "sequence": 0 },
      { "foodItemId": "tuesday-meal", "categoryId": "tiffin", "day": "Tuesday", "sequence": 0 },
      { "foodItemId": "wednesday-meal", "categoryId": "tiffin", "day": "Wednesday", "sequence": 0 },
      { "foodItemId": "thursday-meal", "categoryId": "tiffin", "day": "Thursday", "sequence": 0 },
      { "foodItemId": "friday-meal", "categoryId": "tiffin", "day": "Friday", "sequence": 0 }
    ]
  }'

# Step 2: Verify the weekly plan
curl -X GET "http://localhost:3000/api/admin/category-food-mapping/daywise?categoryId=tiffin" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Workflow 4: Update Daily Menu

```bash
# Step 1: Remove old Monday mappings
curl -X DELETE "http://localhost:3000/api/admin/category-food-mapping/daywise?day=Monday&categoryId=specials" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Step 2: Add new Monday mappings
curl -X POST http://localhost:3000/api/admin/category-food-mapping/daywise \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": [
      { "foodItemId": "new-special1", "categoryId": "specials", "day": "Monday", "sequence": 0 },
      { "foodItemId": "new-special2", "categoryId": "specials", "day": "Monday", "sequence": 1 }
    ]
  }'
```

---

## Backward Compatibility Examples

### Legacy Request (No mappingType) - Still Works!

```bash
# This request defaults to FLAT for backward compatibility
curl -X POST http://localhost:3000/api/admin/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "507f1f77bcf86cd799439011",
    "categoryId": "507f191e810c19729de860ea",
    "sequence": 0
  }'
```

**Result:** Creates a FLAT mapping (defaults to `mappingType: 'FLAT'`)

---

## Error Handling Examples

### Validation Error

```bash
# Missing required 'day' field for DAY_WISE mapping
curl -X POST http://localhost:3000/api/admin/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "507f1f77bcf86cd799439011",
    "categoryId": "507f191e810c19729de860ea",
    "mappingType": "DAY_WISE",
    "sequence": 0
  }'
```

**Response:**
```json
{
  "error": "Validation failed",
  "details": [
    "Day is required for DAY_WISE mapping type"
  ]
}
```

### Duplicate Mapping Error

```bash
# Try to create duplicate DAY_WISE mapping
curl -X POST http://localhost:3000/api/admin/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "507f1f77bcf86cd799439011",
    "categoryId": "507f191e810c19729de860ea",
    "mappingType": "DAY_WISE",
    "day": "Monday",
    "sequence": 0
  }'
```

**Response (if already exists):**
```json
{
  "error": "Mapping already exists for this food item and category with type DAY_WISE"
}
```

### Invalid Day Filter Error

```bash
# Try to use day filter with FLAT mapping type
curl -X GET "http://localhost:3000/api/admin/category-food-mapping?foodItemId=xxx&mappingType=FLAT&day=Monday" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "error": "Day filter can only be used with DAY_WISE mapping type"
}
```

---

## Best Practices

### 1. Always Specify mappingType for New Code

```typescript
// ✅ Good - Explicit
{
  foodItemId: 'xxx',
  categoryId: 'yyy',
  mappingType: 'FLAT',
  sequence: 0
}

// ⚠️ Works but not recommended for new code
{
  foodItemId: 'xxx',
  categoryId: 'yyy',
  sequence: 0  // Defaults to FLAT
}
```

### 2. Use Day-Wise Endpoint for DAY_WISE Operations

```typescript
// ✅ Better - Use specialized endpoint
POST /api/admin/category-food-mapping/daywise
{
  foodItemId: 'xxx',
  categoryId: 'yyy',
  days: [
    { day: 'Monday', sequence: 0 },
    { day: 'Wednesday', sequence: 0 }
  ]
}

// ⚠️ Also works but more verbose
POST /api/admin/category-food-mapping
{
  foodItemId: 'xxx',
  mappingType: 'DAY_WISE',
  categories: [
    { categoryId: 'yyy', day: 'Monday', sequence: 0 },
    { categoryId: 'yyy', day: 'Wednesday', sequence: 0 }
  ]
}
```

### 3. Filter by mappingType When Querying

```typescript
// ✅ Good - Get only what you need
GET /api/admin/category-food-mapping?foodItemId=xxx&mappingType=FLAT

// ⚠️ Less efficient - Gets everything
GET /api/admin/category-food-mapping?foodItemId=xxx
// Then filter client-side
```

### 4. Use Bulk Operations for Multiple Mappings

```typescript
// ✅ Good - Single API call
POST /api/admin/category-food-mapping
{
  foodItemId: 'xxx',
  mappingType: 'FLAT',
  categories: [
    { categoryId: 'cat1', sequence: 0 },
    { categoryId: 'cat2', sequence: 1 },
    { categoryId: 'cat3', sequence: 2 }
  ]
}

// ❌ Bad - Multiple API calls
POST /api/admin/category-food-mapping { foodItemId: 'xxx', categoryId: 'cat1', ... }
POST /api/admin/category-food-mapping { foodItemId: 'xxx', categoryId: 'cat2', ... }
POST /api/admin/category-food-mapping { foodItemId: 'xxx', categoryId: 'cat3', ... }
```

---

## Testing Your Implementation

### Test Sequence

1. **Create FLAT mapping**
2. **Verify FLAT mapping exists**
3. **Create DAY_WISE mappings**
4. **Verify DAY_WISE mappings exist**
5. **Query with filters**
6. **Update mappings**
7. **Delete mappings**
8. **Verify deletions**

### Test Script

```bash
#!/bin/bash

TOKEN="YOUR_ADMIN_TOKEN"
BASE_URL="http://localhost:3000/api/admin/category-food-mapping"

# 1. Create FLAT mapping
echo "Creating FLAT mapping..."
curl -X POST $BASE_URL \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "test-food-1",
    "categoryId": "test-category-1",
    "mappingType": "FLAT",
    "sequence": 0
  }'

# 2. Create DAY_WISE mappings
echo "\nCreating DAY_WISE mappings..."
curl -X POST $BASE_URL/daywise \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodItemId": "test-food-1",
    "categoryId": "test-category-1",
    "days": [
      { "day": "Monday", "sequence": 0 },
      { "day": "Wednesday", "sequence": 0 }
    ]
  }'

# 3. Query mappings
echo "\nQuerying all mappings..."
curl -X GET "$BASE_URL?foodItemId=test-food-1" \
  -H "Authorization: Bearer $TOKEN"

# 4. Query only FLAT
echo "\nQuerying FLAT mappings..."
curl -X GET "$BASE_URL?foodItemId=test-food-1&mappingType=FLAT" \
  -H "Authorization: Bearer $TOKEN"

# 5. Query only DAY_WISE
echo "\nQuerying DAY_WISE mappings..."
curl -X GET "$BASE_URL?foodItemId=test-food-1&mappingType=DAY_WISE" \
  -H "Authorization: Bearer $TOKEN"

# 6. Clean up
echo "\nCleaning up..."
curl -X DELETE "$BASE_URL?foodItemId=test-food-1" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Support

For more information:
- See `CATEGORY_FOOD_MAPPING_API.md` for complete API reference
- See `IMPLEMENTATION_SUMMARY.md` for implementation details
- Check type definitions in `src/types/order.ts`
