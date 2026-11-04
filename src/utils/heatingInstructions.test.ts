import { describe, expect, it } from 'vitest';
import { DEFAULT_HEATING_INSTRUCTIONS, MAX_HEATING_INSTRUCTION_LENGTH, cleanHeatingInstruction, heatingInstructionKey, mergeHeatingInstructions } from './heatingInstructions';

describe('cleanHeatingInstruction', () => {
  it('trims, joins lines and keeps one line', () => {
    expect(cleanHeatingInstruction('  Keep   Refrigerated \n Shake Well ')).toBe('Keep Refrigerated Shake Well');
  });
  it('gives null for nothing', () => {
    expect(cleanHeatingInstruction('')).toBeNull();
    expect(cleanHeatingInstruction('   ')).toBeNull();
    expect(cleanHeatingInstruction(undefined)).toBeNull();
    expect(cleanHeatingInstruction(null)).toBeNull();
    expect(cleanHeatingInstruction(42)).toBeNull();
  });
  it('cuts to the longest allowed length', () => {
    expect(cleanHeatingInstruction('x'.repeat(500))?.length).toBe(MAX_HEATING_INSTRUCTION_LENGTH);
  });
});

describe('mergeHeatingInstructions', () => {
  it('starts with the instructions in use today', () => {
    expect(DEFAULT_HEATING_INSTRUCTIONS).toHaveLength(15);
    expect(mergeHeatingInstructions([])).toHaveLength(15);
  });
  it('adds a new one once and ignores a different spelling of an old one', () => {
    const list = mergeHeatingInstructions(['Serve Warm', 'serve  warm', 'KEEP REFRIGERATED', '']);
    expect(list.filter((t) => heatingInstructionKey(t) === 'serve warm')).toHaveLength(1);
    expect(list.filter((t) => heatingInstructionKey(t) === 'keep refrigerated')).toHaveLength(1);
    expect(list).toHaveLength(16);
  });
  it('is sorted A to Z', () => {
    const list = mergeHeatingInstructions(['Aardvark']);
    expect(list[0]).toBe('Aardvark');
    expect([...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))).toEqual(list);
  });
});
