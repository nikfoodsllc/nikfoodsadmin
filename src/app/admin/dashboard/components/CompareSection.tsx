'use client';

import { useState } from 'react';
import { Box, Button, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconArrowDownRight, IconArrowUpRight, IconMinus } from '@tabler/icons-react';
import { LineChart, SERIES, type ChartPoint } from './charts';
import { count, EmptyNote, money2, moneyAxis, pointsOf, rangeText, Section, SimpleTable, type DashboardData } from './ui';
import { compareRows, type CompareMode, type CompareRow, type DayRange } from '@/utils/businessDashboard';

export interface CompareControls {
  mode: CompareMode;
  setMode: (mode: CompareMode) => void;
  draft: DayRange;
  setDraft: (range: DayRange) => void;
  apply: () => void;
  error: string | null;
  today: string;
}

type Metric = 'net' | 'gross' | 'orders';
const METRICS: Array<{ id: Metric; label: string }> = [
  { id: 'net', label: 'Net sales' },
  { id: 'gross', label: 'Gross sales' },
  { id: 'orders', label: 'Orders' },
];

function Change({ row }: { row: CompareRow }) {
  const fmt = row.kind === 'count' ? (v: number) => count(v) : money2;
  const diffText = `${row.diff > 0 ? '+' : row.diff < 0 ? '−' : ''}${fmt(Math.abs(row.diff))}`;
  if (row.diff === 0) {
    return (
      <Box component="span" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
        <IconMinus size={13} style={{ verticalAlign: '-2px' }} /> No change
      </Box>
    );
  }
  const good = row.lowerIsBetter ? row.diff < 0 : row.diff > 0;
  const Icon = row.diff > 0 ? IconArrowUpRight : IconArrowDownRight;
  return (
    <Box component="span" sx={{ color: good ? '#1f7a3a' : '#b42318', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <Icon size={13} style={{ verticalAlign: '-2px' }} />
      {/* a phone shows only the percent (the amount when there is no percent), so the column fits */}
      <Box component="span" sx={{ display: row.change !== null ? { xs: 'none', sm: 'inline' } : 'inline' }}>{diffText}</Box>
      {row.change !== null && (
        <Box component="span" sx={{ fontWeight: { xs: 600, sm: 500 } }}>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}> (</Box>
          {row.change > 0 ? '+' : ''}
          {row.change}%
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>)</Box>
        </Box>
      )}
    </Box>
  );
}

/** Compare the chosen period with the one before it, the same dates last year, or any dates: a side-by-side table and both lines on one chart */
export default function CompareSection({ data, controls }: { data: DashboardData; controls: CompareControls }) {
  const [metric, setMetric] = useState<Metric>('net');
  const now = data.totals.current;
  const before = data.totals.compare;
  const compareSeries = data.compareSeries;

  // the two periods side by side: point 1 of this period lines up with point 1 of the compared one
  const nowPoints = pointsOf(data.series, data.grouping);
  const beforePoints = compareSeries ? pointsOf(compareSeries, data.grouping) : [];
  const length = Math.max(nowPoints.length, beforePoints.length);
  const points: ChartPoint[] = Array.from({ length }, (_, i) => ({
    label: nowPoints[i]?.label ?? beforePoints[i]?.label ?? '',
    detail: [nowPoints[i]?.detail ?? nowPoints[i]?.label, beforePoints[i]?.detail ?? beforePoints[i]?.label].filter(Boolean).join(' vs '),
  }));
  // each line only as long as its own period, so a shorter period ends instead of dropping to 0
  const valuesOf = (series: DashboardData['series'] | undefined) => (series ?? []).map((b) => b[metric]);
  const format = metric === 'orders' ? (v: number) => count(v) : moneyAxis;

  const choose = (mode: CompareMode | null) => mode && controls.setMode(mode);

  return (
    <Section
      title="Compare periods"
      subtitle={before ? `${rangeText(now.range)} vs ${rangeText(before.range)}` : `${rangeText(now.range)} vs …`}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>Compare with</Typography>
        <ToggleButtonGroup size="small" exclusive value={controls.mode} onChange={(_, v) => choose(v)} sx={{ '& .MuiToggleButton-root': { textTransform: 'none', py: 0.25, px: 1.25 } }}>
          <ToggleButton value="previous">Prior period</ToggleButton>
          <ToggleButton value="lastYear">Last year</ToggleButton>
          <ToggleButton value="custom">Pick dates</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {controls.mode === 'custom' && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start', mb: 2 }}>
          <TextField size="small" type="date" label="From" value={controls.draft.from} onChange={(e) => controls.setDraft({ ...controls.draft, from: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ max: controls.today }} sx={{ width: 165 }} />
          <TextField size="small" type="date" label="To" value={controls.draft.to} onChange={(e) => controls.setDraft({ ...controls.draft, to: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ max: controls.today }} sx={{ width: 165 }} />
          <Button variant="contained" onClick={controls.apply} sx={{ height: 40 }}>Compare</Button>
          {controls.error && <Typography variant="body2" color="error" sx={{ width: '100%' }}>{controls.error}</Typography>}
        </Box>
      )}

      {!before ? (
        <EmptyNote>Pick the dates to compare with, then press Compare.</EmptyNote>
      ) : (
        <>
          <SimpleTable
            head={['', 'This period', 'Compared', 'Change']}
            // a phone hides the Compared column and shows that amount small under the label, so Change fits on screen
            phoneHide={[2]}
            rows={compareRows(now, before, data.channels.compare ? { now: data.channels.current, before: data.channels.compare } : undefined).map((r) => [
              <Box key="l" component="span" sx={{ display: 'block' }}>
                <Box component="span" sx={{ fontWeight: r.key.startsWith('orders_') ? 500 : 600, pl: r.key.startsWith('orders_') ? 1.5 : 0, color: r.key.startsWith('orders_') ? 'text.secondary' : undefined }}>{r.label.trim()}</Box>
                <Box component="span" sx={{ display: { xs: 'block', sm: 'none' }, color: 'text.secondary', fontSize: 11.5 }}>
                  was {r.kind === 'count' ? count(r.before) : money2(r.before)}
                </Box>
              </Box>,
              r.kind === 'count' ? count(r.now) : money2(r.now),
              <Box key="b" component="span" sx={{ color: 'text.secondary' }}>{r.kind === 'count' ? count(r.before) : money2(r.before)}</Box>,
              <Change key="c" row={r} />,
            ])}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 2.5, mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Each {data.grouping} of this period next to the same {data.grouping} of the compared one.
            </Typography>
            <ToggleButtonGroup size="small" exclusive value={metric} onChange={(_, v) => v && setMetric(v)} sx={{ '& .MuiToggleButton-root': { textTransform: 'none', py: 0.25, px: 1.25 } }}>
              {METRICS.map((m) => <ToggleButton key={m.id} value={m.id}>{m.label}</ToggleButton>)}
            </ToggleButtonGroup>
          </Box>
          {now.orders === 0 && before.orders === 0 ? (
            <EmptyNote>No paid orders in either period.</EmptyNote>
          ) : (
            <LineChart
              points={points}
              format={format}
              series={[
                { name: 'This period', color: SERIES[1], values: valuesOf(data.series) },
                { name: 'Compared', color: SERIES[0], values: valuesOf(compareSeries), dashed: true },
              ]}
            />
          )}
        </>
      )}
    </Section>
  );
}
