/** Which customer-site route an admin Notifications request goes to (only these; anything else is "not found"). */
export function notificationsTarget(slug: string[], method: string): string | null {
  const [first, second] = slug;
  const id = (v?: string) => (v && /^[A-Za-z0-9]{8,40}$/.test(v) ? encodeURIComponent(v) : null);
  if (slug.length === 1) {
    if (first === 'summary' && method === 'GET') return '/api/admin/push/summary';
    if (first === 'app-users' && method === 'GET') return '/api/admin/push/app-users';
    if (first === 'templates' && (method === 'GET' || method === 'POST')) return '/api/admin/push/templates';
    if (first === 'send-menu' && method === 'POST') return '/api/admin/push/send-menu';
    if (first === 'app-update' && (method === 'GET' || method === 'PUT' || method === 'POST')) return '/api/admin/push/app-update';
    if (first === 'test' && method === 'POST') return '/api/admin/push/test';
    return null;
  }
  if (slug.length === 2 && first === 'templates' && (method === 'PUT' || method === 'DELETE')) {
    const safe = id(second);
    return safe ? `/api/admin/push/templates/${safe}` : null;
  }
  return null;
}
