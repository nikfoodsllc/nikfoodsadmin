'use client';

import { Box, Chip, Paper, Typography } from '@mui/material';
import { formatDayShort, shortSpiceLabel } from '@/utils/kitchenDashboard';
import { heldReasonText, type HeldCustomer, type HeldReport } from '@/utils/packingHeld';

function HeldCard({ customer, showDate }: { customer: HeldCustomer; showDate: boolean }) {
  const units = customer.lines.reduce((n, l) => n + l.quantity, 0);
  const reasons = [...new Set(customer.lines.map((l) => heldReasonText(l.reason)))];
  return (
    <Paper className="print-card" elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 1.25, bgcolor: '#fff' }}>
      <Box sx={{ px: 2, py: 1, bgcolor: '#FDEFC4', borderBottom: '1px solid #F5D98A' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#111827', wordBreak: 'break-word', lineHeight: 1.3 }}>{customer.customerName || 'Customer'}</Typography>
            <Typography sx={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-word' }}>{customer.orderIds.join(', ')}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>Goes out {customer.goesOutOn.map(formatDayShort).join(', ')}</Typography>
            <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{units} unit{units === 1 ? '' : 's'}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
          {customer.alsoToday && <Chip size="small" label="Also delivering today (other items)" sx={{ height: 22, fontSize: 12, bgcolor: '#E2F4E7', color: '#126B2C', fontWeight: 600 }} />}
          <Typography sx={{ fontSize: 12, color: '#4B5563' }}>{reasons.join(' · ')}</Typography>
        </Box>
      </Box>
      {customer.lines.map((line, i) => (
        <Box key={`${line.orderId}-${i}`} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 0.8, px: 2, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6', bgcolor: line.isEco ? '#E2F4E7' : '#FFFFFF' }}>
          <Typography sx={{ width: { xs: 40, sm: 48 }, flexShrink: 0, fontSize: 16, fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', lineHeight: 1.3 }}>× {line.quantity}</Typography>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#111827', wordBreak: 'break-word' }}>{line.name}</Typography>
            {(line.spice || line.portion || line.isEco) && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.3 }}>
                {line.portion && <Typography sx={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{line.portion}</Typography>}
                {line.spice && <Chip size="small" label={shortSpiceLabel(line.spice)} sx={{ height: 22, fontSize: 12, bgcolor: '#FDE7E2', color: '#A12A14' }} />}
                {line.isEco && <Chip size="small" label="ECO" sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: '#E2F4E7', color: '#126B2C' }} />}
              </Box>
            )}
            {line.choices.map((c) => (
              <Typography key={c} sx={{ fontSize: 12, color: '#4B5563', wordBreak: 'break-word' }}>{c}</Typography>
            ))}
            {showDate && <Typography sx={{ fontSize: 12, color: '#B45309' }}>Goes out {formatDayShort(line.goesOutOn)}</Typography>}
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

/**
 * "Not going out today": customers whose food is made on this date but goes out later. The food waits in the fridge; the packers
 * take it out on the day it goes out (that day's list marks it "Made <day> · from the fridge").
 */
export default function HeldList({ held, date, searching }: { held: HeldReport | undefined; date: string; searching?: boolean }) {
  const customers = held?.customers ?? [];
  return (
    <Box>
      <Typography sx={{ fontSize: 13, color: '#4B5563', mb: 1.25 }}>
        Food made on {formatDayShort(date)} that goes out on a later day. These customers are not on {formatDayShort(date)}&apos;s routes; their food waits in the fridge until it goes out.
      </Typography>
      {customers.length === 0 && (
        <Typography sx={{ color: '#9CA3AF', py: 3 }}>{searching ? 'No customer matches your search.' : `Everything made on ${formatDayShort(date)} goes out the same day.`}</Typography>
      )}
      {customers.map((c) => (
        <HeldCard key={`${c.customerName}-${c.orderIds.join('-')}`} customer={c} showDate={c.goesOutOn.length > 1} />
      ))}
    </Box>
  );
}
