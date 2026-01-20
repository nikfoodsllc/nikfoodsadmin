# AvailableDates Documentation Index

## Overview

This directory contains comprehensive documentation for the new `availableDates` collection, which provides date-specific category listing type configuration for the food management system.

## Documentation Files

### 📘 Main Documentation

#### 1. [availableDates-collection.md](./availableDates-collection.md)
**Complete collection documentation**

This is the **primary reference document** for the `availableDates` collection.

**Contents:**
- Collection schema and field descriptions
- Database indexes and performance considerations
- API endpoints (GET, POST, PUT, DELETE)
- Request/response examples
- Error handling and validation
- Comparison with `availableDays` collection
- Common query examples
- Security considerations
- Best practices and troubleshooting

**Who should read:** Developers, administrators, and anyone implementing or using the `availableDates` feature.

---

#### 2. [availableDates-migration-guide.md](./availableDates-migration-guide.md)
**Step-by-step migration and setup guide**

Practical guide for setting up the `availableDates` collection.

**Contents:**
- Prerequisites and preparation
- Running the migration
- Seeding initial data (single and bulk operations)
- Verifying migration success
- Configuring category types
- Updating and deleting dates
- Rollback procedures
- Common migration scenarios
- Troubleshooting migration issues
- Data migration from other systems
- Maintenance and cleanup

**Who should read:** DevOps engineers, database administrators, and anyone setting up the feature for the first time.

---

#### 3. [availableDates-customer-app-compatibility.md](./availableDates-customer-app-compatibility.md)
**Customer app compatibility verification**

Verification document confirming customer app (TDN9IL) compatibility.

**Contents:**
- Executive summary
- Customer app endpoint analysis
- Separation of concerns (`availableDays` vs `availableDates`)
- Data flow diagrams
- Verification tests and results
- Compatibility matrix
- Risk assessment
- Future integration considerations
- Recommendations for developers and stakeholders

**Who should read:** Product managers, QA teams, developers, and stakeholders concerned about customer impact.

---

### 📗 Updated Documentation

#### 4. [database-structure.md](./database-structure.md)
**Complete database schema documentation**

Updated to include the `availableDates` collection.

**What's new:**
- Added `availableDates` to collections overview
- Section 6: Available Dates Collection documentation
- Schema, indexes, relationships, and API endpoints
- Key differences between `availableDays` and `availableDates`
- Customer app compatibility note

**Who should read:** Anyone needing an understanding of the complete database structure.

---

#### 5. [manage-days-page.md](./manage-days-page.md)
**Manage Days Page - User Interface Documentation**

Complete documentation for the Manage Days admin page (`/admin/manage-days`).

**What's included:**
- Page overview and current features (post-January 2026 simplification)
- Detailed description of removed features (help text, date filter, day list view, view toggle)
- User workflows and common use cases
- Visual design and layout structure
- API integration details
- Responsive design considerations
- Comparison with legacy features

**Who should read:** Front-end developers, UI/UX designers, and administrators using the Manage Days page.

---

## Quick Navigation

### By Role

#### For Developers
1. Start with: [availableDates-collection.md](./availableDates-collection.md)
2. Then: [availableDates-migration-guide.md](./availableDates-migration-guide.md)
3. Reference: [database-structure.md](./database-structure.md)
4. UI Implementation: [manage-days-page.md](./manage-days-page.md)

#### For Front-End Developers
1. Start with: [manage-days-page.md](./manage-days-page.md)
2. Then: [AVAILABILITY-CALENDAR-COMPONENT.md](../AVAILABILITY-CALENDAR-COMPONENT.md)
3. Reference: [availableDates-collection.md](./availableDates-collection.md) (API endpoints section)

#### For Database Administrators
1. Start with: [availableDates-migration-guide.md](./availableDates-migration-guide.md)
2. Reference: [availableDates-collection.md](./availableDates-collection.md)

#### For Product Managers/QA
1. Start with: [availableDates-customer-app-compatibility.md](./availableDates-customer-app-compatibility.md)
2. Then: [availableDates-collection.md](./availableDates-collection.md) (sections 1-4)
3. UI Changes: [manage-days-page.md](./manage-days-page.md)

#### For UI/UX Designers
1. Start with: [manage-days-page.md](./manage-days-page.md)
2. Then: [AVAILABILITY-CALENDAR-COMPONENT.md](../AVAILABILITY-CALENDAR-COMPONENT.md)

#### For Stakeholders
1. Start with: [availableDates-customer-app-compatibility.md](./availableDates-customer-app-compatibility.md)
2. Read: Executive summary and recommendations sections

---

### By Task

#### Understanding the Feature
→ [availableDates-collection.md](./availableDates-collection.md) - Sections: Overview, Purpose, Schema

#### Setting Up/Installing
→ [availableDates-migration-guide.md](./availableDates-migration-guide.md) - Steps 1-3

#### Using the API
→ [availableDates-collection.md](./availableDates-collection.md) - Section: API Endpoints

#### Troubleshooting Issues
→ [availableDates-collection.md](./availableDates-collection.md) - Section: Troubleshooting
→ [availableDates-migration-guide.md](./availableDates-migration-guide.md) - Section: Troubleshooting

#### Verifying Customer Impact
→ [availableDates-customer-app-compatibility.md](./availableDates-customer-app-compatibility.md) - Complete document

