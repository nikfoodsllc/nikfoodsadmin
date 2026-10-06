'use client';

import { CSSProperties, ReactNode, TransitionEventHandler, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Chip, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';
import {
  IconDotsVertical,
  IconEdit,
  IconGripHorizontal,
  IconGripVertical,
  IconListDetails,
  IconSortDescending,
  IconTrash,
} from '@tabler/icons-react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
  DraggableProvidedDragHandleProps,
  DraggableStateSnapshot,
  DraggingStyle,
  NotDraggingStyle,
} from '@hello-pangea/dnd';
import { FoodCategory } from '@/types/order';
import { CategoryGroup } from '@/utils/categoryTree';
import { moveItem } from '@/utils/categoryReorder';
import { DragAxis, constrainTransform, nudgeTransform } from '@/utils/dragConstraint';
import { useVerticalWheelPassthrough } from '@/hooks/useVerticalWheelPassthrough';

interface CategoryTableProps {
  groups: CategoryGroup<FoodCategory>[];
  onEdit: (category: FoodCategory) => void;
  onDelete: (category: FoodCategory) => void;
  onItemSequence: (category: FoodCategory) => void;
  /** New order of the top-level categories (ids, left to right). */
  onReorderCategories: (orderedIds: string[]) => void;
  /** New order of one category's sub-categories (ids, top to bottom). */
  onReorderSubCategories: (parentId: string, orderedIds: string[]) => void;
  /** Dragging is off while a filter is active (the list would be partial) or a save is running. */
  dragDisabled: boolean;
}

const COLUMN_WIDTH = 250;
const ROW_HEIGHT = 96;
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400';
const BORDER = '1px solid #E5E7EB';

const typeColor = (category: FoodCategory) => (category.listingType === 'day-wise' ? '#8B5CF6' : '#10B981');
const typeLabel = (category: FoodCategory) => (category.listingType === 'day-wise' ? 'Day-wise' : 'Flat');
const idOf = (category: FoodCategory) => String(category._id);

function itemCountOf(category: FoodCategory): number {
  if (category.itemCount !== undefined) return category.itemCount;
  if (category.listingType === 'day-wise' && category.dayWiseItems) {
    return category.dayWiseItems.reduce((total, day) => total + day.items.length, 0);
  }
  return 0;
}

function DragHandle({
  handleProps,
  label,
  horizontal,
  disabled,
}: {
  handleProps?: DraggableProvidedDragHandleProps | null;
  label: string;
  horizontal?: boolean;
  disabled: boolean;
}) {
  if (!handleProps) return null;
  return (
    <Box
      {...handleProps}
      aria-label={label}
      title={disabled ? 'Show all categories to re-rank' : label}
      onClick={(e) => e.stopPropagation()}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 1,
        color: disabled ? '#D1D5DB' : '#9CA3AF',
        cursor: disabled ? 'not-allowed' : 'grab',
        '&:hover, &:focus-visible': {
          color: disabled ? '#D1D5DB' : '#4F8CFF',
          backgroundColor: disabled ? 'transparent' : '#EEF4FF',
        },
      }}
    >
      {horizontal ? <IconGripHorizontal size={18} /> : <IconGripVertical size={18} />}
    </Box>
  );
}

