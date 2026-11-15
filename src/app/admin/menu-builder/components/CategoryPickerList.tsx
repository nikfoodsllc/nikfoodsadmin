'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Typography } from '@mui/material';
import { IconChevronRight } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import type { FoodCategory } from '@/types/order';

interface CategoryPickerListProps {
  title: string;
  description: string;
  actionLabel: string;
  onPick: (category: FoodCategory) => void;
}

/**
 * The categories of the menu (not their sub-categories), to pick the one to work on. Used by Menu Builder and Menu Item Sequence in the
 * left menu: pick a category, then its items page / its item sequence opens. Same order as the Food Category page.
 */
export default function CategoryPickerList({ title, description, actionLabel, onPick }: CategoryPickerListProps) {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<FoodCategory[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/food-category', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load the categories.');
      const all: FoodCategory[] = json.data?.items ?? [];
      setCategories(all.filter((c) => !c.parentCategoryId).sort((a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the categories.');
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) void load();
  }, [authLoading, isAuthenticated, load]);

  if (authLoading || !isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto', px: { xs: 0, sm: 1 } }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13.5, color: '#6B7280', mt: 0.25, mb: 2 }}>{description}</Typography>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {!categories && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={26} />
        </Box>
      )}
      {categories && categories.length === 0 && <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: 'center', color: '#6B7280' }}>No categories yet.</Paper>}
      {categories?.map((c) => {
        const id = String(c._id);
        const dayWise = c.listingType === 'day-wise';
        return (
          <Paper
            key={id}
            variant="outlined"
            role="button"
            tabIndex={0}
            onClick={() => onPick(c)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(c))}
            sx={{ p: 1.25, mb: 1, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', '&:hover': { bgcolor: '#FFFBF3' } }}
          >
            <Box
              sx={{ width: 56, height: 56, borderRadius: 1.5, bgcolor: '#F3F4F6', flexShrink: 0, backgroundImage: c.url ? `url(${c.url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
              aria-hidden
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15.5, wordBreak: 'break-word' }}>{c.name}</Typography>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
                <Chip size="small" label={dayWise ? 'Day-wise' : 'Flat'} sx={{ height: 22, fontSize: 11.5, fontWeight: 700, bgcolor: dayWise ? '#EDE9FE' : '#DCFCE7', color: dayWise ? '#5B21B6' : '#166534' }} />
                {typeof c.itemCount === 'number' && <Chip size="small" label={`${c.itemCount} ${c.itemCount === 1 ? 'item' : 'items'}`} sx={{ height: 22, fontSize: 11.5, fontWeight: 700, bgcolor: '#FEF3C7', color: '#92400E' }} />}
                {c.isDraft && <Chip size="small" label="Unavailable" sx={{ height: 22, fontSize: 11.5, fontWeight: 700, bgcolor: '#FEE2E2', color: '#B91C1C' }} />}
              </Box>
            </Box>
            <Button size="small" endIcon={<IconChevronRight size={16} />} sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }} tabIndex={-1}>
              {actionLabel}
            </Button>
            <IconChevronRight size={20} style={{ flexShrink: 0 }} />
          </Paper>
        );
      })}
    </Box>
  );
}
