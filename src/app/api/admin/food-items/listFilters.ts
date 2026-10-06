/**
 * The column filters of the Food Items table, as a MongoDB filter. Missing values count the way the
 * table shows them: no `veg` means Non-Veg, no `available` means Unavailable, no `itemType` means Simple,
 * and no `preparationType` means "not set yet".
 *
 *   veg=true|false            Veg / Non-Veg
 *   available=true|false      Available / Unavailable
 *   itemType=simple|portions|combo
 *   preparationType=cooked|ready_to_eat|not_set
 * Anything else is ignored (the filter stays off).
 */
export function foodItemListFilters(params: URLSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  const veg = params.get('veg');
  if (veg === 'true') filter.veg = true;
  else if (veg === 'false') filter.veg = { $ne: true };

  const available = params.get('available');
  if (available === 'true') filter.available = true;
  else if (available === 'false') filter.available = { $ne: true };

  const itemType = params.get('itemType');
  if (itemType === 'portions' || itemType === 'combo') filter.itemType = itemType;
  else if (itemType === 'simple') filter.itemType = { $nin: ['portions', 'combo'] };

  const preparation = params.get('preparationType');
  if (preparation === 'cooked' || preparation === 'ready_to_eat') filter.preparationType = preparation;
  else if (preparation === 'not_set') filter.preparationType = { $nin: ['cooked', 'ready_to_eat'] };

  return filter;
}
