'use client';

import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, IconButton, Link, TextField, Typography } from '@mui/material';
import { IconTrash } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { isUsableAmount, MAX_RECIPE_LINES, type RecipeLine } from '@/utils/recipeItems';

interface RecipeOption {
  id: string;
  name: string;
}

interface RecipeLinesFieldProps {
  value?: RecipeLine[] | null;
  onChange: (lines: RecipeLine[]) => void;
  /** The sizes of the item (a sized item); leave out for an item with one size */
  sizes?: string[];
  disabled?: boolean;
  error?: string;
}

/**
 * "Goes with": the hidden recipe items (raita, chutney) that come with this item, and how much. A sized item has an amount per size
 * (Biryani 16Oz gets 4Oz raita, 12Oz gets 3Oz); an item without sizes has one amount. Customers never see them: the kitchen counts do.
 */
export default function RecipeLinesField({ value, onChange, sizes, disabled, error }: RecipeLinesFieldProps) {
  const { token } = useAuth();
  const [options, setOptions] = useState<RecipeOption[] | null>(null);
  const lines = useMemo(() => value ?? [], [value]);
  const sized = Array.isArray(sizes);
  const sizeLabels = useMemo(() => (sizes ?? []).map((s) => s.trim()).filter(Boolean), [sizes]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch('/api/admin/recipe-items', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && Array.isArray(json?.data)) setOptions((json.data as RecipeOption[]).map((o) => ({ id: o.id, name: o.name })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const nameOf = (id: string) => options?.find((o) => o.id === id)?.name ?? 'Recipe item';
  const available = (options ?? []).filter((o) => !lines.some((l) => l.recipeItemId === o.id));
  const update = (id: string, patch: (l: RecipeLine) => RecipeLine) => onChange(lines.map((l) => (l.recipeItemId === id ? patch(l) : l)));

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Goes with (recipe items)</Typography>
      <Typography sx={{ fontSize: 12.5, color: '#6B7280', mb: 1 }}>
        Extras that come with this item, like raita with biryani. Customers never see them; the Kitchen Dashboard, Kitchen Report and Packing Report count them.
        {sized ? ' Give the amount for each size, and leave a size empty if nothing goes with it.' : ' Amounts look like 4Oz, 0.5Lb, 100g or 2Pc.'}
      </Typography>

      {lines.map((line) => (
        <Box key={line.recipeItemId} sx={{ border: '1px solid #E5E7EB', borderRadius: 1.5, p: 1.25, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: sized ? 1 : 0.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{nameOf(line.recipeItemId)}</Typography>
            <IconButton size="small" aria-label={`Remove ${nameOf(line.recipeItemId)}`} disabled={disabled} onClick={() => onChange(lines.filter((l) => l.recipeItemId !== line.recipeItemId))} sx={{ color: '#B91C1C' }}>
              <IconTrash size={18} />
            </IconButton>
          </Box>
          {sized ? (
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' } }}>
              {sizeLabels.length === 0 && <Typography sx={{ fontSize: 12.5, color: '#6B7280', gridColumn: '1 / -1' }}>Add the sizes of this item above first.</Typography>}
              {sizeLabels.map((size) => {
                const current = line.bySize?.[size] ?? '';
                return (
                  <TextField
                    key={size}
                    size="small"
                    label={`With ${size}`}
                    value={current}
                    disabled={disabled}
                    error={current.trim() !== '' && !isUsableAmount(current)}
                    placeholder="4Oz"
                    inputProps={{ autoCapitalize: 'none', spellCheck: false, maxLength: 20 }}
                    onChange={(e) =>
                      update(line.recipeItemId, (l) => {
                        const next = { ...(l.bySize ?? {}) };
                        if (e.target.value === '') delete next[size];
                        else next[size] = e.target.value;
                        return { ...l, bySize: next };
                      })
                    }
                  />
                );
              })}
            </Box>
          ) : (
            <TextField
              size="small"
              label="Amount per order"
              value={line.amount ?? ''}
              disabled={disabled}
              error={(line.amount ?? '').trim() !== '' && !isUsableAmount(line.amount)}
              placeholder="4Oz"
              inputProps={{ autoCapitalize: 'none', spellCheck: false, maxLength: 20 }}
              onChange={(e) => update(line.recipeItemId, (l) => ({ ...l, amount: e.target.value }))}
              sx={{ width: { xs: '100%', sm: 220 } }}
            />
          )}
        </Box>
      ))}

      {lines.length < MAX_RECIPE_LINES && (
        <Autocomplete
          size="small"
          options={available}
          value={null}
          blurOnSelect
          clearOnBlur
          disabled={disabled || options === null}
          getOptionLabel={(o) => o.name}
          noOptionsText={options && options.length === 0 ? 'No recipe items yet. Create one under Food Catalog > Recipe Items.' : 'All recipe items are already added.'}
          onChange={(_, o) => o && onChange([...lines, sized ? { recipeItemId: o.id, bySize: {} } : { recipeItemId: o.id, amount: '' }])}
          renderInput={(params) => <TextField {...params} label="Add a recipe item" placeholder="Raita, chutney…" />}
          sx={{ maxWidth: 420 }}
        />
      )}
      <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.75 }}>
        New one? <Link href="/admin/recipe-items" target="_blank" rel="noopener" underline="always">Create a recipe item</Link> first, then pick it here.
      </Typography>
      {error && <Typography sx={{ fontSize: 12.5, color: '#B91C1C', mt: 0.5 }} role="alert">{error}</Typography>}
    </Box>
  );
}
