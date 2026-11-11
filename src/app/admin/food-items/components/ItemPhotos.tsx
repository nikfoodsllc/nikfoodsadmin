'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, IconButton, Tooltip, Typography } from '@mui/material';
import { IconArrowLeft, IconArrowRight, IconArrowsMaximize, IconCheck, IconLink, IconPhotoPlus, IconX, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import { DraftPhoto, MAX_ITEM_PHOTOS, PHOTO_ACCEPT, emailPhotoUrl, movePhoto, newPhotoKey, photoProblem } from '@/utils/itemImages';

const tile = 104;

function Thumb({ photo, size, contain }: { photo: DraftPhoto; size?: number; contain?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photo.url]);
  // a browser that cannot draw a HEIC (Chrome) shows a label instead; after saving it is a normal JPG
  if (broken) {
    return (
      <Box sx={{ width: '100%', height: size ?? '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 0.5, bgcolor: '#F3F4F6', color: '#6B7280', fontSize: 11 }}>
        {photo.file?.name ?? 'Photo'}
        <br />
        (shows after saving)
      </Box>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo.url} alt="" onError={() => setBroken(true)} style={{ width: '100%', height: size ?? '100%', objectFit: contain ? 'contain' : 'cover', display: 'block' }} />
  );
}

/**
 * The photos of a food item: add several at once (JPG, PNG, WebP, GIF, HEIC), put them in order (the first is the main
 * photo), remove them, and open one large with the + button. New photos only upload when the item is saved.
 */
export default function ItemPhotos({ photos, onChange, disabled }: { photos: DraftPhoto[]; onChange: (photos: DraftPhoto[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);
  const urls = useRef<string[]>([]);

  // free the preview addresses of photos that were dropped or when the form closes
  useEffect(() => {
    const live = new Set(photos.filter((p) => p.file).map((p) => p.url));
    urls.current.filter((u) => !live.has(u)).forEach((u) => URL.revokeObjectURL(u));
    urls.current = urls.current.filter((u) => live.has(u));
  }, [photos]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const add = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const problems: string[] = [];
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_ITEM_PHOTOS) {
        problems.push(`Only ${MAX_ITEM_PHOTOS} photos fit on one item.`);
        break;
      }
      const problem = photoProblem(file);
      if (problem) {
        problems.push(problem);
        continue;
      }
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      next.push({ key: newPhotoKey(), url, file });
    }
    setNotice(problems.join(' '));
    onChange(next);
    if (input.current) input.current.value = '';
  };

  const remove = (i: number) => onChange(photos.filter((_, at) => at !== i));
  const move = (from: number, to: number) => onChange(movePhoto(photos, from, to));
  const open = (i: number) => {
    setZoom(1);
    setViewing(i);
  };
  const shown = viewing !== null ? photos[viewing] : null;

  // copies the email-ready link of a saved photo (a photo that is not saved yet has no link)
  const copyLink = async (photo: DraftPhoto) => {
    if (photo.file) return;
    const link = emailPhotoUrl(photo.url);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const box = document.createElement('textarea');
      box.value = link;
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      document.execCommand('copy');
      document.body.removeChild(box);
    }
    setCopied(photo.key);
    setTimeout(() => setCopied((cur) => (cur === photo.key ? null : cur)), 2500);
  };

  const iconBtn = { width: 28, height: 28, bgcolor: 'rgba(255,255,255,0.94)', color: '#111827', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', '&:hover': { bgcolor: '#fff' } } as const;

  return (
    <Box>
      <input ref={input} type="file" accept={PHOTO_ACCEPT} multiple hidden onChange={(e) => add(e.target.files)} disabled={disabled} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {photos.map((photo, i) => (
          <Box key={photo.key} sx={{ position: 'relative', width: tile, height: tile, borderRadius: 2, overflow: 'hidden', border: '2px solid', borderColor: i === 0 ? '#4F8CFF' : '#E5E7EB', bgcolor: '#fff' }}>
            <Thumb photo={photo} />
            <Box sx={{ position: 'absolute', top: 3, left: 3 }}>
              <Tooltip title={photo.file ? 'Save the item first to get this photo\'s link' : copied === photo.key ? 'Link copied' : 'Copy picture link for emails'}>
                <span>
                  <IconButton aria-label="Copy photo link" size="small" sx={{ ...iconBtn, color: copied === photo.key ? '#166534' : '#111827' }} onClick={() => copyLink(photo)} disabled={Boolean(photo.file)}>
                    {copied === photo.key ? <IconCheck size={15} /> : <IconLink size={15} />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            {i === 0 && (
              <Typography sx={{ position: 'absolute', left: 0, bottom: 0, px: 0.75, py: 0.1, bgcolor: '#4F8CFF', color: '#fff', fontSize: 11, fontWeight: 600, borderTopRightRadius: 6 }}>Main</Typography>
            )}
            <Box sx={{ position: 'absolute', top: 3, right: 3, display: 'flex', gap: 0.5 }}>
              <Tooltip title="View large"><IconButton aria-label="Zoom photo" size="small" sx={iconBtn} onClick={() => open(i)}><IconArrowsMaximize size={15} /></IconButton></Tooltip>
              <Tooltip title="Remove"><span><IconButton aria-label="Remove photo" size="small" sx={iconBtn} onClick={() => remove(i)} disabled={disabled}><IconX size={16} /></IconButton></span></Tooltip>
            </Box>
            {photos.length > 1 && (
              <Box sx={{ position: 'absolute', bottom: 3, right: 3, display: 'flex', gap: 0.5 }}>
                <IconButton aria-label="Move earlier" size="small" sx={{ ...iconBtn, opacity: i === 0 ? 0.35 : 1 }} onClick={() => move(i, i - 1)} disabled={disabled || i === 0}><IconArrowLeft size={15} /></IconButton>
                <IconButton aria-label="Move later" size="small" sx={{ ...iconBtn, opacity: i === photos.length - 1 ? 0.35 : 1 }} onClick={() => move(i, i + 1)} disabled={disabled || i === photos.length - 1}><IconArrowRight size={15} /></IconButton>
              </Box>
            )}
          </Box>
        ))}
        {photos.length < MAX_ITEM_PHOTOS && (
          <Box
            component="button"
            type="button"
            onClick={() => input.current?.click()}
            disabled={disabled}
            aria-label="Add photos"
            sx={{ width: tile, height: tile, borderRadius: 2, border: '2px dashed #4F8CFF', bgcolor: '#F6FAFF', color: '#4F8CFF', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
          >
            <IconPhotoPlus size={26} />
            Add photos
          </Box>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {photos.length} of {MAX_ITEM_PHOTOS} · The first photo is the main one on the menu; customers can swipe through the rest. JPG, PNG, WebP, GIF or HEIC, up to 10 MB each. Move a photo with the arrows. The link button copies a picture link sized for emails.
      </Typography>
      {copied && <Alert severity="success" sx={{ mt: 1 }}>Link copied. Paste it where the email design needs a picture address.</Alert>}
      {notice && <Alert severity="warning" sx={{ mt: 1 }} onClose={() => setNotice('')}>{notice}</Alert>}

      <Dialog open={shown !== null} onClose={() => setViewing(null)} maxWidth="md" fullWidth>
        {shown && (
          <Box sx={{ position: 'relative', bgcolor: '#111', display: 'flex', flexDirection: 'column', height: { xs: '80vh', sm: '75vh' } }}>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shown.url} alt="" style={zoom === 1 ? { margin: 'auto', width: '100%', height: '100%', objectFit: 'contain' } : { margin: 'auto', width: `${zoom * 100}%`, maxWidth: 'none', flexShrink: 0 }} />
            </Box>
            <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
              <Button size="small" variant="contained" startIcon={shown && copied === shown.key ? <IconCheck size={16} /> : <IconLink size={16} />} onClick={() => copyLink(shown)} disabled={Boolean(shown.file)} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.94)', color: '#111827', '&:hover': { bgcolor: '#fff' } }}>
                {shown.file ? 'Save the item to get a link' : copied === shown.key ? 'Link copied' : 'Copy link for emails'}
              </Button>
            </Box>
            <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
              <IconButton aria-label="Close" onClick={() => setViewing(null)} sx={{ ...iconBtn, width: 36, height: 36 }}><IconX size={20} /></IconButton>
            </Box>
            <Box sx={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
              <IconButton aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - 1))} disabled={zoom === 1} sx={{ ...iconBtn, width: 40, height: 40 }}><IconZoomOut size={20} /></IconButton>
              <IconButton aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 1))} disabled={zoom === 4} sx={{ ...iconBtn, width: 40, height: 40 }}><IconZoomIn size={20} /></IconButton>
            </Box>
          </Box>
        )}
      </Dialog>
    </Box>
  );
}
