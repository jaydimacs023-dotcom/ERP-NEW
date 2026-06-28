import { describe, expect, it } from 'vitest';
import { InventoryReportingService } from '../services/InventoryReportingService';
import type { InventoryLevel, InventoryTransaction, StockItem } from '../types';

const item = {
  id: 'item-1',
  code: 'MAT-001',
  name: 'Training Material',
  standardCost: 25,
  costPrice: 0,
  minStockLevel: 2,
  reorderQuantity: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
} as StockItem;

const level = {
  stockItemId: item.id,
  quantityOnHand: 8,
  quantityReserved: 1,
  quantityAvailable: 7,
} as InventoryLevel;

const transactions = [
  {
    id: 'txn-in',
    stockItemId: item.id,
    transactionType: 'OPENING_INVENTORY',
    quantity: 10,
    quantityChange: 10,
    unitCost: 25,
    totalCost: 250,
    postingDate: '2026-06-01',
    createdAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'txn-out',
    stockItemId: item.id,
    transactionType: 'INVENTORY_WRITEOFF',
    quantity: 2,
    quantityChange: -2,
    unitCost: 25,
    totalCost: 50,
    postingDate: '2026-06-15',
    createdAt: '2026-06-15T08:00:00.000Z',
  },
] as unknown as InventoryTransaction[];

describe('InventoryReportingService persistent inventory model', () => {
  it('uses ledger-backed level and transaction fields without crashing', () => {
    const aging = InventoryReportingService.getStockAging([item], [level], transactions, '2026-06-28');
    const metrics = InventoryReportingService.getInventoryMetrics([item], [level], transactions);

    expect(aging[0]).toMatchObject({ currentQuantity: 8, value: 200, daysInStock: 13 });
    expect(metrics).toMatchObject({ totalInventoryValue: 200, activeItems: 1 });
    expect(metrics.inventoryTurnover).toBe(0.25);
  });

  it('classifies signed outbound ledger movements for trends and ABC analysis', () => {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const currentTransactions = transactions.map((transaction, index) => ({
      ...transaction,
      postingDate: `${currentPeriod}-${index === 0 ? '01' : '15'}`,
    }));
    const trends = InventoryReportingService.getMovementTrends([item], currentTransactions, 1);
    const abc = InventoryReportingService.getABCAnalysis([item], transactions);

    expect(trends.at(-1)).toMatchObject({ inbound: 10, outbound: 2, netMovement: 8 });
    expect(abc[0].annualConsumptionValue).toBe(50);
  });
});