/** One category or sub-category: image, name, rank, type, item count, actions menu and (when given) a drag handle. */
function CategoryEntry({
  category,
  isTop,
  handle,
  onEdit,
  onDelete,
  onItemSequence,
}: { category: FoodCategory; isTop: boolean; handle: ReactNode } & Pick<CategoryTableProps, 'onEdit' | 'onDelete' | 'onItemSequence'>) {
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const count = itemCountOf(category);
  const close = () => setAnchor(null);
  const manageItems = () => router.push(`/admin/food-category/${category._id?.toString()}/items`);
  const image = `url("${category.url || DEFAULT_IMAGE}")`;

  const countChip =
    isTop && count > 0 ? (
      <Chip
        size="small"
        label={`${count} ${count === 1 ? 'item' : 'items'}`}
        onClick={(e) => {
          e.stopPropagation();
          manageItems();
        }}
        sx={{
          height: 20,
          fontSize: 11,
          bgcolor: '#F59E0B',
          color: '#fff',
          fontWeight: 600,
          '&:hover': { bgcolor: '#D97706' },
        }}
      />
    ) : (
      <Chip
        size="small"
        label={`${count} ${count === 1 ? 'item' : 'items'}`}
        sx={{
          height: 20,
          fontSize: 11,
          fontWeight: 600,
          bgcolor: count > 0 ? '#FEF3C7' : '#F3F4F6',
          color: count > 0 ? '#92400E' : '#6B7280',
        }}
      />
    );

  const chips = (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
      <Chip
        size="small"
        label={`#${category.sequence || 0}`}
        sx={{
          height: 20,
          fontSize: 11,
          bgcolor: '#EEF2FF',
          color: '#4F8CFF',
          fontWeight: 600,
        }}
      />
      <Chip
        size="small"
        label={typeLabel(category)}
        sx={{
          height: 20,
          fontSize: 11,
          bgcolor: typeColor(category),
          color: '#fff',
          fontWeight: 600,
        }}
      />
      {countChip}
    </Box>
  );

  const menuButton = (
    <IconButton
      size="small"
      aria-label={`Actions for ${category.name}`}
      onClick={(e) => {
        e.stopPropagation();
        setAnchor(e.currentTarget);
      }}
      sx={{ color: '#4F8CFF', p: 0.5 }}
    >
      <IconDotsVertical size={18} />
    </IconButton>
  );

  return (
    <Box
      onClick={() => onEdit(category)}
      title={category.description || undefined}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        cursor: 'pointer',
      }}
    >
      {isTop && (
        <Box
          role="img"
          aria-label={category.name}
          sx={{
            width: '100%',
            height: 96,
            borderRadius: 1.5,
            backgroundColor: '#FFF4E4',
            backgroundImage: image,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        {!isTop && (
          <Box
            role="img"
            aria-label={category.name}
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 1,
              backgroundColor: '#FFF4E4',
              backgroundImage: image,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontWeight: isTop ? 700 : 500,
              fontSize: isTop ? 15 : 14,
              color: '#111827',
              lineHeight: 1.3,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {category.name}
            {category.isDraft ? (
              <Typography component="span" sx={{ fontSize: 12, color: '#B45309', ml: 0.75 }}>
                (draft)
              </Typography>
            ) : null}
          </Typography>
          {chips}
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
            mr: -0.5,
          }}
        >
          {menuButton}
          {handle}
        </Box>
      </Box>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {isTop && (
          <MenuItem
            onClick={() => {
              close();
              manageItems();
            }}
            sx={{ gap: 1.5 }}
          >
            <ListItemIcon>
              <IconListDetails size={18} />
            </ListItemIcon>
            Manage Category Items
          </MenuItem>
        )}
        {isTop && (
          <MenuItem
            onClick={() => {
              close();
              onItemSequence(category);
            }}
            sx={{ gap: 1.5 }}
          >
            <ListItemIcon>
              <IconSortDescending size={18} />
            </ListItemIcon>
            Item Sequence
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            close();
            onEdit(category);
          }}
          sx={{ gap: 1.5 }}
        >
          <ListItemIcon>
            <IconEdit size={18} />
          </ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            onDelete(category);
          }}
          sx={{ gap: 1.5, color: '#FF7675' }}
        >
          <ListItemIcon>
            <IconTrash size={18} color="#FF7675" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}

/**
 * Style for the item being dragged: locked to one axis and held inside `container` (the row or column it
 * belongs to). `leftLimit` is a further left edge the item may not cross (the sticky label column, which
 * lies over the row when the table is scrolled sideways).
 */
function dragStyle(
  style: DraggingStyle | NotDraggingStyle | undefined,
  snapshot: DraggableStateSnapshot,
  axis: DragAxis,
  container: HTMLElement | null,
  leftLimit?: HTMLElement | null,
): CSSProperties | undefined {
  if (!style || !snapshot.isDragging || snapshot.isDropAnimating || !('left' in style)) return style;
  const box = container?.getBoundingClientRect();
  const limit = leftLimit?.getBoundingClientRect().right ?? -Infinity;
  const transform = constrainTransform(
    style.transform ?? undefined,
    axis,
    { left: style.left, top: style.top, width: style.width, height: style.height },
    box ? { left: Math.max(box.left, limit), top: box.top, right: box.right, bottom: box.bottom } : null,
  );
  return { ...style, transform: nudgeTransform(transform, axis) };
}

/**
 * Safety net for the drop animation: the drag library finishes a drop only when the browser reports that
 * the item's transform transition ended, and a browser sometimes never does (Safari, interrupted layout).
 * The item would then stay stuck mid-drag. If a drop is still animating after a moment, finish it ourselves.
 */
function DropSafetyNet({ dropping, onTransitionEnd }: { dropping: boolean; onTransitionEnd?: TransitionEventHandler<HTMLElement> }) {
  const finish = useRef(onTransitionEnd);
  finish.current = onTransitionEnd;
  useEffect(() => {
    if (!dropping) return;
    const timer = setTimeout(
      () => finish.current?.({ propertyName: 'transform' } as unknown as Parameters<TransitionEventHandler<HTMLElement>>[0]),
      700,
    );
    return () => clearTimeout(timer);
  }, [dropping]);
  return null;
}

const labelCellSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  flexShrink: 0,
  boxSizing: 'border-box',
  bgcolor: '#F9FAFB',
  width: { xs: 104, sm: 132 },
  px: { xs: 1, sm: 2 },
  py: 1.5,
  fontWeight: 700,
  fontSize: { xs: 11.5, sm: 14 },
  color: '#374151',
  borderRight: BORDER,
} as const;

