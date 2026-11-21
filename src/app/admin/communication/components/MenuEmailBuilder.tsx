'use client';

import { useEffect, useRef, useState } from 'react';
import { moveItem } from '@/utils/categoryReorder';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import { IconCheck, IconDeviceFloppy, IconGripVertical, IconPhotoPlus, IconPlus, IconTrash } from '@tabler/icons-react';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { dateForDay, dishesOf, MAX_MENU_DISHES, MAX_MENU_TAG, MENU_DEFAULT_TAG, MAX_MENU_PHOTOS, MAX_MENU_SECTIONS, sameAsSaved, SECTION_SUBTITLE, sectionsUntouched, shortDate, startingSections, type MenuEmailData, type MenuSection, type SavedMenuBox } from '@/utils/menuEmail';

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

/**
 * Drag-to-reorder for a list shown as chips or cards: press the grip and the item follows the pointer over the
 * others (mouse, finger or pen); arrow keys on a focused grip move it one place. Items carry data-reorder-index,
 * grips carry data-grip.
 */
function useReorder<T>(list: T[], onMove: (next: T[]) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const focusAfterMove = useRef<number | null>(null);
  // a key press that has not been drawn yet: the next press builds on it, so quick presses never use old positions
  const pendingKey = useRef<{ list: T[]; index: number } | null>(null);
  const current = useRef({ list, onMove });
  current.current = { list, onMove };
  const startDrag = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    let from = index;
    setDragging(from);
    const move = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-reorder-index]') as HTMLElement | null;
      if (!el || !listRef.current?.contains(el)) return;
      const to = Number(el.dataset.reorderIndex);
      if (!Number.isInteger(to) || to === from) return;
      current.current.onMove(moveItem(current.current.list, from, to));
      from = to;
      setDragging(to);
    };
    const end = () => {
      setDragging(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
  const keyMove = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const base = pendingKey.current ?? { list, index };
    const to = base.index + step;
    if (to < 0 || to >= base.list.length) return;
    const next = moveItem(base.list, base.index, to);
    pendingKey.current = { list: next, index: to };
    focusAfterMove.current = to;
    onMove(next);
  };
  // after a keyboard move, keep the focus on the moved item's grip
  useEffect(() => {
    pendingKey.current = null;
    if (focusAfterMove.current === null) return;
    const grip = listRef.current?.querySelector(`[data-reorder-index="${focusAfterMove.current}"] [data-grip]`) as HTMLElement | null;
    focusAfterMove.current = null;
    grip?.focus();
  });
  const gripProps = (index: number, name: string) => ({
    'data-grip': true,
    role: 'button',
    tabIndex: 0,
    'aria-label': `Move ${name}. Use the arrow keys or drag.`,
    onPointerDown: (e: React.PointerEvent) => startDrag(e, index),
    onKeyDown: (e: React.KeyboardEvent) => keyMove(e, index),
  });
  return { listRef, dragging, gripProps };
}

const gripSx = (dragging: boolean) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', p: '4px', borderRadius: 1, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', color: '#9A6B2F', flexShrink: 0, '&:focus-visible': { outline: '2px solid #F59E0B' } });

