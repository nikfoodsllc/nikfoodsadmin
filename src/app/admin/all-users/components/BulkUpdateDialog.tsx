'use client';

import { useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Radio, RadioGroup, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { ACTION_HELP, ACTION_LABEL, BULK_ACTIONS, BULK_CREDIT_MAX_EACH, chunkIds, summarize, summaryText, type BulkAction, type BulkResultRow } from '@/utils/bulkUsers';

interface Props {
  open: boolean;
  token: string | null;
  /** the customers picked (account ids) */
  ids: string[];
  onClose: () => void;
  /** called after at least one customer was changed, so the list reloads */
  onChanged: () => void;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const newBatchId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** Bulk update for the customers ticked in All Users: choose what to change, confirm, watch it run, read the result. */
export default function BulkUpdateDialog({ open, token, ids, onClose, onChanged }: Props) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [action, setAction] = useState<BulkAction | ''>('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [sure, setSure] = useState(false);
  const [step, setStep] = useState<'choose' | 'confirm' | 'running' | 'done'>('choose');
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<BulkResultRow[]>([]);
  const [error, setError] = useState('');
  // one id for the whole update: a request sent twice never gives credit twice
  const [batchId, setBatchId] = useState(newBatchId);

  const amountNum = Math.round(Number(amount) * 100) / 100;
  const amountOk = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= BULK_CREDIT_MAX_EACH;
  const settingsOk = action !== '' && (action !== 'credit_add' || (amountOk && reason.trim().length > 0));
  const needsSure = action === 'credit_add' || action === 'deactivate' || ids.length > 25;
  const summary = useMemo(() => summarize(rows), [rows]);

  const close = () => {
    if (step === 'running') return;
    if (rows.length > 0) onChanged();
    setAction('');
    setAmount('');
    setReason('');
    setSure(false);
    setStep('choose');
    setProgress(0);
    setRows([]);
    setError('');
    setBatchId(newBatchId());
    onClose();
  };

  const run = async () => {
    if (action === '' || !token) return;
    setError('');
    setStep('running');
    setRows([]);
    setProgress(0);
    const all: BulkResultRow[] = [];
    const chunks = chunkIds(ids, action);
    for (let i = 0; i < chunks.length; i += 1) {
      try {
        const response = await fetch('/api/admin/users/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action, ids: chunks[i], ...(action === 'credit_add' ? { amount: amountNum, reason: reason.trim(), batchId } : {}) }),
        });
        const json = (await response.json().catch(() => ({}))) as { data?: { rows: BulkResultRow[] }; error?: string };
        if (!response.ok || !json.data) {
          setError(`${json.error ?? 'The update stopped.'} ${all.length > 0 ? `${all.length} customers were already handled; the rest were not changed.` : 'Nothing was changed.'}`);
          break;
        }
        all.push(...json.data.rows);
        setRows([...all]);
        setProgress(Math.round(((i + 1) / chunks.length) * 100));
      } catch {
        setError(`The connection dropped. ${all.length > 0 ? `${all.length} customers were already handled; the rest were not changed.` : 'Nothing was changed.'}`);
        break;
      }
    }
    setStep('done');
  };

  const total = ids.length;
  const plural = total === 1 ? 'customer' : 'customers';

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" fullScreen={phone}>
      <DialogTitle sx={{ fontWeight: 800 }}>
        Update {total} {plural}
      </DialogTitle>
      <DialogContent dividers>
        {step === 'choose' && (
          <>
            <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 1 }}>Choose what to change for everyone selected. Admin accounts are never changed.</Typography>
            <RadioGroup value={action} onChange={(e) => { setAction(e.target.value as BulkAction); setSure(false); }}>
              {BULK_ACTIONS.map((a) => (
                <Box key={a} sx={{ mb: 0.5 }}>
                  <FormControlLabel value={a} control={<Radio size="small" />} label={<Typography sx={{ fontWeight: 700, fontSize: 14 }}>{ACTION_LABEL[a]}</Typography>} />
                  {action === a && <Typography sx={{ fontSize: 12.5, color: '#6B7280', ml: 4, mb: 0.75 }}>{ACTION_HELP[a]}</Typography>}
                </Box>
              ))}
            </RadioGroup>
            {action === 'credit_add' && (
              <Box sx={{ display: 'grid', gap: 1.5, mt: 1 }}>
                <TextField label="Credit for each customer ($)" size="small" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} inputProps={{ min: 0, max: BULK_CREDIT_MAX_EACH, step: '0.01', inputMode: 'decimal' }} error={amount !== '' && !amountOk} helperText={amount !== '' && !amountOk ? `Between $0.01 and $${BULK_CREDIT_MAX_EACH}` : `Up to $${BULK_CREDIT_MAX_EACH} each`} sx={{ maxWidth: 260 }} />
                <TextField label="Reason (required)" size="small" fullWidth value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} helperText={`${reason.length}/200`} />
              </Box>
            )}
          </>
        )}

        {step === 'confirm' && action !== '' && (
          <>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>
              {ACTION_LABEL[action]} for {total} {plural}?
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: '#54442F', mb: 1 }}>{ACTION_HELP[action]}</Typography>
            {action === 'credit_add' && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {money(amountNum)} each, <b>{money(amountNum * total)}</b> in total. Reason: “{reason.trim()}”.
              </Alert>
            )}
            {action === 'deactivate' && <Alert severity="error" sx={{ mb: 1 }}>These accounts will no longer appear in All Users and cannot be reactivated from here.</Alert>}
            {needsSure && <FormControlLabel control={<Checkbox checked={sure} onChange={(e) => setSure(e.target.checked)} />} label={`Yes, update ${total} ${plural}`} />}
          </>
        )}

        {step === 'running' && (
          <Box sx={{ py: 1 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Updating… please keep this window open.</Typography>
            <LinearProgress variant="determinate" value={progress} />
            <Typography sx={{ fontSize: 13, color: '#6B7280', mt: 1 }}>{rows.length} of {total} done</Typography>
          </Box>
        )}

        {step === 'done' && action !== '' && (
          <Box>
            {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
            <Alert severity={summary.failed > 0 || error ? 'warning' : 'success'} sx={{ mb: 1 }}>{summaryText(action, summary)}</Alert>
            {Object.keys(summary.reasons).length > 0 && (
              <Box sx={{ fontSize: 13, color: '#54442F' }}>
                {Object.entries(summary.reasons).map(([why, n]) => (
                  <Typography key={why} sx={{ fontSize: 13 }}>
                    {n} × {why}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        {step === 'choose' && (
          <>
            <Button onClick={close} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" disabled={!settingsOk} onClick={() => { setSure(false); setStep('confirm'); }} sx={{ textTransform: 'none', fontWeight: 700 }}>Continue</Button>
          </>
        )}
        {step === 'confirm' && (
          <>
            <Button onClick={() => setStep('choose')} sx={{ textTransform: 'none' }}>Back</Button>
            <Button variant="contained" color={action === 'deactivate' ? 'error' : 'primary'} disabled={needsSure && !sure} onClick={run} sx={{ textTransform: 'none', fontWeight: 700 }}>Update {total} {plural}</Button>
          </>
        )}
        {step === 'running' && <CircularProgress size={22} />}
        {step === 'done' && <Button variant="contained" onClick={close} sx={{ textTransform: 'none', fontWeight: 700 }}>Done</Button>}
      </DialogActions>
    </Dialog>
  );
}
