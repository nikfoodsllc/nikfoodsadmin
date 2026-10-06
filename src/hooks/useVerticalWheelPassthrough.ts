'use client';

import { useEffect, useRef } from 'react';
import { verticalPassthroughAmount } from '@/utils/wheelPassthrough';

/** The nearest ancestor that really scrolls vertically (the page itself when none does). */
function scrollParent(element: HTMLElement): HTMLElement | Window {
  let node = element.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return window;
}

/**
 * Attach the returned ref to a sideways-scrolling area. Mostly vertical wheel / trackpad gestures over it
 * then scroll the page (or the page's scroll container) instead of being swallowed by the area.
 * `paused()` can switch this off, e.g. while something is being dragged.
 */
export function useVerticalWheelPassthrough<T extends HTMLElement>(paused?: () => boolean) {
  const ref = useRef<T | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (pausedRef.current?.()) return;
      const amount = verticalPassthroughAmount(event, window.innerHeight);
      if (amount === null) return;
      const parent = scrollParent(element);
      event.preventDefault();
      if (parent === window) window.scrollBy(0, amount);
      else (parent as HTMLElement).scrollTop += amount;
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  return ref;
}
