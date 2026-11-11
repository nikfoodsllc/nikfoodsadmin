'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { IconSearch } from '@tabler/icons-react';
import { EMAIL_TEMPLATES, type EmailTemplate } from '@/utils/emailTemplates';
import { EMAIL_DESIGN_GUIDE } from '@/utils/emailDesignGuide';
import {
  EMAIL_HTML_LIMIT,
  EMAIL_LIMIT,
  htmlProblem,
  previewHtml,
  type EmailFormat,
  SUBJECT_LIMIT,
  TEXT_LIMIT,
  addDays,
  audienceTitle,
  fillPlaceholders,
  filterReady,
  pacificLocalToIso,
  pacificText,
  pacificToday,
  placeholdersFor,
  previewValues,
  reachOf,
  textTimeOk,
  withPlaceholder,
  type AudienceCustomer,
  type AudienceFilter,
  type AudienceKind,
} from '@/utils/communication';

interface Props {
  token: string;
  adminEmail: string;
  onSent: (message: string) => void;
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`/api/admin/communications${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) return { ok: false, error: json?.error || 'Something went wrong. Please try again.' };
    return { ok: true, data: json.data as T };
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' };
  }
}

const KIND_LABEL: Record<AudienceKind, string> = { delivery_date: 'Due for delivery', menu_day: 'Ordered for a menu day', ordered_between: 'Ordered between', people: 'Specific people', subscribers: 'Agreed to emails', all: 'Everyone' };

interface Person {
  id: string;
  name: string;
  email: string;
  phone: string;
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box component="span" sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#1F1712', color: '#F6D58E', display: 'inline-grid', placeItems: 'center', fontSize: 13, fontWeight: 800 }}>
        {n}
      </Box>
      {children}
    </Typography>
  );
}

function PlaceholderChips({ onPick, allowed }: { onPick: (p: string) => void; allowed: string[] }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75, alignItems: 'center' }}>
      <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Insert:</Typography>
      {allowed.map((p) => (
        <Chip key={p} size="small" label={p} onClick={() => onPick(p)} sx={{ fontFamily: 'monospace', fontSize: 12 }} />
      ))}
    </Box>
  );
}

function PeopleLookup({ pq, setPq, results, chosen, onAdd, onRemove, summary, label = 'Search by name, email or phone' }: { pq: string; setPq: (v: string) => void; results: Person[]; chosen: Person[]; onAdd: (p: Person) => void; onRemove: (id: string) => void; summary?: string; label?: string }) {
  return (
    <Box>
      <TextField label={label} size="small" fullWidth value={pq} onChange={(e) => setPq(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} sx={{ maxWidth: 420 }} />
      {results.length > 0 && (
        <Box sx={{ mt: 1, border: '1px solid #E5E7EB', borderRadius: 1.5, maxHeight: 260, overflowY: 'auto', maxWidth: 560 }}>
          {results.map((r) => {
            const added = chosen.some((p) => p.id === r.id);
            return (
              <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75, borderBottom: '1px solid #F3F4F6' }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{r.name || 'No name'}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#6B7280', wordBreak: 'break-word' }}>{r.email || 'No email'} · {r.phone || 'No phone'}</Typography>
                </Box>
                <Button size="small" variant={added ? 'text' : 'outlined'} disabled={added} onClick={() => onAdd(r)} sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}>{added ? 'Added' : 'Add'}</Button>
              </Box>
            );
          })}
        </Box>
      )}
      {pq.trim().length >= 2 && results.length === 0 && <Typography sx={{ fontSize: 13, color: '#6B7280', mt: 0.75 }}>No customers match.</Typography>}
      {chosen.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.25 }}>
          {chosen.map((p) => (
            <Chip key={p.id} label={p.name || p.email} onDelete={() => onRemove(p.id)} />
          ))}
        </Box>
      )}
      {summary && <Typography sx={{ fontSize: 13, mt: 1 }}>{summary}</Typography>}
    </Box>
  );
}

export default function NewMessage({ token, adminEmail, onSent }: Props) {
  const today = pacificToday();
  const [kind, setKind] = useState<AudienceKind>('delivery_date');
  const [date, setDate] = useState(addDays(today, 1));
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [people, setPeople] = useState<Person[]>([]);
  // people added by hand on top of any other choice
  const [extra, setExtra] = useState<Person[]>([]);
  const [pq, setPq] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const searchSeq = useRef(0);
  const filter: AudienceFilter =
    kind === 'ordered_between' ? { kind, from, to } : kind === 'people' ? { kind, userIds: people.map((p) => p.id) } : kind === 'all' || kind === 'subscribers' ? { kind } : { kind, date };
  const withExtra: AudienceFilter = kind !== 'people' && extra.length > 0 ? { ...filter, alsoUserIds: extra.map((p) => p.id) } : filter;
  const allowedPlaceholders = placeholdersFor(kind);

  // search customers by hand (only the newest answer is used, so a slow earlier search cannot overwrite it)
  useEffect(() => {
    if (pq.trim().length < 2) {
      setResults([]);
      return;
    }
    const mine = ++searchSeq.current;
    const t = setTimeout(async () => {
      const r = await call<Person[]>(token, `/customers?q=${encodeURIComponent(pq.trim())}`);
      if (mine !== searchSeq.current) return;
      setResults(r.ok && r.data ? r.data : []);
    }, 350);
    return () => clearTimeout(t);
  }, [pq, token]);

  const [customers, setCustomers] = useState<AudienceCustomer[] | null>(null);
  const [foundFilter, setFoundFilter] = useState<AudienceFilter | null>(null);
  const [smsMode, setSmsMode] = useState<'off' | 'dry' | 'on'>('off');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState('');

  const [email, setEmail] = useState(true);
  const [text, setText] = useState(false);
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailFormat, setEmailFormat] = useState<EmailFormat>('text');
  const [pendingTemplate, setPendingTemplate] = useState<EmailTemplate | null>(null);
  const [guideCopied, setGuideCopied] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<'phone' | 'computer'>('phone');
  const [textBody, setTextBody] = useState('');

  const [testTo, setTestTo] = useState(adminEmail);
  const [testing, setTesting] = useState(false);
  const [testNote, setTestNote] = useState<{ ok: boolean; message: string } | null>(null);

  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [local, setLocal] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [everyoneOk, setEveryoneOk] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const textReady = smsMode !== 'off';
  const reach = useMemo(() => reachOf(customers ?? [], picked), [customers, picked]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!customers) return [];
    return q ? customers.filter((c) => `${c.name} ${c.email ?? ''} ${c.phone ?? ''} ${c.orders.join(' ')}`.toLowerCase().includes(q)) : customers;
  }, [customers, search]);
  const applyTemplate = (t: EmailTemplate) => {
    setEmailFormat('html');
    setSubject(t.subject);
    setEmailBody(t.html);
    setPendingTemplate(null);
  };
  const preview = previewValues(customers?.find((c) => picked.has(c.key)), foundFilter ?? filter);

  const find = async (opts?: { filter?: AudienceFilter; keepPicks?: boolean }) => {
    const f = opts?.filter ?? withExtra;
    setFindError('');
    setFinding(true);
    const r = await call<{ customers: AudienceCustomer[]; smsMode: 'off' | 'dry' | 'on' }>(token, '/audience', { method: 'POST', body: JSON.stringify({ filter: f }) });
    setFinding(false);
    if (!r.ok || !r.data) {
      setFindError(r.error ?? 'Could not find the customers.');
      return;
    }
    // the customers we can actually reach come first, then the others (each group by name, as the server sorted them)
    const reachable = (c: AudienceCustomer) => ((c.email && !c.unsubscribed) || c.textOk ? 0 : 1);
    setCustomers([...r.data.customers].sort((a, b) => reachable(a) - reachable(b)));
    setFoundFilter(f);
    setSmsMode(r.data.smsMode);
    // people named by hand stay selected (a missing email shows on the row); the others start with the ones we can reach
    // people added by hand are always ticked; when only the added people changed, the ticks the admin made stay as they were
    setPicked((prev) => new Set(r.data!.customers.filter((c) => c.added || f.kind === 'people' || (opts?.keepPicks ? prev.has(c.key) : (c.email && !c.unsubscribed) || c.textOk)).map((c) => c.key)));
    if (r.data.smsMode === 'off') setText(false);
  };

  // adding or removing a hand-picked person while the list is showing refreshes the list at once (the ticks the admin made stay)
  const extraKey = extra.map((p) => p.id).join(',');
  const firstExtraRun = useRef(true);
  useEffect(() => {
    if (firstExtraRun.current) {
      firstExtraRun.current = false;
      return;
    }
    if (!customers || !foundFilter || foundFilter.kind === 'people') return;
    const base: AudienceFilter = { ...foundFilter };
    delete base.alsoUserIds;
    void find({ filter: extra.length > 0 ? { ...base, alsoUserIds: extra.map((p) => p.id) } : base, keepPicks: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraKey]);

  const toggle = (key: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const sendTest = async () => {
    setTestNote(null);
    setTesting(true);
    const r = await call<{ messageId?: string }>(token, '/test', { method: 'POST', body: JSON.stringify({ to: testTo, subject, emailBody, emailFormat, date: foundFilter?.date ?? filter.date ?? '' }) });
    setTesting(false);
    setTestNote(r.ok ? { ok: true, message: `Test sent to ${testTo}. Placeholders show sample values.` } : { ok: false, message: r.error ?? 'The test could not be sent.' });
  };

  const scheduledIso = when === 'later' ? pacificLocalToIso(local) : null;
  const scheduleProblem =
    when === 'later'
      ? !scheduledIso
        ? 'Pick the date and time to send (Pacific time).'
        : new Date(scheduledIso).getTime() < Date.now() + 5 * 60_000
          ? 'Pick a time at least 5 minutes from now.'
          : ''
      : '';

  const htmlError = email && emailFormat === 'html' ? htmlProblem(emailBody) : null;
  const messageOk = !htmlError && (email ? subject.trim() && emailBody.trim() : true) && (text ? textBody.trim() : true) && (email || text);
  const reachOk = (email && reach.email > 0) || (text && reach.text > 0);
  const stale = Boolean(foundFilter) && JSON.stringify(foundFilter) !== JSON.stringify(withExtra);
  const canSend = Boolean(customers) && !stale && messageOk && reachOk && !scheduleProblem && !sending;

  const send = async () => {
    setSendError('');
    setSending(true);
    const body = {
      filter: foundFilter,
      channels: { email, text },
      subject,
      emailBody,
      emailFormat,
      textBody,
      excludeKeys: (customers ?? []).filter((c) => !picked.has(c.key)).map((c) => c.key),
      ...(scheduledIso ? { scheduledFor: scheduledIso } : {}),
    };
    const r = await call<{ id: string; status: string }>(token, '/send', { method: 'POST', body: JSON.stringify(body) });
    setSending(false);
    if (!r.ok) {
      setSendError(r.error ?? 'The message could not be sent.');
      setConfirm(false);
      return;
    }
    setConfirm(false);
    onSent(scheduledIso ? `Scheduled for ${pacificText(scheduledIso)} (Pacific).` : 'Sending started. Watch the progress below.');
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {/* 1. Who */}
      <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2 }}>
        <StepTitle n={1}>Who should get it?</StepTitle>
        <ToggleButtonGroup exclusive size="small" value={kind} onChange={(_, v) => v && setKind(v)} sx={{ flexWrap: 'wrap', mb: 1.5, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600 } }}>
          {(Object.keys(KIND_LABEL) as AudienceKind[]).map((k) => (
            <ToggleButton key={k} value={k}>
              {KIND_LABEL[k]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {kind === 'ordered_between' ? (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="From" type="date" size="small" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="To" type="date" size="small" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Chip size="small" label="Today" onClick={() => { setFrom(today); setTo(today); }} />
              <Chip size="small" label="Yesterday" onClick={() => { setFrom(addDays(today, -1)); setTo(addDays(today, -1)); }} />
              <Chip size="small" label="Last 7 days" onClick={() => { setFrom(addDays(today, -6)); setTo(today); }} />
            </Box>
          </Box>
        ) : kind === 'people' ? (
          <PeopleLookup pq={pq} setPq={setPq} results={results} chosen={people} onAdd={(r) => setPeople((cur) => [...cur, r])} onRemove={(id) => setPeople((cur) => cur.filter((x) => x.id !== id))} summary={people.length === 0 ? 'No one added yet.' : `${people.length} ${people.length === 1 ? 'person' : 'people'} added.`} />
        ) : kind === 'subscribers' ? (
          <Alert severity="info" sx={{ maxWidth: 560 }}>Everyone who signed up for NikFoods email updates (the menu alerts list) and agreed to get them. You can still untick people in the list below.</Alert>
        ) : kind === 'all' ? (
          <Alert severity="warning" sx={{ maxWidth: 560 }}>This is every customer account. Use it for important notices only. You can still untick people in the list below.</Alert>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label={kind === 'delivery_date' ? 'Delivery date' : 'Menu day'} type="date" size="small" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Chip size="small" label="Today" onClick={() => setDate(today)} />
              <Chip size="small" label="Tomorrow" onClick={() => setDate(addDays(today, 1))} />
            </Box>
          </Box>
        )}
        {kind !== 'people' && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>Add other people (they get it whatever the choice above finds)</Typography>
            <PeopleLookup label="Look up a customer to add" pq={pq} setPq={setPq} results={results} chosen={extra} onAdd={(r) => setExtra((cur) => [...cur, r])} onRemove={(id) => setExtra((cur) => cur.filter((x) => x.id !== id))} summary={extra.length > 0 ? `${extra.length} added by hand.` : undefined} />
          </Box>
        )}
        <Typography sx={{ fontSize: 12.5, color: '#6B7280', mt: 1 }}>
          {kind === 'delivery_date' && 'Customers whose order is delivered on this date (the date it is really delivered on, also for items that were moved).'}
          {kind === 'menu_day' && 'Customers who ordered something from this menu day, even if it is delivered on another day.'}
          {kind === 'ordered_between' && 'Customers who placed an order in this period. Pick the same day twice for one day. Pacific time.'}
          {kind === 'people' && 'Search the customer accounts and add the people you want. Only the people you add are messaged.'}
          {kind === 'subscribers' && 'People on the menu alerts list who agreed to emails, with or without an account. Texts need their own agreement, so this choice is for email.'}
          {kind === 'all' && 'Every active customer account, whether or not they have ordered lately.'}
        </Typography>
        {(kind === 'delivery_date' || kind === 'menu_day' || kind === 'ordered_between') && <Typography sx={{ fontSize: 12.5, color: '#6B7280' }}>Paid orders only; cancelled, failed and refunded orders are left out. One row per customer.</Typography>}
        <Button variant="contained" disabled={!filterReady(filter) || finding} onClick={() => void find()} sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700, bgcolor: '#1F1712', '&:hover': { bgcolor: '#3A2A1E' } }}>
          {finding ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : kind === 'people' ? 'Continue' : 'Find customers'}
        </Button>
        {findError && <Alert severity="error" sx={{ mt: 1.5 }}>{findError}</Alert>}

        {customers && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{audienceTitle(foundFilter ?? withExtra)}</Typography>
            {stale && <Alert severity="info" sx={{ mb: 1 }}>The choice above changed. Press Find customers again before sending.</Alert>}
            {customers.length === 0 ? (
              <Typography sx={{ color: '#6B7280' }}>No customers found for this choice.</Typography>
            ) : (
              <>
                <Typography sx={{ fontSize: 14, mb: 1 }}>
                  <b>{customers.length}</b> {customers.length === 1 ? 'customer' : 'customers'} · <b>{customers.filter((c) => c.email && !c.unsubscribed).length}</b> can be emailed · <b>{customers.filter((c) => c.textOk).length}</b> can be texted
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Search name, email, phone or order"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }}
                    sx={{ flex: '1 1 220px', maxWidth: 360 }}
                  />
                  <Button size="small" onClick={() => setPicked(new Set(customers.map((c) => c.key)))} sx={{ textTransform: 'none' }}>Select all</Button>
                  <Button size="small" onClick={() => setPicked(new Set())} sx={{ textTransform: 'none' }}>Clear</Button>
                  <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{picked.size} selected</Typography>
                </Box>
                <Box sx={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: 1.5 }}>
                  {shown.slice(0, 300).map((c) => (
                    <Box key={c.key} component="label" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, px: 1, py: 0.75, borderBottom: '1px solid #F3F4F6', cursor: 'pointer', bgcolor: picked.has(c.key) ? '#FFFBF3' : '#fff' }}>
                      <Checkbox size="small" checked={picked.has(c.key)} onChange={() => toggle(c.key)} sx={{ p: 0.5, mt: 0.25 }} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{c.name || 'No name'}</Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#6B7280', wordBreak: 'break-word' }}>
                          {c.email ?? 'No email'} · {c.phone ?? 'No phone'} · {c.orders.length} order{c.orders.length === 1 ? '' : 's'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {c.added && <Chip size="small" label="Added" title="You added this person by hand" sx={{ height: 20, fontSize: 11, bgcolor: '#E0E7FF', color: '#3730A3' }} />}
                        {!c.email && <Chip size="small" label="No email" sx={{ height: 20, fontSize: 11, bgcolor: '#FEF3C7', color: '#92400E' }} />}
                        {c.email && c.unsubscribed && <Chip size="small" label="Unsubscribed" title="Stopped our emails. No emails are sent to them." sx={{ height: 20, fontSize: 11, bgcolor: '#FEE2E2', color: '#B91C1C' }} />}
                        {c.textOk ? <Chip size="small" label="Text OK" sx={{ height: 20, fontSize: 11, bgcolor: '#DCFCE7', color: '#166534' }} /> : <Chip size="small" label="No text" title={c.textReason ?? ''} sx={{ height: 20, fontSize: 11, bgcolor: '#F3F4F6', color: '#4B5563' }} />}
                      </Box>
                    </Box>
                  ))}
                  {shown.length === 0 && <Typography sx={{ p: 1.5, color: '#6B7280', fontSize: 14 }}>No one matches the search.</Typography>}
                  {shown.length > 300 && <Typography sx={{ p: 1.5, color: '#6B7280', fontSize: 13 }}>Showing the first 300 of {shown.length}. Use the search to find others. Everyone ticked is still included.</Typography>}
                </Box>
              </>
            )}
          </Box>
        )}
      </Paper>

      {/* 2. Message */}
      <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2 }}>
        <StepTitle n={2}>What do you want to say?</StepTitle>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
          <FormControlLabel control={<Checkbox checked={email} onChange={(e) => setEmail(e.target.checked)} />} label="Email" />
          <FormControlLabel control={<Checkbox checked={text} disabled={!textReady} onChange={(e) => setText(e.target.checked)} />} label="Text" />
        </Box>
        {!textReady && customers && <Alert severity="info" sx={{ mb: 1.5 }}>Text messages are not switched on yet. Email works now; texts will work here once the text service is set up.</Alert>}
        {textReady && smsMode === 'dry' && <Alert severity="warning" sx={{ mb: 1.5 }}>Texts are in practice mode: they are logged, nobody receives them.</Alert>}

        {email && (
          <Box sx={{ mb: 2 }}>
            <TextField label="Email subject" size="small" fullWidth value={subject} onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_LIMIT))} helperText={`${subject.length}/${SUBJECT_LIMIT}`} />
            <PlaceholderChips allowed={allowedPlaceholders} onPick={(p) => setSubject((s) => withPlaceholder(s, p))} />
            <ToggleButtonGroup exclusive size="small" value={emailFormat} onChange={(_, v) => v && setEmailFormat(v)} sx={{ mt: 1.5, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600 } }}>
              <ToggleButton value="text">Simple text (NikFoods style)</ToggleButton>
              <ToggleButton value="html">My own design (HTML)</ToggleButton>
            </ToggleButtonGroup>
            {emailFormat === 'text' ? (
              <>
                <TextField label="Email message" fullWidth multiline minRows={5} value={emailBody} onChange={(e) => setEmailBody(e.target.value.slice(0, EMAIL_LIMIT))} sx={{ mt: 1.5 }} helperText="A blank line starts a new paragraph." />
                <PlaceholderChips allowed={allowedPlaceholders} onPick={(p) => setEmailBody((s) => withPlaceholder(s, p))} />
                <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, bgcolor: '#FFFBF5', borderRadius: 1.5 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#A85A00', textTransform: 'uppercase' }}>Preview{customers && picked.size > 0 ? ' for the first customer' : ' (sample)'}</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mt: 0.5 }}>{fillPlaceholders(subject, preview) || 'Subject'}</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#54442F', mt: 0.5, wordBreak: 'break-word' }}>{fillPlaceholders(emailBody, preview) || 'Your message'}</Typography>
                </Paper>
              </>
            ) : (
              <Box sx={{ mt: 1.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>Start from a design</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {EMAIL_TEMPLATES.map((t) => (
                    <Chip key={t.id} label={t.name} title={t.blurb} variant="outlined" onClick={() => (emailBody.trim() && emailBody !== t.html ? setPendingTemplate(t) : applyTemplate(t))} sx={{ fontWeight: 600 }} />
                  ))}
                </Box>
                {pendingTemplate && (
                  <Alert severity="warning" sx={{ mt: 1 }} action={<><Button size="small" color="inherit" onClick={() => applyTemplate(pendingTemplate)} sx={{ textTransform: 'none', fontWeight: 800 }}>Replace</Button><Button size="small" color="inherit" onClick={() => setPendingTemplate(null)} sx={{ textTransform: 'none' }}>Keep mine</Button></>}>
                    Replace what is in the box with “{pendingTemplate.name}”?
                  </Alert>
                )}
                <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: '#FFFBF5' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 800 }}>Notes for an AI assistant</Typography>
                      <Typography sx={{ fontSize: 12.5, color: '#6B7280' }}>Designing with ChatGPT or Claude? Paste these instructions first, then describe the email you want. It will follow what works in our tool.</Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(EMAIL_DESIGN_GUIDE);
                          setGuideCopied(true);
                          setTimeout(() => setGuideCopied(false), 2500);
                        } catch {
                          setGuideCopied(false);
                        }
                      }}
                      sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1F1712', '&:hover': { bgcolor: '#3A2A1E' }, flexShrink: 0 }}
                    >
                      {guideCopied ? 'Copied' : 'Copy instructions'}
                    </Button>
                  </Box>
                  <TextField label="Instructions" fullWidth multiline minRows={6} maxRows={12} value={EMAIL_DESIGN_GUIDE} InputProps={{ readOnly: true }} inputProps={{ style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, lineHeight: 1.45 } }} sx={{ mt: 1.25 }} />
                </Paper>
                <TextField
                  label="Email HTML"
                  fullWidth
                  multiline
                  minRows={10}
                  maxRows={24}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value.slice(0, EMAIL_HTML_LIMIT))}
                  error={Boolean(htmlError)}
                  helperText={htmlError ?? `${emailBody.length.toLocaleString('en-US')} / ${EMAIL_HTML_LIMIT.toLocaleString('en-US')}. Paste a full email or just the body. The logo: <img src="cid:nikfoods-logo">. Other pictures need a public https link.`}
                  inputProps={{ spellCheck: false, style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, lineHeight: 1.45 } }}
                  sx={{ mt: 1.5 }}
                />
                <PlaceholderChips allowed={[...allowedPlaceholders, '{unsubscribeUrl}']} onPick={(p) => setEmailBody((s) => withPlaceholder(s, p))} />
                <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>Every email gets an Unsubscribe link at the bottom. Put <code>{'{unsubscribeUrl}'}</code> in a link to place it yourself; otherwise one is added for you.</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#A85A00', textTransform: 'uppercase' }}>Preview{customers && picked.size > 0 ? ' for the first customer' : ' (sample)'}</Typography>
                  <ToggleButtonGroup exclusive size="small" value={previewWidth} onChange={(_, v) => v && setPreviewWidth(v)} sx={{ '& .MuiToggleButton-root': { textTransform: 'none', py: 0.25, fontSize: 12 } }}>
                    <ToggleButton value="phone">Phone</ToggleButton>
                    <ToggleButton value="computer">Computer</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 15, mt: 0.75 }}>Subject: {fillPlaceholders(subject, preview) || '(none yet)'}</Typography>
                <Box sx={{ mt: 0.75, border: '1px solid #E5E7EB', borderRadius: 1.5, bgcolor: '#E5E7EB', p: { xs: 0.5, sm: 1.5 }, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                  <Box
                    component="iframe"
                    title="Email preview"
                    sandbox=""
                    srcDoc={emailBody.trim() && !htmlError ? previewHtml(emailBody, preview) : '<p style="font-family:sans-serif;color:#6B7280;padding:24px">Your email shows here.</p>'}
                    sx={{ width: previewWidth === 'phone' ? 375 : '100%', maxWidth: '100%', height: previewWidth === 'phone' ? 640 : 720, border: 0, bgcolor: '#fff', borderRadius: 1 }}
                  />
                </Box>
                <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.75 }}>The preview is close to what customers see. Press “Send test email” to see the real thing in your own inbox (try it on your phone and in dark mode).</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 1.5 }}>
              <TextField label="Send a test to" size="small" value={testTo} onChange={(e) => setTestTo(e.target.value)} sx={{ flex: '1 1 240px', maxWidth: 340 }} />
              <Button variant="outlined" disabled={testing || !subject.trim() || !emailBody.trim() || !testTo.trim()} onClick={sendTest} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {testing ? <CircularProgress size={18} /> : 'Send test email'}
              </Button>
            </Box>
            {testNote && <Alert severity={testNote.ok ? 'success' : 'error'} sx={{ mt: 1 }}>{testNote.message}</Alert>}
          </Box>
        )}

        {text && (
          <Box>
            <TextField label="Text message" fullWidth multiline minRows={3} value={textBody} onChange={(e) => setTextBody(e.target.value.slice(0, TEXT_LIMIT))} helperText={`${textBody.length}/${TEXT_LIMIT}. Short is best. Customers can reply STOP to stop texts.`} />
            <PlaceholderChips allowed={allowedPlaceholders} onPick={(p) => setTextBody((s) => withPlaceholder(s, p))} />
            <Box sx={{ mt: 1.5, p: 1.25, bgcolor: '#E5F2FF', borderRadius: 2, maxWidth: 340, fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{fillPlaceholders(textBody, preview) || 'Your text'}</Box>
          </Box>
        )}
      </Paper>

      {/* 3. Send */}
      <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2 }}>
        <StepTitle n={3}>Send it</StepTitle>
        {!customers ? (
          <Typography sx={{ color: '#6B7280' }}>Find customers in step 1 first.</Typography>
        ) : (
          <>
            <Box sx={{ display: 'grid', gap: 0.25, mb: 1.5, fontSize: 14 }}>
              <Typography sx={{ fontSize: 14 }}>
                <b>{reach.customers}</b> {reach.customers === 1 ? 'customer' : 'customers'} selected.
              </Typography>
              {email && (
                <Typography sx={{ fontSize: 14 }}>
                  Email: <b>{reach.email}</b> will get it{reach.noEmail > 0 ? `, ${reach.noEmail} ${reach.noEmail === 1 ? 'has' : 'have'} no email or ${reach.noEmail === 1 ? 'has' : 'have'} unsubscribed and ${reach.noEmail === 1 ? 'is' : 'are'} skipped` : ''}.
                </Typography>
              )}
              {text && (
                <Typography sx={{ fontSize: 14 }}>
                  Text: <b>{reach.text}</b> will get it{reach.noText > 0 ? `, ${reach.noText} ${reach.noText === 1 ? 'has' : 'have'} not agreed to texts and ${reach.noText === 1 ? 'is' : 'are'} skipped` : ''}.
                </Typography>
              )}
            </Box>
            <ToggleButtonGroup exclusive size="small" value={when} onChange={(_, v) => v && setWhen(v)} sx={{ mb: 1.5, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600 } }}>
              <ToggleButton value="now">Send now</ToggleButton>
              <ToggleButton value="later">Schedule for later</ToggleButton>
            </ToggleButtonGroup>
            {when === 'later' && (
              <Box sx={{ mb: 1.5 }}>
                <TextField label="Send at (Pacific time)" type="datetime-local" size="small" value={local} onChange={(e) => setLocal(e.target.value)} InputLabelProps={{ shrink: true }} />
                {scheduledIso && text && !textTimeOk(scheduledIso) && <Alert severity="info" sx={{ mt: 1 }}>Texts only go out between 8 AM and 9 PM Pacific. They will wait until 8 AM; the email goes at the time you picked.</Alert>}
              </Box>
            )}
            {scheduleProblem && <Typography sx={{ color: '#B45309', fontSize: 13, mb: 1 }}>{scheduleProblem}</Typography>}
            {!reachOk && <Typography sx={{ color: '#B45309', fontSize: 13, mb: 1 }}>Nobody selected can receive this message. Pick customers or change the channels.</Typography>}
            {sendError && <Alert severity="error" sx={{ mb: 1.5 }}>{sendError}</Alert>}
            <Button variant="contained" disabled={!canSend} onClick={() => { setEveryoneOk(false); setConfirm(true); }} sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#F89C35', color: '#1A1106', '&:hover': { bgcolor: '#E08A28' } }}>
              {when === 'later' ? 'Schedule message' : 'Send message'}
            </Button>
          </>
        )}
      </Paper>

      <Dialog open={confirm} onClose={() => !sending && setConfirm(false)} fullWidth maxWidth="xs">
        <DialogTitle>{when === 'later' ? 'Schedule this message?' : 'Send this message?'}</DialogTitle>
        <DialogContent>
          <DialogContentText component="div" sx={{ fontSize: 14 }}>
            {email && <Box>Email to <b>{reach.email}</b> {reach.email === 1 ? 'customer' : 'customers'}: “{subject}”</Box>}
            {text && <Box>Text to <b>{reach.text}</b> {reach.text === 1 ? 'customer' : 'customers'}</Box>}
            <Box sx={{ mt: 1 }}>{audienceTitle(foundFilter ?? withExtra)}.</Box>
            {foundFilter?.kind === 'all' && <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={everyoneOk} onChange={(e) => setEveryoneOk(e.target.checked)} />} label={`I want to send this to ${reach.customers} customers`} />}
            <Box sx={{ mt: 1 }}>{scheduledIso ? `It goes out ${pacificText(scheduledIso)} (Pacific). The customers are looked up again at that time.` : 'It starts right away and cannot be recalled once sent. You can stop it from History while it is still going.'}</Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)} disabled={sending} sx={{ textTransform: 'none' }}>Back</Button>
          <Button variant="contained" onClick={send} disabled={sending || (foundFilter?.kind === 'all' && !everyoneOk)} sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#F89C35', color: '#1A1106', '&:hover': { bgcolor: '#E08A28' } }}>
            {sending ? <CircularProgress size={18} /> : when === 'later' ? 'Schedule' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
