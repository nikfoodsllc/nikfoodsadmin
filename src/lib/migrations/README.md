# CategoryFoodMapping Migration Guide

## Overview

This document describes the migration from the old category structure (where food items had a `category` array) to the new three-collection architecture using a dedicated `CategoryFoodMapping` collection for many-to-many relationships.

## Migration Date

January 2025

## Old Architecture (Deprecated)

### fooditems collection
```javascript
{
  _id: ObjectId("..."),
  name: "Food Item Name",
  category: ["cat1_id", "cat2_id"], // ❌ Old approach - array of category IDs
  price: 10.99,
  // ... other fields
}
```

### Problems with Old Approach
1. **Tight Coupling**: Modifying categories required updating all food items
2. **No Sequence Control**: Hard to maintain the order of categories per food item
3. **Scalability Issues**: Array operations don't scale well with many categories
4. **Query Complexity**: Finding all items in a category required scanning all food items

## New Architecture

### Three-Collection Structure

#### 1. fooditems collection
```javascript
{
  _id: ObjectId("..."),
  name: "Food Item Name",
  category: [], // Kept for backward compatibility during transition
  price: 10.99,
  // ... other fields
}
```

#### 2. foodcategories collection
```javascript
{
  _id: ObjectId("..."),
  name: "Category Name",
  description: "Category description",
  listingType: "flat", // or "day-wise"
  sequence: 1,
  isDraft: false,
  dayWiseItems: [], // Only for day-wise categories
  createdAt: ISODate("2025-01-01"),
  updatedAt: ISODate("2025-01-01")
}
```

#### 3. categoryfoodmapping collection (NEW)
```javascript
{
  _id: ObjectId("..."),
  foodItemId: ObjectId("food_id"),
  categoryId: ObjectId("category_id"),
  sequence: 0, // Order within the category
  createdAt: ISODate("2025-01-01"),
  updatedAt: ISODate("2025-01-01")
}
```

## Benefits of New Architecture

1. **Decoupling**: Food items and categories are independent entities
2. **Flexible Sequencing**: Control order of items within each category
3. **Scalability**: Efficient queries with proper indexing
4. **Multi-Category Support**: A food item can belong to multiple categories
5. **Performance**: Indexed lookups on both `foodItemId` and `categoryId`

## Database Indexes

The migration creates the following indexes on the `categoryfoodmapping` collection:

```javascript
// Index on foodItemId for fast lookup of all categories for a food item
db.categoryfoodmapping.createIndex({ foodItemId: 1 })

// Index on categoryId for fast lookup of all items in a category
db.categoryfoodmapping.createIndex({ categoryId: 1 })

// Unique compound index to prevent duplicate mappings
db.categoryfoodmapping.createIndex(
  { foodItemId: 1, categoryId: 1 },
  { unique: true }
)
```

## API Endpoints

### CategoryFoodMapping Management

#### GET /api/admin/category-food-mapping
Get category mappings for a food item or category

**Query Parameters:**
- `foodItemId` (optional): Filter by food item ID
- `categoryId` (optional): Filter by category ID

**Example:**
```bash
GET /api/admin/category-food-mapping?foodItemId=507f1f77bcf86cd799439011
GET /api/admin/category-food-mapping?categoryId=507f191e810c19729de860ea
```

**Response:**
```json
{
  "data": {
    "mappings": [
      {
        "_id": "...",
        "foodItemId": "...",
        "categoryId": "...",
        "sequence": 0,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "total": 1
  },
  "message": "Category mappings fetched successfully"
}
```

#### POST /api/admin/category-food-mapping
Create a new category mapping or bulk create mappings

**Single Mapping:**
```json
{
  "foodItemId": "507f1f77bcf86cd799439011",
  "categoryId": "507f191e810c19729de860ea",
  "sequence": 0
}
```

**Bulk Mappings (replace all categories for a food item):**
```json
{
  "foodItemId": "507f1f77bcf86cd799439011",
  "categories": [
    { "categoryId": "507f191e810c19729de860ea", "sequence": 0 },
    { "categoryId": "507f191e810c19729de860eb", "sequence": 1 }
  ]
}
```

#### PUT /api/admin/category-food-mapping
Update sequence of a mapping

**Body:**
```json
{
  "_id": "mapping_id",
  "sequence": 5
}
```

#### DELETE /api/admin/category-food-mapping
Delete a category mapping

**Query Parameters:**
- `id` (optional): Delete single mapping by ID
- `foodItemId` (optional): Delete all mappings for a food item

**Examples:**
```bash
DELETE /api/admin/category-food-mapping?id=507f1f77bcf86cd799439011
DELETE /api/admin/category-food-mapping?foodItemId=507f1f77bcf86cd799439011
```

