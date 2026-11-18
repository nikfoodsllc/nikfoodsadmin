import { redirect } from 'next/navigation';

/** The landing page of the admin is Reporting > Dashboard (a packer is sent on to Orders by the layout). */
export default function AdminPage() {
  redirect('/admin/dashboard');
}
