'use client';

import { Box, Paper, Typography } from '@mui/material';
import { IconBrandApple, IconBuildingStore, IconWorld } from '@tabler/icons-react';
import { LineChart, SERIES } from './charts';
import { count, Delta, EmptyNote, money, pointsOf, rangeText, Section, type DashboardData } from './ui';
import { CHANNEL_LABEL, CHANNELS, type Channel } from '@/utils/businessDashboard';

const COLOR: Record<Channel, string> = { website: SERIES[0], app: SERIES[1], offline: SERIES[2] };
const ICON: Record<Channel, typeof IconWorld> = { website: IconWorld, app: IconBrandApple, offline: IconBuildingStore };
const HINT: Record<Channel, string> = { website: 'nikfoods.com', app: 'iPhone and Android app', offline: 'Entered by an admin: payment link, cash, Zelle' };

/** Paid orders split into Website / Mobile app / Offline: share of orders, sales, change against the prior period, and a chart per day / week / month */
export default function ChannelSection({ data }: { data: DashboardData }) {
  const now = data.channels.current;
  const before = data.channels.previous;
  const total = CHANNELS.reduce((n, c) => n + now[c].orders, 0);
  const points = pointsOf(data.channelSeries, data.grouping);
  return (
    <Section title="Orders by channel" subtitle={`${rangeText(data.range)} · Website vs Mobile app vs Offline`}>
      {/* the share bar: one glance at the split */}
      {total > 0 && (
        <Box sx={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', mb: 2, bgcolor: '#F3F4F6' }} role="img" aria-label={CHANNELS.map((c) => `${CHANNEL_LABEL[c]} ${now[c].share}%`).join(', ')}>
          {CHANNELS.filter((c) => now[c].orders > 0).map((c) => (
            <Box key={c} sx={{ width: `${(now[c].orders / total) * 100}%`, bgcolor: COLOR[c], borderRight: '2px solid #fff', '&:last-of-type': { borderRight: 'none' } }} />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
        {CHANNELS.map((c) => {
          const Icon = ICON[c];
          return (
            <Paper key={c} variant="outlined" sx={{ p: 1.75, borderRadius: 2, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLOR[c], flexShrink: 0 }} />
                <Icon size={16} />
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{CHANNEL_LABEL[c]}</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{HINT[c]}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.75 }}>
                <Typography sx={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{count(now[c].orders)}</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary' }}>{now[c].share}% of orders</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>{money(now[c].net)} net sales</Typography>
              <Delta now={now[c].orders} before={before[c].orders} label={`orders vs prior period (${count(before[c].orders)})`} />
            </Paper>
          );
        })}
      </Box>
      <Box sx={{ mt: 3 }}>
        {total === 0 ? (
          <EmptyNote>No paid orders in this period.</EmptyNote>
        ) : (
          <>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>Orders each {data.grouping}, by channel.</Typography>
            <LineChart points={points} format={(v) => count(v)} series={CHANNELS.map((c) => ({ name: CHANNEL_LABEL[c], color: COLOR[c], values: data.channelSeries.map((b) => b[c]) }))} />
          </>
        )}
      </Box>
    </Section>
  );
}
