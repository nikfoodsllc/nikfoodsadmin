'use client';

import { useState } from 'react';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { IconAlertTriangle, IconDownload } from '@tabler/icons-react';
import { BarChart, LineChart, SERIES, TooltipRow } from './charts';
import { unitOf, count, Delta, EmptyNote, Kpi, KpiGrid, money, money2, moneyAxis, pointsOf, rangeText, Section, SimpleTable, type DashboardData, type QuickBlock } from './ui';
import { downloadCSV, escapeCSVValue } from '@/utils/csv';
import CompareSection, { type CompareControls } from './CompareSection';
import ChannelSection from './ChannelSection';

function QuickCard({ block }: { block: QuickBlock }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 0 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>{block.label} so far</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{rangeText(block.current.range)}</Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25, mt: 0.75 }}>{money(block.current.net)}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        net sales · {money(block.current.gross)} gross · {count(block.current.orders)} orders
      </Typography>
      <Delta now={block.current.net} before={block.previous.net} label={`${block.compareLabel} (${money(block.previous.net)})`} />
    </Paper>
  );
}

function downloadCsv(name: string, rows: Array<Array<string | number>>) {
  downloadCSV('\uFEFF' + rows.map((r) => r.map((c) => escapeCSVValue(c)).join(',')).join('\r\n'), name);
}

