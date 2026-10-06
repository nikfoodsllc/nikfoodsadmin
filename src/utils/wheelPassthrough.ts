/**
 * A scroll area that scrolls sideways (a wide table) swallows every mouse-wheel / trackpad gesture that
 * has even a small sideways part, so the page cannot be scrolled down while the pointer is over it.
 * These helpers decide when such a gesture should scroll the page instead. Pure functions, no DOM.
 */

export interface WheelLike {
  deltaX: number;
  deltaY: number;
  /** 0 = pixels, 1 = lines, 2 = pages (as on WheelEvent) */
  deltaMode: number;
  ctrlKey?: boolean;
}

const LINE_PIXELS = 16;

/**
 * How many pixels to scroll the page for this wheel event, or null when the scroll area should handle
 * it itself: mostly sideways gestures, pinch-zoom (ctrl), and events with no vertical movement.
 */
export function verticalPassthroughAmount(event: WheelLike, pageHeight: number): number | null {
  if (event.ctrlKey) return null;
  const ax = Math.abs(event.deltaX);
  const ay = Math.abs(event.deltaY);
  if (ay === 0 || ay <= ax) return null;
  const unit = event.deltaMode === 1 ? LINE_PIXELS : event.deltaMode === 2 ? pageHeight : 1;
  return event.deltaY * unit;
}
