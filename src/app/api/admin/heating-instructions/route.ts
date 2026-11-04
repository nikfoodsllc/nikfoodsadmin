import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { readHeatingInstructions } from '@/lib/heatingInstructionsLibrary';

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { success: false, error: 'Missing or invalid authorization header' };
  const verificationResult = jwtHandler.verifyToken(authHeader.substring(7));
  if (!verificationResult.success || !verificationResult.payload) return { success: false, error: verificationResult.error || 'Invalid token' };
  if (verificationResult.payload.role !== 'admin') return { success: false, error: 'Unauthorized: Admin access required' };
  return { success: true };
}

/** GET /api/admin/heating-instructions: the instructions to pick from on a food item (the starting list plus the ones typed before). */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
    return NextResponse.json({ data: await readHeatingInstructions() });
  } catch (error) {
    console.error('Error in GET /api/admin/heating-instructions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
