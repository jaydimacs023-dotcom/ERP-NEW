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
