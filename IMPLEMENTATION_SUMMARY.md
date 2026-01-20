# Category-Food Mapping API Implementation Summary

## Overview

Successfully updated the Category-Food Mapping API endpoints to support both **FLAT** and **DAY_WISE** mapping types with full backward compatibility.

---

## Changes Made

### 1. Updated Base Endpoint (`/api/admin/category-food-mapping/route.ts`)

#### Imports
- Added discriminated union types from `@/types/order`
- Added validation utilities from `@/lib/validators/categoryFoodMapping`

#### GET Endpoint Enhancements
- ✅ Added `mappingType` query parameter filter (`'FLAT'` or `'DAY_WISE'`)
- ✅ Added `day` query parameter filter (for DAY_WISE mappings)
- ✅ Enhanced response to include separate arrays for FLAT and DAY_WISE mappings
- ✅ Added count statistics for each mapping type
- **Backward Compatible**: Existing queries without mappingType continue to work

#### POST Endpoint Enhancements
- ✅ Support for creating FLAT mappings with explicit `mappingType: 'FLAT'`
- ✅ Support for creating DAY_WISE mappings with `mappingType: 'DAY_WISE'` and `day` field
- ✅ Bulk operations now respect `mappingType` filter
- ✅ Separate handling for FLAT vs DAY_WISE mappings during creation
- ✅ Duplicate checking respects mapping type (allows both FLAT and DAY_WISE for same food item + category)
- **Backward Compatible**: Requests without `mappingType` default to `'FLAT'`

#### PUT Endpoint Enhancements
- ✅ Support for updating both `sequence` and `day` fields
- ✅ Validation to ensure `day` field is only updated for DAY_WISE mappings
- ✅ Flexible updates (can update sequence, day, or both)

#### DELETE Endpoint Enhancements
- ✅ Added `mappingType` filter to delete specific mapping types
- ✅ Added `day` filter to delete specific DAY_WISE mappings
- ✅ Preserves other mapping types when deleting (e.g., delete only FLAT, keep DAY_WISE)
- **Backward Compatible**: Existing delete operations without filters continue to work

---

### 2. New Day-Wise Endpoint (`/api/admin/category-food-mapping/daywise/route.ts`)

Created a specialized endpoint for convenient DAY_WISE operations:

#### GET /api/admin/category-food-mapping/daywise
- Retrieves all DAY_WISE mappings
- Optional filters: `day`, `categoryId`, `foodItemId`
- Automatic grouping by day in response
- Sorted by day name and sequence

#### POST /api/admin/category-food-mapping/daywise
- **Format 1**: Bulk create array of DAY_WISE mappings
- **Format 2**: Single food item assigned to multiple days
- Validates all mappings before insertion
- Duplicate checking for existing DAY_WISE mappings
- Returns count of successfully created mappings

#### DELETE /api/admin/category-food-mapping/daywise
- Delete single mapping by ID
- Delete all mappings for a specific day
- Delete all mappings for a category or food item
- Ensures only DAY_WISE mappings are affected

---

## Data Models

### FLAT Mapping
```typescript
{
  _id: ObjectId,
  foodItemId: ObjectId,
  categoryId: ObjectId,
  sequence: number,
  mappingType: 'FLAT',
  createdAt: Date,
  updatedAt: Date
}
```

### DAY_WISE Mapping
```typescript
{
  _id: ObjectId,
  foodItemId: ObjectId,
  categoryId: ObjectId,
  sequence: number,
  mappingType: 'DAY_WISE',
  day: string,  // e.g., "Monday", "Tuesday", etc.
  createdAt: Date,
  updatedAt: Date
}
```

---

## Backward Compatibility

### Guaranteed Backward Compatibility

1. **Existing API Calls**: All existing API consumers continue to work without changes
2. **Default Behavior**: Requests without `mappingType` default to `'FLAT'`
3. **Response Structure**: New fields are additive, don't break existing parsing
4. **Migration Path**: Existing documents without `mappingType` are migrated to `'FLAT'`

### Legacy Schema Support
```typescript
// This still works and defaults to FLAT
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "sequence": 0
}
```

---

## Validation & Type Safety

### Zod Schemas
- `createFlatMappingSchema`: Validates FLAT mapping creation
- `createDayWiseMappingSchema`: Validates DAY_WISE mapping creation
- `createMappingSchema`: Discriminated union for both types
- `bulkFlatMappingSchema`: Bulk FLAT mapping validation
- `bulkDayWiseMappingSchema`: Bulk DAY_WISE mapping validation
- `bulkMappingSchema`: Discriminated union for bulk operations

### Type Guards
- `isFlatMapping()`: Type guard for FLAT mappings
- `isDayWiseMapping()`: Type guard for DAY_WISE mappings
- `isCategoryFoodMapping()`: Type guard for any mapping type

### Validation Functions
- `validateCreateMapping()`: Validates single mapping creation
- `validateBulkMapping()`: Validates bulk mapping operations
- `validateMappingUniqueness()`: Checks for duplicate mappings
- `sanitizeMappingData()`: Prepares data for database operations

---

## API Usage Examples

### Creating FLAT Mappings
```bash
# Single FLAT mapping
POST /api/admin/category-food-mapping
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "mappingType": "FLAT",
  "sequence": 0
}

# Bulk FLAT mappings
POST /api/admin/category-food-mapping
{
  "foodItemId": "food123",
  "mappingType": "FLAT",
  "categories": [
    { "categoryId": "cat456", "sequence": 0 },
    { "categoryId": "cat789", "sequence": 1 }
  ]
}
```

