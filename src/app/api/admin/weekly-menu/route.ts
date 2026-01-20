import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { IWeeklyMenu, IWeeklyMenuPopulated, IPopulatedFoodItem } from '@/types/weeklyMenu';

// AvailableDay interface for type safety
interface AvailableDay {
  _id?: ObjectId | string;
  day: string;
  label: string;
  enabled: boolean;
  sequence: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Cache configuration for available days
let availableDaysCache: {
  data: AvailableDay[] | null;
  timestamp: number;
  ttl: number;
} = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000, // 5 minutes
};

/**
 * Fetch available days from database with caching
 */
async function getAvailableDays(): Promise<AvailableDay[]> {
  const now = Date.now();

  // Check cache validity
  if (
    availableDaysCache.data &&
    (now - availableDaysCache.timestamp) < availableDaysCache.ttl
  ) {
    return availableDaysCache.data;
  }

  try {
    const result = await db.read<AvailableDay>('availableDays', {}, {
      sort: { sequence: 1 }
    });

    if (result.success && result.data) {
      availableDaysCache = {
        data: result.data,
        timestamp: now,
        ttl: 5 * 60 * 1000
      };
      return result.data;
    }
  } catch (error) {
    console.warn('Failed to fetch available days:', error);
  }

  // Return default days as fallback
  return [
    { day: 'monday', label: 'Monday', enabled: true, sequence: 1 },
    { day: 'tuesday', label: 'Tuesday', enabled: true, sequence: 2 },
    { day: 'wednesday', label: 'Wednesday', enabled: true, sequence: 3 },
    { day: 'thursday', label: 'Thursday', enabled: true, sequence: 4 },
    { day: 'friday', label: 'Friday', enabled: true, sequence: 5 },
    { day: 'saturday', label: 'Saturday', enabled: true, sequence: 6 },
  ];
}

/**
 * Get enabled days mapping for quick lookup
 */
async function getEnabledDaysMap(): Promise<Map<string, AvailableDay>> {
  const availableDays = await getAvailableDays();
  const enabledDaysMap = new Map<string, AvailableDay>();

  availableDays.forEach(day => {
    if (day.enabled) {
      enabledDaysMap.set(day.day, day);
    }
  });

  return enabledDaysMap;
}

/**
 * Filter weekly menu based on enabled days
 */
function filterMenuByEnabledDays(
  menu: IWeeklyMenu | IWeeklyMenuPopulated,
  enabledDaysMap: Map<string, AvailableDay>
): IWeeklyMenu | IWeeklyMenuPopulated {
  const filteredMenu = { ...menu };

  // Define day fields to check
  const dayFields: (keyof IWeeklyMenu)[] = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];

  // Filter each day's menu
  dayFields.forEach(dayField => {
    if (!enabledDaysMap.has(dayField)) {
      (filteredMenu as any)[dayField] = [];
    }
  });

  return filteredMenu;
}

/**
 * Validate menu data against enabled days
 */
