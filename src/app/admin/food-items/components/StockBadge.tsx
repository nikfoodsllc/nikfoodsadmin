'use client';

import { Box, Typography } from '@mui/material';
import { stockCellText } from '@/utils/stockLogText';

/** The Stock column: "12 / 50" (amber once the low-stock alert level is reached), a red "Sold out" at the limit, nothing when the item has no limit. */
export default function StockBadge({ stock }: { stock?: { limit: number | null; ordered: number; soldOut: boolean; unit?: string; level?: string } | null }) {
  const text = stockCellText(stock);
  if (!text) return <Typography variant="caption" sx={{ color: '#9CA3AF' }}>–</Typography>;
  // amber once the team's low-stock alert level is reached (the item's own alert share; 10% left unless changed)
  const near = !stock!.soldOut && stock!.level === 'low';
  const bg = stock!.soldOut ? '#FEE2E2' : near ? '#FEF3C7' : '#F3F4F6';
  const fg = stock!.soldOut ? '#B91C1C' : near ? '#92400E' : '#374151';
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', paddingX: 1.5, paddingY: 0.5, borderRadius: 1.5, backgroundColor: bg, whiteSpace: 'nowrap' }}>
      <Typography variant="caption" sx={{ fontSize: '12px', fontWeight: 700, color: fg }}>{text}</Typography>
    </Box>
  );
}