### Creating DAY_WISE Mappings
```bash
# Using day-wise endpoint (recommended)
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

# Using base endpoint
POST /api/admin/category-food-mapping
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "mappingType": "DAY_WISE",
  "day": "Monday",
  "sequence": 0
}
```

### Querying Mappings
```bash
# Get all mappings for a food item
GET /api/admin/category-food-mapping?foodItemId=food123

# Get only FLAT mappings
GET /api/admin/category-food-mapping?foodItemId=food123&mappingType=FLAT

# Get only DAY_WISE mappings
GET /api/admin/category-food-mapping?foodItemId=food123&mappingType=DAY_WISE

# Get Monday mappings
GET /api/admin/category-food-mapping?foodItemId=food123&day=Monday

# Get all DAY_WISE mappings grouped by day
GET /api/admin/category-food-mapping/daywise?categoryId=cat456
```

### Updating Mappings
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
```

### Deleting Mappings
```bash
# Delete single mapping
DELETE /api/admin/category-food-mapping?id=mapping123

# Delete all FLAT mappings for a food item
DELETE /api/admin/category-food-mapping?foodItemId=food123&mappingType=FLAT

# Delete all Monday mappings
DELETE /api/admin/category-food-mapping?foodItemId=food123&day=Monday

# Delete all day-wise mappings for a category
DELETE /api/admin/category-food-mapping/daywise?categoryId=cat456
```

---

## Key Features

### 1. Coexistence of Mapping Types
A food item can have both FLAT and DAY_WISE mappings for the same or different categories:
```typescript
// Food item in main menu (FLAT) + weekly specials (DAY_WISE)
food123 -> cat456 (FLAT)
food123 -> cat456 (DAY_WISE, Monday)
food123 -> cat789 (FLAT)
```

### 2. Flexible Filtering
Query by any combination of:
- Food item ID
- Category ID
- Mapping type (FLAT or DAY_WISE)
- Day (for DAY_WISE mappings)

### 3. Bulk Operations
Efficient bulk create/delete operations:
```bash
# Assign food item to multiple days at once
POST /api/admin/category-food-mapping/daywise
{
  "foodItemId": "food123",
  "categoryId": "cat456",
  "days": [
    { "day": "Monday", "sequence": 0 },
    { "day": "Tuesday", "sequence": 0 }
  ]
}
```

### 4. Enhanced Responses
GET responses include:
- All mappings (mixed FLAT and DAY_WISE)
- Separate arrays for FLAT and DAY_WISE mappings
- Count statistics for each type
- Grouped by day (for day-wise endpoint)

---

## Database Considerations

### Indexes Created
1. `idx_mappingType` on `mappingType` field
2. `idx_mappingType_categoryId` on `mappingType + categoryId`
3. `idx_mappingType_foodItemId` on `mappingType + foodItemId`
4. Existing indexes remain intact

### Migration Path
Existing documents without `mappingType` are migrated to `'FLAT'` via:
```bash
POST /api/admin/migrations/category-food-mapping-discriminated
```

---

## Testing Recommendations

### Unit Tests
- Test FLAT mapping creation
- Test DAY_WISE mapping creation
- Test bulk operations for both types
- Test filtering by mapping type and day
- Test backward compatibility (requests without mappingType)

### Integration Tests
- Test end-to-end workflows
- Test concurrent operations
- Test migration script
- Test type guard functions

### Manual Testing
1. Create FLAT mappings using legacy format (should default to FLAT)
2. Create FLAT mappings with explicit mappingType
3. Create DAY_WISE mappings
4. Query with various filters
5. Update mappings
6. Delete mappings with filters

---

## Documentation

### Files Created
1. `CATEGORY_FOOD_MAPPING_API.md` - Comprehensive API documentation
2. `src/app/api/admin/category-food-mapping/daywise/route.ts` - Day-wise operations endpoint

### Files Updated
1. `src/app/api/admin/category-food-mapping/route.ts` - Enhanced base endpoint

### Existing Files Referenced
1. `src/types/order.ts` - Type definitions
2. `src/lib/validators/categoryFoodMapping.ts` - Validation utilities
3. `src/lib/migrations/category-food-mapping-discriminated.ts` - Migration script

---

## Next Steps

1. **Run Migration**: Execute the migration script to add `mappingType` to existing documents
2. **Test**: Test all endpoints with various scenarios
3. **Monitor**: Monitor performance with new indexes
4. **Update Clients**: Gradually update client applications to use explicit `mappingType`

---

## Support

For questions or issues:
- Review `CATEGORY_FOOD_MAPPING_API.md` for detailed API documentation
- Check type definitions in `src/types/order.ts`
- Refer to validation utilities in `src/lib/validators/categoryFoodMapping.ts`

---

## Summary

✅ **Successfully implemented** FLAT and DAY_WISE mapping types support
✅ **Maintained full backward compatibility** with existing API consumers
✅ **Added convenient day-wise endpoint** for specialized operations
✅ **Enhanced filtering capabilities** with mappingType and day parameters
✅ **Comprehensive validation** using Zod schemas and type guards
✅ **Detailed API documentation** for developers

The Category-Food Mapping API now supports flexible food item organization strategies while maintaining complete backward compatibility with existing code.