function validateMenuAgainstEnabledDays(
  menuData: Record<string, ObjectId[]>,
  enabledDaysMap: Map<string, AvailableDay>
): { isValid: boolean; errors: string[]; filteredData: Record<string, ObjectId[]> } {
  const errors: string[] = [];
  const filteredData: Record<string, ObjectId[]> = { ...menuData };

  const dayFields: string[] = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];

  dayFields.forEach(dayField => {
    if (menuData[dayField] && !enabledDaysMap.has(dayField)) {
      errors.push(`Day "${dayField}" is not enabled. Menu items for this day will be ignored.`);
      filteredData[dayField] = [];
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    filteredData
  };
}

/**
 * Clear the available days cache (useful when days are updated)
 */
function clearAvailableDaysCache(): void {
  availableDaysCache.data = null;
  availableDaysCache.timestamp = 0;
}

/**
 * Verify JWT token and check admin role
 */
function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  const verificationResult = jwtHandler.verifyToken(token);

  if (!verificationResult.success || !verificationResult.payload) {
    return { success: false, error: verificationResult.error || 'Invalid token' };
  }

  if (verificationResult.payload.role !== 'admin') {
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  return { success: true, userId: verificationResult.payload.userId };
}

// Helper function to get the start of the current week (Monday)
function getStartOfCurrentWeekMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  // We need Monday as start (1). If Sunday (0), go back 6 days; else go back day-1 days
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper function to populate food items for a specific day
async function populateFoodItems(itemIds: ObjectId[]): Promise<IPopulatedFoodItem[]> {
  if (!itemIds || itemIds.length === 0) {
    return [];
  }

  const result = await db.read('fooditems', {
    _id: { $in: itemIds },
  });

  return result.success ? (result.data as IPopulatedFoodItem[]) || [] : [];
}

// Helper function to populate all days in the menu
async function getPopulatedMenu(menu: IWeeklyMenu): Promise<IWeeklyMenuPopulated> {
  const [allDays, monday, tuesday, wednesday, thursday, friday, saturday] = await Promise.all([
    populateFoodItems(menu.allDays),
    populateFoodItems(menu.monday),
    populateFoodItems(menu.tuesday),
    populateFoodItems(menu.wednesday),
    populateFoodItems(menu.thursday),
    populateFoodItems(menu.friday),
    populateFoodItems(menu.saturday),
  ]);

  return {
    ...menu,
    allDays,
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
  };
}

// GET /api/admin/weekly-menu - Fetch active weekly menu filtered by enabled days
export async function GET(req: NextRequest) {
  try {
    // Verify JWT token
    const authResult = verifyAuth(req);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get enabled days for filtering
    const enabledDaysMap = await getEnabledDaysMap();
    const enabledDays = Array.from(enabledDaysMap.values());

    // Find active weekly menu
    const result = await db.readOne<IWeeklyMenu>('weeklymenus', { active: true });

    let menu: IWeeklyMenu | null = result.data || null;

    // If no menu exists, create an empty one
    if (!menu) {
      const newMenu: Partial<IWeeklyMenu> = {
        allDays: [],
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        weekStartDate: getStartOfCurrentWeekMonday(),
        active: true,
      };

      const createResult = await db.create<IWeeklyMenu>('weeklymenus', newMenu as IWeeklyMenu);

      if (!createResult.success) {
        throw new Error('Failed to create weekly menu');
      }

      // Fetch the created menu
      const fetchResult = await db.readOne<IWeeklyMenu>('weeklymenus', {
        _id: new ObjectId(createResult.id),
      });

      menu = fetchResult.data || null;
    }

    if (!menu) {
      throw new Error('Failed to fetch menu');
    }

    // Populate menu with food items
    const populatedMenu = await getPopulatedMenu(menu);

    // Filter menu based on enabled days
    const filteredMenu = filterMenuByEnabledDays(populatedMenu, enabledDaysMap);

    // Get disabled days for metadata
    const availableDaysList = await getAvailableDays();
    const disabledDays = availableDaysList.filter((day: AvailableDay) => !day.enabled);

    // Return filtered menu with metadata
    return NextResponse.json({
      data: filteredMenu,
      meta: {
        enabledDays: enabledDays.map(day => ({
          day: day.day,
          label: day.label,
          sequence: day.sequence
        })),
        disabledDays: disabledDays.map(day => ({
          day: day.day,
          label: day.label,
          sequence: day.sequence
        })),
        totalEnabledDays: enabledDays.length,
        totalDisabledDays: disabledDays.length,
        message: disabledDays.length > 0
          ? `Menu filtered to show only ${enabledDays.length} enabled days. ${disabledDays.length} days are disabled.`
          : 'All days are enabled. Showing full menu.'
      }
    });
  } catch (error) {
    console.error('Error fetching weekly menu:', error);
    return NextResponse.json({
      error: 'Failed to fetch weekly menu',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/admin/weekly-menu - Update weekly menu with validation against enabled days
export async function PUT(req: NextRequest) {
  try {
    // Verify JWT token
    const authResult = verifyAuth(req);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get enabled days for validation
    const enabledDaysMap = await getEnabledDaysMap();

    const body = await req.json();
    const {
      allDays = [],
      monday = [],
      tuesday = [],
      wednesday = [],
      thursday = [],
      friday = [],
      saturday = [],
    } = body || {};

    // Convert string IDs to ObjectIds
    const convertToObjectIds = (ids: string[]) => {
      return ids.map((id) => {
        if (!id || typeof id !== 'string') {
          throw new Error(`Invalid food item ID: ${id}`);
        }
        try {
          return new ObjectId(id);
        } catch (error) {
          throw new Error(`Invalid ObjectId format: ${id}`);
        }
      });
    };

    const rawMenuData = {
      allDays: convertToObjectIds(allDays),
      monday: convertToObjectIds(monday),
      tuesday: convertToObjectIds(tuesday),
      wednesday: convertToObjectIds(wednesday),
      thursday: convertToObjectIds(thursday),
      friday: convertToObjectIds(friday),
      saturday: convertToObjectIds(saturday),
    };

    // Validate and filter menu data against enabled days
    const validation = validateMenuAgainstEnabledDays(rawMenuData, enabledDaysMap);
    const menuData = validation.filteredData;

    // Find active menu
    const existingResult = await db.readOne<IWeeklyMenu>('weeklymenus', { active: true });
    let menu: IWeeklyMenu | null = existingResult.data || null;

    if (!menu) {
      // Create new menu
      const newMenu: Partial<IWeeklyMenu> = {
        ...menuData,
        weekStartDate: getStartOfCurrentWeekMonday(),
        active: true,
      };

      const createResult = await db.create<IWeeklyMenu>('weeklymenus', newMenu as IWeeklyMenu);

      if (!createResult.success) {
        throw new Error('Failed to create weekly menu');
      }

      // Fetch the created menu
      const fetchResult = await db.readOne<IWeeklyMenu>('weeklymenus', {
        _id: new ObjectId(createResult.id),
      });

      menu = fetchResult.data || null;
    } else {
      // Update existing menu
      const updateResult = await db.updateOne<IWeeklyMenu>(
        'weeklymenus',
        { _id: menu._id },
        { $set: menuData }
      );

      if (!updateResult.success) {
        throw new Error('Failed to update weekly menu');
      }

      // Fetch updated menu
      const fetchResult = await db.readOne<IWeeklyMenu>('weeklymenus', { _id: menu._id });
      menu = fetchResult.data || null;
    }

    if (!menu) {
      throw new Error('Failed to save menu');
    }

    // Clear available days cache since menu was updated
    clearAvailableDaysCache();

    // Populate menu with food items
    const populatedMenu = await getPopulatedMenu(menu);

    // Filter the populated menu based on enabled days for consistent response
    const filteredMenu = filterMenuByEnabledDays(populatedMenu, enabledDaysMap);

    // Get enabled and disabled days for metadata
    const enabledDays = Array.from(enabledDaysMap.values());
    const availableDaysList = await getAvailableDays();
    const disabledDays = availableDaysList.filter((day: AvailableDay) => !day.enabled);

    // Build response message based on validation results
    let responseMessage = 'Weekly menu saved successfully';
    if (validation.errors.length > 0) {
      responseMessage += ` (Note: ${validation.errors.length} day(s) were filtered due to being disabled)`;
    }

    return NextResponse.json({
      data: filteredMenu,
      meta: {
        enabledDays: enabledDays.map(day => ({
          day: day.day,
          label: day.label,
          sequence: day.sequence
        })),
        disabledDays: disabledDays.map(day => ({
          day: day.day,
          label: day.label,
          sequence: day.sequence
        })),
        totalEnabledDays: enabledDays.length,
        totalDisabledDays: disabledDays.length,
        validationWarnings: validation.errors,
        message: validation.errors.length > 0
          ? `Some days were filtered: ${validation.errors.join(', ')}`
          : 'All provided days are enabled.'
      },
      message: responseMessage
    });
  } catch (error) {
    console.error('Error saving weekly menu:', error);
    return NextResponse.json({
      error: 'Failed to save weekly menu',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
