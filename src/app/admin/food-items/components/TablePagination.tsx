'use client';

import { Box, IconButton, Typography } from '@mui/material';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function TablePagination({ currentPage, totalPages, onPageChange }: TablePaginationProps) {
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

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        marginTop: 3,
      }}
    >
      <IconButton
        onClick={handlePrevious}
        disabled={currentPage === 1}
        sx={{
          backgroundColor: '#E6F0FF',
          color: '#4F8CFF',
          '&:hover': {
            backgroundColor: '#D6E4FF',
          },
          '&.Mui-disabled': {
            backgroundColor: '#F5F5F5',
            color: '#999',
          },
        }}
      >
        <IconChevronLeft size={20} />
      </IconButton>

      <Typography variant="body2" sx={{ color: '#666', fontWeight: 500, minWidth: 100, textAlign: 'center' }}>
        Page {currentPage} of {totalPages}
      </Typography>

      <IconButton
        onClick={handleNext}
        disabled={currentPage === totalPages}
        sx={{
          backgroundColor: '#E6F0FF',
          color: '#4F8CFF',
          '&:hover': {
            backgroundColor: '#D6E4FF',
          },
          '&.Mui-disabled': {
            backgroundColor: '#F5F5F5',
            color: '#999',
          },
        }}
      >
        <IconChevronRight size={20} />
      </IconButton>
    </Box>
  );
}
