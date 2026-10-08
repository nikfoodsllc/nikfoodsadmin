'use client';

import { Fragment, useState, useEffect, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
} from '@mui/material';
import { CategoryDayWiseItem, FoodCategory } from '@/types/order';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailableDates } from '@/hooks/useAvailableDates';
import { categoryHasParent, toIdString } from '@/app/admin/food-items/utils/subCategoryUtils';
import {
  formatDateLabel,
  formatDateShort,
  formatDateWithDay,
  isDateString,
  isDayName
} from '@/utils/days';
import { safeFormatCurrency } from '@/utils/currency';
import { isTodayOrLater } from '@/utils/lockedMenu';

interface FoodItem {
  _id: string;
  name: string;
  description?: string;
  veg: boolean;
  price: number;
  category?: string[];
}

interface ItemGroup {
  categoryId: string;
  categoryName: string;
  isSubCategory: boolean;
  items: FoodItem[];
}

interface DayWiseItemSelectorProps {
  value: CategoryDayWiseItem[];
  onChange: (dayWiseItems: CategoryDayWiseItem[]) => void;
  lockedItemIds: string[];
  onLockedItemIdsChange: (lockedItemIds: string[]) => void;
  disabled?: boolean;
  categoryId?: string;
  categoryName?: string;
}

