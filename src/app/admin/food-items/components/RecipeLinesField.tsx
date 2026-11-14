'use client';

import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, IconButton, InputAdornment, Link, TextField, Typography } from '@mui/material';
import { IconTrash } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_RECIPE_UNIT, isUsableAmount, MAX_RECIPE_LINES, normalizeRecipeUnit, recipeUnitLabel, type RecipeLine, type RecipeUnit } from '@/utils/recipeItems';

interface RecipeOption {
  id: string;
  name: string;
  unit: RecipeUnit;
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
 * (Biryani 16Oz gets 4 of raita, 12Oz gets 3); an item without sizes has one amount. The amount is a number in the unit the recipe
 * item was created with (oz, lb, g, kg or pieces). Customers never see them: the kitchen counts do.
 */
export default function RecipeLinesField({ value, onChange, sizes, disabled, error }: RecipeLinesFieldProps) {
  const { token } = useAuth();
  const [options, setOptions] = useState<RecipeOption[] | null>(null);
  // what is typed in a box (so "0." can be typed on the way to "0.5"); the saved value is the number
  const [draft, setDraft] = useState<Record<string, string>>({});
  const lines = useMemo(() => value ?? [], [value]);
  const sized = Array.isArray(sizes);
  const sizeLabels = useMemo(() => (sizes ?? []).map((s) => s.trim()).filter(Boolean), [sizes]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch('/api/admin/recipe-items', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && Array.isArray(json?.data)) setOptions((json.data as RecipeOption[]).map((o) => ({ id: o.id, name: o.name, unit: normalizeRecipeUnit(o.unit) })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const optionOf = (id: string) => options?.find((o) => o.id === id);
  const nameOf = (id: string) => optionOf(id)?.name ?? 'Recipe item';
  const unitOf = (id: string): RecipeUnit => optionOf(id)?.unit ?? DEFAULT_RECIPE_UNIT;
  const available = (options ?? []).filter((o) => !lines.some((l) => l.recipeItemId === o.id));
  const update = (id: string, patch: (l: RecipeLine) => RecipeLine) => onChange(lines.map((l) => (l.recipeItemId === id ? patch(l) : l)));

  const shown = (key: string, saved: number | undefined) => (key in draft ? draft[key] : saved === undefined ? '' : String(saved));
  const typed = (key: string, text: string) => setDraft((d) => ({ ...d, [key]: text }));

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Goes with (recipe items)</Typography>
      <Typography sx={{ fontSize: 12.5, color: '#6B7280', mb: 1 }}>
        Extras that come with this item, like raita with biryani. Customers never see them; the Kitchen Dashboard, Kitchen Report and Packing Report count them.
        {sized ? ' Give the amount for each size, and leave a size empty if nothing goes with it.' : ' Give the amount that goes with one order.'}
      </Typography>

      {lines.map((line) => {
        const unit = recipeUnitLabel(unitOf(line.recipeItemId)).toLowerCase();
        const adornment = <InputAdornment position="end">{unit}</InputAdornment>;
        return (
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
                  const key = `${line.recipeItemId}|${size}`;
                  const text = shown(key, line.bySize?.[size]);
                  return (
                    <TextField
                      key={size}
                      size="small"
                      type="number"
                      label={`With ${size}`}
                      value={text}
                      disabled={disabled}
                      error={text.trim() !== '' && !isUsableAmount(text)}
                      inputProps={{ min: 0, step: 'any', inputMode: 'decimal' }}
                      InputProps={{ endAdornment: adornment }}
                      onChange={(e) => {
                        typed(key, e.target.value);
                        update(line.recipeItemId, (l) => {
                          const next = { ...(l.bySize ?? {}) };
                          const n = Number(e.target.value);
                          if (e.target.value.trim() === '' || !Number.isFinite(n)) delete next[size];
                          else next[size] = n;
                          return { ...l, bySize: next };
                        });
                      }}
                    />
                  );
                })}
              </Box>
            ) : (
              (() => {
                const key = `${line.recipeItemId}|one`;
                const text = shown(key, line.amount);
                return (
                  <TextField
                    size="small"
                    type="number"
                    label="Amount per order"
                    value={text}
                    disabled={disabled}
                    error={text.trim() !== '' && !isUsableAmount(text)}
                    inputProps={{ min: 0, step: 'any', inputMode: 'decimal' }}
                    InputProps={{ endAdornment: adornment }}
                    onChange={(e) => {
                      typed(key, e.target.value);
                      const n = Number(e.target.value);
                      update(line.recipeItemId, (l) => {
                        const { amount: _drop, ...rest } = l;
                        void _drop;
                        return e.target.value.trim() === '' || !Number.isFinite(n) ? rest : { ...rest, amount: n };
                      });
                    }}
                    sx={{ width: { xs: '100%', sm: 220 } }}
                  />
                );
              })()
            )}
          </Box>
        );
      })}

      {lines.length < MAX_RECIPE_LINES && (
        <Autocomplete
          size="small"
          options={available}
          value={null}
          blurOnSelect
          clearOnBlur
          disabled={disabled || options === null}
          getOptionLabel={(o) => `${o.name} (${recipeUnitLabel(o.unit).toLowerCase()})`}
          noOptionsText={options && options.length === 0 ? 'No recipe items yet. Create one under Food Catalog > Recipe Items.' : 'All recipe items are already added.'}
          onChange={(_, o) => o && onChange([...lines, sized ? { recipeItemId: o.id, bySize: {} } : { recipeItemId: o.id }])}
          renderInput={(params) => <TextField {...params} label="Add a recipe item" placeholder="Raita, chutney…" />}
          sx={{ maxWidth: 420 }}
        />
      )}
      <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.75 }}>
        New one? <Link href="/admin/recipe-items" target="_blank" rel="noopener" underline="always">Create a recipe item</Link> first (you choose its unit there), then pick it here.
      </Typography>
      {error && <Typography sx={{ fontSize: 12.5, color: '#B91C1C', mt: 0.5 }} role="alert">{error}</Typography>}
    </Box>
  );
}
