'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A search box for a list that asks the server. `input` is what is typed (show it in the box, always up to date);
 * `query` is what the list is filtered by, and follows the box after a short typing pause, so "shrey" is one request and
 * not five. `onCommit` runs together with the change of `query` (use it to go back to page 1 and clear ticked rows).
 */
export function useSearchBox(onCommit?: () => void, delayMs = 350) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });

  useEffect(() => {
    if (input === query) return;
    const timer = setTimeout(() => {
      setQuery(input);
      commit.current?.();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [input, query, delayMs]);

  /** Empties the box and the filter at once (for "Clear filters") */
  const reset = useCallback(() => {
    setInput('');
    setQuery('');
  }, []);

  return { input, query, setInput, reset };
}
