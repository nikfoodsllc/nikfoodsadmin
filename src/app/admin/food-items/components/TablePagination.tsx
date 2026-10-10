'use client';

import { Box, IconButton, MenuItem, Select, Typography } from '@mui/material';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { PAGE_SIZE_OPTIONS, PageSize, pageSizeLabel, parsePageSize, rangeText } from '@/utils/pageSize';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** With these three, the rows-per-page choice (10 / 50 / 100 / All) and the record range are shown too. */
  pageSize?: PageSize;
  onPageSizeChange?: (size: PageSize) => void;
  totalItems?: number;
  /** Greys out the whole control (e.g. while there are unsaved edits on the page). */
  disabled?: boolean;
}

const arrowSx = {
  backgroundColor: '#E6F0FF',
  color: '#4F8CFF',
  '&:hover': {
    backgroundColor: '#D6E4FF',
  },
  '&.Mui-disabled': {
    backgroundColor: '#F5F5F5',
    color: '#999',
  },
};

export default function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
  disabled = false,
}: TablePaginationProps) {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const showSizeChoice = pageSize !== undefined && onPageSizeChange !== undefined;
  const showAll = pageSize === 'all';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        columnGap: 3,
        rowGap: 1.5,
        marginTop: 3,
      }}
    >
      {showSizeChoice && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" component="label" htmlFor="rows-per-page" sx={{ color: '#666', fontWeight: 500 }}>
            Rows
          </Typography>
          <Select
            size="small"
            value={String(pageSize)}
            disabled={disabled}
            onChange={(e) => onPageSizeChange(parsePageSize(e.target.value))}
            inputProps={{ id: 'rows-per-page', 'aria-label': 'Rows per page' }}
            sx={{ minWidth: 84, backgroundColor: '#fff', '& .MuiSelect-select': { py: 0.75 } }}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <MenuItem key={String(option)} value={String(option)}>
                {pageSizeLabel(option)}
              </MenuItem>
            ))}
          </Select>
        </Box>
      )}

      {!showAll && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handlePrevious} disabled={disabled || currentPage === 1} aria-label="Previous page" sx={arrowSx}>
            <IconChevronLeft size={20} />
          </IconButton>

          <Typography variant="body2" sx={{ color: '#666', fontWeight: 500, minWidth: 100, textAlign: 'center' }}>
            Page {currentPage} of {totalPages}
          </Typography>

          <IconButton
            onClick={handleNext}
            disabled={disabled || currentPage >= totalPages}
            aria-label="Next page"
            sx={arrowSx}
          >
            <IconChevronRight size={20} />
          </IconButton>
        </Box>
      )}

      {showSizeChoice && totalItems !== undefined && (
        <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>
          {rangeText(currentPage, pageSize, totalItems)}
        </Typography>
      )}
    </Box>
  );
}
