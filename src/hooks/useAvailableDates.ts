'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Global event emitter for cross-component cache invalidation
type DatesUpdateListener = () => void;
const dateListeners = new Set<DatesUpdateListener>();

export function invalidateDatesCache() {
  dateListeners.forEach(listener => listener());
}

function subscribeToDatesUpdates(listener: DatesUpdateListener) {
  dateListeners.add(listener);
  return () => {
    dateListeners.delete(listener);
  };
}

export interface AvailableDate {
  id: string;
  date: string; // YYYY-MM-DD format
  flatCategoryEnabled: boolean;
  dayWiseCategoryEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UseAvailableDatesOptions {
  startDate?: string;
  endDate?: string;
  dayWiseCategoryEnabledOnly?: boolean;
}

export interface UseAvailableDatesReturn {
  availableDates: AvailableDate[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAvailableDates(options: UseAvailableDatesOptions = {}): UseAvailableDatesReturn {
  const {
    startDate,
    endDate,
    dayWiseCategoryEnabledOnly = true
  } = options;

  const { token, isAuthenticated } = useAuth();
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use useRef for caching to prevent unnecessary refetches
  const cacheRef = useRef<{
    data: AvailableDate[] | null;
    timestamp: number;
    token: string | null;
    options: UseAvailableDatesOptions;
  }>({
    data: null,
    timestamp: 0,
    token: null,
    options: {},
  });

  // Cache duration: 30 seconds
  const CACHE_DURATION = 30 * 1000;

  const fetchAvailableDates = async (forceRefetch = false) => {
    // Check cache first (unless forcing refetch)
    if (
      !forceRefetch &&
      cacheRef.current.data &&
      cacheRef.current.token === token &&
      JSON.stringify(cacheRef.current.options) === JSON.stringify(options) &&
      Date.now() - cacheRef.current.timestamp < CACHE_DURATION
    ) {
      setAvailableDates(cacheRef.current.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Validate authentication
      if (!token || !isAuthenticated) {
        console.warn('Authentication token not found');
        setError('Authentication required');
        setAvailableDates([]);
        return;
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (startDate) {
        queryParams.append('startDate', startDate);
      }
      if (endDate) {
        queryParams.append('endDate', endDate);
      }

      const response = await fetch(`/api/admin/available-dates?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const result = await response.json();

      if (result.data && Array.isArray(result.data)) {
        let fetchedDates = result.data;

        // Filter by dayWiseCategoryEnabled if requested
        if (dayWiseCategoryEnabledOnly) {
          fetchedDates = fetchedDates.filter((date: AvailableDate) => date.dayWiseCategoryEnabled);
        }

        // Update cache
        cacheRef.current = {
          data: fetchedDates,
          timestamp: Date.now(),
          token: token,
          options: { ...options },
        };

        setAvailableDates(fetchedDates);
      } else {
        throw new Error('Invalid API response format');
      }

    } catch (err) {
      console.error('Error fetching available dates:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch available dates');
      setAvailableDates([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchAvailableDates();
  }, [token, isAuthenticated, startDate, endDate, dayWiseCategoryEnabledOnly]);

  // Subscribe to global dates update events
  useEffect(() => {
    const unsubscribe = subscribeToDatesUpdates(() => {
      fetchAvailableDates(true); // Force refetch
    });

    return unsubscribe;
  }, [token, isAuthenticated, startDate, endDate, dayWiseCategoryEnabledOnly]);

  // Manual refetch function
  const refetch = async () => {
    await fetchAvailableDates(true);
  };

  return {
    availableDates,
    loading,
    error,
    refetch,
  };
}
