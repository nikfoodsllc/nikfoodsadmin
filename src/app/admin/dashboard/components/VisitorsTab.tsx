'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { LineChart, SERIES } from './charts';
import { count, EmptyNote, Kpi, KpiGrid, pointsOf, rangeText, Section } from './ui';
import type { Bucket, Grouping } from '@/utils/businessDashboard';

interface VisitorsAnswer {
  connected: boolean;
  error?: string;
  now?: { last5: number; last30: number };
  totals?: { visitors: number; newVisitors: number; visits: number };
  series?: Array<Bucket & { visitors: number; visits: number }>;
}

const LIVE_EVERY_MS = 60_000;

export default function VisitorsTab({ token, range, grouping }: { token: string; range: { from: string; to: string }; grouping: Grouping }) {
  const [data, setData] = useState<VisitorsAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<{ last5: number; last30: number } | null>(null);
  const [nowAt, setNowAt] = useState<Date | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from: range.from, to: range.to, group: grouping });
    fetch(`/api/admin/business-dashboard/visitors?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Could not load the visitors');
        setData(body.data);
        if (body.data?.now) {
          setNow(body.data.now);
          setNowAt(new Date());
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load the visitors');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, range.from, range.to, grouping]);

  // "on the site now" refreshes every minute while the tab is open
  useEffect(() => {
    if (!data?.connected || data.error) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/admin/business-dashboard/visitors?live=1', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((body) => {
          if (body.data?.now) {
            setNow(body.data.now);
            setNowAt(new Date());
          }
        })
        .catch(() => undefined);
    }, LIVE_EVERY_MS);
    return () => clearInterval(timer);
  }, [data, token]);

  if (loading && !data) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (data && !data.connected) {
    return <Alert severity="info">Google Analytics is not connected to the admin yet, so visitor numbers cannot be shown.</Alert>;
  }
  if (data?.error) return <Alert severity="warning">{data.error}</Alert>;
  if (!data) return null;

  const series = data.series ?? [];
  return (
    <>
      <Section
        title="On the website now"
        subtitle={nowAt ? `Updates every minute · last checked ${nowAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : undefined}
      >
        <KpiGrid cols={2}>
          <Kpi label="Last 5 minutes" value={count(now?.last5 ?? 0)} sub="people browsing right now" />
          <Kpi label="Last 30 minutes" value={count(now?.last30 ?? 0)} />
        </KpiGrid>
      </Section>

      <Section title="Visitors" subtitle={`${rangeText(range)} · from Google Analytics (live website only)`}>
        <KpiGrid cols={3}>
          <Kpi label="Visitors" value={count(data.totals?.visitors ?? 0)} sub="different people" />
          <Kpi label="New visitors" value={count(data.totals?.newVisitors ?? 0)} sub="first time on the site" />
          <Kpi label="Visits" value={count(data.totals?.visits ?? 0)} sub="a person can visit more than once" />
        </KpiGrid>
        <Box sx={{ mt: 3 }}>
          {series.every((b) => b.visitors === 0) ? (
            <EmptyNote>No visits recorded in this period. (Google Analytics started on Nov 10, 2026.)</EmptyNote>
          ) : (
            <>
              <LineChart
                points={pointsOf(series, grouping)}
                format={(v) => count(v)}
                series={[
                  { name: 'Visitors', color: SERIES[0], values: series.map((b) => b.visitors) },
                  { name: 'Visits', color: SERIES[2], values: series.map((b) => b.visits) },
                ]}
              />
              {grouping !== 'day' && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                  Visitors each {grouping} add up the people of each day, so someone who came on two days counts twice there.
                </Typography>
              )}
            </>
          )}
        </Box>
      </Section>
    </>
  );
}
