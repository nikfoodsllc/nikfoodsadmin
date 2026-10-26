'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Drawer, IconButton, Tab, Tabs, Typography, useMediaQuery, type Theme } from '@mui/material';
import { IconShoppingCart, IconX } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  addLine,
  estimateUnitPrice,
  lineSignature,
  lineTags,
  missingForCreate,
  needsOptions,
  orderLinePayload,
  paidMethodValue,
  removeOne,
  replaceLine,
  setLineQuantity,
  type CartLine,
  type CatalogPayload,
  type CustomerForm,
  type MenuItem,
  type OrderListRow,
  type PaidChoice,
  TIP_OTHER,
  tipFields,
  tipProblem,
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
  // the entry form and the list of orders (other customers' details) live on separate tabs so entering an order shows nothing else
  const [tab, setTab] = useState<'create' | 'orders'>('create');
  const [menuError, setMenuError] = useState('');
  const [date, setDate] = useState('');

  const [customer, setCustomer] = useState<CustomerForm>({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [existing, setExisting] = useState<FoundCustomer | null>(null);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [optionsItem, setOptionsItem] = useState<MenuItem | null>(null);
  // a line of the order being changed (size, spice, eco, combo parts, note, quantity)
  const [editLine, setEditLine] = useState<CartLine | null>(null);
  const editItem = editLine && menu ? menu.items[editLine.foodItemId] ?? null : null;

  const [tip, setTip] = useState(0);
  // dollars typed when the tip choice is "Other amount"
  const [tipOther, setTipOther] = useState('');
  const [waiveFee, setWaiveFee] = useState(false);
  // an order waiting for payment that already counts in the reports and goes to OptimoRoute
  const [countNow, setCountNow] = useState(false);
  // the Platform Fee only covers Stripe's fee, so a Zelle order starts with it waived; once the admin touches the box, their choice stays
  const feeTouched = useRef(false);
  const changeWaiveFee = (value: boolean) => {
    feeTouched.current = true;
    setWaiveFee(value);
  };
  const changePayment = (next: PaymentChoice) => {
    setPayment(next);
    // a quote always starts with the fee waived (the admin can untick it afterwards)
    if (next === 'quote') {
      feeTouched.current = false;
      setWaiveFee(true);
    } else if (!feeTouched.current) setWaiveFee(next === 'zelle');
  };
  // dollars off, as typed
  const [discount, setDiscount] = useState('');
  const discountValue = Math.max(0, Math.round((Number(discount) || 0) * 100) / 100);
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
  // a refused order gets a message that cannot be missed (on a phone the summary with the red text sits in a drawer that has closed)
  const [errorOpen, setErrorOpen] = useState(false);
  const [result, setResult] = useState<CreatedOrder | null>(null);
  // one id for this order form: the site refuses a second request with it, so a double tap or a retry cannot create the order twice
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const submittingRef = useRef(false);
  const [listVersion, setListVersion] = useState(0);
  // editing an order that was sent: its number (creating replaces it) and any problem loading it
  const [editing, setEditing] = useState<string | null>(null);
  const [editError, setEditError] = useState('');
  const [listRows, setListRows] = useState<OrderListRow[]>([]);
  // started from an abandoned checkout (?fromCheckout=pi_...): who it is for, and a note about anything that could not be added
  const [fromCheckout, setFromCheckout] = useState<{ name: string; skipped: number; noCart: boolean; email: string } | null>(null);
  const fromCheckoutDone = useRef(false);

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

  useEffect(() => {
    if (!token || !menu || fromCheckoutDone.current) return;
    const id = new URLSearchParams(window.location.search).get('fromCheckout');
    if (!id) return;
    fromCheckoutDone.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    void (async () => {
      const res = await fetch(`/api/admin/abandoned-checkouts/${encodeURIComponent(id)}/order-draft`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setEditError(body?.error || 'Could not open that checkout');
        return;
      }
      const draft = body.data as { customer: CustomerForm; lines: Array<Omit<CartLine, 'key' | 'name' | 'unitPrice' | 'tags'>>; noCart: boolean };
      let next: CartLine[] = [];
      let skipped = 0;
      for (const l of draft.lines) {
        const item = menu.items[l.foodItemId];
        if (!item) {
          skipped += 1;
          continue;
        }
        const pick = { selectedPortion: l.selectedPortion, selectedSpiceLevel: l.selectedSpiceLevel, isEcoFriendlyContainer: l.isEcoFriendlyContainer, comboSelections: l.comboSelections };
        next = addLine(next, { ...l, name: item.name, unitPrice: estimateUnitPrice(item, pick), tags: lineTags(item, pick) });
      }
      setCustomer(draft.customer);
      setLines(next);
      if (next[0]) setDate(next[0].date);
      setFromCheckout({ name: draft.customer.name || draft.customer.email, skipped, noCart: draft.noCart, email: draft.customer.email });
    })();
  }, [token, menu]);

  const orderLines = useCallback(
    () => lines.map(orderLinePayload),
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
        body: JSON.stringify({ lines: orderLines(), address: { ...address, street_address: address.street_address || 'x' }, ...tipFields(tip, tipOther), waivePlatformFee: waiveFee, discount: discountValue }),
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
  }, [token, lines, zipOk, address, tip, tipOther, waiveFee, discountValue, orderLines]);

  const counts = useMemo(() => lines.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.date]: (acc[l.date] ?? 0) + l.quantity }), {}), [lines]);
  const tipMissing = tipProblem(tip, tipOther);
  const missing = [...missingForCreate(customer, address, lines.length), ...(tipMissing ? [tipMissing] : [])];

  // the day the item being chosen goes on (an item picked from the whole menu goes on its own menu day)
  const [optionsDate, setOptionsDate] = useState('');
  const choose = (item: MenuItem, forDate: string = date) => {
    // the picker follows the item, so the order and the picker show the same day
    if (forDate && forDate !== date) setDate(forDate);
    if (needsOptions(item)) {
      setOptionsDate(forDate);
      setOptionsItem(item);
      return;
    }
    setLines((cur) => addLine(cur, { date: forDate, foodItemId: item._id, quantity: 1, name: item.name, unitPrice: estimateUnitPrice(item, {}), tags: lineTags(item, {}) }));
  };
  const takeOne = (item: MenuItem, forDate: string = date) => setLines((cur) => removeOne(cur, forDate, item._id));

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
      ...tipFields(tip, tipOther),
      waivePlatformFee: waiveFee,
      discount: discountValue,
      ...(countNow && (payment === 'link' || payment === 'zelle') ? { countBeforePayment: true } : {}),
      payment: payment === 'link' ? { mode: 'link' } : payment === 'zelle' ? { mode: 'zelle' } : payment === 'quote' ? { mode: 'quote' } : { mode: 'offline', method: paidMethodValue(paidChoice, paidTyped), note },
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
    else {
      setSubmitError(r.body?.error || 'The order could not be created');
      setErrorOpen(true);
    }
  };

  const reset = () => {
    setRequestId(crypto.randomUUID());
    setResult(null);
    setCustomer({ name: '', email: '', phone: '' });
    setAddress(EMPTY_ADDRESS);
    setExisting(null);
    setLines([]);
    setTip(0);
    setTipOther('');
    setWaiveFee(false);
    setCountNow(false);
    feeTouched.current = false;
    setDiscount('');
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
    setTab('create');
    setResult(null);
    setRequestId(crypto.randomUUID());
    setCustomer(o.customer);
    setAddress(o.address);
    setExisting(null);
    setLines(
      o.lines.map((l: CartLine) => {
        const { name, unitPrice, tags, unitPriceEdited, ...rest } = l as CartLine & { unitPriceEdited?: number };
        const pick = { ...rest, ...(unitPriceEdited !== undefined ? { unitPriceEdited } : {}) };
        return { ...pick, name, unitPrice, tags, key: lineSignature(pick) };
      })
    );
    if (typeof o.tipAmount === 'number') {
      setTip(TIP_OTHER);
      setTipOther(String(o.tipAmount));
    } else {
      setTip(o.tipPercentage);
      setTipOther('');
    }
    setWaiveFee(o.waivePlatformFee);
    setCountNow(o.countBeforePayment === true);
    feeTouched.current = true; // an order being changed keeps the fee choice it was saved with
    setDiscount(o.discount > 0 ? String(o.discount) : '');
    setPayment(o.payKind === 'zelle' ? 'zelle' : 'link');
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
      onEdit={(line) => menu?.items[line.foodItemId] && setEditLine(line)}
      preview={preview}
      previewLoading={previewLoading}
      previewError={previewError}
      tip={tip}
      onTip={setTip}
      tipOther={tipOther}
      onTipOther={setTipOther}
      waiveFee={waiveFee}
      onWaiveFee={changeWaiveFee}
      countNow={countNow}
      onCountNow={setCountNow}
      discount={discount}
      onDiscount={setDiscount}
      payment={payment}
      onPayment={changePayment}
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
  const onCreate = tab === 'create';
  const form = onCreate && menu && !result && !menuError;

  return (
    <Box sx={{ maxWidth: form && wide ? 1320 : onCreate ? 760 : 960, mx: 'auto', pb: form && !wide ? 11 : 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Create Offline Order</Typography>
      </Box>
      <Typography sx={{ fontSize: 14, color: '#6B7280', mb: 2 }}>
        Enter an order for a customer who ordered by phone or in person. Prices come from the live menu. This is a master tool: no cutoff, delivery area or day rules apply.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ mb: 2, borderBottom: '1px solid #E5E7EB', '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: 15 }, '& .Mui-selected': { color: '#B45309' }, '& .MuiTabs-indicator': { bgcolor: '#F59E0B' } }}
      >
        <Tab value="create" label="Create order" />
        <Tab value="orders" label="Recent orders" />
      </Tabs>

      {editError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditError('')}>{editError}</Alert>}
      {onCreate && (<>
      {fromCheckout && !result && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setFromCheckout(null)}>
          Started from the abandoned checkout of {fromCheckout.name}.
          {fromCheckout.noCart ? ' Their cart was not saved for this checkout, so add the items yourself.' : ' Check the items, the address and how they pay, then create the order.'}
          {fromCheckout.skipped > 0 ? ` ${fromCheckout.skipped} item${fromCheckout.skipped === 1 ? ' is' : 's are'} no longer on the menu and ${fromCheckout.skipped === 1 ? 'was' : 'were'} left out.` : ''}
        </Alert>
      )}
      {editing && !result && (
        <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={reset} sx={{ textTransform: 'none', fontWeight: 700 }}>Stop editing</Button>}>
          Editing {editing}. Change anything, then press Create: the new order replaces it, the old payment link stops working and the customer gets a new email.
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
        <OrderResult result={result} token={token} onAnother={reset} onChanged={() => setListVersion((v) => v + 1)} listed={listRows.find((r) => r.orderId === result.orderId)} />
      ) : menuError ? (
        <Alert severity="error">{menuError}</Alert>
      ) : !menu ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: wide ? 'minmax(0, 1fr) 440px' : 'minmax(0, 1fr)', alignItems: 'start' }}>
          <Box sx={{ display: 'grid', gap: 2, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <CustomerSection token={token} customer={customer} address={address} onCustomer={setCustomer} onAddress={setAddress} onPickedExisting={setExisting} accountExists={existing} prefillEmail={fromCheckout?.email} />
            <MenuPicker catalog={menu} date={date} onDate={setDate} lines={lines} counts={counts} onAdd={choose} onRemove={takeOne} />
          </Box>
          {/* sticks 12px below the 65px top bar (which stays pinned), so the whole panel is visible */}
          {wide && <Box sx={{ position: 'sticky', top: 77, maxHeight: 'calc(100vh - 89px)', overflowY: 'auto', borderRadius: 2 }}>{summary}</Box>}
        </Box>
      )}
      </>)}

      {/* stays mounted (hidden on the create tab) so the list keeps refreshing and a just-created order can be found in it */}
      <Box sx={{ display: onCreate ? 'none' : 'block' }}>
        <RecentOrders token={token} version={listVersion} onChanged={() => setListVersion((v) => v + 1)} onEdit={(id) => void startEdit(id)} onRows={setListRows} />
      </Box>

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
        open={Boolean(optionsItem) || Boolean(editItem)}
        item={editItem ?? optionsItem}
        editing={editItem ? editLine : null}
        date={editItem && editLine ? editLine.date : optionsDate || date}
        dayLabel={editItem && editLine ? dayChipLabel(editLine.date) : (optionsDate || date) ? dayChipLabel(optionsDate || date) : ''}
        onClose={() => {
          setOptionsItem(null);
          setEditLine(null);
        }}
        onAdd={(line) => {
          if (editItem && editLine) setLines((cur) => replaceLine(cur, editLine.key, line));
          else setLines((cur) => addLine(cur, line));
          setOptionsItem(null);
          setEditLine(null);
        }}
      />

      <Dialog open={errorOpen} onClose={() => setErrorOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800, color: '#B91C1C' }}>The order was NOT created</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#111827' }}>{submitError}</DialogContentText>
          <DialogContentText sx={{ mt: 1, fontSize: 13 }}>Nothing was saved and nothing was sent. Fix this and press Create again.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              setErrorOpen(false);
              if (!wide) setDrawerOpen(true);
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create this order?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {preview ? `$${preview.totals.total.toFixed(2)} for ${customer.name || 'the customer'}. ` : ''}
            {editing ? `This replaces ${editing}: that order is cancelled and its link stops working. ` : ''}
            {payment === 'link'
              ? `A payment link will be emailed to ${customer.email}.`
              : payment === 'zelle'
                ? `Zelle instructions will be emailed to ${customer.email}. The order waits until you mark the Zelle as received.`
                : payment === 'quote'
                  ? 'It will be saved as a quote (paid, method “Quote”). No email is sent to the customer or to support.'
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
