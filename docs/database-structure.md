# Database Structure Documentation

## Overview

This document provides a comprehensive overview of the database structure for the food management system. The system uses MongoDB as the primary database and follows a document-based architecture with clear relationships between collections.

## Collections Overview

The database consists of the following main collections:

- **users** - User accounts and authentication data
- **addresses** - User delivery addresses
- **fooditems** - Food items catalog with pricing and categorization
- **foodcategories** - Food categories with flat and day-wise listing options
- **availableDays** - Configuration for available delivery days (weekly recurring)
- **availableDates** - Configuration for specific calendar dates with category type settings
- **weeklymenu** - Weekly menu planning and organization
- **orders** - Customer orders and order management
- **zipcodes** - Delivery zones and minimum cart value configuration

---

## 1. Users Collection (`users`)

### Purpose
Stores user account information including authentication data, roles, and user profile details.

### Schema
```typescript
interface UserDocument {
  _id?: ObjectId;                    // MongoDB document ID
  email: string;                     // User email (unique)
  password: string;                  // Hashed password
  role: 'ADMIN' | 'USER';           // User role for access control
  name?: string;                     // Display name
  phone?: string;                    // Phone number
  isActive?: boolean;                // Account status (default: true)
  isCompleted?: boolean;             // Profile completion status
  provider?: string;                 // OAuth provider (if applicable)
  addresses?: ObjectId[];            // References to addresses collection
  createdAt?: Date;                  // Account creation timestamp
  updatedAt?: Date;                  // Last update timestamp
}
```

### Relationships
- One-to-many with `addresses` collection via `addresses` field
- One-to-many with `orders` collection via user ID

### Example Document
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7k8",
  "email": "customer@example.com",
  "password": "$2b$10$hashedPassword...",
  "role": "USER",
  "name": "John Doe",
  "phone": "+1234567890",
  "isActive": true,
  "isCompleted": true,
  "addresses": ["65a7b8c9d1e2f3g4h5i6j7k9"],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

## 2. Addresses Collection (`addresses`)

### Purpose
Stores delivery addresses associated with users for order fulfillment.

### Schema
```typescript
interface Address {
  _id?: ObjectId;                    // MongoDB document ID
  user: ObjectId;                    // Reference to users collection
  name: string;                      // Address label/name
  location_remark?: string;          // Additional location notes
  phone?: string;                    // Contact phone for delivery
  email: string;                     // Contact email for delivery
  street_address: string;            // Street address
  city: string;                      // City name
  province?: string;                 // State/province
  postal_code: string;               // ZIP/postal code
  apartment?: string;                // Apartment/unit number
  floor?: string;                    // Floor number
  entrance?: string;                 // Entrance/building entrance
  notes?: string;                    // Delivery instructions
  createdAt?: Date;                  // Address creation timestamp
  updatedAt?: Date;                  // Last update timestamp
}
```

### Relationships
- Many-to-one with `users` collection via `user` field
- Referenced by `orders` collection for delivery information

### Example Document
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7k9",
  "user": "65a7b8c9d1e2f3g4h5i6j7k8",
  "name": "Home",
  "location_remark": "Near the main gate",
  "phone": "+1234567890",
  "email": "customer@example.com",
  "street_address": "123 Main Street",
  "city": "New York",
  "province": "NY",
  "postal_code": "10001",
  "apartment": "4B",
  "floor": "4",
  "entrance": "Main",
  "notes": "Please call upon arrival",
  "createdAt": "2024-01-15T10:35:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

---

## 3. Food Items Collection (`fooditems`)

### Purpose
Stores the complete catalog of food items with pricing, categorization, and configuration details.

