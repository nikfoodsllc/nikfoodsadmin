'use client';

import { Box } from '@mui/material';
import { emailStats } from '@/utils/emailStats';

/** One short line for a History card: sent, delivered, opened and bounced, with percentages. */
export default function EmailStatsLine({ counts, opened }: { counts: Record<string, number> | undefined; opened: number | undefined }) {
  const s = emailStats(counts, opened);
  const parts: React.ReactNode[] = [<span key="sent">{s.sent} sent</span>];
  if (s.delivered > 0) parts.push(<span key="d">{s.delivered} delivered ({s.deliveryRate}%)</span>);
  if (s.delivered > 0 || s.opened > 0) parts.push(<b key="o" style={{ color: s.opened > 0 ? '#166534' : undefined }}>{s.opened} opened ({s.openRate}%)</b>);
  if (s.bounced + s.complained > 0) parts.push(<span key="b" style={{ color: '#B91C1C' }}>{s.bounced + s.complained} bounced or spam</span>);
  if (s.failed > 0) parts.push(<span key="f" style={{ color: '#B91C1C' }}>{s.failed} failed</span>);
  if (s.waiting > 0) parts.push(<span key="w">{s.waiting} waiting</span>);
  if (s.skipped > 0) parts.push(<span key="s">{s.skipped} skipped</span>);
  return (
    <Box component="span">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? ' · ' : ''}
          {p}
        </span>
      ))}
    </Box>
  );
}