export default function DayWiseItemSelector({
  value,
  onChange,
  lockedItemIds,
  onLockedItemIdsChange,
  disabled = false,
  categoryId = '',
  categoryName = '',
}: DayWiseItemSelectorProps) {
  const { token, isAuthenticated } = useAuth();
  const { availableDates, loading: datesLoading, error: datesError } = useAvailableDates({
    dayWiseCategoryEnabledOnly: true
  });
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [subCategories, setSubCategories] = useState<FoodCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lockedItemIdSet = useMemo(() => new Set(lockedItemIds), [lockedItemIds]);

  // Fetch food items and sub-categories on component mount
  useEffect(() => {
    const fetchFoodItems = async () => {
      try {
        if (!token || !isAuthenticated) {
          setError('Authentication token not found');
          return;
        }

        const [foodItemsResponse, categoriesResponse] = await Promise.all([
          fetch('/api/admin/food-items?excludeDrafts=true&limit=10000', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          categoryId
            ? fetch('/api/admin/food-category', {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              })
            : Promise.resolve(null),
        ]);

        if (!foodItemsResponse.ok) {
          throw new Error('Failed to fetch food items');
        }

        const foodItemsData = await foodItemsResponse.json();
        setFoodItems(foodItemsData.data?.items || []);

        if (categoriesResponse?.ok) {
          const categoriesData = await categoriesResponse.json();
          const categories: FoodCategory[] = categoriesData.data?.items || [];
          const subs = categories
            .filter(
              (cat) =>
                !cat.isDraft &&
                categoryHasParent(cat) &&
                toIdString(cat.parentCategoryId) === categoryId
            )
            .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

          setSubCategories(subs);
        } else {
          setSubCategories([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load food items');
      } finally {
        setLoading(false);
      }
    };

    fetchFoodItems();
  }, [token, isAuthenticated, categoryId]);

  // Create date labels array for display
const allDateLabels = useMemo(() => {
  return availableDates
    // Only show today and future dates (compared as Pacific calendar days, so today is not hidden)
    .filter((date) => isTodayOrLater(date.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((date) => ({
      label: formatDateLabel(date.date),
      shortLabel: formatDateShort(date.date),
      displayLabel: formatDateWithDay(date.date),
      date: date.date,
      enabled: date.dayWiseCategoryEnabled,
    }));
}, [availableDates]);
  // Check if existing data uses old day-name format
  const hasLegacyDayFormat = useMemo(() => {
    return value.length > 0 && value.some(item => isDayName(item.day));
  }, [value]);

  // Sync value array with allDateLabels by matching day field
// remove old dates like Jan 28 automatically
useEffect(() => {

  if (allDateLabels.length === 0) return;

  const cleanedDayWiseItems: CategoryDayWiseItem[] =
    allDateLabels.map(dateInfo => {

      const existing = value.find(
        item => item.day === dateInfo.date
      );

      return {
        day: dateInfo.date,
        items: existing?.items || []
      };

    });

  onChange(cleanedDayWiseItems);

}, [allDateLabels]);

  const handleItemToggle = (dayIndex: number, itemId: string) => {
    const dateInfo = allDateLabels[dayIndex];
    if (!dateInfo) return;

    const newDayWiseItems = [...value];
    const dayEntryIndex = newDayWiseItems.findIndex(item => item.day === dateInfo.date);

    if (dayEntryIndex === -1) {
      // Create new entry for this date
      newDayWiseItems.push({
        day: dateInfo.date,
        items: [itemId]
      });
    } else {
      const dayItems = newDayWiseItems[dayEntryIndex].items;

      if (dayItems.includes(itemId)) {
        // Remove item from this day
        newDayWiseItems[dayEntryIndex].items = dayItems.filter(id => id !== itemId);
      } else {
        // Add item to this day
        newDayWiseItems[dayEntryIndex].items = [...dayItems, itemId];
      }
    }

    onChange(newDayWiseItems);
  };

  const toggleRowLock = (itemId: string) => {
    if (disabled) return;
    if (lockedItemIdSet.has(itemId)) {
      onLockedItemIdsChange(lockedItemIds.filter((id) => id !== itemId));
    } else {
      onLockedItemIdsChange([...lockedItemIds, itemId]);
    }
  };

  const handleClearAll = () => {
    const clearedDayWiseItems: CategoryDayWiseItem[] = allDateLabels.map((dateInfo) => {
      const dayEntry = value.find((item) => item.day === dateInfo.date);
      const existingItems = dayEntry?.items || [];
      const preserved = existingItems.filter((id) => lockedItemIdSet.has(id));
      return {
        day: dateInfo.date,
        items: preserved,
      };
    });
    onChange(clearedDayWiseItems);
  };

  const isItemSelectedForDay = (dayIndex: number, itemId: string) => {
    const dateInfo = allDateLabels[dayIndex];
    if (!dateInfo) return false;

    const dayEntry = value.find(item => item.day === dateInfo.date);
    return dayEntry?.items?.includes(itemId) || false;
  };

  const getSelectedItemsCount = (dayIndex: number) => {
    const dateInfo = allDateLabels[dayIndex];
    if (!dateInfo) return 0;

    const dayEntry = value.find(item => item.day === dateInfo.date);
    return dayEntry?.items?.length || 0;
  };

  const assignedItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const dayEntry of value) {
      for (const itemId of dayEntry.items) {
        ids.add(itemId);
      }
    }
    return ids;
  }, [value]);

  const subCategoryIds = useMemo(
    () => new Set(subCategories.map((sub) => toIdString(sub._id))),
    [subCategories]
  );

  const showSubCategoryGroups = subCategories.length > 0;

  const displayFoodItems = useMemo(() => {
    if (!showSubCategoryGroups) {
      return foodItems;
    }

    return foodItems.filter((item) => {
      if (assignedItemIds.has(item._id)) {
        return true;
      }

      const categoryIds = item.category || [];
      if (categoryIds.includes(categoryId)) {
        return true;
      }

      return categoryIds.some((id) => subCategoryIds.has(id));
    });
  }, [
    foodItems,
    showSubCategoryGroups,
    assignedItemIds,
    categoryId,
    subCategoryIds,
  ]);

  const itemGroups = useMemo((): ItemGroup[] => {
    if (!showSubCategoryGroups) {
      return [
        {
          categoryId,
          categoryName: categoryName || 'Items',
          isSubCategory: false,
          items: displayFoodItems,
        },
      ];
    }

    const itemsBySub = new Map<string, FoodItem[]>();
    for (const sub of subCategories) {
      itemsBySub.set(toIdString(sub._id), []);
    }

    const parentItems: FoodItem[] = [];
    const otherItems: FoodItem[] = [];

    for (const item of displayFoodItems) {
      const categoryIds = item.category || [];
      const matchingSub = subCategories.find((sub) =>
        categoryIds.includes(toIdString(sub._id))
      );

      if (matchingSub) {
        itemsBySub.get(toIdString(matchingSub._id))!.push(item);
      } else if (categoryIds.includes(categoryId) || assignedItemIds.has(item._id)) {
        parentItems.push(item);
      } else {
        otherItems.push(item);
      }
    }

    const groups: ItemGroup[] = [];

    if (parentItems.length > 0) {
      groups.push({
        categoryId,
        categoryName: categoryName || 'Main Category',
        isSubCategory: false,
        items: parentItems,
      });
    }

    for (const sub of subCategories) {
      const subId = toIdString(sub._id);
      const items = itemsBySub.get(subId) || [];

      if (items.length > 0) {
        groups.push({
          categoryId: subId,
          categoryName: sub.name,
          isSubCategory: true,
          items,
        });
      }
    }

    if (otherItems.length > 0) {
      groups.push({
        categoryId: 'other',
        categoryName: 'Other Assigned Items',
        isSubCategory: false,
        items: otherItems,
      });
    }

    return groups;
  }, [
    showSubCategoryGroups,
    displayFoodItems,
    subCategories,
    categoryId,
    categoryName,
    assignedItemIds,
  ]);

  const totalDisplayItems = itemGroups.reduce(
    (count, group) => count + group.items.length,
    0
  );

  const renderItemRow = (item: FoodItem) => (
    <TableRow
      key={item._id}
      sx={{
        '&:hover': {
          backgroundColor: 'rgba(79, 140, 255, 0.04)',
        },
      }}
    >
      <TableCell
        sx={{
          position: 'sticky',
          left: 0,
          backgroundColor: 'inherit',
          zIndex: 1,
          borderRight: '1px solid #E0E0E0',
          verticalAlign: 'top',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <Tooltip title="When enabled, Clear All will not remove this item from any date">
            <FormControlLabel
              control={
                <Checkbox
                  checked={lockedItemIdSet.has(item._id)}
                  onChange={() => toggleRowLock(item._id)}
                  disabled={disabled}
                  size="small"
                  sx={{ py: 0 }}
                />
              }
              label={
                <Typography component="span" variant="caption" sx={{ color: '#555' }}>
                  Lock row (repeats weekly)
                </Typography>
              }
              sx={{
                m: 0,
                mr: 0,
                alignItems: 'center',
                gap: 0.5,
              }}
            />
          </Tooltip>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: item.veg ? '#4CAF50' : '#F44336',
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#333', lineHeight: 1.2 }}>
                {item.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                {safeFormatCurrency(item.price)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </TableCell>
      {allDateLabels.map((dateInfo, dateIndex) => (
        <TableCell
          key={`${item._id}-${dateInfo.date}`}
          align="center"
          sx={{
            padding: '8px 16px',
            minWidth: 100,
            zIndex: 2,
          }}
        >
          <Tooltip title={`Toggle item for ${dateInfo.label}`} arrow>
            <Checkbox
              checked={isItemSelectedForDay(dateIndex, item._id)}
              onChange={() => handleItemToggle(dateIndex, item._id)}
              disabled={disabled}
              size="small"
              sx={{
                color: '#4F8CFF',
                '&.Mui-checked': {
                  color: '#4F8CFF',
                },
              }}
            />
          </Tooltip>
        </TableCell>
      ))}
    </TableRow>
  );

  const renderGroupHeader = (group: ItemGroup) => (
    <TableRow key={`header-${group.categoryId}`}>
      <TableCell
        colSpan={allDateLabels.length + 1}
        sx={{
          py: 1.25,
          px: 2,
          borderBottom: '1px solid #E0E0E0',
          backgroundColor: group.isSubCategory
            ? 'rgba(139, 92, 246, 0.08)'
            : 'rgba(79, 140, 255, 0.08)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            pl: 1,
            borderLeft: '4px solid',
            borderColor: group.isSubCategory ? '#8B5CF6' : '#4F8CFF',
          }}
        >
          <Typography
            component="span"
            sx={{
              fontWeight: 600,
              color: '#1E3A5F',
              fontSize: { xs: '0.9rem', sm: '0.95rem' },
            }}
          >
            {group.categoryName}
          </Typography>
          {group.isSubCategory && (
            <Chip
              label="Sub-category"
              size="small"
              sx={{
                height: 22,
                backgroundColor: '#8B5CF6',
                color: 'white',
                fontWeight: 500,
                fontSize: '0.7rem',
              }}
            />
          )}
          <Typography component="span" sx={{ color: '#666', fontSize: '0.85rem' }}>
            ({group.items.length} {group.items.length === 1 ? 'item' : 'items'})
          </Typography>
        </Box>
      </TableCell>
    </TableRow>
  );

  if (!token || !isAuthenticated) {
    return (
      <Alert severity="error" sx={{ marginBottom: 2 }}>
        Authentication required. Please log in again.
      </Alert>
    );
  }

  // Show loading state while fetching initial data
  if (loading || (datesLoading && availableDates.length === 0)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', padding: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error state if both food items and dates failed to load
  if (error && (!availableDates || availableDates.length === 0)) {
    return (
      <Alert severity="error" sx={{ marginBottom: 2 }}>
        {error}
      </Alert>
    );
  }

  // Show dates error if food items loaded but dates failed
  if (datesError && availableDates.length === 0) {
    return (
      <Alert severity="error" sx={{ marginBottom: 2 }}>
        {datesError}
      </Alert>
    );
  }

  // Show empty state if no dates are configured for day-wise categories
  if (availableDates.length === 0 && !datesLoading) {
    return (
      <Box sx={{ textAlign: 'center', padding: 4 }}>
        <Typography variant="h6" sx={{ color: '#666', marginBottom: 1 }}>
          No dates available for day-wise item assignment
        </Typography>
        <Typography variant="body2" sx={{ color: '#999' }}>
          Please configure dates in the Availability Calendar and enable "Day-wise Category" for at least one date.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
          Date-wise Item Assignment
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Unchecks all date assignments except locked rows">
            <Chip
              label="Clear All"
              onClick={handleClearAll}
              disabled={disabled}
              variant="outlined"
              size="small"
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(79, 140, 255, 0.04)',
                },
              }}
            />
          </Tooltip>
        </Box>
      </Box>

      <Typography variant="body2" sx={{ color: '#666', marginBottom: 2 }}>
        Select items that will be available for each configured date. Items will only appear in the category on their assigned dates.
        Only dates with "Day-wise Category" enabled in the Availability Calendar are shown.
        Use <strong>Lock</strong> on a row to repeat it every week: it keeps its date selections when you click Clear All, and it is switched on automatically for the same weekdays when you enable the next week&apos;s days in Manage Days. Press Save Changes after locking.
        {showSubCategoryGroups && (
          <>
            {' '}
            Items are grouped by sub-category based on their Food Items assignments.
          </>
        )}
      </Typography>

      <Box sx={{ overflowX: 'auto' }}>
        <TableContainer
          component={Paper}
          sx={{
            boxShadow: 'none',
            border: '1px solid #E0E0E0',
            maxHeight: 500,
            overflowY: 'auto',
          }}
        >
          
          <Table stickyHeader aria-label="day-wise item assignment table">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    backgroundColor: '#F5F5F5',
                    minWidth: 200,
                    position: 'sticky',
                    left: 0,
                    zIndex: 3
                  }}
                >
                  Food Item
                </TableCell>
                
                {allDateLabels.map((dateInfo, dateIndex) => (
                  <TableCell
                    key={dateInfo.date}
                    align="center"
                    sx={{
                      fontWeight: 600,
                      backgroundColor: '#F5F5F5',
                      minWidth: 100,
                    }}
                    >
                    
                    <Tooltip
                      title={dateInfo.label}
                      arrow
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: 'inherit',
                          }}
                        >
                          {dateInfo.displayLabel}
                        </Typography>
                        <Chip
                          label={`${getSelectedItemsCount(dateIndex)}`}
                          size="small"
                          variant={getSelectedItemsCount(dateIndex) > 0 ? 'filled' : 'outlined'}
                          color={getSelectedItemsCount(dateIndex) > 0 ? 'primary' : 'default'}
                          sx={{
                            fontSize: '0.7rem',
                            height: 20,
                          }}
                        />
                      </Box>
                    </Tooltip>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {totalDisplayItems === 0 ? (
                <TableRow>
                  <TableCell colSpan={allDateLabels.length + 1} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      {showSubCategoryGroups
                        ? 'No food items are assigned to this category or its sub-categories yet'
                        : 'No food items available'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                itemGroups.map((group) => (
                  <Fragment key={group.categoryId}>
                    {showSubCategoryGroups && renderGroupHeader(group)}
                    {group.items.map((item) => renderItemRow(item))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Mobile Responsive Summary */}
      <Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 2 }}>
        <Typography variant="body2" sx={{ color: '#666', textAlign: 'center' }}>
          Swipe horizontally to see all dates
        </Typography>
      </Box>
    </Box>
  );
}