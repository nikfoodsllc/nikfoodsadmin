'use client';

import { Box, Typography } from '@mui/material';
import { totalsLines, type OrderDetails } from '@/utils/createOrder';

const money = (n: number) => (n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`);
const dayText = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Colours of the little tags under an item: size amber, spice red, eco green (the same as in the emails). */
function tagColors(tag: string): { bg: string; color: string } {
  if (tag === 'Eco') return { bg: '#DCFCE7', color: '#166534' };
  if (/^(mild|normal|medium|spicy|hot|extra)/i.test(tag)) return { bg: '#FEE2E2', color: '#991B1B' };
  return { bg: '#FEF3C7', color: '#92400E' };
}

/** What was ordered, opened from a card in Recent orders: the items by day with their options, the totals and the address. */
export default function OrderDetailsPanel({ details }: { details: OrderDetails }) {
  const totals = totalsLines(details);
  return (
    <Box sx={{ mt: 1.25, p: { xs: 1.25, sm: 1.5 }, bgcolor: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 1.5, minWidth: 0 }}>
      {details.days.length === 0 && <Typography sx={{ fontSize: 13, color: '#6B7280' }}>No items are saved on this order.</Typography>}
      {details.days.map((day, dayIndex) => (
        <Box key={`${day.menuDay}-${dayIndex}`} sx={{ mb: 1.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, borderBottom: '1px solid #E5E7EB', pb: 0.4, mb: 0.5 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#B45309' }}>
              {dayText(day.menuDay)}
              {day.deliveryDay && day.deliveryDay !== day.menuDay && (
                <Typography component="span" sx={{ fontWeight: 600, fontSize: 12, color: '#6B7280' }}> · delivered {dayText(day.deliveryDay)}</Typography>
              )}
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: '#374151', flexShrink: 0 }}>{money(day.dayTotal)}</Typography>
          </Box>
          {day.items.map((item, itemIndex) => (
            <Box key={`${item.name}-${itemIndex}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, py: 0.5 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#111827', wordBreak: 'break-word' }}>
                  <Typography component="span" sx={{ fontWeight: 800 }}>{item.quantity} × </Typography>
                  {item.name}
                </Typography>
                {item.tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                    {item.tags.map((tag) => (
                      <Box key={tag} component="span" sx={{ px: 0.9, py: 0.1, borderRadius: 999, fontSize: 11.5, fontWeight: 600, bgcolor: tagColors(tag).bg, color: tagColors(tag).color }}>
                        {tag === 'Eco' ? '♻️ Eco' : /^(mild|normal|medium|spicy|hot|extra)/i.test(tag) ? `🌶️ ${tag}` : tag}
                      </Box>
                    ))}
                  </Box>
                )}
                {item.choices.map((choice) => {
                  const i = choice.indexOf(':');
                  return (
                    <Typography key={choice} sx={{ fontSize: 12.5, color: '#374151', wordBreak: 'break-word', mt: 0.15 }}>
                      <Typography component="span" sx={{ fontSize: 12.5, color: '#6B7280' }}>{choice.slice(0, i + 1)} </Typography>
                      <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700 }}>{choice.slice(i + 1).trim()}</Typography>
                    </Typography>
                  );
                })}
                {item.notes && <Typography sx={{ fontSize: 12.5, color: '#6B7280', fontStyle: 'italic', mt: 0.15, wordBreak: 'break-word' }}>Note: {item.notes}</Typography>}
              </Box>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#111827', flexShrink: 0 }}>{money(item.lineTotal)}</Typography>
            </Box>
          ))}
        </Box>
      ))}
      <Box sx={{ borderTop: '1px solid #E5E7EB', pt: 0.75 }}>
        {totals.map((line) => (
          <Box key={line.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.1 }}>
            <Typography sx={{ fontSize: line.strong ? 14 : 13, fontWeight: line.strong ? 800 : 500, color: line.strong ? '#111827' : '#4B5563' }}>{line.label}</Typography>
            <Typography sx={{ fontSize: line.strong ? 14 : 13, fontWeight: line.strong ? 800 : 600, color: line.strong ? '#111827' : '#374151' }}>{money(line.amount)}</Typography>
          </Box>
        ))}
      </Box>
      {details.address.line && (
        <Box sx={{ mt: 1, pt: 0.75, borderTop: '1px dashed #E5E7EB' }}>
          <Typography sx={{ fontSize: 12.5, color: '#374151', wordBreak: 'break-word' }}>
            <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700 }}>Deliver to: </Typography>
            {details.address.line}
          </Typography>
          {details.address.gateCode && <Typography sx={{ fontSize: 12.5, color: '#6B7280' }}>Gate code: {details.address.gateCode}</Typography>}
          {details.address.instruction && <Typography sx={{ fontSize: 12.5, color: '#6B7280', wordBreak: 'break-word' }}>Instruction: {details.address.instruction}</Typography>}
        </Box>
      )}
    </Box>
  );
}
