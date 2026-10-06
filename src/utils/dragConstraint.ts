/**
 * Keeps a dragged item on one axis and inside its container. The drag library moves the dragged item
 * with an inline `transform: translate(Xpx, Ypx)` (the item is position: fixed at its starting spot);
 * these helpers rewrite that value. Pure functions, no React or DOM.
 */

export type DragAxis = 'x' | 'y';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Container {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const TRANSLATE = /^translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)$/;

const clamp = (value: number, min: number, max: number) => (min > max ? min : Math.min(max, Math.max(min, value)));

/**
 * The transform to show while dragging. The item moves only along `axis`, and is held inside
 * `container` (using the item's starting box `start`). On the other axis it is aligned to the
 * container's own edge, so it stays glued to its row or column even if the page or the table scrolls
 * while dragging. With no container it just stays where it started on the other axis. A transform that
 * is not a plain translate (e.g. none) is returned unchanged.
 */
export function constrainTransform(
  transform: string | undefined,
  axis: DragAxis,
  start: Box,
  container: Container | null,
): string | undefined {
  const match = transform ? TRANSLATE.exec(transform.trim()) : null;
  if (!match) return transform;
  let x = Number(match[1]);
  let y = Number(match[2]);
  if (axis === 'x') {
    y = container ? container.top - start.top : 0;
    if (container) x = clamp(x, container.left - start.left, container.right - start.width - start.left);
  } else {
    x = container ? container.left - start.left : 0;
    if (container) y = clamp(y, container.top - start.top, container.bottom - start.height - start.top);
  }
  return `translate(${Math.round(x * 100) / 100}px, ${Math.round(y * 100) / 100}px)`;
}

/** How far (px) the shown drag position is kept away from the exact drop target; see `nudgeTransform`. */
export const DROP_NUDGE_PX = 1;

/**
 * Moves a translate() transform by `px` along `axis`. The drag library ends a drop only when the browser
 * finishes a CSS transform transition, and the browser runs no transition (so the drop never finishes and
 * the item stays "stuck" mid-drag) when the new transform equals the one already shown. Because the
 * shown position is clamped and aligned, it can land exactly on the drop target; a 1px offset while
 * dragging guarantees the final move is a real change. Values that are not a plain translate are returned as-is.
 */
export function nudgeTransform(transform: string | undefined, axis: DragAxis, px: number = DROP_NUDGE_PX): string | undefined {
  const match = transform ? TRANSLATE.exec(transform.trim()) : null;
  if (!match) return transform;
  const x = Number(match[1]) + (axis === 'x' ? px : 0);
  const y = Number(match[2]) + (axis === 'y' ? px : 0);
  return `translate(${Math.round(x * 100) / 100}px, ${Math.round(y * 100) / 100}px)`;
}
