'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { IconArrowDown, IconArrowUp, IconPhotoPlus, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { moveId, SUBTITLE_MAX, TITLE_MAX, type BannerLinkType, type BannerStatus } from '@/lib/banners';

interface Banner {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkType: BannerLinkType;
  categoryId: string;
  url: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sequence: number;
  status: BannerStatus;
}
interface Category {
  _id: string;
  name: string;
}

const STATUS: Record<BannerStatus, { label: string; color: 'success' | 'info' | 'default' | 'warning' }> = {
  live: { label: 'Live', color: 'success' },
  scheduled: { label: 'Starts later', color: 'info' },
  ended: { label: 'Ended', color: 'default' },
  off: { label: 'Off', color: 'warning' },
};

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
/** value for a datetime-local box, in Pacific time (where the kitchen is) */
const toInput = (iso: string | null) => {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
};
/** a datetime-local value (Pacific time) to an ISO moment */
function fromInput(v: string): string | null {
  if (!v) return null;
  // find the UTC moment whose Pacific wall clock reads v
  const guess = new Date(`${v}:00Z`).getTime();
  for (const offsetHours of [7, 8]) {
    const t = new Date(guess + offsetHours * 3600000);
    if (toInput(t.toISOString()) === v) return t.toISOString();
  }
  return new Date(guess + 8 * 3600000).toISOString();
}

const EMPTY = { _id: '', title: '', subtitle: '', imageUrl: '', linkType: 'none' as BannerLinkType, categoryId: '', url: '', active: true, startsAt: '', endsAt: '' };

