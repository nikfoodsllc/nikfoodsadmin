import type { Db } from 'mongodb';

/**
 * Changes to a customer's email and text choices, shared by the customer details dialog and the bulk update in All Users,
 * so both do exactly the same thing.
 */

const cleanEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();
const tenDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-10);

/**
 * true = put the address on the unsubscribe list (no Communication emails; order emails are never affected);
 * false = take it off AND subscribe the customer again, so they show as Subscribed.
 */
export async function setEmailChoice(database: Db, args: { userId: string; email: string; optedOut: boolean; adminId: string }): Promise<void> {
  const email = cleanEmail(args.email);
  const optOuts = database.collection('emailOptOuts');
  if (args.optedOut) {
    await optOuts.createIndex({ email: 1 }, { unique: true });
    await optOuts.updateOne({ email }, { $setOnInsert: { email, createdAt: new Date(), source: 'admin', by: args.adminId } }, { upsert: true });
    return;
  }
  await optOuts.deleteOne({ email });
  // turning emails back on makes the customer subscribed again (the subscription may have been switched off by their own unsubscribe)
  const subs = database.collection('menu_subscriptions');
  const now = new Date();
  const existing = await subs.countDocuments({ $or: [{ email }, { userId: args.userId }] });
  if (existing > 0) {
    await subs.updateMany({ $or: [{ email }, { userId: args.userId }] }, { $set: { isActive: true, consentGiven: true, updatedAt: now }, $unset: { unsubscribedAt: '' } });
  } else {
    await subs.insertOne({ email, userId: args.userId, subscribedAt: now, consentGiven: true, isActive: true, source: 'admin', by: args.adminId, createdAt: now, updatedAt: now });
  }
}

/**
 * Stops marketing texts to a customer, the same way a STOP reply does (their public text agreement and their account's agreement).
 * Returns false when nothing was switched on to begin with. Turning texts ON is never done from here: only the customer can agree.
 */
export async function turnTextsOff(database: Db, user: { _id: unknown; phone?: unknown; smsConsent?: { optedIn?: boolean; phone?: string } }): Promise<boolean> {
  const now = new Date();
  const numbers = [...new Set([tenDigits(user.phone), tenDigits(user.smsConsent?.phone)].filter((n) => n.length === 10))];
  let changed = false;
  if (numbers.length) {
    const r = await database.collection('smsSubscribers').updateMany({ phone: { $in: numbers }, optedIn: true }, { $set: { optedIn: false, optedOutAt: now, updatedAt: now } });
    if (r.modifiedCount > 0) changed = true;
  }
  if (user.smsConsent?.optedIn) {
    await database.collection('users').updateOne({ _id: user._id as never }, { $set: { 'smsConsent.optedIn': false, 'smsConsent.optedOutAt': now, 'smsConsent.optedOutVia': 'admin', updatedAt: now } });
    changed = true;
  }
  return changed;
}
