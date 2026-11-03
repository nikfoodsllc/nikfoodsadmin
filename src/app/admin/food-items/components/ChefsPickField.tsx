'use client';

import { isChefsPick } from '@/utils/chefsPick';
import ToggleRow from './ToggleRow';

/** Chef's Pick switch for the edit dialogs. On puts the item in the mobile app's Chef's Pick row. */
export default function ChefsPickField({ value, onChange, disabled }: { value?: boolean | null; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <ToggleRow label="Chef's Pick" caption="Shown in the app's Chef's Pick row." checked={isChefsPick(value)} onChange={onChange} disabled={disabled} />;
}
