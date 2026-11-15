'use client';

import { useRouter } from 'next/navigation';
import CategoryPickerList from './components/CategoryPickerList';

/** Menu Builder: pick a category, then choose which items are on it (and on which days for a day-wise category). */
export default function MenuBuilderPage() {
  const router = useRouter();
  return (
    <CategoryPickerList
      title="Menu Builder"
      description="Choose a category to decide which items are on its menu (for a day-wise category, on which days)."
      actionLabel="Open"
      onPick={(c) => router.push(`/admin/menu-builder/${String(c._id)}`)}
    />
  );
}
