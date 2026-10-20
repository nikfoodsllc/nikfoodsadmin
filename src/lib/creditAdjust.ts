/**
 * Items an admin gave store credit for are taken out of every report: kitchen, packing, ordered items and delivery.
 * A credited item is not made or delivered any more, so it must not be counted. This MongoDB stage goes before
 * `{ $unwind: '$items' }` in a report's pipeline: it lowers each item's quantity by the quantity credited for it
 * (order.creditsIssued[].items[] = { line, item, quantity }), drops items left with no quantity and days left with no items.
 * An order whose items were all credited has no days left, so the unwind drops it from the report.
 * Keep in step with livesite/src/lib/creditedItems.ts (the same rule for OptimoRoute).
 */
export const CREDIT_ADJUST_STAGE = {
  $addFields: {
    items: {
      $filter: {
        as: 'day',
        cond: { $gt: [{ $size: { $ifNull: ['$$day.items', []] } }, 0] },
        input: {
          $map: {
            input: { $range: [0, { $size: { $ifNull: ['$items', []] } }] },
            as: 'li',
            in: {
              $let: {
                vars: { day: { $arrayElemAt: ['$items', '$$li'] } },
                in: {
                  $mergeObjects: [
                    '$$day',
                    {
                      items: {
                        $filter: {
                          as: 'it',
                          cond: { $gt: ['$$it.quantity', 0] },
                          input: {
                            $map: {
                              input: { $range: [0, { $size: { $ifNull: ['$$day.items', []] } }] },
                              as: 'ii',
                              in: {
                                $let: {
                                  vars: {
                                    it: { $arrayElemAt: ['$$day.items', '$$ii'] },
                                    credited: {
                                      $sum: {
                                        $map: {
                                          input: { $ifNull: ['$creditsIssued', []] },
                                          as: 'c',
                                          in: {
                                            $sum: {
                                              $map: {
                                                input: { $ifNull: ['$$c.items', []] },
                                                as: 'ci',
                                                in: { $cond: [{ $and: [{ $eq: ['$$ci.line', '$$li'] }, { $eq: ['$$ci.item', '$$ii'] }] }, { $ifNull: ['$$ci.quantity', 0] }, 0] },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                  in: { $mergeObjects: ['$$it', { quantity: { $subtract: [{ $ifNull: ['$$it.quantity', 0] }, '$$credited'] } }] },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
};

type CreditsLike = Array<{ items?: Array<{ line: number; item: number; quantity: number }> | null }> | null | undefined;
type DayLike = { items?: Array<{ quantity?: number | null }> | null };

/** The same rule in code, for places that read orders without an aggregation (a packer's order list). */
export function withoutCreditedItems<T extends { items?: DayLike[] | null; creditsIssued?: CreditsLike }>(order: T): T {
  const credits = order.creditsIssued ?? [];
  if (credits.length === 0 || !order.items) return order;
  const credited = new Map<string, number>();
  for (const c of credits) for (const it of c.items ?? []) credited.set(`${it.line}:${it.item}`, (credited.get(`${it.line}:${it.item}`) ?? 0) + (Number(it.quantity) || 0));
  const days = order.items
    .map((day, line) => ({
      ...day,
      items: (day.items ?? []).map((it, item) => ({ ...it, quantity: (Number(it.quantity) || 0) - (credited.get(`${line}:${item}`) ?? 0) })).filter((it) => it.quantity > 0),
    }))
    .filter((day) => day.items.length > 0);
  return { ...order, items: days };
}
