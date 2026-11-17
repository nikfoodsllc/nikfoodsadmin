import type { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { orderDraftSummary, orderDraftTitle, parseOrderDraft, type OrderDraftContent } from '@/utils/createOrderDraft';

export { adminId, whoIs } from '@/lib/server/communicationDrafts';

/** Drafts of Create Order, shared by every admin (one collection). */
export const ORDER_DRAFTS = 'createOrderDrafts';

export interface OrderDraftDoc extends OrderDraftContent {
  _id: ObjectId;
  createdBy: { id: string; name: string };
  updatedBy: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

export const orderDraftSummaryOf = (d: OrderDraftDoc) => ({
  id: String(d._id),
  title: orderDraftTitle(d),
  summary: orderDraftSummary(d),
  payment: d.payment,
  updatedAt: d.updatedAt.toISOString(),
  updatedBy: d.updatedBy.name,
  createdBy: d.createdBy.name,
});

export const orderDraftFullOf = (d: OrderDraftDoc) => ({ id: String(d._id), content: parseOrderDraft(d), updatedAt: d.updatedAt.toISOString(), updatedBy: d.updatedBy.name, createdBy: d.createdBy.name });

export async function orderDrafts() {
  const database = await db.getDb();
  return { database, col: database.collection<OrderDraftDoc>(ORDER_DRAFTS) };
}
