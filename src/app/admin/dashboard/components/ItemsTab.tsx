'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Autocomplete, Box, Chip, CircularProgress, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { LineChart, MUTED, SERIES, ShareBars } from './charts';
import { count, EmptyNote, money, money2, moneyAxis, pointsOf, Section, SimpleTable, TYPE_LABEL, type DashboardData } from './ui';
import { percentChange, typeShare, type Bucket, type ItemType } from '@/utils/businessDashboard';

const COOKED = SERIES[0];
const RTE = SERIES[1];
const MAX_COMPARE = 6;

function TypeChip({ type }: { type: ItemType }) {
  const color = type === 'cooked' ? COOKED : type === 'ready_to_eat' ? RTE : MUTED;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, color: 'text.secondary' }}>
      <Box component="span" sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: color }} />
      {TYPE_LABEL[type]}
    </Box>
  );
}

/** The big "65% Cooked · 35% Ready to eat" split of the whole period */
function ShareStrip({ cooked, readyToEat, notSet }: { cooked: number; readyToEat: number; notSet: number }) {
  const share = typeShare(cooked, readyToEat);
  if (!share) return <EmptyNote>No items sold in this period.</EmptyNote>;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, mb: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{share.cooked}%</Typography>
          <TypeChip type="cooked" /> <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>· {money(cooked)}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{share.readyToEat}%</Typography>
          <TypeChip type="ready_to_eat" /> <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>· {money(readyToEat)}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', height: 12, gap: '2px', borderRadius: 6, overflow: 'hidden' }}>
        <Box sx={{ width: `${share.cooked}%`, bgcolor: COOKED }} />
        <Box sx={{ width: `${share.readyToEat}%`, bgcolor: RTE }} />
      </Box>
      {notSet > 0 && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          {money(notSet)} of items have no preparation type and are left out of the split (set it in Food Items).
        </Typography>
      )}
    </Box>
  );
}

interface ItemSeriesAnswer {
  buckets: Bucket[];
  items: Array<{ key: string; name: string; points: Array<{ quantity: number; revenue: number }> }>;
}

