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
  const splitSticker = params.get('splitSticker');
  if (splitSticker === 'yes' || splitSticker === 'no') filter.splitSticker = splitSticker;
  else if (splitSticker === 'not_set') filter.splitSticker = { $nin: ['yes', 'no'] };

  return filter;
}
