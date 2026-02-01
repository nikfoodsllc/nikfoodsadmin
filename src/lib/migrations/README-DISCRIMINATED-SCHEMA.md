# CategoryFoodMapping Discriminated Schema Migration

This migration adds support for discriminated union schema to the CategoryFoodMapping collection, enabling both FLAT and DAY_WISE mapping types in a single collection.

## Overview

### What Changed?

The CategoryFoodMapping schema has been updated to use a discriminated union pattern with two mapping types:

1. **FLAT** - Standard flat listing where food items appear in category sequence
2. **DAY_WISE** - Day-wise listing where food items are organized by day (includes `day` field)

### Schema Changes

#### Before (Legacy Schema)
```typescript
interface CategoryFoodMapping {
  _id?: ObjectId | string;
  foodItemId: ObjectId;
  categoryId: ObjectId;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### After (Discriminated Schema)
```typescript
type MappingType = 'FLAT' | 'DAY_WISE';

interface BaseCategoryFoodMapping {
  _id?: ObjectId | string;
  foodItemId: ObjectId;
  categoryId: ObjectId;
  sequence: number;
  mappingType: MappingType;  // NEW FIELD
  createdAt?: Date;
  updatedAt?: Date;
}

interface FlatCategoryFoodMapping extends BaseCategoryFoodMapping {
  mappingType: 'FLAT';
}

interface DayWiseCategoryFoodMapping extends BaseCategoryFoodMapping {
  mappingType: 'DAY_WISE';
  day: string;  // e.g., "Monday", "Tuesday"
}

type CategoryFoodMapping = FlatCategoryFoodMapping | DayWiseCategoryFoodMapping;
```

### Example Documents

#### FLAT Mapping
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "foodItemId": "507f1f77bcf86cd799439012",
  "categoryId": "507f1f77bcf86cd799439013",
  "sequence": 0,
  "mappingType": "FLAT",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### DAY_WISE Mapping
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "foodItemId": "507f1f77bcf86cd799439015",
  "categoryId": "507f1f77bcf86cd799439016",
  "sequence": 0,
  "mappingType": "DAY_WISE",
  "day": "Monday",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Migration Steps

### 1. Check Migration Status

Before running the migration, check the current status:

```bash
curl -X GET http://localhost:3000/api/admin/migrations/category-food-mapping-discriminated
```

Response:
```json
{
  "success": true,
  "data": {
    "collectionExists": true,
    "totalDocuments": 1000,
    "migratedDocuments": 0,
    "legacyDocuments": 1000,
    "flatMappings": 0,
    "dayWiseMappings": 0,
    "indexes": ["idx_foodItemId", "idx_categoryId", "idx_foodItemId_categoryId"]
  }
}
```

### 2. Run Migration

Execute the migration to add `mappingType` field to all existing documents:

```bash
curl -X POST http://localhost:3000/api/admin/migrations/category-food-mapping-discriminated \
  -H "Content-Type: application/json" \
  -d '{"action": "migrate"}'
```

Response:
```json
{
  "success": true,
  "message": "Discriminated schema migration completed successfully",
  "data": {
    "totalDocuments": 1000,
    "migratedDocuments": 1000,
    "alreadyMigrated": 0,
    "flatMappings": 1000,
    "dayWiseMappings": 0,
    "errors": [],
    "indexesCreated": [
      "idx_mappingType",
      "idx_mappingType_categoryId",
      "idx_mappingType_foodItemId"
    ]
  }
}
```

**Note:** All existing documents will be defaulted to `mappingType: 'FLAT'`. DAY_WISE mappings must be created explicitly with the `day` field.

### 3. Verify Migration

After migration, verify the results:

```bash
curl -X GET http://localhost:3000/api/admin/migrations/category-food-mapping-discriminated
```

Response should show:
- `legacyDocuments: 0` (all documents migrated)
- `migratedDocuments: 1000` (all documents have mappingType)

## New Indexes Created

The migration creates the following indexes for efficient querying:

1. **idx_mappingType** - Index on mappingType field
2. **idx_mappingType_categoryId** - Compound index on mappingType + categoryId
3. **idx_mappingType_foodItemId** - Compound index on mappingType + foodItemId

## Usage Examples

### Creating FLAT Mappings

```typescript
import { validateCreateMapping, sanitizeMappingData } from '@/lib/validators/categoryFoodMapping';
import { db } from '@/lib/db';

// Validate FLAT mapping data
const validationResult = validateCreateMapping({
  foodItemId: '507f1f77bcf86cd799439012',
  categoryId: '507f1f77bcf86cd799439013',
  sequence: 0,
  mappingType: 'FLAT'
});

