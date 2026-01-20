# AvailableDates Migration Guide

## Overview

This guide provides step-by-step instructions for setting up and managing the `availableDates` collection in your MongoDB database. The `availableDates` collection allows administrators to configure category listing types (flat and day-wise) for specific calendar dates.

## Prerequisites

Before starting the migration, ensure you have:

- ✅ MongoDB database access
- ✅ Admin JWT token (for API authentication)
- ✅ Node.js/Next.js application running
- ✅ Access to the admin API endpoints

## Step 1: Run the Migration

### 1.1. Prepare Your Admin Token

First, obtain a valid admin JWT token by logging in to the admin application:

```bash
# Example login request (adjust to your login endpoint)
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_admin_password"
  }'
```

Save the returned token for subsequent requests.

### 1.2. Execute Migration

Run the migration to create the `availableDates` collection and indexes:

```bash
curl -X POST "http://localhost:3000/api/admin/migrations/available-dates?action=migrate" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response:**

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

### 1.3. Verify Migration

Connect to your MongoDB database and verify the collection was created:

```javascript
// MongoDB shell
use your_database_name;
show collections;

// Verify availableDates collection exists
db.availableDates.countDocuments();

// Check indexes
db.availableDates.getIndexes();
```

**Expected Output:**

```
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { date: 1 }, name: 'date_unique_index', unique: true },
  { v: 2, key: { flatCategoryEnabled: 1 }, name: 'flatCategoryEnabled_index' },
  { v: 2, key: { dayWiseCategoryEnabled: 1 }, name: 'dayWiseCategoryEnabled_index' },
  { v: 2, key: { date: 1 }, name: 'date_range_index' }
]
```

## Step 2: Seed Initial Data

### 2.1. Create a Single Date

Create a date configuration for a specific day:

```bash
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": true
  }'
```

**Expected Response (201 Created):**

```json
{
  "data": {
    "id": "659c12345678901234567890",
    "date": "2024-01-15",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": true,
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-10T10:00:00.000Z"
  },
  "message": "Date created successfully"
}
```

### 2.2. Bulk Create Dates for a Week

Use the PUT endpoint to create multiple dates at once:

```bash
curl -X PUT "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
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

**Expected Response:**

```json
{
  "data": {
    "updated": [
      {
        "id": "659c12345678901234567890",
        "date": "2024-01-15",
        "flatCategoryEnabled": true,
        "dayWiseCategoryEnabled": true,
        "createdAt": "2024-01-10T10:00:00.000Z",
        "updatedAt": "2024-01-10T10:00:00.000Z"
      }
      // ... more dates
    ],
    "deletedCount": 0,
    "createdCount": 7
  },
  "message": "Bulk update completed. 0 deleted, 7 created"
}
```

### 2.3. Seed Dates for a Month

Create a script to seed dates for an entire month:

```javascript
// seed-dates.js
const axios = require('axios');

const TOKEN = 'YOUR_ADMIN_JWT_TOKEN';
const BASE_URL = 'http://localhost:3000/api/admin/available-dates';

async function seedMonth(year, month) {
  const dates = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dates.push({
      date: dateStr,
      flatCategoryEnabled: true,
      dayWiseCategoryEnabled: true
    });
  }

  try {
    const response = await axios.put(BASE_URL, {
      dates,
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`
    }, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Seed January 2024
seedMonth(2024, 1);
```

Run the script:

```bash
node seed-dates.js
```

## Step 3: Verify Data

### 3.1. Query All Dates

```bash
curl -X GET "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

### 3.2. Query Specific Date Range

```bash
curl -X GET "http://localhost:3000/api/admin/available-dates?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

### 3.3. Check Database Directly

```javascript
// MongoDB shell
db.availableDates.find({}).sort({ date: 1 }).limit(5);

// Count total dates
db.availableDates.countDocuments();

// Check specific date
db.availableDates.findOne({ date: "2024-01-15" });
```

## Step 4: Configure Category Types

### 4.1. Enable Only Flat Categories

For dates where you only want flat category listings:

```bash
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-12-25",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": false
  }'
```

**Use Case:** Holiday with simplified menu (flat categories only).

### 4.2. Enable Only Day-Wise Categories

For dates where you only want day-wise category listings:

```bash
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-12-25",
    "flatCategoryEnabled": false,
    "dayWiseCategoryEnabled": true
  }'
