import { redirect } from 'next/navigation';

/** The landing page of the admin is the Kitchen Dashboard. The old stats dashboard lives at /admin/dashboard. */
export default function AdminPage() {
  redirect('/admin/kitchen-dashboard');
}
