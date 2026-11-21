'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, FormControlLabel, IconButton, Switch, TextField, Typography } from '@mui/material';
import { IconCheck, IconDeviceFloppy, IconPhotoPlus, IconTrash } from '@tabler/icons-react';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { cleanPromo, MAX_PROMO_TEXT, promoLink, promosUntouched, type MenuPromo } from '@/utils/menuEmail';

interface Props {
  token: string;
  promos: MenuPromo[];
  onChange: (promos: MenuPromo[]) => void;
  /** true while a picture is on its way (so the message is not sent half-ready) */
  onUploading: (busy: boolean) => void;
}

const same = (a: MenuPromo[], b: MenuPromo[]) => JSON.stringify(a.map(cleanPromo)) === JSON.stringify(b.map(cleanPromo));

/** The "Promotions" step of the New menu email: Niksweets, Bite Theory ... each with text, a picture and a link; saved for every new email. */
export default function MenuPromos({ token, promos, onChange, onUploading }: Props) {
  const latest = useRef(promos);
  latest.current = promos;
  const [saved, setSaved] = useState<MenuPromo[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const files = useRef<Array<HTMLInputElement | null>>([]);

  // a new email (nothing typed in the promos yet) starts with the saved promotions
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/communication-promos', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !Array.isArray(json?.data?.promos)) return;
        const list = (json.data.promos as unknown[]).map(cleanPromo);
        setSaved(list);
        if (list.length > 0 && promosUntouched(latest.current)) onChange(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const setOne = (i: number, patch: Partial<MenuPromo>) => {
    setMessage(null);
    onChange(latest.current.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  };

  const upload = async (i: number, file: File | undefined) => {
    if (files.current[i]) files.current[i]!.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ text: `${file.name} is not a picture`, error: true });
      return;
    }
    setUploading(i);
    onUploading(true);
    try {
      const up = await uploadToCloudinary(file);
      setOne(i, { imageUrl: up.secure_url });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not upload the picture', error: true });
    } finally {
      setUploading(null);
      onUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/communication-promos', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ promos: latest.current }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not save');
      setSaved((json.data.promos as unknown[]).map(cleanPromo));
      setMessage({ text: 'Saved. Every new menu email starts with these.' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not save', error: true });
    } finally {
      setSaving(false);
    }
  };

  const unchanged = saved !== null && saved.length > 0 && same(promos, saved);
  return (
    <Box>
      <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        {promos.map((p, i) => {
          const badLink = p.linkUrl.trim() !== '' && !promoLink(p.linkUrl);
          return (
            <Box key={i} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1.25, minWidth: 0, opacity: p.on ? 1 : 0.6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{p.name}</Typography>
                <FormControlLabel control={<Switch size="small" checked={p.on} onChange={(e) => setOne(i, { on: e.target.checked })} />} label={<Typography sx={{ fontSize: 12.5 }}>In this email</Typography>} sx={{ mr: 0 }} />
              </Box>
              <TextField size="small" fullWidth multiline minRows={2} label="Text" value={p.text} onChange={(e) => setOne(i, { text: e.target.value.slice(0, MAX_PROMO_TEXT) })} sx={{ mt: 1 }} />
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mt: 1 }}>
                <TextField size="small" label="Link" placeholder="www.niksweets.com" value={p.linkUrl} onChange={(e) => setOne(i, { linkUrl: e.target.value.slice(0, 200) })} error={badLink} helperText={badLink ? 'Not a web address' : ' '} />
                <TextField size="small" label="Link words" placeholder={promoLink(p.linkUrl).replace(/^https:\/\//, '').replace(/\/$/, '') || 'www.niksweets.com'} value={p.linkText} onChange={(e) => setOne(i, { linkText: e.target.value.slice(0, 60) })} helperText="Shown at the end of the text" />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.5 }}>
                {p.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt={`${p.name} picture`} style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 8, background: '#F9FAFB', border: '1px solid #E5E7EB' }} />
                    <Button size="small" variant="outlined" disabled={uploading !== null} onClick={() => files.current[i]?.click()} sx={{ textTransform: 'none', fontWeight: 700 }}>Change picture</Button>
                    <IconButton aria-label={`Remove the ${p.name} picture`} size="small" onClick={() => setOne(i, { imageUrl: '' })} sx={{ color: '#B91C1C' }}><IconTrash size={18} /></IconButton>
                  </>
                ) : (
                  <Button size="small" variant="outlined" startIcon={uploading === i ? <CircularProgress size={14} /> : <IconPhotoPlus size={16} />} disabled={uploading !== null} onClick={() => files.current[i]?.click()} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    {uploading === i ? 'Uploading…' : 'Add picture'}
                  </Button>
                )}
                <input ref={(el) => { files.current[i] = el; }} type="file" accept="image/*" hidden onChange={(e) => void upload(i, e.target.files?.[0])} />
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1.25 }}>
        {unchanged ? (
          <Chip size="small" icon={<IconCheck size={14} />} label="Saved for every new email" sx={{ bgcolor: '#ECFDF3', color: '#05603A', fontWeight: 600, '& .MuiChip-icon': { color: '#05603A' } }} />
        ) : (
          <Button size="small" variant="outlined" startIcon={saving ? <CircularProgress size={14} /> : <IconDeviceFloppy size={16} />} disabled={saved === null || saving || uploading !== null || promos.length === 0} onClick={() => void save()} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {saved && saved.length > 0 ? 'Save changes for every new email' : 'Save for every new email'}
          </Button>
        )}
      </Box>
      {message && (message.error ? <Alert severity="error" sx={{ mt: 1 }}>{message.text}</Alert> : <Typography sx={{ fontSize: 12, mt: 0.5, color: '#05603A' }}>{message.text}</Typography>)}
    </Box>
  );
}
