import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { deleteHeatingInstruction, readHeatingInstructions, readHeatingInstructionsWithCounts, renameHeatingInstruction } from '@/lib/heatingInstructionsLibrary';

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { success: false, error: 'Missing or invalid authorization header' };
  const verificationResult = jwtHandler.verifyToken(authHeader.substring(7));
  if (!verificationResult.success || !verificationResult.payload) return { success: false, error: verificationResult.error || 'Invalid token' };
  if (verificationResult.payload.role !== 'admin') return { success: false, error: 'Unauthorized: Admin access required' };
  return { success: true };
}

async function bodyOf(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** GET /api/admin/heating-instructions: the instructions to pick from. With ?counts=1 each comes with the number of food items using it. */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
    const withCounts = new URL(request.url).searchParams.get('counts') === '1';
    return NextResponse.json({ data: withCounts ? await readHeatingInstructionsWithCounts() : await readHeatingInstructions() });
  } catch (error) {
    console.error('Error in GET /api/admin/heating-instructions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/admin/heating-instructions  { from, to }: renames an instruction in the list and on every food item that uses it. */
export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
    const body = await bodyOf(request);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const result = await renameHeatingInstruction(body.from, body.to);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: { updatedItems: result.updatedItems, merged: result.merged }, message: 'Instruction renamed' });
  } catch (error) {
    console.error('Error in PATCH /api/admin/heating-instructions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/admin/heating-instructions  { text }: takes an instruction out of the list and clears it from the food items that use it. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
    const body = await bodyOf(request);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const result = await deleteHeatingInstruction(body.text);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: { clearedItems: result.clearedItems }, message: 'Instruction deleted' });
  } catch (error) {
    console.error('Error in DELETE /api/admin/heating-instructions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