### Schema
```typescript
interface FoodItem {
  _id?: ObjectId;                    // MongoDB document ID
  name: string;                      // Food item name
  itemType: 'simple' | 'portions' | 'combo';  // Item type
  description?: string;              // Item description
  image?: string;                    // Image URL
  category?: string;                 // Category reference
  price?: number;                    // Base price (for simple items)
  portions?: string[];               // Portion names (for portions items)
  portionPrices?: number[];          // Portion prices (for portions items)
  spiceLevel?: string;               // Spice level indicator
  // For combo items only
  sections?: Array<{
    title: string;                   // Section name
    selectedItems: Array<{
      item: string;                  // Item ID reference
      portion?: string;              // Portion selection
      price: number;                 // Item price
      portionId: string;             // Portion identifier
      isDefault?: boolean;           // Default selection flag
      isAvailable?: boolean;         // Availability status
    }>;
    sequence?: number;               // Display order
  }>;
  createdAt?: Date;                  // Item creation timestamp
  updatedAt?: Date;                  // Last update timestamp
}
```

### Relationships
- Many-to-one with `foodcategories` via `category` field
- Referenced by `weeklymenu` collection
- Referenced by `orders` collection (as snapshots)

### Example Documents

#### Simple Item
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7l0",
  "name": "Grilled Chicken Sandwich",
  "itemType": "simple",
  "description": "Juicy grilled chicken with fresh vegetables",
  "image": "https://example.com/images/sandwich.jpg",
  "category": "65a7b8c9d1e2f3g4h5i6j7m0",
  "price": 12.99,
  "spiceLevel": "Medium",
  "createdAt": "2024-01-15T10:40:00Z",
  "updatedAt": "2024-01-15T10:40:00Z"
}
```

#### Portions Item
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7l1",
  "name": "Pasta Primavera",
  "itemType": "portions",
  "description": "Fresh pasta with seasonal vegetables",
  "image": "https://example.com/images/pasta.jpg",
  "category": "65a7b8c9d1e2f3g4h5i6j7m0",
  "portions": ["Small", "Medium", "Large"],
  "portionPrices": [8.99, 10.99, 13.99],
  "spiceLevel": "Mild",
  "createdAt": "2024-01-15T10:40:00Z",
  "updatedAt": "2024-01-15T10:40:00Z"
}
```

#### Combo Item
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7l2",
  "name": "Family Feast Combo",
  "itemType": "combo",
  "description": "Complete meal for the whole family",
  "image": "https://example.com/images/combo.jpg",
  "category": "65a7b8c9d1e2f3g4h5i6j7m1",
  "sections": [
    {
      "title": "Main Course",
      "selectedItems": [
        {
          "item": "65a7b8c9d1e2f3g4h5i6j7l0",
          "price": 12.99,
          "portionId": "regular",
          "isDefault": true,
          "isAvailable": true
        }
      ],
      "sequence": 1
    },
    {
      "title": "Side Dishes",
      "selectedItems": [
        {
          "item": "65a7b8c9d1e2f3g4h5i6j7l3",
          "price": 4.99,
          "portionId": "small",
          "isDefault": false,
          "isAvailable": true
        }
      ],
      "sequence": 2
    }
  ],
  "createdAt": "2024-01-15T10:40:00Z",
  "updatedAt": "2024-01-15T10:40:00Z"
}
```

---

## 4. Food Categories Collection (`foodcategories`)

### Purpose
Organizes food items into categories with support for both flat and day-wise listing types.

### Schema
```typescript
interface FoodCategory {
  _id?: ObjectId;                    // MongoDB document ID
  name: string;                      // Category name
  description?: string;              // Category description
  url?: string;                      // Category image URL
  public_id?: string;                // Cloudinary public ID
  sequence?: number;                 // Display order
  isDraft?: boolean;                 // Draft status (default: false)
  listingType?: 'flat' | 'day-wise'; // Listing type
  dayWiseItems?: Array<{             // Day-wise items (for day-wise categories)
    day: string;                     // Day name (Monday, Tuesday, etc.)
    items: string[];                 // Array of food item IDs
  }>;
  createdAt?: Date | string;         // Category creation timestamp
  updatedAt?: Date | string;         // Last update timestamp
}
```

### Relationships
- One-to-many with `fooditems` via references in `dayWiseItems.items`

### Example Documents

#### Flat Category
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7m0",
  "name": "Main Courses",
  "description": "Hearty main dishes",
  "url": "https://example.com/images/main-courses.jpg",
  "public_id": "food_categories/main_courses",
  "sequence": 1,
  "isDraft": false,
  "listingType": "flat",
  "createdAt": "2024-01-15T10:45:00Z",
  "updatedAt": "2024-01-15T10:45:00Z"
}
```

