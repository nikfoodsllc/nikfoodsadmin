'use client';

import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { IconArrowDownRight, IconArrowUpRight, IconMinus } from '@tabler/icons-react';
import { percentChange, type MoneyTotals, type Bucket, type ItemType, type Grouping, shortDay } from '@/utils/businessDashboard';
import type { ChartPoint } from './charts';

/** Shapes of the Dashboard API answers */
export type Totals = MoneyTotals & { range: { from: string; to: string } };
export interface QuickBlock {
  label: string;
  compareLabel: string;
  current: Totals;
  previous: Totals;
}
export interface DashboardData {
  today: string;
  range: { from: string; to: string };
  grouping: Grouping;
  totals: { current: Totals; previous: Totals; lastYear: Totals; compare?: Totals };
  quick: { week: QuickBlock; month: QuickBlock; year: QuickBlock };
  series: Array<Bucket & MoneyTotals>;
  compareSeries?: Array<Bucket & MoneyTotals>;
  types: Array<Bucket & { cooked: number; readyToEat: number; notSet: number }>;
  losses: Array<{ orderId: string; day: string; fee: number; stripeFee: number; loss: number }>;
  taxMonths: Array<{ month: string; label: string; net: number; feeNet: number; taxable: number; taxNet: number; orders: number }>;
  topItems: Array<{ key: string; name: string; type: ItemType; quantity: number; revenue: number }>;
  itemNames: Array<{ name: string; revenue: number; quantity: number; type: ItemType }>;
  firstSaleDay: string | null;
}

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** $12,345 for big amounts, $12.34 under $1,000 */
export function money(v: number): string {
  return Math.abs(v) >= 1000 ? usd0.format(v) : usd2.format(v);
}
export const money2 = (v: number) => usd2.format(v);
/** Short axis labels: $1.2k */
export function moneyAxis(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return `${v < 0 ? '-' : ''}$${(a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `${v < 0 ? '-' : ''}$${Math.round(a)}`;
}
export const count = (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v));

export const TYPE_LABEL: Record<ItemType, string> = { cooked: 'Cooked', ready_to_eat: 'Ready to eat', not_set: 'Prep Type N/A' };

/** Chart points of buckets: 'Nov 14' with 'Nov 14 – Nov 20' in the tooltip */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** 'Wed, Nov 18' */
export function dayWithWeekday(day: string): string {
  return `${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]}, ${shortDay(day)}`;
}

/** 'day', 'week' or 'month', for sentences like 'Sales each week' */
export const unitOf = (grouping: Grouping) => grouping;

export function pointsOf(buckets: Bucket[], grouping: Grouping): ChartPoint[] {
  return buckets.map((b) => ({
    label: b.label,
    detail: grouping === 'day' ? dayWithWeekday(b.from) : grouping === 'week' ? (b.from === b.to ? shortDay(b.from) : `${shortDay(b.from)} – ${shortDay(b.to)}`) : b.label,
  }));
}

export function rangeText(r: { from: string; to: string }): string {
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  return `${shortDay(r.from)}${sameYear ? '' : `, ${r.from.slice(0, 4)}`} – ${shortDay(r.to)}, ${r.to.slice(0, 4)}`;
}

/** '+12.4% vs last week', green up / red down / grey when there is nothing to compare with */
export function Delta({ now, before, label, invert = false }: { now: number; before: number; label: string; invert?: boolean }) {
  const change = percentChange(now, before);
  if (change === null) {
    return (
      <Typography variant="caption" component="div" sx={{ color: 'text.secondary', lineHeight: 1.45 }}>
        No sales to compare {label.replace(/^vs /, 'with ')}
      </Typography>
    );
  }
  const good = invert ? change < 0 : change > 0;
  const flat = change === 0;
  const color = flat ? 'text.secondary' : good ? '#1f7a3a' : '#b42318';
  const Icon = flat ? IconMinus : change > 0 ? IconArrowUpRight : IconArrowDownRight;
  return (
    <Typography variant="caption" component="div" sx={{ color: 'text.secondary', lineHeight: 1.45 }}>
      <Box component="span" sx={{ color, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        <Icon size={14} style={{ verticalAlign: '-2px' }} />
        {change > 0 ? '+' : ''}
        {change}%
      </Box>{' '}
      {label}
    </Typography>
  );
}

export function Section({ title, subtitle, action, children }: { title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{title}</Typography>
          {subtitle && <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

/** A headline number with its label and optional comparison lines */
export function Kpi({ label, value, sub, children, tone }: { label: string; value: string; sub?: ReactNode; children?: ReactNode; tone?: 'loss' }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: { xs: 24, sm: 28 }, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: tone === 'loss' ? '#b42318' : 'text.primary', my: 0.25 }}>
        {value}
      </Typography>
      {sub && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{sub}</Typography>}
      {children && <Box sx={{ mt: 0.5, display: 'grid', gap: 0.25 }}>{children}</Box>}
    </Box>
  );
}

/** A responsive grid of KPIs: 2 columns on a phone, up to `cols` on a computer */
export function KpiGrid({ cols = 4, children }: { cols?: number; children: ReactNode }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${cols}, minmax(0, 1fr))` }, columnGap: 3, rowGap: 2.5 }}>{children}</Box>;
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>{children}</Typography>;
}

/** A plain table that scrolls sideways inside its box on a phone (never the page) */
export function SimpleTable({ head, rows, align, phoneHide = [] }: { head: string[]; rows: ReactNode[][]; align?: Array<'left' | 'right'>; phoneHide?: number[] }) {
  const hide = (i: number) => (phoneHide.includes(i) ? 'dash-phone-hide' : undefined);
  return (
    <Box sx={{ overflowX: 'auto', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 } }}>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, '& td, & th': { py: 0.9, px: { xs: 0.6, sm: 1 }, borderBottom: '1px solid #eeede9', whiteSpace: 'nowrap' }, '& .dash-phone-hide': { display: { xs: 'none', sm: 'table-cell' } }, '& th': { color: 'text.secondary', fontWeight: 600, fontSize: 12 }, '& td': { fontVariantNumeric: 'tabular-nums' }, '& tr:last-of-type td': { borderBottom: 'none' } }}>
        <thead>
          <tr>{head.map((h, i) => <th key={h} className={hide(i)} style={{ textAlign: align?.[i] ?? (i === 0 ? 'left' : 'right') }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => <td key={ci} className={hide(ci)} style={{ textAlign: align?.[ci] ?? (ci === 0 ? 'left' : 'right') }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}
