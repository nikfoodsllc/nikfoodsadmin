'use client';

import { useRef, useState } from 'react';
import { Box, TableCell } from '@mui/material';
import { ColumnDef, clampWidth } from '@/utils/columnPreferences';

interface ResizableHeaderCellProps {
  column: ColumnDef;
  width: number;
  /** Called on every pointer move while dragging (the table updates the column directly, no re-render). */
  onLiveResize: (key: string, width: number) => void;
  /** Called once when the drag ends (or after a keyboard nudge) with the final width. */
  onResizeEnd: (key: string, width: number) => void;
  /** Double-click on the handle: back to the default width. */
  onReset: (key: string) => void;
}

const KEY_STEP = 10;

export default function ResizableHeaderCell({ column, width, onLiveResize, onResizeEnd, onReset }: ResizableHeaderCellProps) {
  const drag = useRef<{ startX: number; startWidth: number; current: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const widthFor = (clientX: number) => {
    const d = drag.current!;
    return clampWidth(d.startWidth + (clientX - d.startX), column);
  };

  return (
    <TableCell
      sx={{
        position: 'relative',
        padding: '12px 14px 12px 8px',
        fontWeight: 600,
        color: '#374151',
        fontSize: '13px',
        whiteSpace: 'nowrap',
        textAlign: column.align ?? 'left',
      }}
    >
      {column.label}
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${column.label} column`}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { startX: e.clientX, startWidth: width, current: width };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const next = widthFor(e.clientX);
          drag.current.current = next;
          onLiveResize(column.key, next);
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          e.currentTarget.releasePointerCapture(e.pointerId);
          const finalWidth = drag.current.current;
          drag.current = null;
          setDragging(false);
          onResizeEnd(column.key, finalWidth);
        }}
        onPointerCancel={() => {
          if (!drag.current) return;
          const original = drag.current.startWidth;
          drag.current = null;
          setDragging(false);
          onLiveResize(column.key, original);
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onReset(column.key);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          onResizeEnd(column.key, clampWidth(width + (e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP), column));
        }}
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 12,
          cursor: 'col-resize',
          touchAction: 'none',
          userSelect: 'none',
          outline: 'none',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: '22%',
            bottom: '22%',
            right: 5,
            width: 2,
            borderRadius: 1,
            backgroundColor: dragging ? '#4F8CFF' : '#E5E7EB',
            transition: 'background-color 120ms',
          },
          '&:hover::after, &:focus-visible::after': { backgroundColor: '#4F8CFF' },
        }}
      />
    </TableCell>
  );
}
