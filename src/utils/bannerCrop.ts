/**
 * Picking the part of a picture that becomes the banner. Pure geometry in the picture's own pixels: the frame has a fixed shape
 * (width / height = ratio) and a zoom (1 = as wide as the picture allows, more = a smaller part), and it never leaves the picture.
 */
export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MAX_ZOOM = 4;

/** The biggest frame of this shape that fits inside the picture, divided by the zoom. */
export function frameSize(naturalWidth: number, naturalHeight: number, ratio: number, zoom: number): { width: number; height: number } {
  const z = Math.min(MAX_ZOOM, Math.max(1, Number.isFinite(zoom) ? zoom : 1));
  const fullWidth = Math.min(naturalWidth, naturalHeight * ratio);
  const width = fullWidth / z;
  return { width, height: width / ratio };
}

/** Keep a frame's top-left corner inside the picture. */
export function clampPosition(naturalWidth: number, naturalHeight: number, size: { width: number; height: number }, x: number, y: number): { x: number; y: number } {
  const maxX = Math.max(0, naturalWidth - size.width);
  const maxY = Math.max(0, naturalHeight - size.height);
  return { x: Math.min(maxX, Math.max(0, x)), y: Math.min(maxY, Math.max(0, y)) };
}

/** A new frame (shape or zoom changed): keep its centre where it was, then keep it inside. */
export function resizeAroundCentre(naturalWidth: number, naturalHeight: number, previous: CropBox | null, ratio: number, zoom: number): CropBox {
  const size = frameSize(naturalWidth, naturalHeight, ratio, zoom);
  const cx = previous ? previous.x + previous.width / 2 : naturalWidth / 2;
  const cy = previous ? previous.y + previous.height / 2 : naturalHeight / 2;
  const pos = clampPosition(naturalWidth, naturalHeight, size, cx - size.width / 2, cy - size.height / 2);
  return { ...pos, ...size };
}

/** Size of the uploaded picture: the framed part, at most `maxWidth` wide (a banner never needs more), shape kept. */
export function outputSize(box: CropBox, maxWidth = 1600): { width: number; height: number } {
  const width = Math.max(1, Math.round(Math.min(box.width, maxWidth)));
  return { width, height: Math.max(1, Math.round(width * (box.height / box.width))) };
}
