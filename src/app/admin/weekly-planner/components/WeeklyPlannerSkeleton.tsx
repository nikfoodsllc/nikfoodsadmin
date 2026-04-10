'use client';

import React from 'react';
import { Box, Card, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

export default function WeeklyPlannerSkeleton() {
  return (
    <Box sx={{ p: 4, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Card Skeleton */}
      <Card
        sx={{
          background: '#E6F0FF',
          p: 3,
          borderRadius: 3,
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Skeleton variant="rectangular" width={280} height={28} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" width={240} height={16} sx={{ borderRadius: 1 }} />
          </Box>
          <Skeleton variant="rectangular" width={160} height={40} sx={{ borderRadius: 2 }} />
        </Box>
      </Card>

      {/* Search Bar Skeleton */}
      <Card sx={{ mb: 3, p: 2, borderRadius: 3 }}>
        <Skeleton variant="rectangular" width="100%" height={36} sx={{ borderRadius: 1 }} />
      </Card>

      {/* Table Skeleton */}
      <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Table>
          {/* Table Header */}
          <TableHead sx={{ backgroundColor: '#E6F0FF' }}>
            <TableRow sx={{ borderBottom: '2px solid #4F8CFF' }}>
              <TableCell>
                <Skeleton variant="rectangular" width={120} height={20} sx={{ borderRadius: 1 }} />
              </TableCell>
              {[...Array(6)].map((_, i) => (
                <TableCell key={i} align="center">
                  <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: 1, mx: 'auto' }} />
                </TableCell>
              ))}
              <TableCell align="center">
                <Skeleton variant="rectangular" width={80} height={20} sx={{ borderRadius: 1, mx: 'auto' }} />
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {/* Render 3 categories */}
            {[1, 2, 3].map((catIndex) => (
              <React.Fragment key={catIndex}>
                {/* Category Header Row */}
                <TableRow sx={{ backgroundColor: '#F6FAFF' }}>
                  <TableCell colSpan={8} sx={{ py: 1.5 }}>
                    <Skeleton variant="rectangular" width={200} height={24} sx={{ borderRadius: 1 }} />
                  </TableCell>
                </TableRow>

                {/* Category Items */}
                {[1, 2, 3, 4].map((itemIndex) => (
                  <TableRow
                    key={itemIndex}
                    sx={{
                      backgroundColor: itemIndex % 2 === 0 ? '#fff' : '#FAFAFA',
                      borderBottom: '1px solid #F0F0F0',
                    }}
                  >
                    <TableCell>
                      <Skeleton variant="rectangular" width={240} height={20} sx={{ borderRadius: 1 }} />
                    </TableCell>
                    {[...Array(6)].map((_, dayIndex) => (
                      <TableCell key={dayIndex} align="center">
                        <Skeleton variant="circular" width={24} height={24} sx={{ mx: 'auto' }} />
                      </TableCell>
                    ))}
                    <TableCell align="center">
                      <Skeleton variant="circular" width={24} height={24} sx={{ mx: 'auto' }} />
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
