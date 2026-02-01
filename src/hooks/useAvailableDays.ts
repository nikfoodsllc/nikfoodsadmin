'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Global event emitter for cross-component cache invalidation
type DaysUpdateListener = () => void;
const listeners = new Set<DaysUpdateListener>();

export function invalidateDaysCache() {
  listeners.forEach(listener => listener());
}

function subscribeToDaysUpdates(listener: DaysUpdateListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface AvailableDay {
  id: string;
  day: string;
  label: string;
  enabled: boolean;
  sequence: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UseAvailableDaysOptions {
  enabledOnly?: boolean;
}

export interface UseAvailableDaysReturn {
  availableDays: AvailableDay[];
  enabledDays: AvailableDay[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Keep DEFAULT_DAYS for absolute emergency fallback only
const DEFAULT_DAYS: AvailableDay[] = [
  { id: '1', day: 'monday', label: 'Monday', enabled: true, sequence: 1 },
  { id: '2', day: 'tuesday', label: 'Tuesday', enabled: true, sequence: 2 },
  { id: '3', day: 'wednesday', label: 'Wednesday', enabled: true, sequence: 3 },
  { id: '4', day: 'thursday', label: 'Thursday', enabled: true, sequence: 4 },
  { id: '5', day: 'friday', label: 'Friday', enabled: true, sequence: 5 },
  { id: '6', day: 'saturday', label: 'Saturday', enabled: true, sequence: 6 },
  { id: '7', day: 'sunday', label: 'Sunday', enabled: true, sequence: 7 },
];

export function useAvailableDays(options: UseAvailableDaysOptions = {}): UseAvailableDaysReturn {
  const { enabledOnly = false } = options; // Changed default: fetch ALL days by default
  const { token, isAuthenticated } = useAuth();
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use useRef for caching to prevent unnecessary refetches
  const cacheRef = useRef<{
    data: AvailableDay[] | null;
    timestamp: number;
    token: string | null;
    enabledOnly: boolean;
  }>({
    data: null,
    timestamp: 0,
    token: null,
    enabledOnly: false,
  });

  // Reduced cache duration: 30 seconds (was 5 minutes)
  const CACHE_DURATION = 30 * 1000;

  const fetchAvailableDays = async (forceRefetch = false) => {
    // Check cache first (unless forcing refetch)
    if (
      !forceRefetch &&
      cacheRef.current.data &&
      cacheRef.current.token === token &&
      cacheRef.current.enabledOnly === enabledOnly &&
      Date.now() - cacheRef.current.timestamp < CACHE_DURATION
    ) {
      setAvailableDays(cacheRef.current.data);
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
        setAvailableDays([]);
        return;
      }

      // Always fetch without enabledOnly to get complete data
      // We'll filter client-side if needed
      const response = await fetch(`/api/admin/days`, {
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
        const fetchedDays = result.data;

        // Update cache
        cacheRef.current = {
          data: fetchedDays,
          timestamp: Date.now(),
          token: token,
          enabledOnly: enabledOnly,
        };

        setAvailableDays(fetchedDays);
      } else {
        throw new Error('Invalid API response format');
      }

    } catch (err) {
      console.error('Error fetching available days:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch available days');
      setAvailableDays([]);
    } finally {
      setLoading(false);
    }
  };

  // Memoize enabled days for convenience
  const enabledDays = useMemo(() => {
    return availableDays.filter(day => day.enabled);
  }, [availableDays]);

  // Initial fetch on component mount
  useEffect(() => {
    fetchAvailableDays();
  }, [token, isAuthenticated, enabledOnly]);

  // Subscribe to global days update events
  useEffect(() => {
    const unsubscribe = subscribeToDaysUpdates(() => {
      fetchAvailableDays(true); // Force refetch
    });

    return unsubscribe;
  }, [token, isAuthenticated, enabledOnly]);

  // Manual refetch function
  const refetch = async () => {
    await fetchAvailableDays(true);
  };

  return {
    availableDays,
    enabledDays,
    loading,
    error,
    refetch,
  };
}