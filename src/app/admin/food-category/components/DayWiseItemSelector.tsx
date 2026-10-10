'use client';

import { Fragment, useState, useEffect, useMemo, type ReactNode } from 'react';
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
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { IconSearch, IconX, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
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
import { nameMatchesSearch } from '@/utils/itemSearch';

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
  /** shown on the right of the search box (the page puts Save Changes here) */
  actions?: ReactNode;
}

// Row tints: locked = amber, on for any day = green, on for no day = plain white
const ROW_TINTS = {
  locked: { bg: '#FFF1D6', hover: '#FFE8BA' },
  on: { bg: '#E6F6EA', hover: '#D5EFDC' },
  off: { bg: '#FFFFFF', hover: 'rgba(79, 140, 255, 0.06)' },
};

export default function DayWiseItemSelector({
  value,
  onChange,
  lockedItemIds,
  onLockedItemIdsChange,
  disabled = false,
  categoryId = '',
  categoryName = '',
  actions,
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

  const baseGroups = useMemo((): ItemGroup[] => {
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

  const [search, setSearch] = useState('');
  // sub-category sections start folded; a search opens the ones that have matches
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const searching = search.trim().length > 0;
  const isGroupOpen = (group: ItemGroup) =>
    !showSubCategoryGroups || searching || expandedGroups.has(group.categoryId);
  const toggleGroup = (groupId: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  // the search only hides rows: ticks, locks and what is saved are untouched
  const itemGroups = useMemo(
    () =>
      searching
        ? baseGroups
            .map((group) => ({ ...group, items: group.items.filter((item) => nameMatchesSearch(item.name, search)) }))
            .filter((group) => group.items.length > 0)
        : baseGroups,
    [baseGroups, search, searching]
  );

  const baseItemCount = baseGroups.reduce((count, group) => count + group.items.length, 0);
  const totalDisplayItems = itemGroups.reduce(
    (count, group) => count + group.items.length,
    0
  );

  const renderItemRow = (item: FoodItem) => {
    const tint = lockedItemIdSet.has(item._id)
      ? ROW_TINTS.locked
      : allDateLabels.some((_, dateIndex) => isItemSelectedForDay(dateIndex, item._id))
        ? ROW_TINTS.on
        : ROW_TINTS.off;
    return (
    <TableRow
      key={item._id}
      sx={{
        backgroundColor: tint.bg,
        '&:hover': {
          backgroundColor: tint.hover,
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
  };

  const renderGroupHeader = (group: ItemGroup) => (
    <TableRow
      key={`header-${group.categoryId}`}
      hover
      role="button"
      tabIndex={0}
      aria-expanded={isGroupOpen(group)}
      onClick={() => {
        if (!searching) toggleGroup(group.categoryId);
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !searching) {
          e.preventDefault();
          toggleGroup(group.categoryId);
        }
      }}
      sx={{ cursor: searching ? 'default' : 'pointer' }}
    >
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
            // the header row spans every date column: keep its text in view while the table is scrolled sideways
            position: 'sticky',
            left: 16,
            width: 'max-content',
            maxWidth: 'calc(100vw - 96px)',
          }}
        >
          {isGroupOpen(group) ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
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
                display: { xs: 'none', sm: 'inline-flex' },
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
          {group.items.some((item) => assignedItemIds.has(item._id)) && (
            <Chip
              label={`${group.items.filter((item) => assignedItemIds.has(item._id)).length} picked`}
              size="small"
              color="primary"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
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
        Use <strong>Lock</strong> on a row to repeat it every week: it keeps its date selections when you click Clear All. When you press Save Changes it is also added to the later days that are already switched on, on the same weekdays (a Friday item goes onto the next Fridays), and again when you enable new days in Manage Days.
        {showSubCategoryGroups && (
          <>
            {' '}
            Items are grouped by sub-category based on their Food Items assignments.
          </>
        )}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search food items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ 'aria-label': 'Search food items' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={18} />
              </InputAdornment>
            ),
            endAdornment: searching ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Clear search" onClick={() => setSearch('')}>
                  <IconX size={16} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
          sx={{ flex: '1 1 260px', maxWidth: 420 }}
        />
        {actions}
      </Box>
      {showSubCategoryGroups && !searching && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Chip
            label="Expand all"
            size="small"
            variant="outlined"
            onClick={() => setExpandedGroups(new Set(baseGroups.map((group) => group.categoryId)))}
          />
          <Chip label="Collapse all" size="small" variant="outlined" onClick={() => setExpandedGroups(new Set())} />
        </Box>
      )}
      {searching && (
        <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 1 }}>
          {totalDisplayItems} of {baseItemCount} items
        </Typography>
      )}

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
                      {searching
                        ? 'No food items match your search'
                        : showSubCategoryGroups
                        ? 'No food items are assigned to this category or its sub-categories yet'
                        : 'No food items available'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                itemGroups.map((group) => (
                  <Fragment key={group.categoryId}>
                    {showSubCategoryGroups && renderGroupHeader(group)}
                    {isGroupOpen(group) && group.items.map((item) => renderItemRow(item))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* What is picked for each day (names, grouped like the table) */}
      {allDateLabels.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#333', mb: 1.5 }}>
            Picked for each day
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
              gap: 2,
            }}
          >
            {allDateLabels.map((dateInfo, dayIndex) => {
              const picked = baseGroups
                .map((group) => ({
                  group,
                  items: group.items.filter((item) => isItemSelectedForDay(dayIndex, item._id)),
                }))
                .filter((entry) => entry.items.length > 0);
              return (
                <Box
                  key={dateInfo.date}
                  sx={{ border: '1px solid #E0E0E0', borderRadius: 2, p: 1.5, minWidth: 0, backgroundColor: '#fff' }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#333' }}>
                      {dateInfo.displayLabel}
                    </Typography>
                    <Chip
                      label={getSelectedItemsCount(dayIndex)}
                      size="small"
                      sx={{ backgroundColor: '#FF9F2E', color: '#fff', fontWeight: 600, height: 20 }}
                    />
                  </Box>
                  {picked.length === 0 ? (
                    <Typography variant="caption" sx={{ color: '#999' }}>
                      Nothing picked yet
                    </Typography>
                  ) : (
                    picked.map(({ group, items }) => (
                      <Box key={group.categoryId} sx={{ mb: 1 }}>
                        {showSubCategoryGroups && (
                          <Typography
                            variant="caption"
                            sx={{ display: 'block', color: '#7C3AED', fontWeight: 600, mb: 0.25 }}
                          >
                            {group.categoryName}
                          </Typography>
                        )}
                        {items.map((item) => (
                          <Box key={item._id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                flexShrink: 0,
                                backgroundColor: item.veg ? '#4CAF50' : '#F44336',
                              }}
                            />
                            <Typography variant="body2" sx={{ color: '#333', lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                              {item.name}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ))
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Mobile Responsive Summary */}
      <Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 2 }}>
        <Typography variant="body2" sx={{ color: '#666', textAlign: 'center' }}>
          Swipe horizontally to see all dates
        </Typography>
      </Box>
    </Box>
  );
}