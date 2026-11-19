import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { rateHistory, type DriverRates } from '@/utils/businessDashboard';

/**
 * Driver pay rates, shared by every admin: one document in `dashboardSettings` ({ key: 'driverPay', history: [...] }).
 * Nothing is stored until an admin changes the rates; before that the default rates apply.
 */
const COLLECTION = 'dashboardSettings';
const KEY = 'driverPay';

interface DriverPayDoc {
  key: string;
  history: DriverRates[];
  updatedAt?: Date;
}

export async function loadDriverRates(): Promise<DriverRates[]> {
  const conn = await db.getDb();
  const doc = await conn.collection<DriverPayDoc>(COLLECTION).findOne({ key: KEY });
  return rateHistory(doc?.history);
}

export async function saveDriverRates(history: DriverRates[]): Promise<void> {
  const conn = await db.getDb();
  await conn.collection<DriverPayDoc>(COLLECTION).updateOne(
    { key: KEY },
    { $set: { history: history.filter((r) => r.setAt), updatedAt: new Date() } },
    { upsert: true },
  );
}

/** The admin's name for "changed by" (falls back to their email, then 'An admin') */
export async function adminName(userId: string): Promise<string> {
  try {
    if (!ObjectId.isValid(userId)) return 'An admin';
    const conn = await db.getDb();
    const user = await conn.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { fullName: 1, name: 1, email: 1 } });
    const name = (user?.fullName || user?.name || user?.email || '').toString().trim();
    return name || 'An admin';
  } catch {
    return 'An admin';
  }
}