```

**Use Case:** Special event with day-specific menus.

### 4.3. Enable Both Categories

For normal operation with both category types:

```bash
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": true
  }'
```

**Use Case:** Regular business day with full menu options.

## Step 5: Update Existing Dates

### 5.1. Update Single Date

Use the POST endpoint to update an existing date (upsert):

```bash
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "flatCategoryEnabled": false,
    "dayWiseCategoryEnabled": true
  }'
```

**Expected Response (200 OK):**

```json
{
  "data": {
    "id": "659c12345678901234567890",
    "date": "2024-01-15",
    "flatCategoryEnabled": false,
    "dayWiseCategoryEnabled": true,
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-11T14:30:00.000Z"
  },
  "message": "Date updated successfully"
}
```

### 5.2. Bulk Replace Dates in Range

Replace all dates in a range with new configurations:

```bash
curl -X PUT "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dates": [
      {"date": "2024-01-20", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": false},
      {"date": "2024-01-21", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": false}
    ],
    "startDate": "2024-01-20",
    "endDate": "2024-01-21"
  }'
```

**Expected Response:**

```json
{
  "data": {
    "updated": [...],
    "deletedCount": 2,
    "createdCount": 2
  },
  "message": "Bulk update completed. 2 deleted, 2 created"
}
```

## Step 6: Delete Dates

### 6.1. Delete Single Date (by Range)

To delete a single date, use the DELETE endpoint with same start and end date:

```bash
curl -X DELETE "http://localhost:3000/api/admin/available-dates?startDate=2024-01-15&endDate=2024-01-15" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response:**

```json
{
  "data": {
    "deletedCount": 1,
    "startDate": "2024-01-15",
    "endDate": "2024-01-15"
  },
  "message": "1 date(s) deleted successfully"
}
```

### 6.2. Delete Date Range

Delete all dates within a range:

```bash
curl -X DELETE "http://localhost:3000/api/admin/available-dates?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response:**

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

## Rollback Procedure

If you need to remove the entire collection and start over:

### 1. Rollback Migration

```bash
curl -X POST "http://localhost:3000/api/admin/migrations/available-dates?action=rollback" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response:**

```json
{
  "data": {
    "collectionDeleted": true,
    "indexesDropped": ["date_unique_index", "flatCategoryEnabled_index", "dayWiseCategoryEnabled_index", "date_range_index"]
  },
  "message": "AvailableDates collection rollback completed successfully"
}
```

### 2. Verify Rollback

```javascript
// MongoDB shell - collection should not exist
db.availableDates.countDocuments(); // Should return 0 or error
```

### 3. Re-migrate (if needed)

Follow Step 1 again to re-create the collection.

## Common Migration Scenarios

### Scenario 1: Holiday Configuration

Configure Christmas Day with only flat categories:

```bash
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-12-25",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": false
  }'
```

### Scenario 2: Promotional Event

Enable both category types for a promotional week:

```bash
curl -X PUT "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dates": [
      {"date": "2024-02-14", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": true},
      {"date": "2024-02-15", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": true},
      {"date": "2024-02-16", "flatCategoryEnabled": true, "dayWiseCategoryEnabled": true}
    ]
  }'
```

### Scenario 3: Seasonal Changes

Configure different category types for summer months:

```javascript
// Using Node.js script
const summerMonths = [6, 7, 8]; // June, July, August
const dates = [];

for (const month of summerMonths) {
  const daysInMonth = new Date(2024, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dates.push({
      date: dateStr,
      flatCategoryEnabled: false, // Summer: only day-wise
      dayWiseCategoryEnabled: true
    });
  }
}

// Send via PUT endpoint
```

## Troubleshooting

### Issue: Migration Fails

**Error:** "Collection already exists"

**Solution:**
```bash
# Rollback first, then migrate again
curl -X POST "http://localhost:3000/api/admin/migrations/available-dates?action=rollback" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

curl -X POST "http://localhost:3000/api/admin/migrations/available-dates?action=migrate" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

### Issue: Duplicate Date Error

**Error:** "Date already exists" (409 Conflict)

**Solution:**
```bash
# Use POST to update instead of creating
curl -X POST "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "flatCategoryEnabled": true,
    "dayWiseCategoryEnabled": false
  }'
