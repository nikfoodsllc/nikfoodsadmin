'use client';

import { Box, TextField, Typography } from '@mui/material';
import { MAX_UNIT_QUANTITY, cleanUnitQuantity } from '@/utils/unitQuantity';

interface UnitQuantityFieldProps {
  value?: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

/**
 * Quantity per order, for flat items only (the dialog shows it when the item is in a flat category). An item sold as "2 Makki Roti"
 * is set to 2, so the Kitchen Dashboard and Kitchen Report count pieces (an order of 3 = 6). Customers never see it.
 */
export default function UnitQuantityField({ value, onChange, disabled }: UnitQuantityFieldProps) {
  const current = cleanUnitQuantity(value);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Quantity per order</Typography>
        <Typography sx={{ fontSize: 12.5, color: '#6B7280' }}>
          How many pieces one order makes, for example 2 for “2 Makki Roti”. The kitchen counts multiply by it. Customers do not see this.
        </Typography>
      </Box>
      <TextField
        type="number"
        size="small"
        value={current}
        disabled={disabled}
        onChange={(e) => {
          const next = cleanUnitQuantity(e.target.value === '' ? 1 : Number(e.target.value));
          onChange(next > 1 ? next : null);
        }}
        inputProps={{ min: 1, max: MAX_UNIT_QUANTITY, step: 1, inputMode: 'numeric', 'aria-label': 'Quantity per order' }}
        sx={{ width: 90, flexShrink: 0 }}
      />
    </Box>
  );
}
