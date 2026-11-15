'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { FoodCategory } from '@/types/order';

/**
 * The Food Menu category (the day-wise menu): the one Menu Builder and Menu Item Sequence in the left menu work on. Found by its name among
 * the top-level categories; if nobody called one "Food Menu", the first top-level day-wise category.
 */
export function useFoodMenuCategory(): { category: FoodCategory | null; error: string; loading: boolean } {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/food-category', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not load the Food Menu.');
        const top: FoodCategory[] = (json.data?.items ?? []).filter((c: FoodCategory) => !c.parentCategoryId);
        const found = top.find((c) => c.name.trim().toLowerCase() === 'food menu') ?? top.find((c) => c.listingType === 'day-wise') ?? null;
        if (cancelled) return;
        if (!found) setError('The Food Menu category was not found.');
        setCategory(found);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the Food Menu.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, token]);

  return { category, error, loading: loading || authLoading };
}
