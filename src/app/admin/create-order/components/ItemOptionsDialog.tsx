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
import { comboQuantityText } from '@/utils/comboQuantity';
import { comboNeedsOverallSpice, getSectionSpice, pruneSectionSpice, sectionOwnsSpice, withSectionSpice } from '@/utils/comboSpice';

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
  const spice = item.hasSpiceLevel && item.spiceLevel?.length ? (item.spiceLevel.includes('Normal') ? 'Normal' : item.spiceLevel[0]) : undefined;
  // a section with its own spice choice starts on the same default level
  if (spice) for (const section of item.sections ?? []) if (sectionOwnsSpice(section) && combo[section._id]?.length) combo[`spice:${section._id}`] = [spice];
  return {
    portion: item.portions?.[0],
    spice,
    combo,
  };
}

function ComboSection({ section, chosen, onChange, spiceLevels, spice, onSpice }: { section: MenuComboSection; chosen: string[]; onChange: (ids: string[]) => void; spiceLevels?: string[]; spice?: string | null; onSpice?: (level: string) => void }) {
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
        const label = `${option.item?.name ?? 'Item'}${option.portion ? ` (${option.portion})` : ''}${comboQuantityText(option.quantity)}${option.price > 0 ? ` +${money(option.price)}` : ''}`;
        return (
          <FormControlLabel
            key={option._id}
            sx={{ display: 'flex', mr: 0, '& .MuiFormControlLabel-label': { fontSize: 14 } }}
            control={single ? <Radio checked={on} onChange={() => toggle(option._id)} size="small" color="warning" /> : <Checkbox checked={on} onChange={() => toggle(option._id)} size="small" color="warning" />}
            label={label}
          />
        );
      })}
      {onSpice && spiceLevels && spiceLevels.length > 0 && sectionOwnsSpice(section) && chosen.length > 0 && (
        <Box sx={{ mt: 0.75 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 13, mb: 0.5 }}>Spice level for {section.title}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {spiceLevels.map((s) => (
              <Chip key={s} size="small" label={s} color={spice === s ? 'warning' : 'default'} variant={spice === s ? 'filled' : 'outlined'} onClick={() => onSpice(s)} />
            ))}
          </Box>
        </Box>
      )}
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
  // the day it is delivered ('' = the kitchen day)
  const [deliverOn, setDeliverOn] = useState('');
  // another price for one item, as typed ('' = the menu price)
  const [priceText, setPriceText] = useState('');

  useEffect(() => {
    if (!open || !item) return;
    if (editing) {
      setPortion(editing.selectedPortion);
      setSpice(editing.selectedSpiceLevel);
      setEco(Boolean(editing.isEcoFriendlyContainer));
      setCombo(editing.comboSelections ?? {});
      setNotes(editing.notes ?? '');
      setQuantity(editing.quantity);
      setDeliverOn(editing.deliverOn ?? '');
      setPriceText(editing.unitPriceEdited !== undefined ? String(editing.unitPriceEdited) : '');
      return;
    }
    const d = defaultsFor(item);
    setPortion(d.portion);
    setSpice(d.spice);
    setEco(false);
    setCombo(d.combo);
    setNotes('');
    setQuantity(1);
    setDeliverOn('');
    setPriceText('');
  }, [open, item, editing]);

  const pick = useMemo(
    () => ({ selectedPortion: portion, selectedSpiceLevel: spice, isEcoFriendlyContainer: eco || undefined, comboSelections: combo }),
    [portion, spice, eco, combo]
  );
  if (!item) return null;

  const problem = pickProblem(item, pick);
  // the menu price of one item for this pick, without the eco container (the eco charge is added on top of any typed price)
  const menuPrice = estimateUnitPrice(item, { ...pick, isEcoFriendlyContainer: false });
  const eco_ = eco ? Number(item.ecoContainerCharge) || 0 : 0;
  const typed = priceText.trim() === '' ? null : Number(priceText);
  const priceBad = typed !== null && (!Number.isFinite(typed) || typed < 0 || typed > 1000);
  const edited = typed !== null && !priceBad && Math.round(typed * 100) !== Math.round(menuPrice * 100) ? Math.round(typed * 100) / 100 : undefined;
  const unit = Math.round(((edited ?? menuPrice) + eco_) * 100) / 100;

  const deliverBad = deliverOn !== '' && deliverOn < date;
  const add = () => {
    if (problem || priceBad || deliverBad) return;
    const comboSelections = pruneSectionSpice(item.sections, Object.fromEntries(Object.entries(combo).filter(([, ids]) => ids.length > 0)));
    onAdd({
      date,
      ...(deliverOn && deliverOn > date ? { deliverOn } : {}),
      foodItemId: item._id,
      quantity,
      selectedPortion: portion,
      selectedSpiceLevel: comboNeedsOverallSpice(item) ? spice : undefined,
      isEcoFriendlyContainer: eco || undefined,
      comboSelections: Object.keys(comboSelections).length > 0 ? comboSelections : undefined,
      notes: notes.trim() || undefined,
      name: item.name,
      unitPrice: unit,
      ...(edited !== undefined ? { unitPriceEdited: edited } : {}),
      tags: lineTags(item, { ...pick, selectedSpiceLevel: comboNeedsOverallSpice(item) ? spice : undefined, comboSelections }),
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
        {item.hasSpiceLevel && (item.spiceLevel?.length ?? 0) > 0 && comboNeedsOverallSpice(item) && (
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
          <ComboSection
            key={section._id}
            section={section}
            chosen={combo[section._id] ?? []}
            onChange={(ids) => setCombo((c) => ({ ...c, [section._id]: ids }))}
            spiceLevels={item.hasSpiceLevel ? item.spiceLevel : undefined}
            spice={getSectionSpice(combo, section._id)}
            onSpice={(level) => setCombo((c) => withSectionSpice(c, section._id, level))}
          />
        ))}
        {item.isEcoFriendlyContainer && (
          <FormControlLabel
            sx={{ display: 'flex', mb: 1 }}
            control={<Checkbox color="warning" checked={eco} onChange={(e) => setEco(e.target.checked)} />}
            label={`Eco container${item.ecoContainerCharge ? ` (+${money(Number(item.ecoContainerCharge))})` : ''}`}
          />
        )}
        <TextField
          label="Deliver on"
          type="date"
          value={deliverOn || date}
          onChange={(e) => setDeliverOn(e.target.value)}
          size="small"
          fullWidth
          error={deliverBad}
          helperText={deliverBad ? 'Not before the kitchen day' : deliverOn && deliverOn > date ? `Cooked for ${dayLabel}, delivered ${new Date(`${deliverOn}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}` : `Kitchen day: ${dayLabel}`}
          slotProps={{ htmlInput: { min: date } }}
          sx={{ mb: 2 }}
        />
        <TextField label="Note for the kitchen (optional)" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 300))} fullWidth size="small" multiline maxRows={3} sx={{ mb: 2 }} />
        <TextField
          label="Price for one (optional)"
          value={priceText}
          onChange={(e) => setPriceText(e.target.value.replace(/[^0-9.]/g, '').slice(0, 7))}
          size="small"
          fullWidth
          placeholder={menuPrice.toFixed(2)}
          error={priceBad}
          helperText={priceBad ? 'Enter a price from $0 to $1000' : `Menu price ${money(menuPrice)}${item.isEcoFriendlyContainer && eco ? ' (eco container is added on top)' : ''}. Type another price to change it for this order.`}
          slotProps={{ input: { startAdornment: <Typography sx={{ mr: 0.5, color: '#6B7280' }}>$</Typography>, inputMode: 'decimal' } }}
          sx={{ mb: 2 }}
        />
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
        <Button variant="contained" onClick={add} disabled={Boolean(problem) || priceBad || deliverBad} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {editing ? 'Save changes' : 'Add'} · {money(unit * quantity)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
