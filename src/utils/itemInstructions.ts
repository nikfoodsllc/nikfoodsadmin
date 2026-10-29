/**
 * Special instructions: a yes/no setting on a food item. Items set to Yes show a "Special instructions" box to the customer
 * (website and app) when they add the item; what they type travels with that item to the kitchen, the packing team and the
 * order summary. An item with no setting counts as No (the box is off).
 */
export const allowsInstructions = (value: unknown): boolean => value === true;

/** What to show in the Food Items table: Yes or No. */
export const instructionsLabel = (value: unknown): 'Yes' | 'No' => (allowsInstructions(value) ? 'Yes' : 'No');

/** The Special Instructions filter above the Food Items table. */
export type InstructionsFilter = 'all' | 'yes' | 'no';

export const isInstructionsFilter = (value: unknown): value is InstructionsFilter => value === 'all' || value === 'yes' || value === 'no';
