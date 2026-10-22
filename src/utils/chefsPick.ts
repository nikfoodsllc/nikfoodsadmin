/**
 * Chef's Pick: a yes/no mark on a food item. Items marked Yes are shown in the mobile app's "Chef's Pick" row (under the banner
 * on the home page); the website does not show it. An item with no mark counts as No.
 */
export const isChefsPick = (value: unknown): boolean => value === true;

export const chefsPickLabel = (value: unknown): 'Yes' | 'No' => (isChefsPick(value) ? 'Yes' : 'No');

/** The list filter on the Food Items page. */
export type ChefsPickFilter = 'all' | 'yes' | 'no';

export const isChefsPickFilter = (value: unknown): value is ChefsPickFilter => value === 'all' || value === 'yes' || value === 'no';
