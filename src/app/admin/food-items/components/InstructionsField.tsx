'use client';

import { allowsInstructions } from '@/utils/itemInstructions';
import ToggleRow from './ToggleRow';

/** Special instructions switch for the edit dialogs. On gives customers a box to write instructions for this item. */
export default function InstructionsField({ value, onChange, disabled }: { value?: boolean | null; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <ToggleRow label="Special instructions" caption="Customers can write a note for the kitchen." checked={allowsInstructions(value)} onChange={onChange} disabled={disabled} />;
}
