'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Paper, Typography } from '@mui/material';
import { IconX } from '@tabler/icons-react';
import { DrillArrow, DrillLabel, TapBarsHint } from '@/components/common/DrillHint';
import type { CustomerSplit, SplitLine } from '@/utils/customerSplit';
import { shortDay, type Grouping } from '@/utils/businessDashboard';
import { count, dayWithWeekday, EmptyNote, money2, rangeText, Section } from './ui';

const NEW_COLOR = '#2a78d6';
const EXISTING_COLOR = '#D9CBB0';

interface Picked {
  title: string;
  lines: SplitLine[];
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function Tile({ value, label, hint, onClick, color }: { value: string; label: string; hint?: string; onClick?: () => void; color?: string }) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      sx={{ position: 'relative', p: 1.5, pr: onClick ? 4 : 1.5, borderRadius: 2, minWidth: 0, cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { borderColor: '#B8893B', bgcolor: '#FFFBF5' } : undefined }}
    >
      {onClick && <DrillArrow />}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {color && <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color, flexShrink: 0 }} />}
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      {hint && <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{hint}</Typography>}
      {onClick && <DrillLabel text="See orders" />}
    </Paper>
  );
}

/** Paid orders of the chosen period: from new customers (their first order ever) vs from existing ones */
export default function CustomerSplitSection({ token, range, grouping }: { token: string; range: { from: string; to: string }; grouping: Grouping }) {
  const [data, setData] = useState<CustomerSplit | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    const params = new URLSearchParams({ from: range.from, to: range.to, group: grouping });
    fetch(`/api/admin/business-dashboard/customers?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'Could not load the customers');
        setData(body.data);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load the customers');
      });
    return () => controller.abort();
  }, [token, range.from, range.to, grouping]);

  const subtitle = `${rangeText(range)} · paid orders. New = the customer's first order ever.`;
  if (error) return <Section title="Orders: new vs existing customers" subtitle={subtitle}><Alert severity="error">{error}</Alert></Section>;
  if (!data) return <Section title="Orders: new vs existing customers" subtitle={subtitle}><Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box></Section>;

  const newLines = data.lines.filter((l) => l.isNew);
  const oldLines = data.lines.filter((l) => !l.isNew);
  const max = Math.max(1, ...data.series.map((b) => b.newOrders + b.existingOrders));
  const pick = (title: string, lines: SplitLine[]) => lines.length > 0 && setPicked({ title, lines });

  return (
    <Section title="Orders: new vs existing customers" subtitle={subtitle}>
      {data.orders === 0 ? (
        <EmptyNote>No paid orders in this period.</EmptyNote>
      ) : (
        <>
          <Typography sx={{ fontSize: 15, color: '#111827', mb: 1.5 }}>
            Out of <b>{count(data.orders)}</b> orders, <b>{count(data.newOrders)}</b> {data.newOrders === 1 ? 'is' : 'are'} from new customers and <b>{count(data.existingOrders)}</b> from existing customers{' '}
            <Box component="span" sx={{ color: '#6B7280', whiteSpace: 'nowrap' }}>({pct(data.newOrders, data.orders)}% : {100 - pct(data.newOrders, data.orders)}%)</Box>.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25, mb: 2 }}>
            <Tile value={count(data.orders)} label="Orders" hint={`${count(data.customers)} customers`} onClick={() => pick('All paid orders', data.lines)} />
            <Tile value={count(data.newOrders)} label="New customers" color={NEW_COLOR} hint={`${pct(data.newOrders, data.orders)}% of orders · first order ever`} onClick={newLines.length ? () => pick('Orders from new customers', newLines) : undefined} />
            <Tile value={count(data.existingOrders)} label="Existing customers" color={EXISTING_COLOR} hint={`${pct(data.existingOrders, data.orders)}% of orders · from ${count(data.existingCustomers)} ${data.existingCustomers === 1 ? 'person' : 'people'}`} onClick={oldLines.length ? () => pick('Orders from existing customers', oldLines) : undefined} />
          </Box>

          <TapBarsHint text={`Tap a bar to see that ${grouping}'s orders`} />
          <Box sx={{ display: 'flex', gap: 1.5, mb: 0.75, fontSize: 12, color: '#374151' }}>
            {[['New', NEW_COLOR], ['Existing', EXISTING_COLOR]].map(([label, color]) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color }} />
                {label}
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.25, sm: 1 }, height: 165, overflowX: 'auto', pb: 0.5 }}>
            {data.series.map((b) => {
              const total = b.newOrders + b.existingOrders;
              const newH = (b.newOrders / max) * 100;
              const oldH = (b.existingOrders / max) * 100;
              const when = grouping === 'day' ? dayWithWeekday(b.from) : grouping === 'month' ? b.label : b.from === b.to ? shortDay(b.from) : `${shortDay(b.from)} – ${shortDay(b.to)}`;
              const label = `${when}: ${b.newOrders} new, ${b.existingOrders} existing`;
              const lines = data.lines.filter((l) => l.day >= b.from && l.day <= b.to);
              const open = total > 0 ? () => pick(`Orders on ${when}`, lines) : undefined;
              return (
                <Box
                  key={b.key}
                  title={label}
                  aria-label={total > 0 ? `${label}: see orders` : label}
                  role={open ? 'button' : 'img'}
                  tabIndex={open ? 0 : undefined}
                  onClick={open}
                  onKeyDown={open ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()) : undefined}
                  sx={{ cursor: open ? 'pointer' : 'default', '&:hover .bars': open ? { filter: 'brightness(0.92)' } : undefined, flex: '1 0 0', minWidth: { xs: 17, sm: 22 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                >
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: total ? '#111827' : '#9CA3AF' }}>{total || '–'}</Typography>
                  <Box className="bars" sx={{ width: '100%', maxWidth: 34, display: 'flex', flexDirection: 'column', gap: b.newOrders && b.existingOrders ? '2px' : 0 }}>
                    {b.existingOrders > 0 && <Box sx={{ height: `${Math.max(3, oldH)}px`, bgcolor: EXISTING_COLOR, borderRadius: '6px 6px 0 0' }} />}
                    {b.newOrders > 0 && (
                      <Box sx={{ height: `${Math.max(3, newH)}px`, bgcolor: NEW_COLOR, borderRadius: b.existingOrders ? 0 : '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {newH >= 12 && <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{b.newOrders}</Typography>}
                      </Box>
                    )}
                    {!total && <Box sx={{ height: 4, bgcolor: '#F3F4F6', borderRadius: '6px 6px 0 0' }} />}
                  </Box>
                  <Typography sx={{ fontSize: { xs: 9, sm: 10 }, color: '#6B7280', mt: 0.5, lineHeight: 1.1, textAlign: 'center', whiteSpace: 'pre-line' }}>
                    {grouping === 'day' ? dayWithWeekday(b.from).replace(', ', '\n').replace(' ', '\n') : b.label.replace(' ', '\n')}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </>
      )}

      <Dialog open={Boolean(picked)} onClose={() => setPicked(null)} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ pr: 6, fontWeight: 700, fontSize: 17 }}>
          {picked?.title}
          <Typography sx={{ fontSize: 12, color: '#6B7280', fontWeight: 400 }}>
            {picked ? `${picked.lines.length} order${picked.lines.length === 1 ? '' : 's'} · ${picked.lines.filter((l) => l.isNew).length} new, ${picked.lines.filter((l) => !l.isNew).length} existing` : ''}
          </Typography>
          <IconButton aria-label="Close" onClick={() => setPicked(null)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <IconX size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ px: { xs: 1.5, sm: 2 } }}>
          {picked?.lines.map((l) => (
            <Box key={l.orderId} sx={{ py: 1, borderBottom: '1px solid #F3F4F6', '&:last-of-type': { borderBottom: 0 }, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{l.name}</Typography>
                <Typography sx={{ fontSize: 12, color: '#6B7280', overflowWrap: 'anywhere' }}>{l.orderId} · {dayWithWeekday(l.day)}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money2(l.total)}</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: l.isNew ? NEW_COLOR : '#8A7550' }}>{l.isNew ? 'New' : 'Existing'}</Typography>
              </Box>
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    </Section>
  );
}