#### Day-wise Category
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7m1",
  "name": "Daily Specials",
  "description": "Special items available on specific days",
  "url": "https://example.com/images/daily-specials.jpg",
  "public_id": "food_categories/daily_specials",
  "sequence": 2,
  "isDraft": false,
  "listingType": "day-wise",
  "dayWiseItems": [
    {
      "day": "Monday",
      "items": ["65a7b8c9d1e2f3g4h5i6j7l0", "65a7b8c9d1e2f3g4h5i6j7l1"]
    },
    {
      "day": "Tuesday",
      "items": ["65a7b8c9d1e2f3g4h5i6j7l2", "65a7b8c9d1e2f3g4h5i6j7l3"]
    },
    {
      "day": "Wednesday",
      "items": ["65a7b8c9d1e2f3g4h5i6j7l4"]
    }
  ],
  "createdAt": "2024-01-15T10:45:00Z",
  "updatedAt": "2024-01-15T10:45:00Z"
}
```

---

## 5. Available Days Collection (`availableDays`)

### Purpose
Configures which days are available for ordering and delivery with custom labels and sequences.

### Schema
```typescript
interface AvailableDay {
  _id?: ObjectId | string;           // MongoDB document ID
  day: string;                       // Day name (monday, tuesday, etc.)
  label: string;                     // Display label
  enabled: boolean;                  // Availability status
  sequence: number;                  // Display order
  createdAt?: Date;                  // Day creation timestamp
  updatedAt?: Date;                  // Last update timestamp
}
```

### Relationships
- Referenced by `foodcategories` for day-wise item validation
- Referenced by `weeklymenu` for menu filtering

### Example Document
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

---

## 6. Available Dates Collection (`availableDates`)

### Purpose
Manages specific calendar dates with category listing type enablement settings. Unlike `availableDays` (which handles recurring weekly days), `availableDates` provides granular control over flat and day-wise category listings for specific dates (e.g., "2024-01-15").

### Key Differences: availableDates vs availableDates

| Aspect | availableDays | availableDates |
|--------|---------------|----------------|
| **Granularity** | Day of week (Monday, Tuesday) | Specific date (2024-01-15) |
| **Recurrence** | Recurs every week | One-time specific date |
| **Purpose** | General weekly schedule | Date-specific configuration |
| **Access** | Admin + Customer endpoints | Admin-only endpoints |
| **Use Case** | Regular operations | Holidays, events, specials |

### Schema
```typescript
interface AvailableDate {
  _id?: ObjectId | string;           // MongoDB document ID
  date: string;                      // Date in YYYY-MM-DD format (unique)
  flatCategoryEnabled: boolean;      // Enable flat category listing
  dayWiseCategoryEnabled: boolean;   // Enable day-wise category listing
  createdAt?: Date;                  // Creation timestamp
  updatedAt?: Date;                  // Last update timestamp
}
```

### Database Indexes
1. **Unique index** on `date` field - Prevents duplicate dates
2. **Index** on `flatCategoryEnabled` - Optimizes flat category queries
3. **Index** on `dayWiseCategoryEnabled` - Optimizes day-wise category queries
4. **Date range index** on `date` field - Optimizes range queries

### Relationships
- **Admin-only collection** - Not directly referenced by customer-facing features
- Complements `availableDays` for date-specific configurations
- Future integration with `foodcategories` for filtering by date

### API Endpoints
All endpoints require admin authentication:

- **GET** `/api/admin/available-dates` - Fetch dates by range
- **POST** `/api/admin/available-dates` - Create/upsert single date
- **PUT** `/api/admin/available-dates` - Bulk update (delete + insert)
- **DELETE** `/api/admin/available-dates` - Delete dates by range
- **POST** `/api/admin/migrations/available-dates` - Run/rollback migration

### Example Document
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7p1",
  "date": "2024-01-15",
  "flatCategoryEnabled": true,
  "dayWiseCategoryEnabled": false,
  "createdAt": "2024-01-10T10:00:00Z",
  "updatedAt": "2024-01-10T10:00:00Z"
}
```