/** The "New menu" email form: headline, photos with the dish names, one box per day. The email builds itself from it. */
/** One day's dishes as chips (tap x to leave one out) and a box to add another. */
function DishList({ label, text, count, fromLabel = 'from the menu', onChange, onEdited }: { label?: string; text: string; count: number | null; fromLabel?: string; onChange: (text: string) => void; onEdited: () => void }) {
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
  // keys that stay with a dish while it moves (the same name twice gets #1, #2)
  const seen = new Map<string, number>();
  const keys = dishes.map((d) => {
    const n = (seen.get(d) ?? 0) + 1;
    seen.set(d, n);
    return `${d}#${n}`;
  });
  const { listRef, dragging, gripProps } = useReorder(dishes, write);
  return (
    <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1.25, minWidth: 0 }}>
      {label && <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{label}</Typography>}
      <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 0.75 }}>
        {count === null ? 'Loading the menu…' : dishes.length > 0 ? `${dishes.length} ${count > 0 ? fromLabel : 'dishes'}. ${dishes.length > 1 ? 'Drag to change the order. ' : ''}Tap x to leave one out.` : (fromLabel === 'from the menu' ? 'Nothing on the menu for this day yet. Add dishes below, or skip the day.' : 'No dishes yet. Pick a category above or add dishes below.')}
      </Typography>
      <Box ref={listRef} sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
        {dishes.map((d, i) => (
          <Chip
            key={keys[i]}
            data-reorder-index={i}
            label={d}
            onDelete={() => write(dishes.filter((_, j) => j !== i))}
            icon={dishes.length > 1 ? (
              <Box component="span" {...gripProps(i, d)} sx={{ ...gripSx(dragging !== null), ml: '4px !important', mr: '-4px !important' }}>
                <IconGripVertical size={16} />
              </Box>
            ) : undefined}
            sx={{ maxWidth: '100%', fontWeight: 600, bgcolor: dragging === i ? '#FDE2B8' : '#FFF1DC', boxShadow: dragging === i ? '0 0 0 2px #F59E0B' : 'none', userSelect: 'none', transition: 'background-color 120ms, box-shadow 120ms', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 }, height: 'auto', minHeight: 32 }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField size="small" fullWidth placeholder="Add a dish" value={adding} onChange={(e) => setAdding(e.target.value.slice(0, 80))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button size="small" variant="outlined" onClick={add} disabled={!adding.trim()} sx={{ textTransform: 'none', fontWeight: 700 }}>Add</Button>
      </Box>
    </Box>
  );
}

/** Under a box: Save box / Saved / Save changes, and Unsave for a saved one. */
function SavedBoxControls({ section, saved, loaded, busy, message, onSave, onUnsave }: { section: MenuSection; saved?: SavedMenuBox; loaded: boolean; busy: boolean; message: { text: string; error?: boolean } | null; onSave: () => void; onUnsave: () => void }) {
  const isSaved = Boolean(section.savedId && saved);
  const unchanged = isSaved && sameAsSaved(section, saved);
  const canSave = section.title.trim() !== '' && dishesOf(section.items).length > 0;
  return (
    <Box sx={{ mt: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {unchanged ? (
          <Chip size="small" icon={<IconCheck size={14} />} label="Saved for every new email" sx={{ bgcolor: '#ECFDF3', color: '#05603A', fontWeight: 600, '& .MuiChip-icon': { color: '#05603A' } }} />
        ) : (
          <Button size="small" variant="outlined" startIcon={busy ? <CircularProgress size={14} /> : <IconDeviceFloppy size={16} />} disabled={!loaded || busy || !canSave} onClick={onSave} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {isSaved ? 'Save changes' : 'Save box'}
          </Button>
        )}
        {isSaved && (
          <Button size="small" disabled={busy} onClick={onUnsave} sx={{ textTransform: 'none', color: '#6B7280' }}>
            Unsave
          </Button>
        )}
      </Box>
      {message && <Typography sx={{ fontSize: 12, mt: 0.5, color: message.error ? '#B91C1C' : '#05603A' }}>{message.text}</Typography>}
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
  const photoDrag = useReorder(data.photos, (photos) => set({ photos }));

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
  // ---- the other boxes (Indian Mithai, Add-On's ...): filled from a flat category, or typed ----
  const [cats, setCats] = useState<Array<{ id: string; label: string }> | null>(null);
  const [sectionCounts, setSectionCounts] = useState<Record<number, number>>({});
  const sectionEdited = useRef<Set<number>>(new Set((data.sections ?? []).map((x, i) => (dishesOf(x.items).length > 0 ? i : -1)).filter((i) => i >= 0)));
  const setSection = (i: number, patch: Partial<MenuSection>) => onChange({ ...latest.current, sections: (latest.current.sections ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const loadCategory = async (i: number, categoryId: string) => {
    try {
      const res = await fetch(`/api/admin/communication-menu?category=${categoryId}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not load the category');
      const items = (json?.data?.items ?? []) as string[];
      sectionEdited.current.delete(i);
      onChange({ ...latest.current, sections: (latest.current.sections ?? []).map((x, j) => (j === i ? { ...x, categoryId, items: items.join('\n') } : x)) });
      setSectionCounts((c) => ({ ...c, [i]: items.length }));
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : 'Could not load the category');
    }
  };
  // ---- saved boxes (shared by every admin): a new email starts with them, so Kunal does not type them every week ----
  const [saved, setSaved] = useState<SavedMenuBox[] | null>(null);
  const [boxBusy, setBoxBusy] = useState<number | null>(null);
  const [boxMsg, setBoxMsg] = useState<{ i: number; text: string; error?: boolean } | null>(null);
  const saveBox = async (i: number) => {
    const sec = (latest.current.sections ?? [])[i];
    if (!sec) return;
    setBoxBusy(i);
    setBoxMsg(null);
    try {
      const res = await fetch('/api/admin/communication-saved-boxes', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sec.savedId, title: sec.title, subtitle: sec.subtitle, items: sec.items, categoryId: sec.categoryId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not save the box');
      const box = json.data.box as SavedMenuBox;
      setSaved((list) => [...(list ?? []).filter((b) => b.id !== box.id), box]);
      setSection(i, { savedId: box.id });
      setBoxMsg({ i, text: 'Saved. Every new menu email starts with this box.' });
    } catch (e) {
      setBoxMsg({ i, text: e instanceof Error ? e.message : 'Could not save the box', error: true });
    } finally {
      setBoxBusy(null);
    }
  };
  const unsaveBox = async (i: number) => {
    const sec = (latest.current.sections ?? [])[i];
    if (!sec?.savedId) return;
    setBoxBusy(i);
    setBoxMsg(null);
    try {
      const res = await fetch(`/api/admin/communication-saved-boxes?id=${sec.savedId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not unsave the box');
      setSaved((list) => (list ?? []).filter((b) => b.id !== sec.savedId));
      setSection(i, { savedId: undefined });
      setBoxMsg({ i, text: 'Unsaved. It stays in this email but new emails will not have it.' });
    } catch (e) {
      setBoxMsg({ i, text: e instanceof Error ? e.message : 'Could not unsave the box', error: true });
    } finally {
      setBoxBusy(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const auth = { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' as const };
    const savedBoxes = fetch('/api/admin/communication-saved-boxes', auth)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => (Array.isArray(json?.data?.boxes) ? (json.data.boxes as SavedMenuBox[]) : []))
      .catch(() => [] as SavedMenuBox[]);
    // the saved boxes go in first (only into an email nobody has touched), then empty boxes may pick a matching category
    savedBoxes
      .then((boxes) => {
        if (cancelled) return null;
        setSaved(boxes);
        if (boxes.length > 0 && sectionsUntouched(latest.current.sections)) {
          const sections = startingSections(boxes);
          sectionEdited.current = new Set(sections.map((_, i) => i));
          onChange({ ...latest.current, sections });
        }
        return fetch('/api/admin/communication-menu?list=categories', auth);
      })
      .then((r) => (r && r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !Array.isArray(json?.data?.categories)) return;
        const list = json.data.categories as Array<{ id: string; label: string }>;
        setCats(list);
        // a box still empty and not typed in picks the category with the matching name (Indian Mithai -> Indian Sweets, Add-On's -> Add-Ons)
        const norm = (t: string) => t.toLowerCase().replace(/[^a-z]/g, '');
        (latest.current.sections ?? []).forEach((sec, i) => {
          if (sec.categoryId || dishesOf(sec.items).length > 0 || sectionEdited.current.has(i)) return;
          const t = norm(sec.title);
          const last = (label: string) => norm(label.split('>').pop() ?? '');
          const hit = list.find((c) => norm(c.label) === t) ?? list.find((c) => last(c.label) === t) ?? (t.length > 3 ? list.find((c) => last(c.label).includes(t)) : undefined) ?? (t.includes('mithai') ? list.find((c) => last(c.label).includes('mithai')) : undefined);
          if (hit) void loadCategory(i, hit.id);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
        <TextField label="Tag above the headline" size="small" value={data.tag ?? ''} placeholder={MENU_DEFAULT_TAG} onChange={(e) => set({ tag: e.target.value.slice(0, MAX_MENU_TAG) })} helperText={`Shown in capitals. Empty = ${MENU_DEFAULT_TAG}.`} inputProps={{ style: { textTransform: 'uppercase' } }} InputLabelProps={{ shrink: true }} sx={{ mb: 1.25, width: { xs: '100%', sm: 260 } }} />
        <TextField label="Headline" size="small" fullWidth value={data.headline} onChange={(e) => set({ headline: e.target.value.slice(0, 80) })} />
        <TextField label="A line or two (optional)" size="small" fullWidth multiline minRows={2} value={data.intro} onChange={(e) => set({ intro: e.target.value.slice(0, 300) })} sx={{ mt: 1.25 }} />
      </Box>

      <Box>
        <Step n={2}>Photos (up to {MAX_MENU_PHOTOS})</Step>
        <Box ref={photoDrag.listRef} sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          {data.photos.map((p, i) => (
            <Box key={p.url} data-reorder-index={i} sx={{ border: '1px solid', borderColor: photoDrag.dragging === i ? '#F59E0B' : '#E5E7EB', boxShadow: photoDrag.dragging === i ? '0 0 0 1px #F59E0B' : 'none', bgcolor: photoDrag.dragging === i ? '#FFFBF5' : 'transparent', borderRadius: 2, p: 1, display: 'flex', gap: 1, alignItems: 'center', minWidth: 0, userSelect: photoDrag.dragging === null ? 'auto' : 'none' }}>
              {data.photos.length > 1 && (
                <Box component="span" {...photoDrag.gripProps(i, p.caption || `photo ${i + 1}`)} sx={{ ...gripSx(photoDrag.dragging !== null), alignSelf: 'stretch', px: '2px' }}>
                  <IconGripVertical size={18} />
                </Box>
              )}
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption || `Photo ${i + 1}`} draggable={false} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                {data.photos.length > 1 && (
                  <Box sx={{ position: 'absolute', top: 4, left: 4, minWidth: 20, height: 20, px: 0.5, borderRadius: 10, bgcolor: 'rgba(31,23,18,0.85)', color: '#FDE9C9', fontSize: 11.5, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{i + 1}</Box>
                )}
              </Box>
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
        <Typography sx={{ fontSize: 12.5, color: '#6B7280', mt: 0.75 }}>Drag a photo by its grip to change the order. They line up by themselves: 1 is wide, 2 sit side by side, 3 and 4 make a neat grid. Pictures are cut to the same shape for you.</Typography>
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

      <Box>
        <Step n={4}>Other boxes (optional)</Step>
        <Typography sx={{ fontSize: 12.5, color: '#6B7280', mb: 1 }}>Extra boxes under the days, like Indian Mithai or Add-On&apos;s. Fill one from a menu category, or type your own dishes. Save a box that stays the same and every new menu email starts with it.</Typography>
        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {(data.sections ?? []).map((sec, i) => (
            <Box key={i} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1.25, minWidth: 0 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField size="small" label="Box title" value={sec.title} onChange={(e) => setSection(i, { title: e.target.value.slice(0, 40) })} sx={{ flex: 1, minWidth: 0 }} />
                <IconButton aria-label={`Remove ${sec.title || 'this box'}`} size="small" onClick={() => { onChange({ ...latest.current, sections: (latest.current.sections ?? []).filter((_, j) => j !== i) }); sectionEdited.current.clear(); (latest.current.sections ?? []).forEach((x, j) => { if (j !== i && dishesOf(x.items).length > 0) sectionEdited.current.add(j > i ? j - 1 : j); }); }} sx={{ color: '#B91C1C', mt: 0.5 }}>
                  <IconTrash size={18} />
                </IconButton>
              </Box>
              <TextField size="small" fullWidth label="Under the title" value={sec.subtitle} onChange={(e) => setSection(i, { subtitle: e.target.value.slice(0, 60) })} sx={{ mt: 1 }} />
              <TextField select size="small" fullWidth label="Fill from a category" value={sec.categoryId ?? ''} onChange={(e) => (e.target.value ? void loadCategory(i, e.target.value) : setSection(i, { categoryId: undefined }))} disabled={!cats} sx={{ mt: 1, mb: 1 }}>
                <MenuItem value="">None, I will type the dishes</MenuItem>
                {(cats ?? []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>
                ))}
              </TextField>
              <DishList
                text={sec.items}
                count={sec.categoryId ? (sectionCounts[i] ?? dishesOf(sec.items).length) : 0}
                fromLabel={`from ${cats?.find((c) => c.id === sec.categoryId)?.label ?? 'the category'}`}
                onEdited={() => sectionEdited.current.add(i)}
                onChange={(text) => setSection(i, { items: text })}
              />
              <SavedBoxControls
                section={sec}
                saved={saved?.find((b) => b.id === sec.savedId)}
                loaded={saved !== null}
                busy={boxBusy === i}
                message={boxMsg?.i === i ? boxMsg : null}
                onSave={() => void saveBox(i)}
                onUnsave={() => void unsaveBox(i)}
              />
            </Box>
          ))}
        </Box>
        {(data.sections ?? []).length < MAX_MENU_SECTIONS && (
          <Button size="small" startIcon={<IconPlus size={16} />} onClick={() => onChange({ ...latest.current, sections: [...(latest.current.sections ?? []), { title: '', subtitle: SECTION_SUBTITLE, items: '' }] })} sx={{ mt: 1.25, textTransform: 'none', fontWeight: 700 }}>
            Add a box
          </Button>
        )}
      </Box>
    </Box>
  );
}
