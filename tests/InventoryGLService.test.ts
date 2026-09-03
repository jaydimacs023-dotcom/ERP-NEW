import { describe, it, expect } from 'vitest';
import { InventoryGLService } from '../services/InventoryGLService';
import { AccountClass, ChartOfAccount, StockItem, StockAdjustment } from '../types';

describe('InventoryGLService - Double-Entry Accounting & Asset Balance Integrity', () => {
  const accounts: ChartOfAccount[] = [
    {
      id: 'acc-inv-asset',
      orgId: 'org-1',
      code: '1300',
      name: 'Merchandise Inventory',
      class: AccountClass.ASSET,
      type: 'CURRENT_ASSET',
      isActive: true
    },
    {
      id: 'acc-cogs',
      orgId: 'org-1',
      code: '5100',
      name: 'Cost of Goods Sold',
      class: AccountClass.EXPENSE,
      type: 'OPERATING_EXPENSE',
      isActive: true
    },
    {
      id: 'acc-variance',
      orgId: 'org-1',
      code: '5150',
      name: 'Inventory Variance and Shrinkage',
      class: AccountClass.EXPENSE,
      type: 'OPERATING_EXPENSE',
      isActive: true
    }
  ];

  const stockItem: StockItem = {
    id: 'item-1',
    orgId: 'org-1',
    code: 'BOOK-001',
    name: 'Accounting Textbook',
    type: 'STOCK_ITEM',
    unitOfMeasure: 'PCS',
    reorderLevel: 10,
    safetyStock: 5,
    isActive: true,
    unitPrice: 500,
    costPrice: 300,
    warehouseLocationId: 'loc-main',
    cogsAccountId: 'acc-cogs',
    valuationMethod: 'FIFO',
    standardCost: 300,
    minStockLevel: 5,
    maxStockLevel: 50,
    reorderQuantity: 20,
    createdAt: new Date().toISOString()
  };

  it('correctly credits the Inventory Asset account and debits Expense on inventory write-off', () => {
    const adjustment: StockAdjustment = {
      id: 'adj-shrink-1',
      orgId: 'org-1',
      adjustmentNumber: 'ADJ-2026-0001',
      warehouseLocationId: 'loc-main',
      reason: 'Physical count shortage / damaged copies',
      type: 'DAMAGE',
      status: 'POSTED',
      quantityChange: -5, // -5 units
      totalValue: 1500,
      createdAt: '2026-09-03',
      lines: []
    };

    const result = InventoryGLService.createAdjustmentEntry(adjustment, stockItem, accounts, 'org-1', 'user-1');
    expect(result).not.toBeNull();
    if (!result) return;

    const { entry, lines } = result;
    expect(entry.status).toBe('POSTED');
    expect(entry.sourceType).toBe('INVENTORY');
    expect(lines.length).toBe(2);

    const debitLine = lines.find(l => l.debit > 0);
    const creditLine = lines.find(l => l.credit > 0);

    expect(debitLine).toBeDefined();
    expect(creditLine).toBeDefined();

    // 5 units * ₱300 cost = ₱1,500
    expect(debitLine?.debit).toBe(1500);
    expect(creditLine?.credit).toBe(1500);

    // Debit must be an EXPENSE account (Variance / COGS)
    const debitAccount = accounts.find(a => a.id === debitLine?.accountId);
    expect(debitAccount?.class).toBe(AccountClass.EXPENSE);

    // Credit must be an ASSET account (Inventory Asset - NOT COGS)
    const creditAccount = accounts.find(a => a.id === creditLine?.accountId);
    expect(creditAccount?.class).toBe(AccountClass.ASSET);
    expect(creditAccount?.id).toBe('acc-inv-asset');
  });

  it('correctly debits the Inventory Asset account and credits Expense on positive inventory adjustment', () => {
    const adjustment: StockAdjustment = {
      id: 'adj-surplus-1',
      orgId: 'org-1',
      adjustmentNumber: 'ADJ-2026-0002',
      warehouseLocationId: 'loc-main',
      reason: 'Found inventory count surplus',
      type: 'COUNT_DISCREPANCY',
      status: 'POSTED',
      quantityChange: 10, // +10 units
      totalValue: 3000,
      createdAt: '2026-09-03',
      lines: []
    };

    const result = InventoryGLService.createAdjustmentEntry(adjustment, stockItem, accounts, 'org-1', 'user-1');
    expect(result).not.toBeNull();
    if (!result) return;

    const { lines } = result;
    const debitLine = lines.find(l => l.debit > 0);
    const creditLine = lines.find(l => l.credit > 0);

    expect(debitLine?.debit).toBe(3000);
    expect(creditLine?.credit).toBe(3000);

    // Debit must be the ASSET account (increasing inventory balance)
    const debitAccount = accounts.find(a => a.id === debitLine?.accountId);
    expect(debitAccount?.class).toBe(AccountClass.ASSET);
    expect(debitAccount?.id).toBe('acc-inv-asset');

    // Credit must be an EXPENSE account (reducing variance / expense)
    const creditAccount = accounts.find(a => a.id === creditLine?.accountId);
    expect(creditAccount?.class).toBe(AccountClass.EXPENSE);
  });
});
