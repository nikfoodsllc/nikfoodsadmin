'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import { IconPhotoPlus, IconTrash } from '@tabler/icons-react';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { dateForDay, dishesOf, MAX_MENU_DISHES, MAX_MENU_PHOTOS, shortDate, type MenuEmailData } from '@/utils/menuEmail';

interface Props {
  token: string;
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
/** One day's dishes as chips (tap x to leave one out) and a box to add another. */
function DishList({ label, text, count, onChange, onEdited }: { label: string; text: string; count: number | null; onChange: (text: string) => void; onEdited: () => void }) {
  const [adding, setAdding] = useState('');
  const dishes = dishesOf(text);
  const write = (list: string[]) => {
    onEdited();
    onChange(list.join('\n'));
  };
  const add = () => {
    const d = adding.replace(/\s+/g, ' ').trim();
    if (!d || dishes.length >= MAX_MENU_DISHES) return;
    write([...dishes, d]);
    setAdding('');
  };
  return (
    <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1.25, minWidth: 0 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 0.75 }}>
        {count === null ? 'Loading the menu…' : count > 0 ? `${count} from the menu. Tap x to leave one out.` : dishes.length > 0 ? 'Your own list.' : 'Nothing on the menu for this day yet. Add dishes below, or skip the day.'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
        {dishes.map((d, i) => (
          <Chip key={`${d}-${i}`} label={d} onDelete={() => write(dishes.filter((_, j) => j !== i))} sx={{ maxWidth: '100%', fontWeight: 600, bgcolor: '#FFF1DC', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 }, height: 'auto', minHeight: 32 }} />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField size="small" fullWidth placeholder="Add a dish" value={adding} onChange={(e) => setAdding(e.target.value.slice(0, 80))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button size="small" variant="outlined" onClick={add} disabled={!adding.trim()} sx={{ textTransform: 'none', fontWeight: 700 }}>Add</Button>
      </Box>
    </Box>
  );
}

export default function MenuEmailBuilder({ token, data, onChange, onUploading }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState('');
  const latest = useRef(data);
  latest.current = data;
  const set = (patch: Partial<MenuEmailData>) => onChange({ ...latest.current, ...patch });

  // the day boxes start from the day-wise menu of their date; days Kunal has changed himself (or that came with a saved draft) are left alone
  const edited = useRef<Set<string>>(new Set(data.days.filter((d) => dishesOf(d.dishes).length > 0).map((d) => d.day)));
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [menuError, setMenuError] = useState('');
  const fetchSeq = useRef(0);
  const loadMenu = async (all: boolean) => {
    const seq = ++fetchSeq.current;
    const cur = latest.current;
    const wanted = cur.days.map((d) => ({ day: d.day, date: dateForDay(cur.weekOf, d.day) })).filter((d) => d.date && (all || !edited.current.has(d.day)));
    if (wanted.length === 0) return;
    setMenuError('');
    setCounts((c) => ({ ...c, ...Object.fromEntries(wanted.map((d) => [d.day, null])) }));
    try {
      const res = await fetch(`/api/admin/communication-menu?dates=${[...new Set(wanted.map((d) => d.date))].join(',')}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (seq !== fetchSeq.current) return;
      if (!res.ok) throw new Error(json?.error || 'Could not load the menu');
      const menus = (json?.data?.menus ?? {}) as Record<string, string[]>;
      if (all) wanted.forEach((d) => edited.current.delete(d.day));
      onChange({ ...latest.current, days: latest.current.days.map((d) => { const w = wanted.find((x) => x.day === d.day); return w ? { ...d, dishes: (menus[w.date] ?? []).join('\n') } : d; }) });
      setCounts((c) => ({ ...c, ...Object.fromEntries(wanted.map((d) => [d.day, (menus[d.date] ?? []).length])) }));
    } catch (e) {
      if (seq !== fetchSeq.current) return;
      setMenuError(e instanceof Error ? e.message : 'Could not load the menu');
      setCounts((c) => ({ ...c, ...Object.fromEntries(wanted.map((d) => [d.day, 0])) }));
    }
  };
  useEffect(() => {
    void loadMenu(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.weekOf]);

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
        <TextField label="Menu starts on" type="date" size="small" value={data.weekOf ?? ''} onChange={(e) => set({ weekOf: e.target.value })} InputLabelProps={{ shrink: true }} helperText="Each day gets its date from this one, and its dishes from the day-wise menu." sx={{ mb: 1.5, width: { xs: '100%', sm: 240 } }} />
        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {data.days.map((d, i) => (
            <DishList
              key={d.day}
              label={dateForDay(data.weekOf, d.day) ? `${d.day} · ${shortDate(dateForDay(data.weekOf, d.day))}` : d.day}
              text={d.dishes}
              count={counts[d.day] === undefined ? 0 : counts[d.day]}
              onEdited={() => edited.current.add(d.day)}
              onChange={(text) => set({ days: latest.current.days.map((x, j) => (j === i ? { ...x, dishes: text } : x)) })}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 1.25 }}>
          <Button size="small" variant="outlined" onClick={() => void loadMenu(true)} sx={{ textTransform: 'none', fontWeight: 700 }}>Fill again from the menu</Button>
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Starts over from the day-wise menu and replaces what is in the boxes.</Typography>
        </Box>
        {menuError && <Alert severity="error" sx={{ mt: 1 }}>{menuError}</Alert>}
      </Box>
    </Box>
  );
}
