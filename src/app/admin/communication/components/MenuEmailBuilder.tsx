'use client';

import { useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import { IconPhotoPlus, IconTrash } from '@tabler/icons-react';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { dateForDay, MAX_MENU_PHOTOS, shortDate, type MenuEmailData } from '@/utils/menuEmail';

interface Props {
  data: MenuEmailData;
  onChange: (next: MenuEmailData) => void;
  /** true while a picture is on its way (so the message is not sent half-ready) */
  onUploading: (busy: boolean) => void;
}

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
    <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#1F1712', color: '#FDE9C9', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{n}</Box>
    <Typography sx={{ fontWeight: 800, fontSize: 14.5 }}>{children}</Typography>
  </Box>
);

/** The "New menu" email form: headline, photos with the dish names, one box per day. The email builds itself from it. */
export default function MenuEmailBuilder({ data, onChange, onUploading }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState('');
  const latest = useRef(data);
  latest.current = data;
  const set = (patch: Partial<MenuEmailData>) => onChange({ ...latest.current, ...patch });

  const addFiles = async (files: FileList | null) => {
    const room = MAX_MENU_PHOTOS - latest.current.photos.length;
    const list = Array.from(files ?? []).slice(0, Math.max(room, 0));
    if (fileRef.current) fileRef.current.value = '';
    if (list.length === 0) return;
    setError('');
    setBusy((n) => n + list.length);
    onUploading(true);
    let left = list.length;
    await Promise.all(
      list.map(async (file) => {
        try {
          if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not a picture`);
          const up = await uploadToCloudinary(file);
          // a picture lands in the next free spot; the list is read fresh because several can finish together
          const cur = latest.current;
          if (cur.photos.length < MAX_MENU_PHOTOS) onChange({ ...cur, photos: [...cur.photos, { url: up.secure_url, caption: '' }] });
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not upload a picture');
        } finally {
          setBusy((n) => n - 1);
          left -= 1;
          if (left === 0) onUploading(false);
        }
      })
    );
  };

  return (
    <Box sx={{ mt: 1.5, display: 'grid', gap: 2.5 }}>
      <Box>
        <Step n={1}>Headline</Step>
        <TextField label="Headline" size="small" fullWidth value={data.headline} onChange={(e) => set({ headline: e.target.value.slice(0, 80) })} />
        <TextField label="A line or two (optional)" size="small" fullWidth multiline minRows={2} value={data.intro} onChange={(e) => set({ intro: e.target.value.slice(0, 300) })} sx={{ mt: 1.25 }} />
      </Box>

      <Box>
        <Step n={2}>Photos (up to {MAX_MENU_PHOTOS})</Step>
        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          {data.photos.map((p, i) => (
            <Box key={p.url} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1, display: 'flex', gap: 1.25, alignItems: 'center', minWidth: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || `Photo ${i + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              <TextField size="small" label="Dish name" value={p.caption} onChange={(e) => set({ photos: data.photos.map((x, j) => (j === i ? { ...x, caption: e.target.value.slice(0, 60) } : x)) })} sx={{ flex: 1, minWidth: 0 }} />
              <IconButton aria-label={`Remove photo ${i + 1}`} size="small" onClick={() => set({ photos: data.photos.filter((_, j) => j !== i) })} sx={{ color: '#B91C1C' }}>
                <IconTrash size={18} />
              </IconButton>
            </Box>
          ))}
          {busy > 0 && (
            <Box sx={{ border: '1px dashed #D1D5DB', borderRadius: 2, p: 1, display: 'flex', alignItems: 'center', gap: 1, color: '#6B7280', fontSize: 14 }}>
              <CircularProgress size={18} /> Uploading…
            </Box>
          )}
        </Box>
        {data.photos.length + busy < MAX_MENU_PHOTOS && (
          <Button variant="outlined" startIcon={<IconPhotoPlus size={18} />} onClick={() => fileRef.current?.click()} sx={{ mt: 1.25, textTransform: 'none', fontWeight: 700 }}>
            Add photos
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
        <Typography sx={{ fontSize: 12.5, color: '#6B7280', mt: 0.75 }}>They line up by themselves: 1 is wide, 2 sit side by side, 3 and 4 make a neat grid. Pictures are cut to the same shape for you.</Typography>
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </Box>

      <Box>
        <Step n={3}>What is on each day</Step>
        <TextField label="Menu starts on" type="date" size="small" value={data.weekOf ?? ''} onChange={(e) => set({ weekOf: e.target.value })} InputLabelProps={{ shrink: true }} helperText="Each day below gets its date from this one." sx={{ mb: 1.5, width: { xs: '100%', sm: 240 } }} />
        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {data.days.map((d, i) => (
            <TextField
              key={d.day}
              label={dateForDay(data.weekOf, d.day) ? `${d.day} · ${shortDate(dateForDay(data.weekOf, d.day))}` : d.day}
              size="small"
              multiline
              minRows={4}
              maxRows={12}
              fullWidth
              value={d.dishes}
              placeholder={'Paneer Tikka\nDal Makhani\nJeera Rice'}
              onChange={(e) => set({ days: data.days.map((x, j) => (j === i ? { ...x, dishes: e.target.value } : x)) })}
              helperText="One dish per line. Leave empty to skip this day."
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
