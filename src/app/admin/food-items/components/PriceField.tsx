'use client';

import { useEffect, useState } from 'react';
import { TextField, TextFieldProps } from '@mui/material';

type PriceFieldProps = Omit<TextFieldProps, 'type' | 'value' | 'onChange' | 'defaultValue'> & {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
};

const toText = (v: number | null | undefined) => (v ? String(v) : '');

/**
 * Money box for the edit dialogs. It is a plain text box (not type=number), so the mouse wheel and drag cannot change the
 * amount, and it keeps what is typed: clearing the box leaves it empty (not a stuck "0") and a leading 0 does not stay.
 * Only digits and one dot with up to 2 decimals are accepted. The parent gets a number (0 while the box is empty).
 */
export default function PriceField({ value, onValueChange, onBlur, slotProps, ...rest }: PriceFieldProps) {
  const [text, setText] = useState(toText(value));

  // follow the parent when it changes the value by itself (a template applied, another item opened)
  useEffect(() => {
    setText((current) => ((parseFloat(current) || 0) === (value || 0) ? current : toText(value)));
  }, [value]);

  return (
    <TextField
      {...rest}
      value={text}
      onChange={(e) => {
        const next = e.target.value.replace(/^0+(?=\d)/, ''); // 09 -> 9
        if (!/^\d*\.?\d{0,2}$/.test(next)) return;
        setText(next);
        onValueChange(parseFloat(next) || 0);
      }}
      onBlur={(e) => {
        setText(toText(parseFloat(text) || 0)); // "5." -> "5"
        onBlur?.(e);
      }}
      slotProps={{ ...slotProps, htmlInput: { inputMode: 'decimal', autoComplete: 'off', ...(slotProps?.htmlInput as object) } }}
    />
  );
}