export default function BannersPage() {
  const router = useRouter();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<Banner | null>(null);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const call = useCallback(
    async (path: string, method = 'GET', body?: unknown) => {
      const r = await fetch(path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const json = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, json };
    },
    [token]
  );

  const load = useCallback(async () => {
    if (!token) return;
    const r = await call('/api/admin/banners');
    if (r.ok) {
      setBanners(r.json.data as Banner[]);
      setError('');
    } else setError(r.json.error || 'Could not load the banners');
    setLoading(false);
  }, [call, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const r = await call('/api/admin/food-category');
      const items = (r.json?.data?.items ?? []) as Array<Category & { parentCategoryId?: unknown }>;
      setCategories(items.filter((c) => !c.parentCategoryId).map((c) => ({ _id: String(c._id), name: c.name })));
    })();
  }, [call, token]);

  const open = (b?: Banner) => {
    setFormError('');
    setForm(b ? { _id: b._id, title: b.title, subtitle: b.subtitle, imageUrl: b.imageUrl, linkType: b.linkType, categoryId: b.categoryId, url: b.url, active: b.active, startsAt: toInput(b.startsAt), endsAt: toInput(b.endsAt) } : { ...EMPTY });
  };

  const upload = async (file: File | undefined) => {
    if (!file || !form) return;
    if (!file.type.startsWith('image/')) return setFormError('Choose a picture file');
    if (file.size > 8 * 1024 * 1024) return setFormError('The picture is too large (8 MB at most)');
    setUploading(true);
    setFormError('');
    try {
      const uploaded = await uploadToCloudinary(file);
      setForm((f) => (f ? { ...f, imageUrl: uploaded.secure_url } : f));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not upload the picture');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError('');
    const body = { title: form.title, subtitle: form.subtitle, imageUrl: form.imageUrl, linkType: form.linkType, categoryId: form.categoryId, url: form.url, active: form.active, startsAt: fromInput(form.startsAt), endsAt: fromInput(form.endsAt) };
    const r = form._id ? await call(`/api/admin/banners/${form._id}`, 'PUT', body) : await call('/api/admin/banners', 'POST', body);
    setSaving(false);
    if (r.ok) {
      setForm(null);
      setNotice(form._id ? 'Saved' : 'Banner added');
      void load();
    } else setFormError(r.json.error || 'Could not save');
  };

  const toggle = async (b: Banner) => {
    const r = await call(`/api/admin/banners/${b._id}`, 'PUT', { ...b, active: !b.active });
    setNotice(r.ok ? (b.active ? 'Switched off' : 'Switched on') : r.json.error || 'Could not change it');
    void load();
  };

  const move = async (b: Banner, to: number) => {
    const ids = moveId(banners.map((x) => x._id), b._id, to);
    setBanners((prev) => ids.map((id) => prev.find((x) => x._id === id)!).filter(Boolean));
    const r = await call('/api/admin/banners/reorder', 'PATCH', { ids });
    if (!r.ok) {
      setNotice(r.json.error || 'Could not change the order');
      void load();
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    const r = await call(`/api/admin/banners/${toDelete._id}`, 'DELETE');
    setToDelete(null);
    setNotice(r.ok ? 'Deleted' : r.json.error || 'Could not delete');
    void load();
  };

  const categoryName = useMemo(() => new Map(categories.map((c) => [c._id, c.name])), [categories]);
  const linkText = (b: Banner) => (b.linkType === 'category' ? `Opens ${categoryName.get(b.categoryId) ?? 'a category'}` : b.linkType === 'url' ? `Opens ${b.url.replace(/^https:\/\//, '')}` : 'No link');

  if (authLoading || !isAuthenticated || !token || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800 }}>Banners</Typography>
          <Typography sx={{ color: '#6B7280', fontSize: 14 }}>The pictures at the top of the home page, on the website and in the app. The first one is shown first.</Typography>
        </Box>
        <Button variant="contained" color="warning" startIcon={<IconPlus size={18} />} onClick={() => open()} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Add banner
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {banners.length === 0 && !error ? (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700 }}>No banners yet</Typography>
          <Typography sx={{ color: '#6B7280', fontSize: 14, mt: 0.5 }}>Until you add one, the website shows its usual welcome picture and the app shows none.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gap: 2 }}>
          {banners.map((b, i) => (
            <Paper key={b._id} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ position: 'relative', backgroundColor: '#F3EEE6', opacity: b.status === 'live' ? 1 : 0.7 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.imageUrl} alt={b.title || 'Banner'} style={{ width: '100%', height: 'auto', display: 'block' }} />
                {(b.title || b.subtitle) && (
                  <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: 1.5, pt: 4, background: 'linear-gradient(to top, rgba(26,20,16,0.7), rgba(26,20,16,0))', color: '#fff' }}>
                    {b.title && <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{b.title}</Typography>}
                    {b.subtitle && <Typography sx={{ fontSize: 13, opacity: 0.9 }}>{b.subtitle}</Typography>}
                  </Box>
                )}
                <Chip size="small" color={STATUS[b.status].color} label={STATUS[b.status].label} sx={{ position: 'absolute', top: 10, left: 10, fontWeight: 700 }} />
              </Box>
              <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography sx={{ fontSize: 13, color: '#4B5563' }}>
                  {linkText(b)}
                  {(b.startsAt || b.endsAt) && ` · ${b.startsAt ? `from ${when(b.startsAt)}` : ''}${b.startsAt && b.endsAt ? ' ' : ''}${b.endsAt ? `until ${when(b.endsAt)}` : ''}`}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <FormControlLabel control={<Switch checked={b.active} onChange={() => void toggle(b)} color="warning" />} label={b.active ? 'On' : 'Off'} sx={{ mr: 1 }} />
                  <IconButton aria-label="Move up" disabled={i === 0} onClick={() => void move(b, i - 1)}><IconArrowUp size={20} /></IconButton>
                  <IconButton aria-label="Move down" disabled={i === banners.length - 1} onClick={() => void move(b, i + 1)}><IconArrowDown size={20} /></IconButton>
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" startIcon={<IconPencil size={16} />} onClick={() => open(b)} sx={{ textTransform: 'none' }}>Edit</Button>
                  <Button size="small" color="error" startIcon={<IconTrash size={16} />} onClick={() => setToDelete(b)} sx={{ textTransform: 'none' }}>Delete</Button>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      <Dialog open={form !== null} onClose={() => !saving && setForm(null)} fullWidth maxWidth="sm" fullScreen={phone}>
        <DialogTitle>{form?._id ? 'Edit banner' : 'Add banner'}</DialogTitle>
        <DialogContent>
          {form && (
            <Box sx={{ display: 'grid', gap: 2, pt: 1 }}>
              <Box>
                <Box
                  onClick={() => !uploading && fileRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
                  sx={{ position: 'relative', ...(form.imageUrl ? {} : { aspectRatio: '2 / 1' }), borderRadius: 2, border: '2px dashed #D1D5DB', backgroundColor: '#FAFAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
                >
                  {form.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.imageUrl} alt="Banner" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  ) : (
                    <Box sx={{ textAlign: 'center', color: '#6B7280' }}>
                      <IconPhotoPlus size={32} />
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Choose a picture</Typography>
                    </Box>
                  )}
                  {uploading && (
                    <Box sx={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CircularProgress size={28} />
                    </Box>
                  )}
                </Box>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
                <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.75 }}>A wide picture works best (about 1400 × 700). The whole picture is shown, nothing is cut off.{form.imageUrl ? ' Tap the picture to change it.' : ''}</Typography>
              </Box>

              <TextField label="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} size="small" fullWidth helperText={`${form.title.length}/${TITLE_MAX}`} error={form.title.length > TITLE_MAX} />
              <TextField label="Line under the title (optional)" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} size="small" fullWidth helperText={`${form.subtitle.length}/${SUBTITLE_MAX}`} error={form.subtitle.length > SUBTITLE_MAX} />

              <TextField select label="When tapped" value={form.linkType} onChange={(e) => setForm({ ...form, linkType: e.target.value as BannerLinkType })} size="small" fullWidth>
                <MenuItem value="none">Nothing</MenuItem>
                <MenuItem value="category">Open a menu category</MenuItem>
                <MenuItem value="url">Open a web page</MenuItem>
              </TextField>
              {form.linkType === 'category' && (
                <TextField select label="Category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} size="small" fullWidth>
                  {categories.map((c) => (
                    <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              )}
              {form.linkType === 'url' && <TextField label="Web address" placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} size="small" fullWidth />}

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <TextField label="Starts (optional)" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} size="small" slotProps={{ inputLabel: { shrink: true } }} />
                <TextField label="Ends (optional)" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} size="small" slotProps={{ inputLabel: { shrink: true } }} />
              </Box>
              <Typography sx={{ fontSize: 12, color: '#6B7280', mt: -1 }}>Times are Pacific time. Leave them empty to show it right away and until you switch it off.</Typography>
              <FormControlLabel control={<Switch checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} color="warning" />} label="Show to customers" />
              {formError && <Alert severity="error">{formError}</Alert>}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setForm(null)} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => void save()} disabled={saving || uploading || !form?.imageUrl} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={toDelete !== null} onClose={() => setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete this banner?</DialogTitle>
        <DialogContent>
          <DialogContentText>It disappears from the website and the app. To hide it for a while, switch it off instead.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void remove()} sx={{ textTransform: 'none' }}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice('')} message={notice} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
