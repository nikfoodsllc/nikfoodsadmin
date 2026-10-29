/**
 * The column filters of the Food Items table, as a MongoDB filter. Missing values count the way the
 * table shows them: no `veg` means Non-Veg, no `available` means Unavailable, no `itemType` means Simple,
 * and no `preparationType` or `sticker` means "not set yet".
 *
 *   veg=true|false            Veg / Non-Veg
 *   available=true|false      Available / Unavailable
 *   itemType=simple|portions|combo
 *   preparationType=cooked|ready_to_eat|not_set
 *   sticker=yes|no|not_set
 *   splitSticker=yes|no|not_set
 *   chefsPick=yes|no   (no = not marked yes)
 *   allowInstructions=yes|no   (no = not marked yes)
 *   stock=none|has|ok|low|out   (none = no order limit, has = any limit; ok / low / out follow the live count and are handled by the route)
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

  const sticker = params.get('sticker');
  if (sticker === 'yes' || sticker === 'no') filter.sticker = sticker;
  else if (sticker === 'not_set') filter.sticker = { $nin: ['yes', 'no'] };
  const chefsPick = params.get('chefsPick');
  if (chefsPick === 'yes') filter.chefsPick = true;
  else if (chefsPick === 'no') filter.chefsPick = { $ne: true };
  const allowInstructions = params.get('allowInstructions');
  if (allowInstructions === 'yes') filter.allowInstructions = true;
  else if (allowInstructions === 'no') filter.allowInstructions = { $ne: true };
  // stock=none|has are plain filters; ok|low|out depend on the live count, so the list route works them out (stockLevelParam)
  const stock = params.get('stock');
  if (stock === 'has') filter.stockThreshold = { $gt: 0 };
  else if (stock === 'none') filter.$nor = [{ stockThreshold: { $gt: 0 } }];
  const splitSticker = params.get('splitSticker');
  if (splitSticker === 'yes' || splitSticker === 'no') filter.splitSticker = splitSticker;
  else if (splitSticker === 'not_set') filter.splitSticker = { $nin: ['yes', 'no'] };

  return filter;
}

/** The stock filter values that need the live count (the route works them out): ok, low or out; otherwise null. */
export function stockLevelParam(params: URLSearchParams): 'ok' | 'low' | 'out' | null {
  const v = params.get('stock');
  return v === 'ok' || v === 'low' || v === 'out' ? v : null;
}