#### Understanding Database Changes
→ [database-structure.md](./database-structure.md) - Section 6: Available Dates Collection

#### Using the Manage Days UI
→ [manage-days-page.md](./manage-days-page.md) - Complete guide to the admin interface

#### Understanding UI Changes (January 2026)
→ [manage-days-page.md](./manage-days-page.md) - Section: Recent Changes

---

## Key Concepts

### availableDates vs availableDays

| Aspect | availableDays | availableDates |
|--------|---------------|----------------|
| **Granularity** | Day of week (Monday) | Specific date (2024-01-15) |
| **Recurrence** | Every week | One-time |
| **Access** | Admin + Customer | Admin only |
| **Purpose** | Weekly operations | Date-specific configuration |
| **Collection** | `availableDays` | `availableDates` |

**Key Point:** These are **separate collections** with different purposes. Customer app uses `availableDays` and is **unaffected** by `availableDates`.

---

## API Endpoint Summary

### availableDates Endpoints (Admin Only)

```
GET    /api/admin/available-dates           # Fetch dates by range
POST   /api/admin/available-dates           # Create/upsert single date
PUT    /api/admin/available-dates           # Bulk update
DELETE /api/admin/available-dates           # Delete dates by range
POST   /api/admin/migrations/available-dates # Run/rollback migration
```

### availableDays Endpoints (Admin + Customer)

```
# Admin endpoints
GET    /api/admin/days                      # Manage weekly days
POST   /api/admin/days                      # Update day settings

# Customer endpoints (unchanged)
GET    /api/days                            # Get enabled days
GET    /api/enabled-days                    # Get enabled day names
```

---

## Common Use Cases

### 1. Holiday Configuration
Disable day-wise categories on Christmas:
```json
{
  "date": "2024-12-25",
  "flatCategoryEnabled": true,
  "dayWiseCategoryEnabled": false
}
```

### 2. Special Promotion
Enable both category types for a promotional event:
```json
{
  "date": "2024-02-14",
  "flatCategoryEnabled": true,
  "dayWiseCategoryEnabled": true
}
```

### 3. Seasonal Changes
Configure summer months with day-wise only:
```json
{
  "date": "2024-07-15",
  "flatCategoryEnabled": false,
  "dayWiseCategoryEnabled": true
}
```

---

## Getting Started

### Quick Start (3 Steps)

1. **Run Migration:**
   ```bash
   curl -X POST "http://localhost:3000/api/admin/migrations/available-dates" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

2. **Create a Date:**
   ```bash
   curl -X POST "http://localhost:3000/api/admin/available-dates" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"date":"2024-01-15","flatCategoryEnabled":true,"dayWiseCategoryEnabled":true}'
   ```

3. **Verify:**
   ```bash
   curl -X GET "http://localhost:3000/api/admin/available-dates" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

**Detailed Guide:** See [availableDates-migration-guide.md](./availableDates-migration-guide.md)

---

## Important Notes

### ✅ What Works

- ✅ All API endpoints implemented and tested
- ✅ Admin authentication and authorization
- ✅ Comprehensive input validation
- ✅ Optimized database indexes
- ✅ Bulk operations support
- ✅ Migration and rollback capabilities
- ✅ Customer app fully compatible (no changes needed)

### ⏳ What's Next

- ⏳ Integration with category filtering logic
- ⏳ Promotional features based on date settings
- ⏳ Automated date configuration tools
- ⏳ Advanced filtering options in UI

### ❌ What's NOT Needed

- ❌ No changes to customer app (TDN9IL)
- ❌ No database migration for existing data
- ❌ No breaking changes to existing APIs
- ❌ No customer-facing feature changes (yet)

---

## Support and Feedback

### Questions or Issues?

1. **Check documentation first:**
   - [availableDates-collection.md](./availableDates-collection.md) - Troubleshooting section
   - [availableDates-migration-guide.md](./availableDates-migration-guide.md) - Common issues

2. **Verify customer app compatibility:**
   - [availableDates-customer-app-compatibility.md](./availableDates-customer-app-compatibility.md)

3. **Contact development team:**
   - Provide error messages and steps to reproduce
   - Include relevant logs and API responses

### Contributing

When updating documentation:
1. Keep this index file updated
2. Maintain consistent formatting
3. Include examples and use cases
4. Update all related documents

---

## Document Versions

| Document | Version | Last Updated |
|----------|---------|--------------|
| availableDates-collection.md | 1.0.0 | 2024-01-03 |
| availableDates-migration-guide.md | 1.0.0 | 2024-01-03 |
| availableDates-customer-app-compatibility.md | 1.0.0 | 2024-01-03 |
| database-structure.md | 2.0.0 | 2024-01-03 |
| manage-days-page.md | 2.0.0 | 2026-01-03 |

---

## Summary

The `availableDates` collection provides **date-specific category configuration** capabilities while maintaining **full backward compatibility** with the existing customer application.

**Key Benefits:**
- 🎯 Date-specific control over category types
- 🔒 Admin-only access (no customer impact)
- 📅 Perfect for holidays and special events
- 🔄 Easy bulk operations
- ✅ Fully documented and tested

**Documentation is complete and ready for use!**

---

**Last Updated:** 2024-01-03
**Documentation Version:** 1.0.0
