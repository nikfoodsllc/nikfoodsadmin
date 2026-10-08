'use client';

import { useCallback, useRef } from 'react';

export interface LatestRequest {
  /** Pass to fetch(): the request is cancelled when a newer one starts */
  signal: AbortSignal;
  /** False once a newer request has started: its answer must not touch the screen */
  isCurrent: () => boolean;
}

/**
 * For lists that reload as filters or a search change. Call the returned function at the start of every load: it cancels
 * the previous load and tells you, after each await, whether this load is still the newest. A slow earlier answer can then
 * never replace a newer one (which showed the right rows for a second and then the wrong ones).
 */
export function useLatestRequest(): () => LatestRequest {
  const seq = useRef(0);
  const controller = useRef<AbortController | null>(null);
  return useCallback(() => {
    const mine = ++seq.current;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    return { signal: next.signal, isCurrent: () => mine === seq.current };
  }, []);
}
