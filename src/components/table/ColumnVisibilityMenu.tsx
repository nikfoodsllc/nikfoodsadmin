'use client';

import { useState } from 'react';
import { Box, Button, Checkbox, Divider, FormControlLabel, Popover, Typography } from '@mui/material';
import { IconColumns3, IconGripVertical } from '@tabler/icons-react';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { ColumnDef } from '@/utils/columnPreferences';
import type { ColumnSyncStatus } from '@/hooks/useColumnPreferences';

interface ColumnVisibilityMenuProps {
  /** Every column in its current order (hidden ones included). Locked columns are not listed. */
  columns: ColumnDef[];
  hiddenKeys: Set<string>;
  onToggle: (key: string) => void;
  /** Move a column to a position among the listed (unlocked) columns. */
  onMove: (key: string, toIndex: number) => void;
  onShowAll: () => void;
  /** Back to the original order and widths, with all columns shown. */
  onReset: () => void;
  syncStatus?: ColumnSyncStatus;
  disabled?: boolean;
  /** What the list holds, for the button and title (default 'Columns'). */
  label?: string;
  /** Help text under the title (default explains columns). */
  description?: string;
}

const STATUS_TEXT: Record<ColumnSyncStatus, string> = {
  idle: '',
  saving: 'Saving to your account…',
  saved: 'Saved to your account',
  error: "Couldn't reach your account, so this is saved on this computer only",
};

const DEFAULT_DESCRIPTION =
  'Tick to show or hide. Drag a row by its handle to change the order the table shows. You can also resize a column by dragging the edge of its header.';

export default function ColumnVisibilityMenu({
  columns,
  hiddenKeys,
  onToggle,
  onMove,
  onShowAll,
  onReset,
  syncStatus = 'idle',
  disabled,
  label = 'Columns',
  description = DEFAULT_DESCRIPTION,
}: ColumnVisibilityMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const listed = columns.filter((c) => !c.locked);
  const hiddenCount = listed.filter((c) => hiddenKeys.has(c.key)).length;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    onMove(result.draggableId, result.destination.index);
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<IconColumns3 size={18} />}
        onClick={(e) => setAnchor(e.currentTarget)}
        disabled={disabled}
        sx={{
          textTransform: 'none',
          borderRadius: 2,
          px: 2.5,
          borderColor: hiddenCount > 0 ? '#4F8CFF' : '#E5E7EB',
          color: hiddenCount > 0 ? '#4F8CFF' : '#374151',
          '&:hover': { borderColor: '#4F8CFF', backgroundColor: 'rgba(79, 140, 255, 0.04)' },
        }}
      >
        {hiddenCount > 0 ? `${label} (${hiddenCount} hidden)` : label}
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { borderRadius: 2, mt: 0.5, width: 300, maxHeight: 'calc(100vh - 100px)' } } }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{label}</Typography>
          <Typography sx={{ fontSize: '12px', color: '#6B7280', mt: 0.25 }}>
            {description}
          </Typography>
        </Box>
        <Divider />
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="table-columns">
            {(dropProvided) => (
              <Box
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
                sx={{ display: 'flex', flexDirection: 'column', px: 1, py: 0.5, maxHeight: 'min(560px, calc(100vh - 330px))', overflowY: 'auto' }}
              >
                {listed.map((c, index) => (
                  <Draggable key={c.key} draggableId={c.key} index={index}>
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 1,
                          backgroundColor: snapshot.isDragging ? '#EEF4FF' : 'transparent',
                          boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                        }}
                      >
                        <Box
                          {...provided.dragHandleProps}
                          aria-label={`Move ${c.label}. Press space, then the arrow keys, then space.`}
                          sx={{ display: 'flex', alignItems: 'center', color: '#9CA3AF', cursor: 'grab', px: 0.5, py: 1, '&:hover, &:focus-visible': { color: '#4F8CFF' } }}
                        >
                          <IconGripVertical size={18} />
                        </Box>
                        <FormControlLabel
                          label={c.label}
                          control={<Checkbox size="small" checked={!hiddenKeys.has(c.key)} onChange={() => onToggle(c.key)} />}
                          sx={{ m: 0, flex: 1, '& .MuiFormControlLabel-label': { fontSize: '13px', color: '#374151' } }}
                        />
                      </Box>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
        <Divider />
        <Box sx={{ px: 2, pt: 0.75, minHeight: 22 }}>
          <Typography
            role="status"
            sx={{ fontSize: '11px', color: syncStatus === 'error' ? '#B45309' : '#6B7280' }}
          >
            {STATUS_TEXT[syncStatus]}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, pb: 1 }}>
          <Button size="small" onClick={onShowAll} disabled={hiddenCount === 0} sx={{ textTransform: 'none' }}>
            Show all
          </Button>
          <Button size="small" onClick={onReset} sx={{ textTransform: 'none', color: '#6B7280' }}>
            Reset layout
          </Button>
        </Box>
      </Popover>
    </>
  );
}
