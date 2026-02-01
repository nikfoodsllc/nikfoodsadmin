# CategoryFoodMapping Migration

## Overview

This migration creates a new `CategoryFoodMapping` collection to establish a many-to-many relationship between food items and categories, replacing the existing array-based approach in the `fooditems.category` field.

## Purpose

The current `fooditems` collection stores category references in an array field (`category: string[]`). This migration:

1. **Normalizes the data structure**: Creates a dedicated collection for category-food item relationships
2. **Enables efficient querying**: Adds indexes for fast lookups by food item or category
3. **Supports additional metadata**: Allows for sequence ordering and timestamps on each relationship
4. **Improves scalability**: Better suited for large-scale applications with complex category relationships

## New Collection Schema

### CategoryFoodMapping

```typescript
{
  _id: ObjectId,              // Auto-generated primary key
  foodItemId: ObjectId,       // Reference to fooditems._id
  categoryId: ObjectId,       // Reference to foodcategories._id
  sequence: number,           // Order within the category array (preserves original order)
  createdAt: Date,            // Timestamp when mapping was created
  updatedAt: Date             // Timestamp when mapping was last updated
}
```

## Indexes

The migration creates the following indexes for optimal query performance:

1. **`idx_foodItemId`**: Single-field index on `foodItemId`
   - Optimizes queries like: "Find all categories for a specific food item"

2. **`idx_categoryId`**: Single-field index on `categoryId`
   - Optimizes queries like: "Find all food items in a specific category"

3. **`idx_foodItemId_categoryId`**: Unique compound index on `foodItemId` and `categoryId`
   - Ensures no duplicate relationships
   - Optimizes queries that filter on both fields

## Migration Process

### Forward Migration

The forward migration:

1. **Checks existing state**: Verifies if the collection already exists and has data
2. **Fetches food items**: Retrieves all documents from the `fooditems` collection
3. **Transforms data**: Converts each category in the `category` array into a separate `CategoryFoodMapping` document
4. **Preserves order**: Uses the array index as the `sequence` value
5. **Inserts in batches**: Processes documents in batches of 1000 for performance
6. **Creates indexes**: Builds the three indexes listed above
7. **Validates results**: Verifies that all expected documents were created

### Rollback Migration

The rollback migration:

1. **Checks if collection exists**: Safely handles cases where the collection doesn't exist
2. **Drops the collection**: Removes the entire `categoryfoodmapping` collection and its indexes
3. **Logs the operation**: Provides audit trail of the rollback

## Usage

### Running the Migration

The migration is exposed via a REST API endpoint:

```bash
# Run the forward migration
POST /api/admin/migrations/category-food-mapping
Authorization: Bearer <admin-token>

# Check migration status
GET /api/admin/migrations/category-food-mapping
Authorization: Bearer <admin-token>

# Rollback the migration
DELETE /api/admin/migrations/category-food-mapping
Authorization: Bearer <admin-token>
```

### Example: Forward Migration Request

```bash
curl -X POST http://localhost:3000/api/admin/migrations/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**

```json
{
  "success": true,
  "message": "CategoryFoodMapping migration completed successfully",
  "data": {
    "totalProcessed": 150,
    "successfulMappings": 150,
    "failedMappings": 0,
    "errors": [],
    "indexesCreated": ["idx_foodItemId", "idx_categoryId", "idx_foodItemId_categoryId"],
    "status": {
      "collectionExists": true,
      "documentCount": 150,
      "indexes": ["_id_", "idx_foodItemId", "idx_categoryId", "idx_foodItemId_categoryId"]
    },
    "migrationPerformed": true
  }
}
```

### Example: Status Check Request

```bash
curl -X GET http://localhost:3000/api/admin/migrations/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Migration status retrieved successfully",
  "data": {
    "collectionExists": true,
    "documentCount": 150,
    "indexes": ["_id_", "idx_foodItemId", "idx_categoryId", "idx_foodItemId_categoryId"]
  }
}
```

### Example: Rollback Request

```bash
curl -X DELETE http://localhost:3000/api/admin/migrations/category-food-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "CategoryFoodMapping collection dropped successfully",
  "data": {
    "rollbackPerformed": true
  }
}
```

## Error Handling

The migration includes comprehensive error handling:

1. **Validation errors**: Invalid category IDs are logged and skipped
2. **Batch insert failures**: Errors during batch inserts are caught and reported
3. **Index creation failures**: Failures to create indexes are logged but don't fail the entire migration
4. **Verification failures**: Discrepancies between expected and actual document counts are reported

## Audit Trail

All migration operations are logged to the console with timestamps:

```
[2024-01-15T10:30:00.000Z] ✅ MIGRATION_START: Starting CategoryFoodMapping migration
[2024-01-15T10:30:00.100Z] ✅ CHECK_COLLECTION: Checking if collection 'categoryfoodmapping' exists
[2024-01-15T10:30:00.200Z] ✅ FETCH_FOODITEMS: Found 150 food items
[2024-01-15T10:30:00.300Z] ✅ TRANSFORM_DATA: Created 150 mapping documents from 150 food items
[2024-01-15T10:30:00.400Z] ✅ INSERT_DATA: Successfully inserted 150 mapping documents
[2024-01-15T10:30:00.500Z] ✅ CREATE_INDEX: Created index on foodItemId
[2024-01-15T10:30:00.600Z] ✅ CREATE_INDEX: Created index on categoryId
[2024-01-15T10:30:00.700Z] ✅ CREATE_INDEX: Created unique compound index on foodItemId and categoryId
[2024-01-15T10:30:00.800Z] ✅ VERIFY_MIGRATION: Verification successful: 150 documents in collection
[2024-01-15T10:30:00.900Z] ✅ MIGRATION_COMPLETE: Migration completed with 0 errors
```

## Transaction Support

The migration is designed to be atomic at the operation level:

- **Batch inserts**: Each batch of 1000 documents is inserted as a single atomic operation
- **Index creation**: Each index is created independently; failures don't affect other indexes
- **Verification**: Final verification ensures data integrity before marking the migration as successful

## Notes

- **Idempotent**: Running the migration multiple times is safe. It will skip if the collection already exists with data.
- **Non-destructive**: The migration does NOT modify or remove the original `fooditems.category` array. This allows for a gradual migration strategy.
- **Rollback safety**: The rollback completely removes the new collection but does NOT restore any data (since the original data is untouched).
- **Performance**: The migration processes documents in batches to manage memory usage and provide progress feedback.

## Post-Migration Steps

After running the migration successfully:

1. **Update application code**: Modify queries to use the new `CategoryFoodMapping` collection
2. **Test thoroughly**: Ensure all category-related functionality works with the new structure
3. **Monitor performance**: Check that the indexes provide the expected query performance improvements
4. **Plan cleanup**: Once confident, consider removing the `category` array from `fooditems` (in a separate migration)

## Support

For issues or questions about this migration, refer to:
- Migration script: `/src/lib/migrations/category-food-mapping.ts`
- API endpoint: `/src/app/api/admin/migrations/category-food-mapping/route.ts`
- Database utilities: `/src/lib/db.ts`
