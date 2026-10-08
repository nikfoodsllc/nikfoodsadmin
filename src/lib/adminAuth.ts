import { NextRequest } from 'next/server';
import { jwtHandler } from '@/lib/jwt';

/** The signed-in admin of a request (role admin in the token), or an error message for a 401. */
export function verifyAdminRequest(request: NextRequest): { ok: true; userId: string } | { ok: false; error: string } {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return { ok: false, error: 'Missing or invalid authorization header' };
  const result = jwtHandler.verifyToken(header.substring(7));
  if (!result.success || !result.payload) return { ok: false, error: result.error || 'Invalid token' };
  if (result.payload.role !== 'admin') return { ok: false, error: 'Unauthorized: Admin access required' };
  return { ok: true, userId: String(result.payload.userId) };
}