```

### Issue: Invalid Date Format

**Error:** "Invalid date format. Must be YYYY-MM-DD"

**Solution:**
Ensure dates are in strict YYYY-MM-DD format:
- ✅ Correct: "2024-01-15"
- ❌ Incorrect: "01-15-2024", "2024/01/15", "2024-1-5"

### Issue: Bulk Operation Partial Failure

**Error:** Some dates created, some failed

**Solution:**
Check the response `errors` array and `createdCount`:
```json
{
  "data": {
    "updated": [...],
    "deletedCount": 5,
    "createdCount": 3,
    "errors": ["Invalid date format for 2024-13-01"]
  }
}
```

Fix the invalid dates and retry.

## Data Migration from Other Systems

If you're migrating date configurations from another system:

### 1. Export Existing Data

From your existing system, export date configurations to CSV/JSON:

```csv
date,flatEnabled,dayWiseEnabled
2024-01-15,true,true
2024-01-16,false,true
```

### 2. Transform to API Format

Convert to API-compatible JSON:

```javascript
const csvData = `date,flatEnabled,dayWiseEnabled
2024-01-15,true,true
2024-01-16,false,true`;

const lines = csvData.split('\n').slice(1);
const dates = lines.map(line => {
  const [date, flatEnabled, dayWiseEnabled] = line.split(',');
  return {
    date,
    flatCategoryEnabled: flatEnabled === 'true',
    dayWiseCategoryEnabled: dayWiseEnabled === 'true'
  };
});

// Use PUT endpoint to migrate
```

### 3. Import via API

```bash
curl -X PUT "http://localhost:3000/api/admin/available-dates" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @dates.json
```

## Validation Checklist

After migration, verify the following:

- [ ] Collection `availableDates` exists in MongoDB
- [ ] All indexes are created (4 indexes total)
- [ ] Can create a single date via POST
- [ ] Can query dates via GET
- [ ] Can bulk update via PUT
- [ ] Can delete dates via DELETE
- [ ] Unique constraint prevents duplicate dates
- [ ] Date format validation works
- [ ] Boolean validation works
- [ ] Admin authentication is required

## Post-Migration Steps

### 1. Configure Admin UI

Build or update admin UI to manage dates:
- Calendar view for date selection
- Toggle switches for category types
- Bulk configuration options
- Validation feedback

### 2. Set Up Monitoring

Monitor the collection:
- Query performance
- Index usage
- Data growth rate
- Error rates

### 3. Document Processes

Create internal documentation:
- Standard operating procedures
- Common scenarios
- Troubleshooting guide
- Contact information

### 4. Train Administrators

Train admin users:
- How to use the API
- Common configuration patterns
- Best practices
- Error handling

## Maintenance

### Regular Tasks

1. **Review Upcoming Dates**: Check dates for next 30 days
2. **Clean Old Dates**: Remove dates older than 6 months
3. **Validate Data**: Ensure no invalid dates exist
4. **Monitor Performance**: Check query times

### Cleanup Script

```javascript
// clean-old-dates.js
const axios = require('axios');

const TOKEN = 'YOUR_ADMIN_JWT_TOKEN';
const BASE_URL = 'http://localhost:3000/api/admin/available-dates';

async function cleanOldDates() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoffDate = sixMonthsAgo.toISOString().split('T')[0];

  try {
    const response = await axios.delete(BASE_URL, {
      params: {
        startDate: '2020-01-01',
        endDate: cutoffDate
      },
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    console.log('Cleanup complete:', response.data);
  } catch (error) {
    console.error('Cleanup failed:', error.response?.data || error.message);
  }
}

cleanOldDates();
```

## Summary

The `availableDates` collection migration provides:

- ✅ Date-specific category configuration
- ✅ Admin-only API endpoints
- ✅ Comprehensive validation and error handling
- ✅ Optimized database indexes
- ✅ Bulk operation support
- ✅ No impact on customer-facing app

For additional details, refer to:
- `/docs/availableDates-collection.md` - Complete API documentation
- `/docs/database-structure.md` - Database schema overview
- `/src/lib/migrations/README-AVAILABLE-DATES.md` - Technical API details

---

**Last Updated:** 2024-01-03
**Version:** 1.0.0
