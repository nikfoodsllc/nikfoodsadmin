import { describe, expect, it } from 'vitest';
import {
  isPreparationFilter,
  isPreparationType,
  matchesPreparationFilter,
  normalizePreparationType,
  preparationTypeError,
  preparationTypeLabel,
} from './preparationType';

describe('preparation type', () => {
  it('knows the two types', () => {
    expect(isPreparationType('cooked')).toBe(true);
    expect(isPreparationType('ready_to_eat')).toBe(true);
    expect(isPreparationType('Cooked')).toBe(false);
    expect(isPreparationType('')).toBe(false);
    expect(isPreparationType(null)).toBe(false);
    expect(isPreparationType(undefined)).toBe(false);
    expect(isPreparationType(1)).toBe(false);
  });

  it('labels each state, and "(not set yet)" for everything else', () => {
    expect(preparationTypeLabel('cooked')).toBe('Cooked');
    expect(preparationTypeLabel('ready_to_eat')).toBe('Ready to eat');
    expect(preparationTypeLabel(undefined)).toBe('(not set yet)');
    expect(preparationTypeLabel(null)).toBe('(not set yet)');
    expect(preparationTypeLabel('fried')).toBe('(not set yet)');
  });

  it('normalizes to a valid type or null', () => {
    expect(normalizePreparationType('cooked')).toBe('cooked');
    expect(normalizePreparationType('ready_to_eat')).toBe('ready_to_eat');
    expect(normalizePreparationType('x')).toBeNull();
    expect(normalizePreparationType(undefined)).toBeNull();
  });

  it('makes the type mandatory for NEW items only', () => {
    expect(preparationTypeError(true, undefined)).toBe('Choose Cooked or Ready to eat');
    expect(preparationTypeError(true, null)).toBe('Choose Cooked or Ready to eat');
    expect(preparationTypeError(true, 'nope')).toBe('Choose Cooked or Ready to eat');
    expect(preparationTypeError(true, 'cooked')).toBeNull();
    expect(preparationTypeError(true, 'ready_to_eat')).toBeNull();
    // an existing item may stay not set
    expect(preparationTypeError(false, undefined)).toBeNull();
    expect(preparationTypeError(false, null)).toBeNull();
  });

  it('filters', () => {
    expect(isPreparationFilter('not_set')).toBe(true);
    expect(isPreparationFilter('all')).toBe(true);
    expect(isPreparationFilter('cooked')).toBe(true);
    expect(isPreparationFilter('nope')).toBe(false);
    expect(matchesPreparationFilter('cooked', 'all')).toBe(true);
    expect(matchesPreparationFilter(undefined, 'all')).toBe(true);
    expect(matchesPreparationFilter('cooked', 'cooked')).toBe(true);
    expect(matchesPreparationFilter('ready_to_eat', 'cooked')).toBe(false);
    expect(matchesPreparationFilter(undefined, 'not_set')).toBe(true);
    expect(matchesPreparationFilter(null, 'not_set')).toBe(true);
    expect(matchesPreparationFilter('cooked', 'not_set')).toBe(false);
  });
});