### Use Cases
1. **Holiday Management**: Disable certain category types on holidays
2. **Special Promotions**: Enable specific category types for events
3. **Seasonal Changes**: Configure different availability for seasons
4. **One-Day Events**: Handle special days with unique configurations

### Customer App Compatibility
✅ **NO CHANGES REQUIRED** in customer-facing application (TDN9IL)

The customer app uses separate endpoints and is NOT affected:
- Customer app uses `/api/days` and `/api/enabled-days` (availableDays collection)
- availableDates is **admin-only** and does not impact customer functionality
- Future integration planned for category filtering (no immediate action needed)

**See `/docs/availableDates-collection.md` for complete documentation.**

---

## 7. Weekly Menu Collection (`weeklymenu`)

### Purpose
Organizes food items into weekly menu planning with day-based organization.

### Schema
```typescript
interface WeeklyMenu {
  _id?: ObjectId;                    // MongoDB document ID
  active: boolean;                   // Menu activation status
  weekStartDate?: Date;              // Start date of the week
  allDays: ObjectId[];               // All available food items
  monday: ObjectId[];                // Monday food items
  tuesday: ObjectId[];               // Tuesday food items
  wednesday: ObjectId[];             // Wednesday food items
  thursday: ObjectId[];              // Thursday food items
  friday: ObjectId[];                // Friday food items
  saturday: ObjectId[];              // Saturday food items
  createdAt?: Date;                  // Menu creation timestamp
  updatedAt?: Date;                  // Last update timestamp
}
```

### Relationships
- Many-to-many with `fooditems` via ObjectId references in day arrays

### Example Document
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7p0",
  "active": true,
  "weekStartDate": "2024-01-15T00:00:00Z",
  "allDays": [
    "65a7b8c9d1e2f3g4h5i6j7l0",
    "65a7b8c9d1e2f3g4h5i6j7l1",
    "65a7b8c9d1e2f3g4h5i6j7l2"
  ],
  "monday": ["65a7b8c9d1e2f3g4h5i6j7l0"],
  "tuesday": ["65a7b8c9d1e2f3g4h5i6j7l1"],
  "wednesday": ["65a7b8c9d1e2f3g4h5i6j7l2"],
  "thursday": ["65a7b8c9d1e2f3g4h5i6j7l0"],
  "friday": ["65a7b8c9d1e2f3g4h5i6j7l1"],
  "saturday": ["65a7b8c9d1e2f3g4h5i6j7l2"],
  "createdAt": "2024-01-15T11:00:00Z",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

---

## 8. Orders Collection (`orders`)

### Purpose
Stores customer orders with complete order details, pricing, and delivery information.

### Schema
```typescript
interface Order {
  _id?: ObjectId | string;           // MongoDB document ID
  orderId: string;                   // Unique order identifier (e.g., "#ORD-1234567890123")
  user?: string;                     // User ID reference (optional for guest orders)
  items: Array<{                     // Order items by day
    day: string;                     // Day name (Monday, Tuesday, etc.)
    deliveryDate: Date | string;     // Delivery date
    items: Array<{                   // Food items for the day
      food: {                        // Food item snapshot
        _id: string;                 // Item ID
        name: string;                // Item name
        price: number;               // Item price
        image?: string;              // Item image
        category?: string;           // Category name
        description?: string;        // Item description
        spiceLevel?: string;         // Spice level
        portions?: number;           // Portion count
        sections?: Array<{           // Combo sections (for combo items)
          _id: string;               // Section ID
          name: string;              // Section name
          items: Array<{             // Section items
            _id: string;             // Item ID
            name: string;            // Item name
          }>;
        }>;
      };
      quantity: number;              // Item quantity
      price: number;                 // Item total price
      spiceLevel?: string;           // Selected spice level
      portions?: number;             // Selected portions
      comboSelections?: Record<string, string>; // { sectionId: itemId }
    }>;
    dayTotal: number;                // Day total amount
  }>;
  address: {                         // Delivery address snapshot
    street: string;                  // Street address
    apartment?: string;              // Apartment number
    floor?: string;                  // Floor number
    city: string;                    // City name
    state: string;                   // State name
    zipCode: string;                 // ZIP code
    landmark?: string;               // Landmark
  };
  customerInfo: {                    // Customer information
    name: string;                    // Customer name
    email: string;                   // Customer email
    phone: string;                   // Customer phone
  };
  subtotal: number;                  // Order subtotal
  platformFee: number;               // Platform fee ($1.00)
  deliveryFee: number;               // Delivery fee ($10.00 or $0)
  taxes: number;                     // Tax amount (10% of subtotal)
  tip: number;                       // Customer tip
  discount?: {                       // Discount information
    amount: number;                  // Discount amount
    code: string;                    // Discount code
  };
  totalPaid: number;                 // Total amount paid
  currency: string;                  // Currency code ('usd' | 'inr')
  status: OrderStatus;               // Order status
  paymentStatus: PaymentStatus;      // Payment status
  paymentMethod: PaymentMethod;      // Payment method
  stripePaymentIntentId?: string;    // Stripe payment intent ID (for card payments)
  deliveryMessages?: string[];       // Cart clubbing messages
  createdAt?: Date | string;         // Order creation timestamp
  updatedAt?: Date | string;         // Last update timestamp
}

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';
type PaymentMethod = 'Credit Card' | 'Cash on Delivery';
```

