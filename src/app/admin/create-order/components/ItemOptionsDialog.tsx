'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Radio,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { IconMinus, IconPlus } from '@tabler/icons-react';
import {
  estimateUnitPrice,
  lineTags,
  pickProblem,
  type CartLine,
  type MenuComboSection,
  type MenuItem,
} from '@/utils/createOrder';

const money = (n: number) => `$${n.toFixed(2)}`;

function defaultsFor(item: MenuItem) {
  const combo: Record<string, string[]> = {};
  for (const section of item.sections ?? []) {
    const single = section.maxSelection <= 1;
    const wanted = section.isRequired ? Math.max(section.minSelection || 0, 1) : section.minSelection || 0;
    if (wanted > 0) {
      const preferred = section.selectedItems.filter((o) => o.isDefault).map((o) => o._id);
      const ids = (preferred.length > 0 ? preferred : section.selectedItems.map((o) => o._id)).slice(0, single ? 1 : wanted);
      if (ids.length > 0) combo[section._id] = ids;
    }
  }
  return {
    portion: item.portions?.[0],
    spice: item.hasSpiceLevel && item.spiceLevel?.length ? (item.spiceLevel.includes('Normal') ? 'Normal' : item.spiceLevel[0]) : undefined,
    combo,
  };
}

function ComboSection({ section, chosen, onChange }: { section: MenuComboSection; chosen: string[]; onChange: (ids: string[]) => void }) {
  const single = section.maxSelection <= 1;
  const toggle = (id: string) => {
    if (single) return onChange([id]);
    if (chosen.includes(id)) return onChange(chosen.filter((c) => c !== id));
    if (section.maxSelection && chosen.length >= section.maxSelection) return;
    onChange([...chosen, id]);
  };
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
        {section.title}
        <Typography component="span" sx={{ fontWeight: 400, fontSize: 12, color: '#6B7280', ml: 0.75 }}>
          {section.isRequired ? 'required' : 'optional'}
          {section.maxSelection > 1 ? ` · up to ${section.maxSelection}` : ''}
        </Typography>
      </Typography>
      {section.selectedItems.map((option) => {
        const on = chosen.includes(option._id);
        const label = `${option.item?.name ?? 'Item'}${option.portion ? ` (${option.portion})` : ''}${option.price > 0 ? ` +${money(option.price)}` : ''}`;
        return (
          <FormControlLabel
            key={option._id}
            sx={{ display: 'flex', mr: 0, '& .MuiFormControlLabel-label': { fontSize: 14 } }}
            control={single ? <Radio checked={on} onChange={() => toggle(option._id)} size="small" color="warning" /> : <Checkbox checked={on} onChange={() => toggle(option._id)} size="small" color="warning" />}
            label={label}
          />
        );
      })}
    </Box>
  );
}

/** Choose size, spice level, eco container, combo parts, a note and the quantity of one item for one day. */
export default function ItemOptionsDialog({
  open,
  item,
  date,
  dayLabel,
  onClose,
  onAdd,
  editing,
}: {
  open: boolean;
  item: MenuItem | null;
  date: string;
  dayLabel: string;
  onClose: () => void;
  onAdd: (line: Omit<CartLine, 'key'>) => void;
  /** Changing a line that is already in the order: its current pick is shown, and the button saves instead of adds */
  editing?: CartLine | null;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [portion, setPortion] = useState<string | undefined>();
  const [spice, setSpice] = useState<string | undefined>();
  const [eco, setEco] = useState(false);
  const [combo, setCombo] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!open || !item) return;
    if (editing) {
      setPortion(editing.selectedPortion);
      setSpice(editing.selectedSpiceLevel);
      setEco(Boolean(editing.isEcoFriendlyContainer));
      setCombo(editing.comboSelections ?? {});
      setNotes(editing.notes ?? '');
      setQuantity(editing.quantity);
      return;
    }
    const d = defaultsFor(item);
    setPortion(d.portion);
    setSpice(d.spice);
    setEco(false);
    setCombo(d.combo);
    setNotes('');
    setQuantity(1);
  }, [open, item, editing]);

  const pick = useMemo(
    () => ({ selectedPortion: portion, selectedSpiceLevel: spice, isEcoFriendlyContainer: eco || undefined, comboSelections: combo }),
    [portion, spice, eco, combo]
  );
  if (!item) return null;

  const problem = pickProblem(item, pick);
  const unit = estimateUnitPrice(item, pick);

  const add = () => {
    if (problem) return;
    const comboSelections = Object.fromEntries(Object.entries(combo).filter(([, ids]) => ids.length > 0));
    onAdd({
      date,
      foodItemId: item._id,
      quantity,
      selectedPortion: portion,
      selectedSpiceLevel: spice,
      isEcoFriendlyContainer: eco || undefined,
      comboSelections: Object.keys(comboSelections).length > 0 ? comboSelections : undefined,
      notes: notes.trim() || undefined,
      name: item.name,
      unitPrice: unit,
      tags: lineTags(item, { ...pick, comboSelections }),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle sx={{ pb: 0.5 }}>
        {item.name}
        <Typography sx={{ fontSize: 13, color: '#6B7280', fontWeight: 400 }}>For {dayLabel}</Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
        {(item.portions?.length ?? 0) > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.75 }}>Size</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {item.portions!.map((p, i) => (
                <Chip
                  key={p}
                  label={`${p} · ${money(Number(item.portionPrices?.[i] ?? item.price))}`}
                  color={portion === p ? 'warning' : 'default'}
                  variant={portion === p ? 'filled' : 'outlined'}
                  onClick={() => setPortion(p)}
                />
              ))}
            </Box>
          </Box>
        )}
        {item.hasSpiceLevel && (item.spiceLevel?.length ?? 0) > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.75 }}>Spice level</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {item.spiceLevel!.map((s) => (
                <Chip key={s} label={s} color={spice === s ? 'warning' : 'default'} variant={spice === s ? 'filled' : 'outlined'} onClick={() => setSpice(s)} />
              ))}
            </Box>
          </Box>
        )}
        {item.hasCombo && (item.sections ?? []).map((section) => (
          <ComboSection key={section._id} section={section} chosen={combo[section._id] ?? []} onChange={(ids) => setCombo((c) => ({ ...c, [section._id]: ids }))} />
        ))}
        {item.isEcoFriendlyContainer && (
          <FormControlLabel
            sx={{ display: 'flex', mb: 1 }}
            control={<Checkbox color="warning" checked={eco} onChange={(e) => setEco(e.target.checked)} />}
            label={`Eco container${item.ecoContainerCharge ? ` (+${money(Number(item.ecoContainerCharge))})` : ''}`}
          />
        )}
        <TextField label="Note for the kitchen (optional)" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 300))} fullWidth size="small" multiline maxRows={3} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Quantity</Typography>
          <IconButton aria-label="One less" size="small" onClick={() => setQuantity((q) => Math.max(1, q - 1))}><IconMinus size={18} /></IconButton>
          <Typography sx={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{quantity}</Typography>
          <IconButton aria-label="One more" size="small" onClick={() => setQuantity((q) => Math.min(99, q + 1))}><IconPlus size={18} /></IconButton>
        </Box>
        {problem && <Alert severity="warning" sx={{ mt: 2 }}>{problem}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={add} disabled={Boolean(problem)} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {editing ? 'Save changes' : 'Add'} · {money(unit * quantity)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
