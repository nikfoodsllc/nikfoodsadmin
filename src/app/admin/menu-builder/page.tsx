'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useFoodMenuCategory } from './useFoodMenuCategory';

/** Menu Builder (left menu): opens the Food Menu's builder straight away (which items are on which day). */
export default function MenuBuilderPage() {
  const router = useRouter();
  const { category, error } = useFoodMenuCategory();

  useEffect(() => {
    if (category?._id) router.replace(`/admin/menu-builder/${String(category._id)}`);
  }, [category, router]);

  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );
}