## Usage Examples

### Get all categories for a food item
```typescript
const mappings = await db.read<CategoryFoodMapping>(
  'categoryfoodmapping',
  { foodItemId: new ObjectId(foodItemId) },
  { sort: { sequence: 1 } }
);

const categoryIds = mappings.data?.map(m => m.categoryId.toString()) || [];
```

### Get all items in a category
```typescript
const mappings = await db.read<CategoryFoodMapping>(
  'categoryfoodmapping',
  { categoryId: new ObjectId(categoryId) },
  { sort: { sequence: 1 } }
);

const foodItemIds = mappings.data?.map(m => m.foodItemId) || [];
```

### Add a food item to a category
```typescript
const mapping: CategoryFoodMapping = {
  foodItemId: new ObjectId(foodItemId),
  categoryId: new ObjectId(categoryId),
  sequence: 0,
  createdAt: new Date(),
  updatedAt: new Date()
};

await db.create<CategoryFoodMapping>('categoryfoodmapping', mapping);
```

### Remove a food item from a category
```typescript
await db.delete<CategoryFoodMapping>('categoryfoodmapping', {
  foodItemId: new ObjectId(foodItemId),
  categoryId: new ObjectId(categoryId)
});
```

### Update category sequence for a food item
```typescript
// Delete old mappings
await db.delete<CategoryFoodMapping>('categoryfoodmapping', {
  foodItemId: new ObjectId(foodItemId)
});

// Create new mappings with updated sequence
const newMappings: CategoryFoodMapping[] = categoryIds.map((categoryId, index) => ({
  foodItemId: new ObjectId(foodItemId),
  categoryId: new ObjectId(categoryId),
  sequence: index,
  createdAt: new Date(),
  updatedAt: new Date()
}));

await db.createMany<CategoryFoodMapping>('categoryfoodmapping', newMappings);
```

## Integration with Existing Code

### Food Items API
The `/api/admin/food-items` endpoint now:
1. Ignores the `category` field in the fooditems collection during reads
2. Fetches categories from `categoryfoodmapping` collection
3. Attaches category IDs to the response for backward compatibility
4. Creates/updates `categoryfoodmapping` entries when creating/updating food items

### Food Categories API
The `/api/admin/food-category` endpoint now:
1. Calculates `itemCount` dynamically from `categoryfoodmapping` collection
2. Supports both 'flat' and 'day-wise' listing types
3. For 'flat' categories, items are managed through CategoryFoodMapping
4. For 'day-wise' categories, items are stored in the category's `dayWiseItems` array

## Rollback Procedure

If you need to rollback to the old structure:

1. **Backup current data:**
```bash
mongodump --db=your_db --collection=categoryfoodmapping --out=/backup/path
```

2. **Drop the CategoryFoodMapping collection:**
```javascript
db.categoryfoodmapping.drop()
```

3. **Restore category arrays in fooditems** (if you have a backup)

See `/api/admin/migrations/category-food-mapping/rollback` for automated rollback.

## Migration Scripts

### Run Migration
```bash
POST /api/admin/migrations/category-food-mapping/migrate
```

### Check Migration Status
```bash
GET /api/admin/migrations/category-food-mapping/status
```

### Rollback Migration
```bash
POST /api/admin/migrations/category-food-mapping/rollback
```

## Validation

### Before Migration
- Backup your database
- Ensure you have at least 2x free disk space for the migration

### After Migration
- Verify all food items have their categories mapped
- Check category item counts match expected values
- Test frontend functionality

## Performance Considerations

### Query Optimization
- Always use the indexed fields (`foodItemId`, `categoryId`) in queries
- Use projection to limit returned fields when possible
- Batch operations when creating/updating multiple mappings

### Cache Strategy
- Consider caching frequently accessed category mappings
- Invalidate cache when mappings are created/updated/deleted
- Use a TTL cache with 5-minute expiration

## Troubleshooting

### Common Issues

**Issue:** Duplicate mappings for same food item and category
**Solution:** The unique compound index prevents this. If you see duplicates, drop and recreate the index.

**Issue:** Slow queries when fetching all items in a category
**Solution:** Ensure the `categoryId` index exists. Use `.explain()` to analyze query performance.

**Issue:** Food items showing no categories after migration
**Solution:** Run the migration script again. Check the migration logs for errors.

## Support

For questions or issues related to this migration:
1. Check the migration logs in the console output
2. Review the audit trail in the migration result
3. Check the status endpoint: `GET /api/admin/migrations/category-food-mapping/status`

## Future Enhancements

Potential improvements for the future:
1. Add support for category-specific pricing
2. Add support for item availability per category
3. Implement soft deletes for mappings
4. Add audit logging for all mapping changes
5. Create materialized views for common queries
