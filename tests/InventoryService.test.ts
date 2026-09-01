import { describe, expect, it } from 'vitest';
import { InventoryService } from '../services/InventoryService';
import type { InventoryLevel } from '../types';

describe('InventoryService stock availability', () => {
  it('aggregates available quantities across warehouse levels', () => {
    const levels = [
      { quantityOnHand: 12, quantityReserved: 2, quantityAvailable: 10 },
      { quantityOnHand: 8, quantityReserved: 3, quantityAvailable: 5 },
    ] as InventoryLevel[];

    expect(InventoryService.getAvailableQuantity(levels)).toBe(15);
  });

  it('derives availability when a stored available value is missing', () => {
    const level = {
      quantityOnHand: 9,
      quantityReserved: 4,
      quantityAvailable: undefined,
    } as unknown as InventoryLevel;

    expect(InventoryService.getAvailableQuantity(level)).toBe(5);
  });
});

describe('InventoryService physical count variance', () => {
  it('returns a negative movement when the physical count is lower', () => {
    expect(InventoryService.calculateCountVariance(100, 87)).toBe(-13);
  });

  it('returns a positive movement when unrecorded stock is counted', () => {
    expect(InventoryService.calculateCountVariance(20, 24)).toBe(4);
  });

  it('does not emit an invalid numeric movement', () => {
    expect(InventoryService.calculateCountVariance(Number.NaN, 10)).toBe(0);
  });
});
