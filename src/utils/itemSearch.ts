/** True when every word typed in the search box appears in the item name (any order, any case). */
export function nameMatchesSearch(name: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = name.toLowerCase();
  return words.every((word) => text.includes(word));
}
