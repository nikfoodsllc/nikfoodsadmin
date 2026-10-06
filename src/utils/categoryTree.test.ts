import { describe, expect, it } from 'vitest';
import { categoryTableRows, groupCategoriesByParent, type TreeCategory } from './categoryTree';

const cat = (id: string, name: string, sequence?: number, parent?: string): TreeCategory => ({ _id: id, name, sequence, parentCategoryId: parent });
const shape = (groups: ReturnType<typeof groupCategoriesByParent>) =>
  groups.map((g) => `${g.parent?.name ?? `(${g.parentName || '?'})`}: ${g.children.map((c) => c.name).join(', ')}`);

describe('groupCategoriesByParent', () => {
  const list = [
    cat('c3', 'Sweets', 3),
    cat('s2', 'Pickles B', 2, 'c2'),
    cat('c1', 'Batter', 1),
    cat('s1', 'Menu B', 5, 'c2'),
    cat('c2', 'Food Menu', 2),
    cat('s3', 'Menu A', 1, 'c2'),
    cat('s4', 'Barfi', 1, 'c3'),
    cat('s5', 'Pickles A', 1, 'c2'),
  ];

  it('puts each category before its own sub-categories, both by rank', () => {
    expect(shape(groupCategoriesByParent(list))).toEqual([
      'Batter: ',
      'Food Menu: Menu A, Pickles A, Pickles B, Menu B',
      'Sweets: Barfi',
    ]);
  });

  it('breaks rank ties by name', () => {
    const g = groupCategoriesByParent([cat('p', 'P', 1), cat('b', 'B', 1, 'p'), cat('a', 'A', 1, 'p')]);
    expect(g[0].children.map((c) => c.name)).toEqual(['A', 'B']);
  });

  it('accepts ids that are objects (ObjectId) as well as strings', () => {
    const oid = (s: string) => ({ toString: () => s });
    const g = groupCategoriesByParent([{ _id: oid('x'), name: 'Top', sequence: 1 }, { _id: oid('y'), name: 'Kid', sequence: 1, parentCategoryId: oid('x') }]);
    expect(shape(g)).toEqual(['Top: Kid']);
  });

  it('keeps sub-categories of a hidden parent, under the parent name, in the parent rank position', () => {
    const shown = list.filter((c) => c._id !== 'c2');
    expect(shape(groupCategoriesByParent(shown, list))).toEqual([
      'Batter: ',
      '(Food Menu): Menu A, Pickles A, Pickles B, Menu B',
      'Sweets: Barfi',
    ]);
  });

  it('puts sub-categories with an unknown parent last', () => {
    const g = groupCategoriesByParent([cat('a', 'A', 1), cat('k', 'Lost', 1, 'gone')]);
    expect(shape(g)).toEqual(['A: ', '(?): Lost']);
  });

  it('treats a blank parent id as top level and does not change the input', () => {
    const input = [cat('a', 'A', 2, ''), cat('b', 'B', 1)];
    const copy = JSON.stringify(input);
    expect(shape(groupCategoriesByParent(input))).toEqual(['B: ', 'A: ']);
    expect(JSON.stringify(input)).toBe(copy);
  });

  it('returns nothing for an empty list', () => {
    expect(groupCategoriesByParent([])).toEqual([]);
  });
});

describe('categoryTableRows', () => {
  it('lines each category\'s sub-categories up in its own column, padding short columns with null', () => {
    const groups = groupCategoriesByParent([
      cat('c1', 'Cat 1', 1), cat('a', 'Sub 1', 1, 'c1'), cat('b', 'Sub 2', 2, 'c1'),
      cat('c2', 'Cat 2', 2), cat('d', 'Sub 1', 1, 'c2'), cat('e', 'Sub 2', 2, 'c2'), cat('f', 'Sub 3', 3, 'c2'),
      cat('c3', 'Cat 3', 3),
    ]);
    const rows = categoryTableRows(groups).map((row) => row.map((c) => c?.name ?? '-').join(' | '));
    expect(rows).toEqual(['Sub 1 | Sub 1 | -', 'Sub 2 | Sub 2 | -', '- | Sub 3 | -']);
  });

  it('has no rows when nothing has sub-categories', () => {
    expect(categoryTableRows(groupCategoriesByParent([cat('a', 'A', 1)]))).toEqual([]);
  });
});
