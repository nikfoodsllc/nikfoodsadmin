'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import {
  addLine,
  estimateUnitPrice,
  lineTags,
  missingForCreate,
  needsOptions,
  setLineQuantity,
  type CartLine,
  type CustomerForm,
  type MenuItem,
  type MenuPayload,
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

  const [menu, setMenu] = useState<MenuPayload | null>(null);
  const [menuError, setMenuError] = useState('');
  const [date, setDate] = useState('');

  const [customer, setCustomer] = useState<CustomerForm>({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [existing, setExisting] = useState<FoundCustomer | null>(null);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [optionsItem, setOptionsItem] = useState<MenuItem | null>(null);

  const [tip, setTip] = useState(0);
  const [waiveFee, setWaiveFee] = useState(false);
  const [allowBelowMin, setAllowBelowMin] = useState(false);
  const [payment, setPayment] = useState<PaymentChoice>('link');
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const r = await callApi(token, 'menu');
      if (cancelled) return;
      if (!r.ok) {
        setMenuError(r.body?.error || 'Could not load the menu from the customer site');
        return;
      }
      const data = r.body.data as MenuPayload;
      setMenu(data);
      setDate((d) => d || data.openDates[0] || '');
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
      allowBelowMinimum: allowBelowMin,
      payment: payment === 'link' ? { mode: 'link' } : { mode: 'offline', method: payment === 'cash' ? 'Cash on Delivery' : 'Other', note },
      requestId,
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
    setAllowBelowMin(false);
    setPayment('link');
    setNote('');
    setPreview(null);
    setSubmitError('');
  };

  if (authLoading || !isAuthenticated || !token) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', pb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Create Order</Typography>
        <Chip label="BETA" size="small" color="warning" sx={{ fontWeight: 800 }} />
      </Box>
      <Typography sx={{ fontSize: 14, color: '#6B7280', mb: 2 }}>
        Enter an order for a customer who ordered by phone or in person. Prices come from the live menu, so they match the website.
      </Typography>

      {result ? (
        <OrderResult result={result} token={token} onAnother={reset} onChanged={() => setListVersion((v) => v + 1)} />
      ) : menuError ? (
        <Alert severity="error">{menuError}</Alert>
      ) : !menu ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <CustomerSection token={token} customer={customer} address={address} onCustomer={setCustomer} onAddress={setAddress} onPickedExisting={setExisting} accountExists={existing} />
          <MenuPicker menu={menu} date={date} onDate={setDate} counts={counts} onChoose={choose} />
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
            allowBelowMin={allowBelowMin}
            onAllowBelowMin={setAllowBelowMin}
            payment={payment}
            onPayment={setPayment}
            note={note}
            onNote={setNote}
            missing={missing}
            submitting={submitting}
            submitError={submitError}
            onSubmit={() => setConfirmOpen(true)}
          />
        </Box>
      )}

      <RecentOrders token={token} version={listVersion} onChanged={() => setListVersion((v) => v + 1)} />

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
            {payment === 'link'
              ? `A payment link will be emailed to ${customer.email}.`
              : `It will be saved as paid and a confirmation emailed to ${customer.email}.`}
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
