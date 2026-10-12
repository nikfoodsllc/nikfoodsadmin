'use client';

import { Box, Paper, Typography } from '@mui/material';
import type { AbandonedMetrics } from '@/utils/abandonedMetrics';

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pctText = (n: number | null) => (n === null ? '–' : `${Number.isInteger(n) ? n : n.toFixed(1)}%`);

function Tile({ label, value, note, accent }: { label: string; value: string; note: string; accent?: string }) {
  return (
    <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #E5E7EB', borderRadius: 2, minWidth: 0 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
      <Typography sx={{ fontSize: { xs: 24, sm: 28 }, fontWeight: 800, lineHeight: 1.2, color: accent ?? '#111827', overflowWrap: 'anywhere' }}>{value}</Typography>
      <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.25, overflowWrap: 'anywhere' }}>{note}</Typography>
    </Paper>
  );
}

function FunnelRow({ label, count, of, color, note }: { label: string; count: number; of: number; color: string; note?: string }) {
  const share = of > 0 ? Math.round((count / of) * 1000) / 10 : 0;
  return (
    <Box sx={{ mb: 1.1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{label}</Typography>
        <Typography sx={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
          <b>{count}</b> · {pctText(of > 0 ? share : null)}
        </Typography>
      </Box>
      <Box sx={{ height: 8, bgcolor: '#F3F4F6', borderRadius: 4, mt: 0.4, overflow: 'hidden' }} role="img" aria-label={`${label}: ${count} of ${of}`}>
        <Box sx={{ height: '100%', width: `${Math.max(count > 0 ? 2 : 0, share)}%`, bgcolor: color, borderRadius: 4 }} />
      </Box>
      {note && <Typography sx={{ fontSize: 11.5, color: '#6B7280', mt: 0.3 }}>{note}</Typography>}
    </Box>
  );
}

/** The numbers above the list: how many people finish checkout, what is left in carts, and how well the reminder email works. */
export default function AbandonedMetricsPanel({ metrics }: { metrics: AbandonedMetrics }) {
  const m = metrics;
  const r = m.reminders;
  if (m.started === 0) {
    return (
      <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, border: '1px solid #E5E7EB', borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 700 }}>No one opened checkout in these days</Typography>
        <Typography sx={{ fontSize: 13, color: '#6B7280' }}>Pick a longer range to see how checkout is doing.</Typography>
      </Paper>
    );
  }
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#374151', mb: 0.75 }}>Overview</Typography>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' } }}>
        <Tile label="Checkout conversion" value={pctText(m.conversionRate)} note={`${m.completed} of ${m.started} people who opened checkout paid`} accent="#047857" />
        <Tile label="Left without paying" value={String(m.abandoned)} note={m.abandoned > 0 ? `${money(m.cartValue)} in carts · ${money(m.averageCart)} each` : 'Nobody left a cart'} accent="#B45309" />
        <Tile label="Pressed Pay, failed" value={String(m.triedToPay)} note="Wanted to buy but the payment did not go through" />
        <Tile label="Reminders sent" value={String(r.sent)} note={r.sent > 0 ? `${r.delivered} delivered · ${r.opened} opened` : 'No reminder email in these days'} />
        <Tile label="Recovered by email" value={money(r.recoveredRevenue)} note={r.sent > 0 ? `${r.recovered} of ${r.sent} ordered within 7 days of the email` : 'Shows once a reminder goes out'} accent="#047857" />
        <Tile label="You contacted" value={String(m.contacted)} note={m.abandoned > 0 ? `of ${m.abandoned} who left without paying` : ' '} />
      </Box>

      <Box sx={{ display: 'grid', gap: 1, mt: 1, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.2fr) minmax(0, 1fr)' } }}>
        <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #E5E7EB', borderRadius: 2, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 1 }}>Reminder email results</Typography>
          {r.sent === 0 ? (
            <Typography sx={{ fontSize: 13, color: '#6B7280' }}>No reminder email was sent for checkouts in these days.</Typography>
          ) : (
            <>
              <FunnelRow label="Reminded" count={r.sent} of={r.sent} color="#6366F1" />
              <FunnelRow label="Delivered" count={r.delivered} of={r.sent} color="#3B82F6" note={r.problems > 0 ? `${r.problems} bounced or marked as spam` : undefined} />
              <FunnelRow label="Opened the email" count={r.opened} of={r.sent} color="#10B981" note="A hint only: some mail apps open emails on their own" />
              <FunnelRow label="Opened the cart from it" count={r.clicked} of={r.sent} color="#059669" />
              <FunnelRow label="Ordered within 7 days" count={r.recovered} of={r.sent} color="#F59E0B" />
            </>
          )}
        </Paper>
        <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #E5E7EB', borderRadius: 2, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 1 }}>Most left behind</Typography>
          {m.topItems.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: '#6B7280' }}>No item details saved for these checkouts.</Typography>
          ) : (
            m.topItems.map((it, i) => (
              <Box key={it.name} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', py: 0.5, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                <Typography sx={{ fontSize: 12, color: '#9CA3AF', width: 14 }}>{i + 1}</Typography>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{it.name}</Typography>
                <Typography sx={{ fontSize: 12.5, color: '#6B7280', whiteSpace: 'nowrap' }}>{it.units} × · {it.people} {it.people === 1 ? 'person' : 'people'}</Typography>
              </Box>
            ))
          )}
        </Paper>
      </Box>
    </Box>
  );
}