if (validationResult.isValid) {
  const sanitized = sanitizeMappingData(validationResult.data, 'create');
  await db.create('categoryfoodmapping', sanitized);
}
```

### Creating DAY_WISE Mappings

```typescript
// Validate DAY_WISE mapping data
const validationResult = validateCreateMapping({
  foodItemId: '507f1f77bcf86cd799439012',
  categoryId: '507f1f77bcf86cd799439013',
  sequence: 0,
  mappingType: 'DAY_WISE',
  day: 'Monday'
});

if (validationResult.isValid) {
  const sanitized = sanitizeMappingData(validationResult.data, 'create');
  await db.create('categoryfoodmapping', sanitized);
}
```

### Querying by Mapping Type

```typescript
// Get all FLAT mappings for a category
const flatMappings = await db.read('categoryfoodmapping', {
  categoryId: new ObjectId('...'),
  mappingType: 'FLAT'
});

// Get all DAY_WISE mappings for a specific day
const mondayMappings = await db.read('categoryfoodmapping', {
  mappingType: 'DAY_WISE',
  day: 'Monday'
});
```

### Using Type Guards

```typescript
import {
  isCategoryFoodMapping,
  isFlatMapping,
  isDayWiseMapping
} from '@/lib/validators/categoryFoodMapping';

// Check if document is any valid mapping
if (isCategoryFoodMapping(doc)) {
  console.log('Valid mapping');

  // Check specific type
  if (isFlatMapping(doc)) {
    console.log('FLAT mapping');
  } else if (isDayWiseMapping(doc)) {
    console.log('DAY_WISE mapping for', doc.day);
  }
}
```

## Rollback

If you need to rollback the migration:

```bash
curl -X POST http://localhost:3000/api/admin/migrations/category-food-mapping-discriminated \
  -H "Content-Type: application/json" \
  -d '{"action": "rollback"}'
```

**Warning:** Rollback will:
1. Remove the `mappingType` field from all documents
2. Remove the `day` field from DAY_WISE mappings (this data will be lost)
3. Drop the mappingType indexes

## Backward Compatibility

The validators maintain backward compatibility with legacy code:

- Legacy code that doesn't specify `mappingType` will default to `'FLAT'`
- Legacy bulk operations continue to work without modifications
- Existing queries continue to function as before

However, new code should explicitly specify `mappingType` for clarity.

## Testing

After migration, test the following:

1. **FLAT Mapping Creation**
   ```bash
   curl -X POST http://localhost:3000/api/admin/category-food-mapping \
     -H "Content-Type: application/json" \
     -d '{
       "foodItemId": "...",
       "categoryId": "...",
       "sequence": 0,
       "mappingType": "FLAT"
     }'
   ```

2. **DAY_WISE Mapping Creation**
   ```bash
   curl -X POST http://localhost:3000/api/admin/category-food-mapping \
     -H "Content-Type: application/json" \
     -d '{
       "foodItemId": "...",
       "categoryId": "...",
       "sequence": 0,
       "mappingType": "DAY_WISE",
       "day": "Monday"
     }'
   ```

3. **Query by Mapping Type**
   - Verify FLAT mappings return correctly
   - Verify DAY_WISE mappings with day filtering work correctly

## Migration Checklist

- [ ] Review migration status
- [ ] Backup database (recommended)
- [ ] Run migration in non-production environment first
- [ ] Execute migration
- [ ] Verify all documents have `mappingType` field
- [ ] Test FLAT mapping operations
- [ ] Test DAY_WISE mapping operations
- [ ] Verify indexes are created
- [ ] Monitor application logs for errors
- [ ] Update application code to use discriminated schema
- [ ] Document migration completion

## Troubleshooting

### Migration Fails Partway Through

The migration is idempotent - you can safely run it multiple times. Documents already migrated will be skipped.

### Missing Indexes After Migration

Check the migration response for `indexesCreated`. If indexes failed to create, you can create them manually:

```javascript
db.categoryfoodmapping.createIndex({ mappingType: 1 });
db.categoryfoodmapping.createIndex({ mappingType: 1, categoryId: 1 });
db.categoryfoodmapping.createIndex({ mappingType: 1, foodItemId: 1 });
```

### Validation Errors After Migration

Ensure your application code is updated to handle the new schema:

- Import types from `@/types/order`
- Use `validateCreateMapping` for new operations
- Include `mappingType` in create operations
- Handle the `day` field for DAY_WISE mappings

## Additional Resources

- Type definitions: `src/types/order.ts`
- Validators: `src/lib/validators/categoryFoodMapping.ts`
- Migration script: `src/lib/migrations/category-food-mapping-discriminated.ts`
- API endpoint: `src/app/api/admin/migrations/category-food-mapping-discriminated/route.ts`