export default function ItemsTab({ data, token }: { data: DashboardData; token: string }) {
  const points = pointsOf(data.types, data.grouping);
  const unit = data.grouping === 'week' ? 'week' : 'month';
  const totals = data.types.reduce((s, b) => ({ cooked: s.cooked + b.cooked, readyToEat: s.readyToEat + b.readyToEat, notSet: s.notSet + b.notSet }), { cooked: 0, readyToEat: 0, notSet: 0 });

  const [topBy, setTopBy] = useState<'revenue' | 'quantity'>('revenue');
  const top = useMemo(() => [...data.itemNames].sort((a, b) => (topBy === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity) || a.name.localeCompare(b.name)).slice(0, 10), [data.itemNames, topBy]);

  // item comparison: starts with the 3 best sellers of the period; kept when the period changes if still sold
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    setPicked((current) => {
      const sold = new Set(data.itemNames.map((i) => i.name));
      const kept = current.filter((n) => sold.has(n));
      return kept.length > 0 ? kept : data.itemNames.slice(0, 3).map((i) => i.name);
    });
  }, [data.itemNames]);
  const [metric, setMetric] = useState<'revenue' | 'quantity'>('revenue');
  const [compare, setCompare] = useState<ItemSeriesAnswer | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    if (picked.length === 0) {
      setCompare(null);
      return;
    }
    const controller = new AbortController();
    setCompareLoading(true);
    setCompareError(null);
    const params = new URLSearchParams({ from: data.range.from, to: data.range.to, group: data.grouping, names: JSON.stringify(picked) });
    fetch(`/api/admin/business-dashboard/items?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Could not load the items');
        setCompare(body.data as ItemSeriesAnswer);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setCompareError(e instanceof Error ? e.message : 'Could not load the items');
      })
      .finally(() => {
        if (!controller.signal.aborted) setCompareLoading(false);
      });
    return () => controller.abort();
  }, [picked, data.range.from, data.range.to, data.grouping, token]);

  const fmt = metric === 'revenue' ? moneyAxis : (v: number) => count(v);
  const fmtCell = metric === 'revenue' ? money2 : (v: number) => count(v);

  return (
    <>
      <Section title="Cooked vs Ready to eat" subtitle="Share of item sales (price × quantity, before refunds). Combos count as cooked.">
        <ShareStrip {...totals} />
        {totals.cooked + totals.readyToEat > 0 && (
          <>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mt: 3, mb: 1 }}>Share each {unit}</Typography>
            <ShareBars
              points={points}
              format={money2}
              parts={[
                { name: 'Cooked', color: COOKED, values: data.types.map((b) => b.cooked) },
                { name: 'Ready to eat', color: RTE, values: data.types.map((b) => b.readyToEat) },
              ]}
            />
            <Typography sx={{ fontWeight: 600, fontSize: 14, mt: 3, mb: 1 }}>Sales each {unit}</Typography>
            <LineChart
              points={points}
              format={moneyAxis}
              series={[
                { name: 'Cooked', color: COOKED, values: data.types.map((b) => b.cooked) },
                { name: 'Ready to eat', color: RTE, values: data.types.map((b) => b.readyToEat) },
              ]}
            />
          </>
        )}
      </Section>

      <Section
        title="Best sellers"
        subtitle="Top 10 items of the period"
        action={
          <ToggleButtonGroup size="small" exclusive value={topBy} onChange={(_, v) => v && setTopBy(v)}>
            <ToggleButton value="revenue">By sales</ToggleButton>
            <ToggleButton value="quantity">By quantity</ToggleButton>
          </ToggleButtonGroup>
        }
      >
        {top.length === 0 ? (
          <EmptyNote>No items sold in this period.</EmptyNote>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
              <TypeChip type="cooked" />
              <TypeChip type="ready_to_eat" />
            </Box>
            <SimpleTable
              head={['#', 'Item', 'Qty', 'Sales']}
              align={['left', 'left', 'right', 'right']}
              rows={top.map((item, i) => [
                <Typography key="r" variant="caption" sx={{ color: 'text.secondary' }}>{i + 1}</Typography>,
                <Box key="n" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, whiteSpace: 'normal', fontWeight: 500 }}>
                  <Box component="span" title={TYPE_LABEL[item.type]} sx={{ width: 8, height: 8, borderRadius: '2px', mt: '6px', flexShrink: 0, bgcolor: item.type === 'cooked' ? COOKED : item.type === 'ready_to_eat' ? RTE : MUTED }} />
                  {item.name}
                </Box>,
                <Box key="q" sx={{ fontWeight: topBy === 'quantity' ? 700 : 400 }}>{count(item.quantity)}</Box>,
                <Box key="s" sx={{ fontWeight: topBy === 'revenue' ? 700 : 400 }}>{money2(item.revenue)}</Box>,
              ])}
            />
          </>
        )}
      </Section>

      <Section
        title="Compare items"
        subtitle={`Pick up to ${MAX_COMPARE} items, e.g. Aloo Parantha and Gobhi Parantha`}
        action={
          <ToggleButtonGroup size="small" exclusive value={metric} onChange={(_, v) => v && setMetric(v)}>
            <ToggleButton value="revenue">Sales</ToggleButton>
            <ToggleButton value="quantity">Quantity</ToggleButton>
          </ToggleButtonGroup>
        }
      >
        <Autocomplete
          multiple
          size="small"
          options={data.itemNames.map((i) => i.name)}
          value={picked}
          onChange={(_, value) => setPicked(value.slice(0, MAX_COMPARE))}
          getOptionDisabled={(option) => picked.length >= MAX_COMPARE && !picked.includes(option)}
          filterSelectedOptions
          renderTags={(value, getTagProps) =>
            value.map((name, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  {...tagProps}
                  size="small"
                  label={name}
                  icon={<Box component="span" sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: SERIES[index % SERIES.length], ml: '8px !important' }} />}
                />
              );
            })
          }
          renderInput={(params) => <TextField {...params} placeholder={picked.length === 0 ? 'Search items sold in this period' : ''} />}
          sx={{ mb: 2 }}
        />
        {compareError && <Alert severity="error" sx={{ mb: 2 }}>{compareError}</Alert>}
        {picked.length === 0 ? (
          <EmptyNote>Pick an item to see its trend.</EmptyNote>
        ) : compareLoading && !compare ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : compare ? (
          <Box sx={{ opacity: compareLoading ? 0.5 : 1, transition: 'opacity 150ms' }}>
            <LineChart
              points={pointsOf(compare.buckets, data.grouping)}
              format={fmt}
              series={compare.items.map((item, i) => ({ name: item.name, color: SERIES[i % SERIES.length], values: item.points.map((p) => p[metric]) }))}
            />
            <Box sx={{ mt: 2 }}>
              <SimpleTable
                head={['Item', 'Period', `Latest ${unit}`, `vs ${unit} before`]}
                phoneHide={[2]}
                rows={compare.items.map((item, i) => {
                  const values = item.points.map((p) => p[metric]);
                  const last = values[values.length - 1] ?? 0;
                  const before = values[values.length - 2] ?? 0;
                  const change = percentChange(last, before);
                  return [
                    <Box key="n" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, whiteSpace: 'normal' }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: SERIES[i % SERIES.length], flexShrink: 0 }} />
                      {item.name}
                    </Box>,
                    <strong key="t">{fmtCell(values.reduce((s, v) => s + v, 0))}</strong>,
                    fmtCell(last),
                    <Box key="c" component="span" title={`${unit === 'week' ? 'Week' : 'Month'} before: ${fmtCell(before)}`} sx={{ color: change === null || change === 0 ? 'text.secondary' : change > 0 ? '#1f7a3a' : '#b42318', fontWeight: 600 }}>
                      {change === null ? '–' : `${change > 0 ? '+' : ''}${change}%`}
                    </Box>,
                  ];
                })}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                The latest {unit} may not be over yet.
              </Typography>
            </Box>
          </Box>
        ) : null}
      </Section>
    </>
  );
}