/**
 * Food categories as a table: one column per category (in rank order), its sub-categories listed
 * underneath in rank order. Drag a category's handle left or right to re-rank the categories, and a
 * sub-category's handle up or down to re-rank the sub-categories of that category. The first column
 * holds the row labels and stays in view when the table scrolls sideways.
 */
export default function CategoryTable({
  groups,
  onEdit,
  onDelete,
  onItemSequence,
  onReorderCategories,
  onReorderSubCategories,
  dragDisabled,
}: CategoryTableProps) {
  // the row / columns managed by the drag library and the sticky label cell: a dragged item is held inside its own area
  const dropAreas = useRef<Record<string, HTMLElement | null>>({});
  const labelCell = useRef<HTMLDivElement | null>(null);
  // the table scrolls sideways, which must not swallow vertical scrolling of the page; paused while dragging
  const dragging = useRef(false);
  const scrollArea = useVerticalWheelPassthrough<HTMLDivElement>(() => dragging.current);
  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    const droppableId = source.droppableId;
    if (!destination || destination.droppableId !== droppableId || destination.index === source.index) return;
    if (droppableId === 'categories') {
      onReorderCategories(
        moveItem(
          groups.map((g) => g.parentId),
          source.index,
          destination.index,
        ),
      );
      return;
    }
    const group = groups.find((g) => `subs-${g.parentId}` === droppableId);
    if (group) onReorderSubCategories(group.parentId, moveItem(group.children.map(idOf), source.index, destination.index));
  };

  return (
    <Box
      ref={scrollArea}
      sx={{
        border: BORDER,
        borderRadius: 2,
        bgcolor: '#fff',
        maxWidth: '100%',
        overflowX: 'auto',
      }}
    >
      <DragDropContext
        onDragStart={() => {
          dragging.current = true;
        }}
        onDragEnd={(result) => {
          dragging.current = false;
          handleDragEnd(result);
        }}
      >
        <Box sx={{ width: 'max-content', minWidth: '100%' }}>
          {/* Row 1: the categories (drag sideways) */}
          {/* The whole row, label included, is the drop zone, so releasing over the label (easy to do on a phone) still drops at the start */}
          <Droppable droppableId="categories" direction="horizontal" type="CATEGORY">
            {(drop) => (
              <Box
                ref={(el: HTMLDivElement | null) => {
                  drop.innerRef(el);
                  dropAreas.current.categories = el;
                }}
                {...drop.droppableProps}
                sx={{ display: 'flex', borderBottom: '2px solid #111827' }}
              >
                <Box ref={labelCell} sx={labelCellSx}>
                  Categories
                </Box>
                {groups.map((group, index) => (
                  <Draggable
                    key={group.parentId}
                    draggableId={`cat-${group.parentId}`}
                    index={index}
                    isDragDisabled={dragDisabled || !group.parent}
                  >
                    {(drag, snapshot) => (
                      <Box
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        style={dragStyle(drag.draggableProps.style, snapshot, 'x', dropAreas.current.categories, labelCell.current)}
                        sx={{
                          width: COLUMN_WIDTH,
                          flexShrink: 0,
                          boxSizing: 'border-box',
                          p: 1.5,
                          borderRight: BORDER,
                          bgcolor: snapshot.isDragging ? '#EEF4FF' : '#fff',
                          boxShadow: snapshot.isDragging ? '0 6px 18px rgba(0,0,0,0.18)' : 'none',
                        }}
                      >
                        <DropSafetyNet dropping={snapshot.isDropAnimating} onTransitionEnd={drag.draggableProps.onTransitionEnd} />
                        {group.parent ? (
                          <CategoryEntry
                            category={group.parent}
                            isTop
                            handle={
                              <DragHandle
                                handleProps={drag.dragHandleProps}
                                label={`Drag to re-rank ${group.parent.name} (left or right)`}
                                horizontal
                                disabled={dragDisabled}
                              />
                            }
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onItemSequence={onItemSequence}
                          />
                        ) : (
                          <Typography
                            sx={{
                              fontSize: 13,
                              color: '#6B7280',
                              fontStyle: 'italic',
                            }}
                            {...(drag.dragHandleProps ?? {})}
                          >
                            {group.parentName ? `${group.parentName} (hidden by the filter)` : 'Parent not found'}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Draggable>
                ))}
                {drop.placeholder}
              </Box>
            )}
          </Droppable>

          {/* Row 2: each category's sub-categories (drag up or down inside their own column) */}
          <Box sx={{ display: 'flex' }}>
            <Box sx={{ ...labelCellSx, alignSelf: 'stretch' }}>Subcategories</Box>
            <Box sx={{ display: 'flex' }}>
              {groups.map((group) => (
                <Droppable key={group.parentId} droppableId={`subs-${group.parentId}`} type={`SUB-${group.parentId}`}>
                  {(drop) => (
                    <Box
                      ref={(el: HTMLDivElement | null) => {
                        drop.innerRef(el);
                        dropAreas.current[`subs-${group.parentId}`] = el;
                      }}
                      {...drop.droppableProps}
                      sx={{
                        width: COLUMN_WIDTH,
                        flexShrink: 0,
                        boxSizing: 'border-box',
                        borderRight: BORDER,
                        minHeight: ROW_HEIGHT,
                      }}
                    >
                      {group.children.map((sub, index) => (
                        <Draggable key={idOf(sub)} draggableId={`sub-${idOf(sub)}`} index={index} isDragDisabled={dragDisabled}>
                          {(drag, snapshot) => (
                            <Box
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              style={dragStyle(drag.draggableProps.style, snapshot, 'y', dropAreas.current[`subs-${group.parentId}`])}
                              sx={{
                                height: ROW_HEIGHT,
                                boxSizing: 'border-box',
                                px: 1.5,
                                py: 1.25,
                                borderBottom: BORDER,
                                bgcolor: snapshot.isDragging ? '#EEF4FF' : '#fff',
                                boxShadow: snapshot.isDragging ? '0 6px 18px rgba(0,0,0,0.18)' : 'none',
                                overflow: 'hidden',
                              }}
                            >
                              <DropSafetyNet dropping={snapshot.isDropAnimating} onTransitionEnd={drag.draggableProps.onTransitionEnd} />
                              <CategoryEntry
                                category={sub}
                                isTop={false}
                                handle={
                                  <DragHandle
                                    handleProps={drag.dragHandleProps}
                                    label={`Drag to re-rank ${sub.name} (up or down)`}
                                    disabled={dragDisabled}
                                  />
                                }
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onItemSequence={onItemSequence}
                              />
                            </Box>
                          )}
                        </Draggable>
                      ))}
                      {drop.placeholder}
                    </Box>
                  )}
                </Droppable>
              ))}
            </Box>
          </Box>
        </Box>
      </DragDropContext>
    </Box>
  );
}