export default function FinancialTab({ data, compare }: { data: DashboardData; compare: CompareControls }) {
  const [showLosses, setShowLosses] = useState(false);
  const { current, previous, lastYear } = data.totals;
  const points = pointsOf(data.series, data.grouping);
  const unit = unitOf(data.grouping);
  const kept = current.feeOnCard - current.stripeFee;
  const keptSeries = data.series.map((b) => Math.round((b.feeOnCard - b.stripeFee) * 100) / 100);
  const lastYearLabel = `vs last year`;

  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2, mb: 2 }}>
        <QuickCard block={data.quick.week} />
        <QuickCard block={data.quick.month} />
        <QuickCard block={data.quick.year} />
      </Box>

      <CompareSection data={data} controls={compare} />

      <Section title="Sales" subtitle={`${rangeText(data.range)} · by the day the order was placed`}>
        <KpiGrid>
          <Kpi label="Gross sales" value={money(current.gross)} sub="Food before refunds">
            <Delta now={current.gross} before={previous.gross} label="vs prior period" />
            <Delta now={current.gross} before={lastYear.gross} label={lastYearLabel} />
          </Kpi>
          <Kpi label="Net sales" value={money(current.net)} sub={`After ${money(current.refunds)} refunds`}>
            <Delta now={current.net} before={previous.net} label="vs prior period" />
            <Delta now={current.net} before={lastYear.net} label={lastYearLabel} />
          </Kpi>
          <Kpi label="Orders" value={count(current.orders)}>
            <Delta now={current.orders} before={previous.orders} label="vs prior period" />
            <Delta now={current.orders} before={lastYear.orders} label={lastYearLabel} />
          </Kpi>
          <Kpi label="Average order" value={money2(current.averageOrder)} sub="Gross sales per order">
            <Delta now={current.averageOrder} before={previous.averageOrder} label="vs prior period" />
          </Kpi>
        </KpiGrid>
        <Box sx={{ mt: 3 }}>
          {current.orders === 0 ? (
            <EmptyNote>No paid orders in this period.</EmptyNote>
          ) : (
            <LineChart
              points={points}
              format={moneyAxis}
              series={[
                { name: 'Gross sales', color: SERIES[0], values: data.series.map((b) => b.gross) },
                { name: 'Net sales', color: SERIES[1], values: data.series.map((b) => b.net) },
              ]}
            />
          )}
        </Box>
      </Section>

      <ChannelSection data={data} />

      <Section
        title="Platform Fee vs Stripe fee"
        subtitle="Card orders only (cash, Zelle and older orders have no Stripe fee recorded)"
      >
        <KpiGrid>
          <Kpi label="Platform Fee collected" value={money(current.feeOnCard)} sub={`${count(current.cardOrders)} card orders`} />
          <Kpi label="Stripe fees" value={money(current.stripeFee)} />
          <Kpi label={kept >= 0 ? 'Kept after Stripe' : 'Lost to Stripe'} value={money(kept)} tone={kept < 0 ? 'loss' : undefined} sub={current.feeOnCard > 0 ? `${Math.round((kept / current.feeOnCard) * 100)}% of the fee` : undefined} />
          <Kpi label="Orders where we lost money" value={count(current.lossOrders)} tone={current.lossOrders > 0 ? 'loss' : undefined} sub={current.cardOrders > 0 ? `of ${count(current.cardOrders)} card orders` : undefined} />
        </KpiGrid>
        <Box sx={{ mt: 3 }}>
          {current.cardOrders === 0 ? (
            <EmptyNote>No card orders with a Stripe fee in this period.</EmptyNote>
          ) : (
            <>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Fee kept each {unit} (Platform Fee minus Stripe fee). Red bars are {unit}s where Stripe took more than the fee.
              </Typography>
              <BarChart
                points={points}
                values={keptSeries}
                name="Kept"
                format={moneyAxis}
                extra={(i) => (
                  <>
                    <TooltipRow name="Platform Fee" value={money2(data.series[i].feeOnCard)} />
                    <TooltipRow name="Stripe fee" value={money2(data.series[i].stripeFee)} />
                    <TooltipRow name="Loss orders" value={String(data.series[i].lossOrders)} />
                  </>
                )}
              />
            </>
          )}
        </Box>
        {data.losses.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Alert
              severity="error"
              icon={<IconAlertTriangle size={20} />}
              action={<Button color="inherit" size="small" onClick={() => setShowLosses((s) => !s)}>{showLosses ? 'Hide' : 'Show'}</Button>}
            >
              {current.lossOrders} {current.lossOrders === 1 ? 'order' : 'orders'} cost more in Stripe fees than the Platform Fee: {money2(data.losses.reduce((s, l) => s + l.loss, 0))}{' '}lost{current.lossOrders > data.losses.length ? ' on the 50 biggest' : ''}.
            </Alert>
            {showLosses && (
              <Box sx={{ mt: 1 }}>
                <SimpleTable
                  head={['Order', 'Placed', 'Platform Fee', 'Stripe fee', 'Lost']}
                  phoneHide={[1]}
                  rows={data.losses.map((l) => [l.orderId, rangeText({ from: l.day, to: l.day }).split(' – ')[0], money2(l.fee), money2(l.stripeFee), <Box key="l" component="span" sx={{ color: '#b42318', fontWeight: 600 }}>{money2(l.loss)}</Box>])}
                />
              </Box>
            )}
          </Box>
        )}
      </Section>

      <Section
        title="Tax"
        subtitle="Taxable sales = net sales + Platform Fee (after refunds)"
        action={
          data.taxMonths.length > 0 ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<IconDownload size={16} />}
              onClick={() =>
                downloadCsv(`tax-${data.range.from}-to-${data.range.to}.csv`, [
                  ['Month', 'Orders', 'Net sales', 'Platform Fee', 'Taxable sales', 'Tax collected'],
                  ...data.taxMonths.map((m) => [m.label, m.orders, m.net.toFixed(2), m.feeNet.toFixed(2), m.taxable.toFixed(2), m.taxNet.toFixed(2)]),
                  ['Total', current.orders, current.net.toFixed(2), current.feeNet.toFixed(2), current.taxable.toFixed(2), current.taxNet.toFixed(2)],
                ])
              }
            >
              CSV
            </Button>
          ) : undefined
        }
      >
        <KpiGrid cols={3}>
          <Kpi label="Taxable sales" value={money(current.taxable)} />
          <Kpi label="Tax collected" value={money(current.taxNet)} sub={current.tax > current.taxNet ? `${money(current.tax - current.taxNet)} given back in refunds` : undefined} />
          <Kpi label="Tax rate charged" value={current.taxable > 0 ? `${((current.taxNet / current.taxable) * 100).toFixed(2)}%` : '–'} sub="Should be close to 10.3%" />
        </KpiGrid>
        {data.taxMonths.length > 0 && (
          <Box sx={{ mt: 2.5 }}>
            <SimpleTable
              head={['Month', 'Net sales', 'Platform Fee', 'Taxable sales', 'Tax collected']}
              phoneHide={[1, 2]}
              rows={[
                ...data.taxMonths.map((m) => [m.label, money2(m.net), money2(m.feeNet), money2(m.taxable), money2(m.taxNet)]),
                ...(data.taxMonths.length > 1
                  ? [[<strong key="t">Total</strong>, <strong key="n">{money2(current.net)}</strong>, <strong key="f">{money2(current.feeNet)}</strong>, <strong key="x">{money2(current.taxable)}</strong>, <strong key="c">{money2(current.taxNet)}</strong>]]
                  : []),
              ]}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              Months at the edges only count the days inside the chosen period.
            </Typography>
          </Box>
        )}
      </Section>
    </>
  );
}
