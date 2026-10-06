import { ObjectId } from 'mongodb';

// 'Credit Card' is a plain card payment. The Stripe webhook on the live site records the real
// method for wallet/bank payments ('Apple Pay', 'Google Pay', 'Bank', 'Link', 'Klarna').
export type PaymentMethod =
  | 'Credit Card'
  | 'Cash on Delivery'
  | 'Apple Pay'
  | 'Google Pay'
  | 'Bank'
  | 'Link'
  | 'Klarna'
  | 'Other';

export type CategoryListingType = 'flat' | 'day-wise';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

export type EmailStatus = 'pending' | 'sent' | 'failed' | 'retrying';

export interface EmailStatusInfo {
  status: EmailStatus;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  messageId?: string;
}

/**
 * Mapping type discriminator for CategoryFoodMapping
 * - FLAT: Standard flat listing where food items appear in category sequence
 * - DAY_WISE: Day-wise listing where food items are organized by day
 */
export type MappingType = 'FLAT' | 'DAY_WISE';

/**
 * Base CategoryFoodMapping interface
 * Contains common fields shared by all mapping types
 */
export interface BaseCategoryFoodMapping {
  _id?: ObjectId | string;
  foodItemId: ObjectId;
  categoryId: ObjectId;
  sequence: number;
  mappingType: MappingType;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * FLAT mapping type
 * Standard flat listing where food items appear in category sequence
 */
export interface FlatCategoryFoodMapping extends BaseCategoryFoodMapping {
  mappingType: 'FLAT';
}

/**
 * DAY_WISE mapping type
 * Day-wise listing where food items are organized by day
 * Includes additional day information
 */
export interface DayWiseCategoryFoodMapping extends BaseCategoryFoodMapping {
  mappingType: 'DAY_WISE';
  day: string; // e.g., "Monday", "Tuesday", etc.
}

/**
 * CategoryFoodMapping discriminated union
 * Represents the many-to-many relationship between food items and categories
 * in the new three-collection architecture.
 *
 * This replaces the old approach where fooditems had a `category: string[]` array.
 *
 * @example FLAT mapping
 * {
 *   _id: ObjectId('...'),
 *   foodItemId: ObjectId('food123'),
 *   categoryId: ObjectId('category456'),
 *   sequence: 0,
 *   mappingType: 'FLAT',
 *   createdAt: new Date('2024-01-01'),
 *   updatedAt: new Date('2024-01-01')
 * }
 *
 * @example DAY_WISE mapping
 * {
 *   _id: ObjectId('...'),
 *   foodItemId: ObjectId('food123'),
 *   categoryId: ObjectId('category456'),
 *   sequence: 0,
 *   mappingType: 'DAY_WISE',
 *   day: 'Monday',
 *   createdAt: new Date('2024-01-01'),
 *   updatedAt: new Date('2024-01-01')
 * }
 */
export type CategoryFoodMapping = FlatCategoryFoodMapping | DayWiseCategoryFoodMapping;

/**
 * FoodItemSnapshot Interface
 * Snapshot of a food item stored in an order.
 *
 * @deprecated The `category` field is kept for backward compatibility.
 * The actual category relationships are now managed through the CategoryFoodMapping collection.
 * When creating orders, the category field is populated from CategoryFoodMapping.
 */
export interface FoodItemSnapshot {
  _id: string;
  name: string;
  price: number;
  image?: string;
  category?: string; // @deprecated Populated from CategoryFoodMapping for backward compatibility
  description?: string;
  veg?: boolean;
  hasSpiceLevel?: boolean;
  spiceLevel?: string[];
  portions?: string[]; // Array of portion names (e.g., ["Full", "Half"])
  portionPrices?: number[];
  hasCombo?: boolean;
  sections?: Array<{
    _id: string;
    title: string;
    description?: string;
    selectedItems: Array<{
      _id: string;
      item: {
        _id: string;
        name: string;
        price: number;
      };
      portion?: string;
      price: number;
      isDefault: boolean;
    }>;
  }>; // Combo sections for displaying combo selections
}

export interface OrderDayItem {
  food: FoodItemSnapshot;
  quantity: number;
  price: number;
  spiceLevel?: string;
  selectedPortion?: string; // Portion name (e.g., "Full", "Half")
  portions?: number; // Portion index for backwards compatibility
  isEcoFriendlyContainer?: boolean;
  ecoContainerCharge?: number;
  comboSelections?: Record<string, string[]>; // { sectionId: itemId[] }
  notes?: string;
}

export interface OrderDay {
  day: string; // e.g., "Monday", "Tuesday"
  deliveryDate: Date | string;
  actualDeliveryDate?: Date | string; // Calculated delivery date after clubbing logic
  items: OrderDayItem[];
  dayTotal: number;
}

export interface AddressSnapshot {
  street: string;
  apartment?: string;
  floor?: string;
  city: string;
  state: string;
  zipCode: string;
  entrance?: string;
  landmark?: string;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

export interface DiscountInfo {
  amount: number;
  code: string;
}

export interface PaymentErrorInfo {
  code: string; // Stripe error code, e.g. 'card_declined', or 'canceled_*'
  declineCode?: string; // e.g. 'insufficient_funds'
  type?: string; // e.g. 'card_error'
  message: string;
  paymentMethodType?: string;
  at: Date | string;
}

export interface ClientPaymentError {
  stage: string; // where in the checkout it happened
  code?: string;
  declineCode?: string;
  type?: string;
  message: string;
  paymentIntentId?: string;
  at: Date | string;
}

export interface Order {
  _id?: string;
  orderId: string; // e.g., "#ORD-1234567890123"
  user?: string; // User ID
  items: OrderDay[];
  address: AddressSnapshot;
  customerInfo: CustomerInfo;
  subtotal: number;
  platformFee: number; // $1.00
  deliveryFee: number; // $10.00 or $0
  taxes: number; // 10% of subtotal
  tip: number; // User selected tip
  discount?: DiscountInfo;
  minOrderValue?: number; // Minimum order value required for delivery
  totalPaid: number;
  currency: string; // 'usd' | 'inr'
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  stripePaymentIntentId?: string; // Only for card payments
  paymentError?: PaymentErrorInfo; // Latest failure/cancellation reported by Stripe
  paymentAttempts?: number; // Failed Stripe attempts (webhook count)
  clientPaymentErrors?: ClientPaymentError[]; // Last errors the checkout page reported (max 10)
  paymentActionRequiredAt?: Date | string; // Stripe asked for extra authentication (e.g. 3D Secure)
  refundedAmount?: number; // Total refunded so far, in dollars (a partial refund keeps the order active)
  stripeFee?: number; // What Stripe charged us for this payment, in dollars (saved for orders paid after it was added)
  stripeNet?: number; // Amount that reached our balance after Stripe's fee, in dollars
  refundedAt?: Date | string; // When the latest refund was recorded
  deliveryMessages?: string[]; // Cart clubbing messages
  hasReview?: boolean; // Whether this order has been reviewed
  emailStatus?: EmailStatusInfo; // Track order confirmation email status
  paymentFailedEmailStatus?: EmailStatusInfo; // Track payment failed email status
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CategoryDayWiseItem {
  day: string; // e.g., "Monday", "Tuesday", etc.
  items: string[]; // Array of food item IDs
}

export interface FoodCategory {
  _id?: ObjectId;
  /** Top-level categories omit this; sub-categories reference a parent (one level only). */
  parentCategoryId?: ObjectId | string;
  name: string;
  description?: string;
  url?: string;
  public_id?: string;
  sequence?: number;
  isDraft?: boolean;
  listingType?: CategoryListingType; // 'flat' | 'day-wise'
  dayWiseItems?: CategoryDayWiseItem[]; // For day-wise categories
  /** Food item IDs whose day-wise rows stay checked when using Clear All */
  dayWiseLockedItemIds?: string[];
  itemCount?: number; // Total items assigned to the category
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * AvailableDate Interface
 * Represents a date with category type enablement settings
 */
export interface AvailableDate {
  _id?: ObjectId | string;
  date: string; // YYYY-MM-DD format
  flatCategoryEnabled: boolean; // Enable flat category listing for this date
  dayWiseCategoryEnabled: boolean; // Enable day-wise category listing for this date
  /**
   * Custom order cutoff for this date (an absolute moment). Missing/null = the standard cutoff,
   * 1 PM Pacific the day before. Set by an admin to extend, reopen or close a date early.
   */
  cutoffAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * DeliveryOrderReport Interface
 * Represents an order in the delivery report for CSV export.
 * Used by the delivery report API and CSV export functionality.
 */
export interface DeliveryOrderReport {
  orderId: string;
  orderDate: Date | string;
  customerInfo: CustomerInfo;
  address: AddressSnapshot;
  deliveryDate: Date | string;
  deliveryDay: string;
  items: OrderDayItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  platformFee: number;
  deliveryFee: number;
  taxes: number;
  tip: number;
  totalPaid: number;
  deliveryMessages?: string[];
}
