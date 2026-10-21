'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Slider, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme } from '@mui/material';
import { clampPosition, MAX_ZOOM, outputSize, resizeAroundCentre, type CropBox } from '@/utils/bannerCrop';

/** The shapes the frame can have (width / height). The banner on the site follows whatever shape is uploaded. */
const SHAPES = [
  { label: 'Wide 2:1', ratio: 2 },
  { label: 'Standard 16:9', ratio: 16 / 9 },
] as const;

interface Props {
  /** The picture the admin chose; the dialog is open while this is set */
  file: File | null;
  onCancel: () => void;
  /** The picture to upload: the framed part, or the original when "Use the whole picture" is pressed */
  onDone: (file: File) => void;
}

/**
 * Lets the admin choose which part of a picture becomes the banner: drag the frame, zoom with the slider, pick a shape.
 * Only the framed part is uploaded (JPEG, at most 1600 px wide), so the site and the app both show exactly this part.
 */
export default function BannerCropDialog({ file, onCancel, onDone }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const imgRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [ratio, setRatio] = useState<number>(SHAPES[0].ratio);
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState<CropBox | null>(null);
  const [broken, setBroken] = useState(false);
  const [busy, setBusy] = useState(false);

  const url = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => {
    setNatural(null);
    setBox(null);
    setZoom(1);
    setBroken(false);
    setBusy(false);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const reshape = (nextRatio: number, nextZoom: number) => {
    if (!natural) return;
    setBox((prev) => resizeAroundCentre(natural.w, natural.h, prev, nextRatio, nextZoom));
  };

  const onLoad = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return setBroken(true);
    const dims = { w: img.naturalWidth, h: img.naturalHeight };
    setNatural(dims);
    setBox(resizeAroundCentre(dims.w, dims.h, null, ratio, 1));
  };

  const move = (dxNatural: number, dyNatural: number, from: { x: number; y: number }) => {
    if (!natural || !box) return;
    const pos = clampPosition(natural.w, natural.h, box, from.x + dxNatural, from.y + dyNatural);
    setBox({ ...box, ...pos });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!box) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerX: e.clientX, pointerY: e.clientY, startX: box.x, startY: box.y };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = boxRef.current;
    if (!d || !el || !natural) return;
    const scale = natural.w / el.getBoundingClientRect().width;
    move((e.clientX - d.pointerX) * scale, (e.clientY - d.pointerY) * scale, { x: d.startX, y: d.startY });
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!natural || !box) return;
    const step = natural.w * (e.shiftKey ? 0.05 : 0.01);
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    move(d[0], d[1], { x: box.x, y: box.y });
  };

  const useCrop = () => {
    const img = imgRef.current;
    if (!img || !box || !file) return;
    setBusy(true);
    const size = outputSize(box);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return onDone(file);
    // a picture with see-through parts would turn black as a JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, size.width, size.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return onDone(file);
        onDone(new File([blob], 'banner.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <Dialog open={Boolean(file)} onClose={busy ? undefined : onCancel} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle sx={{ fontWeight: 700 }}>Choose the part to show</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 1.5 }}>Drag the frame over the part you want. The rest is not used.</Typography>
        {broken ? (
          <Alert severity="warning">This picture cannot be previewed here. You can still use it as it is.</Alert>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', backgroundColor: '#F3EEE6', borderRadius: 2, p: 0.5 }}>
            <Box ref={boxRef} sx={{ position: 'relative', display: 'inline-block', lineHeight: 0, overflow: 'hidden', borderRadius: 1.5, maxWidth: '100%' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={url} alt="Picture to crop" onLoad={onLoad} onError={() => setBroken(true)} draggable={false} style={{ display: 'block', maxWidth: '100%', maxHeight: '55vh', userSelect: 'none', pointerEvents: 'none' }} />
              {natural && box && (
                <Box
                  role="slider"
                  tabIndex={0}
                  aria-label="Banner frame: drag, or use the arrow keys"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round((box.x / Math.max(1, natural.w - box.width || 1)) * 100)}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onKeyDown={onKeyDown}
                  sx={{
                    position: 'absolute',
                    left: `${(box.x / natural.w) * 100}%`,
                    top: `${(box.y / natural.h) * 100}%`,
                    width: `${(box.width / natural.w) * 100}%`,
                    height: `${(box.height / natural.h) * 100}%`,
                    border: '2px solid #fff',
                    boxShadow: '0 0 0 9999px rgba(20,16,12,0.55)',
                    cursor: 'grab',
                    touchAction: 'none',
                    '&:active': { cursor: 'grabbing' },
                    '&:focus-visible': { outline: '3px solid #F59E0B', outlineOffset: 2 },
                  }}
                />
              )}
            </Box>
          </Box>
        )}

        {!broken && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={ratio}
              onChange={(_, value: number | null) => {
                if (!value) return;
                setRatio(value);
                reshape(value, zoom);
              }}
              aria-label="Banner shape"
            >
              {SHAPES.map((s) => (
                <ToggleButton key={s.label} value={s.ratio} sx={{ textTransform: 'none', px: 2 }}>
                  {s.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Box>
              <Typography sx={{ fontSize: 13, color: '#374151' }}>Zoom</Typography>
              <Slider
                value={zoom}
                min={1}
                max={MAX_ZOOM}
                step={0.05}
                disabled={!natural}
                onChange={(_, value) => {
                  const z = Array.isArray(value) ? value[0] : value;
                  setZoom(z);
                  reshape(ratio, z);
                }}
                aria-label="Zoom"
                color="warning"
              />
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => file && onDone(file)} disabled={busy} sx={{ textTransform: 'none' }}>
          Use the whole picture
        </Button>
        {!broken && (
          <Button variant="contained" color="warning" onClick={useCrop} disabled={busy || !box} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Use this part
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
