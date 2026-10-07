'use client';

import { useEffect, useRef, useState } from 'react';
import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material';
import { IconMapPin } from '@tabler/icons-react';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text: string; secondary_text?: string };
}

export interface FoundAddress {
  street: string;
  city: string;
  pincode: string;
}

/**
 * The same address search as the customer site's "Add address": type a few letters, pick a suggestion and the street,
 * city and zip are filled in. It asks the customer site's Google lookup through the admin's own routes (the admin's login is
 * attached there). The fields below stay editable, so an address the search does not know can still be typed by hand.
 */
export default function AddressLookup({ token, onPick }: { token: string; onPick: (found: FoundAddress) => void }) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (input.trim().length < 3) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const ticket = ++latest.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/create-order/places?input=${encodeURIComponent(input.trim())}`, { headers });
        const body = await res.json().catch(() => ({}));
        if (ticket !== latest.current) return; // a newer search is running
        setOptions(res.ok && body?.data?.data?.predictions ? body.data.data.predictions : []);
      } catch {
        if (ticket === latest.current) setOptions([]);
      } finally {
        if (ticket === latest.current) setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, token]);

  const choose = async (picked: Prediction | null) => {
    if (!picked) return;
    setLoading(true);
    setNote('');
    try {
      const res = await fetch(`/api/admin/create-order/places/details?place_id=${encodeURIComponent(picked.place_id)}`, { headers });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.data) {
        onPick({ street: body.data.street || '', city: body.data.city || body.data.town || '', pincode: String(body.data.pincode || '').slice(0, 5) });
        setInput('');
        setOptions([]);
      } else {
        setNote('Could not load that address. Type it in the boxes below.');
      }
    } catch {
      setNote('Could not load that address. Type it in the boxes below.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Autocomplete
      options={options}
      filterOptions={(all) => all}
      getOptionLabel={(option) => option.description}
      inputValue={input}
      onInputChange={(_e, value, reason) => {
        if (reason !== 'reset') setInput(value);
      }}
      value={null}
      onChange={(_e, value) => void choose(value)}
      loading={loading}
      noOptionsText={input.trim().length < 3 ? 'Type at least 3 characters' : 'No addresses found. Type it in the boxes below.'}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label="Search for an address"
          placeholder="Start typing the street address…"
          helperText={note || 'Pick a suggestion to fill in the street, city and zip, or type them below.'}
          error={Boolean(note)}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: <IconMapPin size={18} style={{ marginLeft: 6, marginRight: -2 }} />,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ py: 1 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{option.structured_formatting?.main_text ?? option.description}</Typography>
              {option.structured_formatting?.secondary_text && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{option.structured_formatting.secondary_text}</Typography>
              )}
            </Box>
          </Box>
        );
      }}
      sx={{ mb: 1.5 }}
    />
  );
}
