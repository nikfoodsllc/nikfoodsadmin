'use client';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { IconMinus, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { paidMethodValue, type CartLine, type PaidChoice } from '@/utils/createOrder';
import { dayChipLabel } from './MenuPicker';
import PaidMethodPicker from './PaidMethodPicker';

export interface PreviewData {
  days: Array<{ date: string; weekday: string; actualDeliveryDate?: string; message?: string; dayTotal: number; items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }> }>;
  totals: { subtotal: number; platformFee: number; deliveryFee: number; tax: number; tip: number; total: number };
  minOrderValue: number;
  canCheckout: boolean;
  belowMinimum?: Array<{ date: string; total: number }>;
  deliveryMessages: string[];
}

export type PaymentChoice = 'link' | 'paid';

const money = (n: number) => `$${n.toFixed(2)}`;

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography sx={{ fontSize: bold ? 16 : 14, fontWeight: bold ? 800 : 400, color: bold ? '#111827' : '#4B5563' }}>{label}</Typography>
      <Typography sx={{ fontSize: bold ? 16 : 14, fontWeight: bold ? 800 : 400, color: bold ? '#111827' : '#4B5563' }}>{value}</Typography>
    </Box>
  );
}

/** The order so far (change quantities, remove lines), the server's totals, how it is paid, and the Create button. */
export default function OrderSummary(props: {
  lines: CartLine[];
  onQuantity: (key: string, quantity: number) => void;
  /** Open the line to change its size, spice level, eco container, combo parts, note or quantity */
  onEdit: (line: CartLine) => void;
  preview: PreviewData | null;
  previewLoading: boolean;
  previewError: string;
  tip: number;
  onTip: (t: number) => void;
  waiveFee: boolean;
  onWaiveFee: (v: boolean) => void;
  payment: PaymentChoice;
  onPayment: (p: PaymentChoice) => void;
  paidChoice: PaidChoice;
  onPaidChoice: (c: PaidChoice) => void;
  paidTyped: string;
  onPaidTyped: (t: string) => void;
  note: string;
  onNote: (n: string) => void;
  missing: string[];
  submitting: boolean;
  submitError: string;
  onSubmit: () => void;
}) {
  const { lines, preview } = props;
  const byDate = lines.reduce<Record<string, CartLine[]>>((acc, l) => ({ ...acc, [l.date]: [...(acc[l.date] ?? []), l] }), {});
  const dates = Object.keys(byDate).sort();
  const methodMissing = props.payment === 'paid' && paidMethodValue(props.paidChoice, props.paidTyped) === null;
  const blocked = props.missing.length > 0 || Boolean(props.previewError) || !preview || methodMissing;

  return (
    <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: '1px solid #E5E7EB', borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 1 }}>3. Order & payment</Typography>

      {lines.length === 0 && <Typography sx={{ color: '#6B7280', fontSize: 14 }}>No items yet. Add items from the menu.</Typography>}
      {dates.map((date) => (
        <Box key={date} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A85A00' }}>{dayChipLabel(date)}</Typography>
          {preview?.days.find((d) => d.date === date)?.message && (
            <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 0.5 }}>{preview.days.find((d) => d.date === date)!.message}</Typography>
          )}
          {byDate[date].map((l) => (
            <Box key={l.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75, borderBottom: '1px solid #F3F4F6' }}>
              <Box
                role="button"
                tabIndex={0}
                aria-label={`Change ${l.name}`}
                onClick={() => props.onEdit(l)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), props.onEdit(l))}
                sx={{ minWidth: 0, flex: 1, cursor: 'pointer', borderRadius: 1, mx: -0.5, px: 0.5, '&:hover': { bgcolor: '#FFF8EC' }, '&:focus-visible': { outline: '2px solid #F5C77E' } }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>
                  {l.name}
                  <IconPencil size={13} style={{ marginLeft: 6, verticalAlign: '-1px', color: '#A85A00' }} aria-hidden />
                </Typography>
                {l.tags.length > 0 && <Typography sx={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-word' }}>{l.tags.join(' · ')}</Typography>}
                {l.notes && <Typography sx={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>Note: {l.notes}</Typography>}
                <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{money(l.unitPrice)} each</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <IconButton size="small" aria-label="One less" onClick={() => props.onQuantity(l.key, l.quantity - 1)}>{l.quantity === 1 ? <IconTrash size={16} /> : <IconMinus size={16} />}</IconButton>
                <Typography sx={{ minWidth: 22, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{l.quantity}</Typography>
                <IconButton size="small" aria-label="One more" onClick={() => props.onQuantity(l.key, l.quantity + 1)}><IconPlus size={16} /></IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      ))}

      <Divider sx={{ my: 1.5 }} />
      <TextField select label="Tip" value={props.tip} onChange={(e) => props.onTip(Number(e.target.value))} size="small" fullWidth sx={{ mb: 1 }}>
        {[0, 5, 10, 15].map((t) => <MenuItem key={t} value={t}>{t === 0 ? 'No tip' : `${t}% of the subtotal`}</MenuItem>)}
      </TextField>
      <FormControlLabel sx={{ display: 'flex' }} control={<Checkbox size="small" color="warning" checked={props.waiveFee} onChange={(e) => props.onWaiveFee(e.target.checked)} />} label={<Typography sx={{ fontSize: 14 }}>Waive the Platform Fee</Typography>} />

      {props.previewError && <Alert severity="warning" sx={{ my: 1 }}>{props.previewError}</Alert>}
      {!preview && !props.previewError && lines.length > 0 && (
        <Typography sx={{ fontSize: 13, color: '#6B7280', my: 1 }}>{props.previewLoading ? 'Working out the totals…' : 'Enter the 5 digit zip code to see the totals.'}</Typography>
      )}
      {preview && (
        <Box sx={{ my: 1.5, opacity: props.previewLoading ? 0.6 : 1 }}>
          <Row label="Subtotal" value={money(preview.totals.subtotal)} />
          <Row label="Platform Fee" value={money(preview.totals.platformFee)} />
          <Row label="Tax" value={money(preview.totals.tax)} />
          {preview.totals.tip > 0 && <Row label="Tip" value={money(preview.totals.tip)} />}
          <Row label="Total" value={money(preview.totals.total)} bold />
          {(preview.belowMinimum?.length ?? 0) > 0 && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Under the {money(preview.minOrderValue)} minimum per delivery day: {preview.belowMinimum!.map((d) => `${dayChipLabel(d.date)} (${money(d.total)})`).join(', ')}. That is fine here: each day is delivered on the date you chose.
            </Alert>
          )}
        </Box>
      )}

      <Divider sx={{ my: 1.5 }} />
      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>How does the customer pay?</Typography>
      <RadioGroup value={props.payment} onChange={(e) => props.onPayment(e.target.value as PaymentChoice)}>
        <FormControlLabel value="link" control={<Radio size="small" color="warning" />} label={<Typography sx={{ fontSize: 14 }}>Email a payment link (card or Apple Pay)</Typography>} />
        <FormControlLabel value="paid" control={<Radio size="small" color="warning" />} label={<Typography sx={{ fontSize: 14 }}>Already paid (cash, Zelle, other…)</Typography>} />
      </RadioGroup>
      {props.payment === 'paid' && (
        <Box sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: 13, color: '#4B5563', mb: 0.75 }}>How was it paid?</Typography>
          <PaidMethodPicker choice={props.paidChoice} typed={props.paidTyped} onChoice={props.onPaidChoice} onTyped={props.onPaidTyped} />
          <TextField label="Payment note (optional)" value={props.note} onChange={(e) => props.onNote(e.target.value.slice(0, 200))} size="small" fullWidth sx={{ mt: 1 }} placeholder="For example: paid to Kunal on Oct 6" />
        </Box>
      )}
      <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 1 }}>
        {props.payment === 'link'
          ? 'The customer gets an email with a secure pay link. The order is confirmed (and the confirmation email sent) once they pay.'
          : 'The order is saved as paid with the method you chose, and the customer gets the usual order confirmation email.'}
      </Typography>

      {props.missing.length > 0 && lines.length > 0 && (
        <Typography sx={{ fontSize: 12, color: '#B45309', mt: 1 }}>Still needed: {props.missing.join(', ')}</Typography>
      )}
      {props.submitError && <Alert severity="error" sx={{ mt: 1.5 }}>{props.submitError}</Alert>}
      <Button
        fullWidth
        variant="contained"
        size="large"
        disabled={blocked || props.submitting}
        onClick={props.onSubmit}
        sx={{ mt: 2, textTransform: 'none', fontWeight: 800, bgcolor: '#F59E0B', color: '#111', '&:hover': { bgcolor: '#D97706' } }}
      >
        {props.submitting ? <CircularProgress size={22} sx={{ color: '#111' }} /> : props.payment === 'link' ? 'Create order and email the payment link' : 'Create order as paid'}
      </Button>
    </Paper>
  );
}