### Relationships
- Many-to-one with `users` collection via `user` field
- Contains snapshots of `fooditems` data (immutable)
- Contains snapshot of `addresses` data (immutable)

### Example Document
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7q0",
  "orderId": "#ORD-1705310400123",
  "user": "65a7b8c9d1e2f3g4h5i6j7k8",
  "items": [
    {
      "day": "Monday",
      "deliveryDate": "2024-01-16T00:00:00Z",
      "items": [
        {
          "food": {
            "_id": "65a7b8c9d1e2f3g4h5i6j7l0",
            "name": "Grilled Chicken Sandwich",
            "price": 12.99,
            "image": "https://example.com/images/sandwich.jpg",
            "category": "Main Courses",
            "spiceLevel": "Medium"
          },
          "quantity": 2,
          "price": 25.98,
          "spiceLevel": "Medium"
        }
      ],
      "dayTotal": 25.98
    }
  ],
  "address": {
    "street": "123 Main Street",
    "apartment": "4B",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001"
  },
  "customerInfo": {
    "name": "John Doe",
    "email": "customer@example.com",
    "phone": "+1234567890"
  },
  "subtotal": 25.98,
  "platformFee": 1.00,
  "deliveryFee": 10.00,
  "taxes": 2.60,
  "tip": 5.00,
  "totalPaid": 44.58,
  "currency": "usd",
  "status": "confirmed",
  "paymentStatus": "paid",
  "paymentMethod": "Credit Card",
  "stripePaymentIntentId": "pi_1234567890",
  "createdAt": "2024-01-15T12:00:00Z",
  "updatedAt": "2024-01-15T12:05:00Z"
}
```

---

## 9. Zipcodes Collection (`zipcodes`)

### Purpose
Manages delivery zones with minimum cart values and delivery fee configurations.

### Schema
```typescript
interface Zipcode {
  _id: string;                       // MongoDB document ID
  zipcode: string;                   // ZIP/postal code
  minCartValue: number;              // Minimum cart value for delivery
  deliveryFee?: number;              // Delivery fee amount
  label?: string;                    // Zone label/description
  createdAt: Date;                   // Record creation timestamp
  updatedAt: Date;                   // Last update timestamp
}
```

### Relationships
- Referenced by order processing logic for delivery fee calculation

### Example Document
```json
{
  "_id": "65a7b8c9d1e2f3g4h5i6j7r0",
  "zipcode": "10001",
  "minCartValue": 25.00,
  "deliveryFee": 10.00,
  "label": "Manhattan - Midtown",
  "createdAt": "2024-01-15T11:15:00Z",
  "updatedAt": "2024-01-15T11:15:00Z"
}
```

---

## Data Flow and Relationships

### Primary Relationships

1. **User → Addresses**: One-to-many relationship
   - A user can have multiple delivery addresses
   - Foreign key: `addresses` array in `users` collection

2. **User → Orders**: One-to-many relationship
   - A user can place multiple orders
   - Foreign key: `user` field in `orders` collection

3. **FoodCategory → FoodItems**: One-to-many relationship
   - Categories organize food items
   - Foreign key: `category` field in `fooditems` collection
   - Additional: `dayWiseItems.items` arrays for day-wise categories

4. **WeeklyMenu → FoodItems**: Many-to-many relationship
   - Weekly menus organize items by days
   - Foreign keys: ObjectId arrays for each day field

5. **Order → FoodItems**: Snapshot relationship
   - Orders contain immutable snapshots of food item data
   - No direct foreign key relationship to maintain data integrity

### Business Logic Flow

#### 1. Menu Planning Flow
```
AvailableDays → FoodCategories (day-wise validation) → WeeklyMenu → Customer Interface
```

#### 2. Order Placement Flow
```
User → Address → FoodItems (from WeeklyMenu) → Order → Payment → Order Processing
```

#### 3. Delivery Calculation Flow
```
Order Address ZIP → Zipcodes → Min Cart Value & Delivery Fee → Order Total
```

#### 4. Category Management Flow
```
FoodItems → FoodCategories → WeeklyMenu → AvailableDays (validation)
```

### Index Recommendations

For optimal performance, consider creating indexes on:

1. **Users Collection**
   - `email` (unique)
   - `role`
   - `isActive`

2. **Orders Collection**
   - `orderId` (unique)
   - `user`
   - `status`
   - `paymentStatus`
   - `createdAt`

3. **FoodItems Collection**
   - `category`
   - `itemType`
   - `name` (text index for search)

4. **FoodCategories Collection**
   - `sequence`
   - `isDraft`
   - `listingType`

5. **AvailableDays Collection**
   - `enabled`
   - `sequence`

6. **Zipcodes Collection**
   - `zipcode` (unique)

7. **Addresses Collection**
   - `user`
   - `postal_code`

### Data Integrity Considerations

1. **Referential Integrity**: The system uses soft references (ObjectIds) rather than hard foreign keys to maintain flexibility in a document database.

2. **Data Snapshots**: Orders contain snapshots of food item and address data to maintain historical accuracy even if source data changes.

3. **Cascading Updates**: When updating food categories or weekly menus, the system ensures that active orders are not affected.

4. **Soft Deletes**: User accounts use the `isActive` field for soft deletion to maintain order history.

---

## Common Query Patterns

### 1. Fetch User with Addresses
```javascript
db.users.findOne({ _id: userId })
// Then populate addresses using addresses array
```

### 2. Get Weekly Menu for Active Week
```javascript
db.weeklymenu.findOne({ active: true })
// Then populate food items for each day
```

### 3. Get Orders by User with Status Filter
```javascript
db.orders.find({
  user: userId,
  status: { $in: ['pending', 'confirmed', 'preparing'] }
}).sort({ createdAt: -1 })
```

### 4. Get Food Categories for Customer Display
```javascript
db.foodcategories.find({
  isDraft: { $ne: true }
}).sort({ sequence: 1 })
```

### 5. Validate Day-wise Category Items
```javascript
// First get available days
db.availableDays.find({ enabled: true }).sort({ sequence: 1 })
// Then validate category dayWiseItems against available days
```

---

## Migration Notes

When working with database migrations or updates:

1. **Backward Compatibility**: The system maintains backward compatibility by providing default values for new fields.

2. **Schema Evolution**: New fields are added as optional with default values to prevent breaking existing functionality.

3. **Data Validation**: The system includes comprehensive validation logic, especially for day-wise category configurations.

4. **Caching Strategy**: Available days are cached in memory to reduce database load during validation operations.

---

## Security Considerations

1. **Password Hashing**: User passwords are stored as hashes, never in plain text.

2. **Role-Based Access**: The `role` field in users collection controls access to admin functionality.

3. **Input Validation**: All API endpoints include comprehensive validation for data integrity and security.

4. **JWT Authentication**: System uses JWT tokens for authentication with proper expiration and refresh mechanisms.

---

This documentation provides a comprehensive overview of the database structure and serves as a reference for developers working with the food management system. For specific implementation details or query optimizations, refer to the corresponding API route files in the codebase.