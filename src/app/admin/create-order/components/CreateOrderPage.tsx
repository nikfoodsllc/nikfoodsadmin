'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Drawer, IconButton, Typography, useMediaQuery, type Theme } from '@mui/material';
import { IconShoppingCart, IconX } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  addLine,
  estimateUnitPrice,
  lineSignature,
  lineTags,
  missingForCreate,
  needsOptions,
  paidMethodValue,
  removeOne,
  setLineQuantity,
  type CartLine,
  type CatalogPayload,
  type CustomerForm,
  type MenuItem,
  type PaidChoice,
} from '@/utils/createOrder';
import CustomerSection, { EMPTY_ADDRESS, type FoundCustomer } from './CustomerSection';
import MenuPicker, { dayChipLabel } from './MenuPicker';
import ItemOptionsDialog from './ItemOptionsDialog';
import OrderSummary, { type PaymentChoice, type PreviewData } from './OrderSummary';
import OrderResult, { type CreatedOrder } from './OrderResult';
import RecentOrders from './RecentOrders';

async function callApi(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`/api/admin/create-order/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.success !== false, status: res.status, body };
}

export default function CreateOrderPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  const [menu, setMenu] = useState<CatalogPayload | null>(null);
  // wide screens show the order next to the items; on a phone or narrow window it opens from a bar at the bottom
  const wide = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [date, setDate] = useState('');

  const [customer, setCustomer] = useState<CustomerForm>({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [existing, setExisting] = useState<FoundCustomer | null>(null);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [optionsItem, setOptionsItem] = useState<MenuItem | null>(null);

  const [tip, setTip] = useState(0);
  const [waiveFee, setWaiveFee] = useState(false);
  const [payment, setPayment] = useState<PaymentChoice>('link');
  const [paidChoice, setPaidChoice] = useState<PaidChoice>('Cash');
  const [paidTyped, setPaidTyped] = useState('');
  const [note, setNote] = useState('');

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const previewSeq = useRef(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<CreatedOrder | null>(null);
  // one id for this order form: the site refuses a second request with it, so a double tap or a retry cannot create the order twice
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const submittingRef = useRef(false);
  const [listVersion, setListVersion] = useState(0);
  // editing an order that was sent: its number (creating replaces it) and any problem loading it
  const [editing, setEditing] = useState<string | null>(null);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const r = await callApi(token, 'catalog');
      if (cancelled) return;
      if (!r.ok) {
        setMenuError(r.body?.error || 'Could not load the menu from the customer site');
        return;
      }
      const data = r.body.data as CatalogPayload;
      setMenu(data);
      // start on the first day that is still open, else today (any date can be picked afterwards)
      setDate((d) => d || data.dates.find((x) => x.state === 'open')?.date || data.today);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const orderLines = useCallback(
    () => lines.map((l) => ({ date: l.date, foodItemId: l.foodItemId, quantity: l.quantity, selectedPortion: l.selectedPortion, selectedSpiceLevel: l.selectedSpiceLevel, isEcoFriendlyContainer: l.isEcoFriendlyContainer, comboSelections: l.comboSelections, notes: l.notes })),
    [lines]
  );

  // price the order on the customer site (debounced); it needs at least one item and the zip code
  const zipOk = /^\d{5}(-\d{4})?$/.test(address.postal_code.trim());
  useEffect(() => {
    if (!token || lines.length === 0 || !zipOk) {
      setPreview(null);
      setPreviewError('');
      setPreviewLoading(false);
      return;
    }
    const seq = ++previewSeq.current;
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      const r = await callApi(token, 'preview', {
        method: 'POST',
        body: JSON.stringify({ lines: orderLines(), address: { ...address, street_address: address.street_address || 'x' }, tipPercentage: tip, waivePlatformFee: waiveFee }),
      });
      if (seq !== previewSeq.current) return;
      setPreviewLoading(false);
      if (r.ok) {
        setPreview(r.body.data);
        setPreviewError('');
      } else {
        setPreview(null);
        setPreviewError(r.body?.error || 'Could not price the order');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [token, lines, zipOk, address, tip, waiveFee, orderLines]);

  const counts = useMemo(() => lines.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.date]: (acc[l.date] ?? 0) + l.quantity }), {}), [lines]);
  const missing = missingForCreate(customer, address, lines.length);

  const choose = (item: MenuItem) => {
    if (needsOptions(item)) {
      setOptionsItem(item);
      return;
    }
    setLines((cur) => addLine(cur, { date, foodItemId: item._id, quantity: 1, name: item.name, unitPrice: estimateUnitPrice(item, {}), tags: lineTags(item, {}) }));
  };
  const takeOne = (item: MenuItem) => setLines((cur) => removeOne(cur, date, item._id));

  const submit = async () => {
    if (!token || submittingRef.current) return;
    submittingRef.current = true;
    setConfirmOpen(false);
    setSubmitting(true);
    setSubmitError('');
    const body = {
      customer,
      address,
      lines: orderLines(),
      tipPercentage: tip,
      waivePlatformFee: waiveFee,
      payment: payment === 'link' ? { mode: 'link' } : { mode: 'offline', method: paidMethodValue(paidChoice, paidTyped), note },
      requestId,
      ...(editing ? { replacesOrderId: editing } : {}),
    };
    const r = await callApi(token, 'create', { method: 'POST', body: JSON.stringify(body) });
    setSubmitting(false);
    submittingRef.current = false;
    if (r.ok) {
      setResult(r.body.data);
      setListVersion((v) => v + 1);
    }
    else setSubmitError(r.body?.error || 'The order could not be created');
  };

  const reset = () => {
    setRequestId(crypto.randomUUID());
    setResult(null);
    setCustomer({ name: '', email: '', phone: '' });
    setAddress(EMPTY_ADDRESS);
    setExisting(null);
    setLines([]);
    setTip(0);
    setWaiveFee(false);
    setPayment('link');
    setPaidChoice('Cash');
    setPaidTyped('');
    setNote('');
    setPreview(null);
    setSubmitError('');
    setEditing(null);
    setEditError('');
  };

  // Edit: load a sent, unpaid order into the form; pressing Create makes the new version and cancels the old one
  const startEdit = async (orderId: string) => {
    if (!token) return;
    setEditError('');
    const r = await callApi(token, `orders/${encodeURIComponent(orderId)}`);
    if (!r.ok) {
      setEditError(r.body?.error || 'Could not open that order for editing');
      return;
    }
    const o = r.body.data;
    setResult(null);
    setRequestId(crypto.randomUUID());
    setCustomer(o.customer);
    setAddress(o.address);
    setExisting(null);
    setLines(
      o.lines.map((l: CartLine) => {
        const { name, unitPrice, tags, ...pick } = l;
        return { ...pick, name, unitPrice, tags, key: lineSignature(pick) };
      })
    );
    setTip(o.tipPercentage);
    setWaiveFee(o.waivePlatformFee);
    setPayment('link');
    setNote('');
    setSubmitError('');
    setDate((d) => o.lines[0]?.date || d);
    setEditing(orderId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (authLoading || !isAuthenticated || !token) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  const summary = (
    <OrderSummary
      lines={lines}
      onQuantity={(key, q) => setLines((cur) => setLineQuantity(cur, key, q))}
      preview={preview}
      previewLoading={previewLoading}
      previewError={previewError}
      tip={tip}
      onTip={setTip}
      waiveFee={waiveFee}
      onWaiveFee={setWaiveFee}
      payment={payment}
      onPayment={setPayment}
      paidChoice={paidChoice}
      onPaidChoice={setPaidChoice}
      paidTyped={paidTyped}
      onPaidTyped={setPaidTyped}
      note={note}
      onNote={setNote}
      missing={missing}
      submitting={submitting}
      submitError={submitError}
      onSubmit={() => {
        setDrawerOpen(false);
        setConfirmOpen(true);
      }}
    />
  );
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const form = menu && !result && !menuError;

  return (
    <Box sx={{ maxWidth: form && wide ? 1320 : 760, mx: 'auto', pb: form && !wide ? 11 : 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Create Order</Typography>
        <Chip label="BETA" size="small" color="warning" sx={{ fontWeight: 800 }} />
      </Box>
      <Typography sx={{ fontSize: 14, color: '#6B7280', mb: 2 }}>
        Enter an order for a customer who ordered by phone or in person. Prices come from the live menu. This is a master tool: no cutoff, delivery area or day rules apply.
      </Typography>

      {editError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditError('')}>{editError}</Alert>}
      {editing && !result && (
        <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={reset} sx={{ textTransform: 'none', fontWeight: 700 }}>Stop editing</Button>}>
          Editing {editing}. Change anything, then press Create: the new order replaces it, the old payment link stops working and the customer gets a new link by email.
        </Alert>
      )}
      {result?.replaced && (
        <Alert severity={result.replaced.cancelled ? 'success' : 'warning'} sx={{ mb: 2 }}>
          {result.replaced.cancelled
            ? `${result.replaced.orderId} was cancelled and replaced by this order.`
            : `The new order was created, but ${result.replaced.orderId} could not be cancelled (${result.replaced.error || 'unknown reason'}). Check the Recent orders list.`}
        </Alert>
      )}
      {result ? (
        <OrderResult result={result} token={token} onAnother={reset} onChanged={() => setListVersion((v) => v + 1)} />
      ) : menuError ? (
        <Alert severity="error">{menuError}</Alert>
      ) : !menu ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: wide ? 'minmax(0, 1fr) 440px' : 'minmax(0, 1fr)', alignItems: 'start' }}>
          <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <CustomerSection token={token} customer={customer} address={address} onCustomer={setCustomer} onAddress={setAddress} onPickedExisting={setExisting} accountExists={existing} />
            <MenuPicker catalog={menu} date={date} onDate={setDate} lines={lines} counts={counts} onAdd={choose} onRemove={takeOne} />
          </Box>
          {wide && <Box sx={{ position: 'sticky', top: 12, maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', borderRadius: 2 }}>{summary}</Box>}
        </Box>
      )}

      <RecentOrders token={token} version={listVersion} onChanged={() => setListVersion((v) => v + 1)} onEdit={(id) => void startEdit(id)} />

      {form && !wide && (
        <>
          <Box sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1200, p: 1.25, bgcolor: '#fff', borderTop: '1px solid #E5E7EB', boxShadow: '0 -4px 16px rgba(0,0,0,0.08)' }}>
            <Button fullWidth variant="contained" onClick={() => setDrawerOpen(true)} startIcon={<IconShoppingCart size={20} />} sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#F59E0B', color: '#111', '&:hover': { bgcolor: '#D97706' }, justifyContent: 'space-between', px: 2 }}>
              <span>{itemCount === 0 ? 'Your order is empty' : `View order · ${itemCount} item${itemCount === 1 ? '' : 's'}`}</span>
              <span>{preview ? `$${preview.totals.total.toFixed(2)}` : ''}</span>
            </Button>
          </Box>
          <Drawer anchor="bottom" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { maxHeight: '92vh', borderTopLeftRadius: 16, borderTopRightRadius: 16, bgcolor: '#F5F5F5' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 1.5 }}>
              <Typography sx={{ fontWeight: 800 }}>Your order</Typography>
              <IconButton onClick={() => setDrawerOpen(false)} aria-label="Close"><IconX size={20} /></IconButton>
            </Box>
            <Box sx={{ p: 1.5, overflowY: 'auto' }}>{summary}</Box>
          </Drawer>
        </>
      )}

      <ItemOptionsDialog
        open={Boolean(optionsItem)}
        item={optionsItem}
        date={date}
        dayLabel={date ? dayChipLabel(date) : ''}
        onClose={() => setOptionsItem(null)}
        onAdd={(line) => {
          setLines((cur) => addLine(cur, line));
          setOptionsItem(null);
        }}
      />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create this order?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {preview ? `$${preview.totals.total.toFixed(2)} for ${customer.name || 'the customer'}. ` : ''}
            {editing ? `This replaces ${editing}: that order is cancelled and its link stops working. ` : ''}
            {payment === 'link'
              ? `A payment link will be emailed to ${customer.email}.`
              : `It will be saved as paid (${paidMethodValue(paidChoice, paidTyped) ?? '?'}) and a confirmation emailed to ${customer.email}.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: 'none' }}>Back</Button>
          <Button variant="contained" onClick={submit} sx={{ textTransform: 'none', fontWeight: 700 }}>Create order</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
