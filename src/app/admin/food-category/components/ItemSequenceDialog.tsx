'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { IconGripVertical } from '@tabler/icons-react';
import { FoodCategory } from '@/types/order';
import { useAuth } from '@/contexts/AuthContext';
import { isTodayOrLater } from '@/utils/lockedMenu';
import { safeFormatCurrency } from '@/utils/currency';

interface FoodItem {
  _id: string;
  name: string;
  url?: string;
  price?: number;
  sequence?: number;
  mappingId?: string;
  mappingCategoryId?: string;
}

interface ItemGroup {
  categoryId: string;
  categoryName: string;
  isSubCategory: boolean;
  items: FoodItem[];
}

/** One day of a day-wise category (day is null for a flat category, which has a single list). */
interface DaySection {
  day: string | null;
  groups: ItemGroup[];
}

interface ItemSequenceDialogProps {
  open: boolean;
  category: FoodCategory | null;
  onClose: () => void;
  onSave: () => void;
}

const GRID_COLUMNS = {
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 6,
} as const;

function categoryHasParent(category: FoodCategory): boolean {
  const p = category.parentCategoryId;
  if (p === undefined || p === null) return false;
  if (typeof p === 'string') return p.trim().length > 0;
  return true;
}

function getGridColumnCount(
  isXl: boolean,
  isLg: boolean,
  isMd: boolean,
  isSm: boolean
): number {
  if (isXl) return GRID_COLUMNS.xl;
  if (isLg) return GRID_COLUMNS.lg;
  if (isMd) return GRID_COLUMNS.md;
  if (isSm) return GRID_COLUMNS.sm;
  return GRID_COLUMNS.xs;
}

function chunkIntoRows<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }

  return rows;
}

function reorderFlatItems(
  items: FoodItem[],
  sourceRowIndex: number,
  sourceIndex: number,
  destinationRowIndex: number,
  destinationIndex: number,
  columns: number
): FoodItem[] {
  const sourceFlatIndex = sourceRowIndex * columns + sourceIndex;
  let destinationFlatIndex = destinationRowIndex * columns + destinationIndex;

  const nextItems = Array.from(items);
  const [movedItem] = nextItems.splice(sourceFlatIndex, 1);

  if (
    sourceRowIndex !== destinationRowIndex &&
    sourceFlatIndex < destinationFlatIndex
  ) {
    destinationFlatIndex -= 1;
  }

  nextItems.splice(destinationFlatIndex, 0, movedItem);

  return nextItems.map((item, index) => ({
    ...item,
    sequence: index,
  }));
}

function parseDroppableId(droppableId: string): {
  sectionIndex: number;
  groupIndex: number;
  rowIndex: number;
} {
  const match = droppableId.match(/^s(\d+)-group-(\d+)-row-(\d+)$/);
  return {
    sectionIndex: match ? Number.parseInt(match[1], 10) : 0,
    groupIndex: match ? Number.parseInt(match[2], 10) : 0,
    rowIndex: match ? Number.parseInt(match[3], 10) : 0,
  };
}

function buildSequenceUpdates(
  groups: ItemGroup[]
): { mappingId: string; sequence: number }[] {
  const updates: { mappingId: string; sequence: number }[] = [];
  const scopeCounters = new Map<string, number>();

  for (const group of groups) {
    for (const item of group.items) {
      const scopeKey = item.mappingCategoryId || group.categoryId;
      const sequence = scopeCounters.get(scopeKey) ?? 0;

      updates.push({
        mappingId: item.mappingId || '',
        sequence,
      });

      scopeCounters.set(scopeKey, sequence + 1);
    }
  }

  return updates;
}

/** 'Wednesday, Oct 14' for a YYYY-MM-DD day */
function longDayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function getTotalItemCount(groups: ItemGroup[]): number {
  return groups.reduce((total, group) => total + group.items.length, 0);
}

function getGlobalItemIndex(
  groups: ItemGroup[],
  groupIndex: number,
  gridColumns: number,
  rowIndex: number,
  columnIndex: number
): number {
  let offset = 0;

  for (let i = 0; i < groupIndex; i++) {
    offset += groups[i].items.length;
  }

  return offset + rowIndex * gridColumns + columnIndex;
}

export default function ItemSequenceDialog({
  open,
  category,
  onClose,
  onSave,
}: ItemSequenceDialogProps) {
  const { token } = useAuth();
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.up('sm'));
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));
  const gridColumns = getGridColumnCount(isXl, isLg, isMd, isSm);

  const [sections, setSections] = useState<DaySection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const includeSubCategories = category ? !categoryHasParent(category) : false;
  const totalItems = sections.reduce((sum, section) => sum + getTotalItemCount(section.groups), 0);

  // Day-wise categories show every upcoming day one under the other, so all days are reordered and saved in one go
  useEffect(() => {
    if (!open || !category || !token) return;
    let cancelled = false;
    setError('');
    setSections([]);
    setLoading(true);

    const days: (string | null)[] =
      category.listingType === 'day-wise'
        ? (category.dayWiseItems ?? [])
            .filter((d) => d.items && d.items.length > 0 && isTodayOrLater(d.day))
            .map((d) => d.day)
            .sort()
        : [null];

    Promise.all(days.map((day) => fetchGroups(day)))
      .then((all) => {
        if (cancelled) return;
        setSections(
          days
            .map((day, index) => ({ day, groups: all[index] }))
            .filter((section) => getTotalItemCount(section.groups) > 0)
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error fetching items:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch food items');
        setSections([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category, token]);

  const fetchGroups = async (day: string | null): Promise<ItemGroup[]> => {
    if (!category || !token) return [];

    const params = new URLSearchParams({
      categoryId: category._id?.toString() || '',
    });

    if (day) {
      params.append('mappingType', 'DAY_WISE');
      params.append('day', day);
    } else {
      params.append('mappingType', 'FLAT');
    }

    if (includeSubCategories) {
      params.append('includeSubCategories', 'true');
    }

    const response = await fetch(
      `/api/admin/category-food-mapping/items?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch category items');
    }

    const data = await response.json();

    if (includeSubCategories && data.data?.groups?.length) {
      return data.data.groups;
    }

    return [
      {
        categoryId: category._id?.toString() || '',
        categoryName: category.name,
        isSubCategory: false,
        items: data.data?.items || [],
      },
    ];
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const {
      sectionIndex: sourceSectionIndex,
      groupIndex: sourceGroupIndex,
      rowIndex: sourceRowIndex,
    } = parseDroppableId(result.source.droppableId);
    const {
      sectionIndex: destinationSectionIndex,
      groupIndex: destinationGroupIndex,
      rowIndex: destinationRowIndex,
    } = parseDroppableId(result.destination.droppableId);

    // an item stays in its own day and category
    if (
      sourceSectionIndex !== destinationSectionIndex ||
      sourceGroupIndex !== destinationGroupIndex
    ) {
      return;
    }

    if (
      sourceRowIndex === destinationRowIndex &&
      result.source.index === result.destination.index
    ) {
      return;
    }

    const destinationIndex = result.destination.index;

    setSections((prevSections) =>
      prevSections.map((section, sectionIndex) => {
        if (sectionIndex !== sourceSectionIndex) {
          return section;
        }

        return {
          ...section,
          groups: section.groups.map((group, index) => {
            if (index !== sourceGroupIndex) {
              return group;
            }

            return {
              ...group,
              items: reorderFlatItems(
                group.items,
                sourceRowIndex,
                result.source.index,
                destinationRowIndex,
                destinationIndex,
                gridColumns
              ),
            };
          }),
        };
      })
    );
  };

  const handleSave = async () => {
    if (!category || !token) return;

    setSaving(true);
    setError('');

    try {
      // sequences count from 0 inside each day, so every day is numbered on its own
      const updates = sections.flatMap((section) => buildSequenceUpdates(section.groups));
      const missingMappingId = updates.find((update) => !update.mappingId);

      if (missingMappingId) {
        throw new Error('Mapping ID not found for one or more items');
      }

      const response = await fetch(
        '/api/admin/category-food-mapping/batch-sequence',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ updates }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        throw new Error(errorData.error || 'Failed to update sequence');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving sequence:', err);

      setError(
        err instanceof Error ? err.message : 'Failed to save sequence'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
          width: '95vw',
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '1.4rem',
        }}
      >
        Reorder Items - {category?.name || 'Category'}
      </DialogTitle>

      <DialogContent sx={{ overflowY: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 2,
          }}
        >
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                p: 6,
              }}
            >
              <CircularProgress />
            </Box>
          ) : totalItems === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                p: 6,
                backgroundColor: '#F8F9FA',
                borderRadius: 2,
              }}
            >
              <Typography>
                No items found for this category
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Drag items left or right within a row, or drag up/down to move
                them into another row. Items are grouped by day and category, and one Save keeps every day.
              </Typography>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                  }}
                >
                  {sections.map((section, sectionIndex) => (
                    <Box key={section.day ?? 'flat'}>
                      {section.day && (
                        <Box
                          sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 3,
                            mb: 2,
                            px: 2,
                            py: 1.25,
                            borderRadius: 2,
                            backgroundColor: '#1E3A5F',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: 1,
                          }}
                        >
                          <Typography sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
                            {longDayLabel(section.day)}
                          </Typography>
                          <Typography sx={{ fontSize: '0.85rem', opacity: 0.85 }}>
                            {getTotalItemCount(section.groups)} items
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {section.groups.map((group, groupIndex) => {
                    const itemRows = chunkIntoRows(group.items, gridColumns);

                    if (group.items.length === 0) {
                      return null;
                    }

                    return (
                      <Box key={group.categoryId}>
                        <Box
                          sx={{
                            mb: 2,
                            pl: 2,
                            py: 1,
                            borderLeft: '4px solid #4F8CFF',
                            borderRadius: '0 10px 10px 0',
                          }}
                        >
                          <Typography
                            component="h3"
                            sx={{
                              fontWeight: 600,
                              color: '#1E3A5F',
                              fontSize: { xs: '0.95rem', sm: '1.05rem' },
                            }}
                          >
                            {group.categoryName}
                            <Typography
                              component="span"
                              sx={{
                                ml: 1,
                                fontWeight: 500,
                                color: '#666',
                                fontSize: '0.85rem',
                              }}
                            >
                              ({group.items.length}{' '}
                              {group.items.length === 1 ? 'item' : 'items'})
                            </Typography>
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                        >
                          {itemRows.map((rowItems, rowIndex) => (
                            <Droppable
                              key={`s${sectionIndex}-group-${groupIndex}-row-${rowIndex}`}
                              droppableId={`s${sectionIndex}-group-${groupIndex}-row-${rowIndex}`}
                              direction="horizontal"
                            >
                              {(provided, snapshot) => (
                                <Box
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  sx={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'stretch',
                                    gap: 2,
                                    minHeight: 240,
                                    p: 1.5,
                                    borderRadius: 2,
                                    border: '1px dashed #CBD5E1',
                                    backgroundColor: snapshot.isDraggingOver
                                      ? '#E3F2FD'
                                      : '#FAFBFC',
                                    transition: 'background-color 0.2s',
                                  }}
                                >
                                  {rowItems.map((item, columnIndex) => {
                                    const globalIndex = getGlobalItemIndex(
                                      section.groups,
                                      groupIndex,
                                      gridColumns,
                                      rowIndex,
                                      columnIndex
                                    );

                                    return (
                                      <Draggable
                                        key={`${section.day ?? 'flat'}-${group.categoryId}-${item._id}`}
                                        draggableId={`${section.day ?? 'flat'}-${group.categoryId}-${item._id}`}
                                        index={columnIndex}
                                      >
                                        {(provided, snapshot) => (
                                          <Box
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            sx={{
                                              flex: '1 1 0',
                                              minWidth: 0,
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              gap: 1.5,
                                              p: 2,
                                              borderRadius: 3,
                                              border: '1px solid #E5E7EB',
                                              backgroundColor: snapshot.isDragging
                                                ? '#E3F2FD'
                                                : '#fff',
                                              boxShadow: snapshot.isDragging
                                                ? '0 8px 20px rgba(0,0,0,0.15)'
                                                : '0 2px 6px rgba(0,0,0,0.05)',
                                              transition: '0.2s',
                                              cursor: 'grab',
                                              minHeight: 220,
                                              '&:hover': {
                                                borderColor: '#4F8CFF',
                                                transform: 'translateY(-2px)',
                                              },
                                              '&:active': {
                                                cursor: 'grabbing',
                                              },
                                              ...provided.draggableProps.style,
                                            }}
                                          >
                                            <Box
                                              sx={{
                                                width: '100%',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                              }}
                                            >
                                              <Box
                                                sx={{
                                                  width: 30,
                                                  height: 30,
                                                  borderRadius: '50%',
                                                  backgroundColor: '#4F8CFF',
                                                  color: '#fff',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  fontSize: '0.85rem',
                                                  fontWeight: 700,
                                                }}
                                              >
                                                {globalIndex + 1}
                                              </Box>

                                              <IconGripVertical
                                                size={20}
                                                color="#999"
                                              />
                                            </Box>

                                            <Box
                                              sx={{
                                                width: 100,
                                                height: 100,
                                                borderRadius: 3,
                                                overflow: 'hidden',
                                                border: '1px solid #E5E7EB',
                                                backgroundColor: '#F3F4F6',
                                              }}
                                            >
                                              {item.url ? (
                                                <Box
                                                  component="img"
                                                  src={item.url}
                                                  alt={item.name}
                                                  sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                  }}
                                                />
                                              ) : (
                                                <Box
                                                  sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.75rem',
                                                    color: '#999',
                                                  }}
                                                >
                                                  No Image
                                                </Box>
                                              )}
                                            </Box>

                                            <Typography
                                              sx={{
                                                fontWeight: 600,
                                                textAlign: 'center',
                                                fontSize: '0.95rem',
                                                lineHeight: 1.4,
                                                minHeight: 42,
                                              }}
                                            >
                                              {item.name}
                                            </Typography>

                                            {item.price !== undefined &&
                                              item.price !== null &&
                                              !Number.isNaN(item.price) &&
                                              Number.isFinite(item.price) && (
                                                <Typography
                                                  sx={{
                                                    color: '#4F8CFF',
                                                    fontWeight: 700,
                                                    fontSize: '0.9rem',
                                                  }}
                                                >
                                                  {safeFormatCurrency(item.price)}
                                                </Typography>
                                              )}
                                          </Box>
                                        )}
                                      </Draggable>
                                    );
                                  })}

                                  {provided.placeholder}

                                  {Array.from({
                                    length: Math.max(
                                      0,
                                      gridColumns - rowItems.length
                                    ),
                                  }).map((_, spacerIndex) => (
                                    <Box
                                      key={`spacer-${sectionIndex}-${groupIndex}-${rowIndex}-${spacerIndex}`}
                                      sx={{
                                        flex: '1 1 0',
                                        minWidth: 0,
                                        minHeight: 220,
                                        pointerEvents: 'none',
                                      }}
                                    />
                                  ))}
                                </Box>
                              )}
                            </Droppable>
                          ))}
                        </Box>
                      </Box>
                    );
                  })}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </DragDropContext>
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          p: 3,
          gap: 1,
        }}
      >
        <Button
          onClick={handleClose}
          disabled={saving}
          sx={{
            textTransform: 'none',
            color: '#666',
          }}
        >
          Cancel
        </Button>

        <Button
          onClick={handleSave}
          disabled={loading || saving || totalItems === 0}
          variant="contained"
          sx={{
            textTransform: 'none',
            backgroundColor: '#4F8CFF',
            minWidth: 120,
            borderRadius: 2,
            '&:hover': {
              backgroundColor: '#3B7AE8',
            },
          }}
        >
          {saving ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            'Save'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
