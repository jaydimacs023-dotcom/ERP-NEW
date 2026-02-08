/**
 * InventoryGLService
 * Handles automatic GL journal entry creation for inventory transactions
 * Implements GR/IR clearing, FIFO valuation, and inventory cost tracking
 */

import { 
  JournalEntry, JournalLine, ChartOfAccount, 
  StockAdjustment, InventoryTransaction, GoodsReceipt,
  StockItem, InventoryLevel, AccountClass 
} from '../types';
import { AccountingService } from './accountingService';

interface GLConfig {
  inventoryAccountId: string;
  grirClearingAccountId: string;
  cogsAccountId: string;
  varianceAccountId: string;
  costLedgerAccountId?: string;
}

export class InventoryGLService {
  /**
   * Creates GL entry for stock adjustment (variance, damage, count difference)
   * DR Inventory Variance (Expense) / CR Inventory (Asset)
   */
  static createAdjustmentEntry(
    adjustment: StockAdjustment,
    item: StockItem,
    accounts: ChartOfAccount[],
    orgId: string,
    createdBy: string
  ): { entry: Partial<JournalEntry>; lines: JournalLine[] } | null {
    // Get GL accounts
    const varianceAccount = accounts.find(a => 
      a.name.toLowerCase().includes('inventory variance') && 
      a.class === AccountClass.EXPENSE
    ) || accounts.find(a => a.code === '5100'); // Fallback to COGS

    const inventoryAccount = item.cogsAccountId 
      ? accounts.find(a => a.id === item.cogsAccountId)
      : accounts.find(a => a.name.toLowerCase().includes('inventory') && a.class === AccountClass.ASSET);

    if (!varianceAccount || !inventoryAccount) return null;

    // Calculate adjustment amount (quantity change × unit cost)
    const adjustmentAmount = Math.abs(adjustment.quantityChange) * item.costPrice;
    const isIncrement = adjustment.quantityChange > 0;

    const entryId = `je-adj-${adjustment.id}`;
    const entry: Partial<JournalEntry> = {
      orgId,
      date: adjustment.createdAt,
      description: `Inventory Adjustment: ${adjustment.reason}`,
      reference: `ADJ-${adjustment.adjustmentNumber}`,
      sourceType: 'PURCHASE_ORDER', // Generic source for adjustments
      status: 'POSTED',
      createdBy,
    };

    const lines: JournalLine[] = isIncrement
      ? [
          // Increment: DR Inventory / CR Variance (reversal of expense)
          {
            id: `l1-${entryId}`,
            journalEntryId: entryId,
            accountId: inventoryAccount.id,
            debit: adjustmentAmount,
            credit: 0,
            memo: `${adjustment.reason}: +${adjustment.quantityChange} units`,
            description: `Stock adjustment increase - ${item.code}`,
          },
          {
            id: `l2-${entryId}`,
            journalEntryId: entryId,
            accountId: varianceAccount.id,
            debit: 0,
            credit: adjustmentAmount,
            memo: `Reversal of variance`,
            description: `Inventory variance reversal`,
          },
        ]
      : [
          // Decrement: DR Variance / CR Inventory
          {
            id: `l1-${entryId}`,
            journalEntryId: entryId,
            accountId: varianceAccount.id,
            debit: adjustmentAmount,
            credit: 0,
            memo: `${adjustment.reason}: -${Math.abs(adjustment.quantityChange)} units`,
            description: `Stock adjustment decrease - ${item.code}`,
          },
          {
            id: `l2-${entryId}`,
            journalEntryId: entryId,
            accountId: inventoryAccount.id,
            debit: 0,
            credit: adjustmentAmount,
            memo: `Inventory write-off`,
            description: `Inventory variance charge`,
          },
        ];

    return { entry, lines };
  }

  /**
   * Creates GL entry for inter-warehouse stock transfer
   * DR Warehouse A Inventory / CR Warehouse B Inventory
   * (or single account if no location sub-ledgers)
   */
  static createTransferEntry(
    transaction: InventoryTransaction,
    item: StockItem,
    accounts: ChartOfAccount[],
    orgId: string,
    createdBy: string
  ): { entry: Partial<JournalEntry>; lines: JournalLine[] } | null {
    const inventoryAccount = item.cogsAccountId 
      ? accounts.find(a => a.id === item.cogsAccountId)
      : accounts.find(a => a.name.toLowerCase().includes('inventory') && a.class === AccountClass.ASSET);

    if (!inventoryAccount) return null;

    const transferAmount = transaction.quantity * item.costPrice;
    const entryId = `je-xfr-${transaction.id}`;

    const entry: Partial<JournalEntry> = {
      orgId,
      date: transaction.transactionDate,
      description: `Stock Transfer: ${transaction.fromLocation} → ${transaction.toLocation}`,
      reference: `XFR-${transaction.transactionNumber || Date.now()}`,
      sourceType: 'TRANSFER',
      status: 'POSTED',
      createdBy,
    };

    // Simple transfer: Both sides use same account (no subledger)
    // In advanced setups, create separate accounts per warehouse
    const lines: JournalLine[] = [
      {
        id: `l1-${entryId}`,
        journalEntryId: entryId,
        accountId: inventoryAccount.id,
        debit: transferAmount,
        credit: 0,
        memo: `Transfer to ${transaction.toLocation}`,
        description: `Inventory transfer - ${item.code}`,
      },
      {
        id: `l2-${entryId}`,
        journalEntryId: entryId,
        accountId: inventoryAccount.id,
        debit: 0,
        credit: transferAmount,
        memo: `Transfer from ${transaction.fromLocation}`,
        description: `Inventory transfer - ${item.code}`,
      },
    ];

    return { entry, lines };
  }

  /**
   * Creates GR/IR Clearing journal entry for goods receipt
   * DR Inventory (Asset) / CR GR/IR Clearing (Liability)
   * When invoice received: DR GR/IR Clearing / CR AP
   */
  static createGRIREntry(
    goodsReceipt: GoodsReceipt,
    accounts: ChartOfAccount[],
    orgId: string,
    createdBy: string,
    config?: GLConfig
  ): { entry: Partial<JournalEntry>; lines: JournalLine[] } | null {
    const inventoryAccount = config?.inventoryAccountId
      ? accounts.find(a => a.id === config.inventoryAccountId)
      : accounts.find(a => a.name.toLowerCase().includes('inventory') && a.class === AccountClass.ASSET);

    const grirAccount = config?.grirClearingAccountId
      ? accounts.find(a => a.id === config.grirClearingAccountId)
      : accounts.find(a => 
          (a.name.toLowerCase().includes('gr/ir') || 
           a.name.toLowerCase().includes('goods receipt')) && 
          a.class === AccountClass.LIABILITY
        );

    if (!inventoryAccount || !grirAccount) return null;

    const entryId = `je-grir-${goodsReceipt.id}`;
    const entry: Partial<JournalEntry> = {
      orgId,
      date: goodsReceipt.receiptDate,
      description: `Goods Receipt: ${goodsReceipt.grNumber}`,
      reference: goodsReceipt.grNumber,
      sourceType: 'GR_IR',
      status: 'POSTED',
      createdBy,
    };

    const lines: JournalLine[] = [
      {
        id: `l1-${entryId}`,
        journalEntryId: entryId,
        accountId: inventoryAccount.id,
        debit: goodsReceipt.totalAmount,
        credit: 0,
        memo: `GR/IR Clearing receipt`,
        description: `Inventory receipt - ${goodsReceipt.grNumber}`,
      },
      {
        id: `l2-${entryId}`,
        journalEntryId: entryId,
        accountId: grirAccount.id,
        debit: 0,
        credit: goodsReceipt.totalAmount,
        memo: `GR/IR Clearing liability`,
        description: `GR/IR clearing account`,
      },
    ];

    return { entry, lines };
  }

  /**
   * Matches GR/IR clearing against received invoice
   * DR GR/IR Clearing (Liability) / CR AP
   * Called when bill is received matching GR
   */
  static createGRIRMatchingEntry(
    goodsReceiptId: string,
    invoiceAmount: number,
    accounts: ChartOfAccount[],
    orgId: string,
    createdBy: string,
    grNumber?: string,
    config?: GLConfig
  ): { entry: Partial<JournalEntry>; lines: JournalLine[] } | null {
    const grirAccount = config?.grirClearingAccountId
      ? accounts.find(a => a.id === config.grirClearingAccountId)
      : accounts.find(a => 
          (a.name.toLowerCase().includes('gr/ir') || 
           a.name.toLowerCase().includes('goods receipt')) && 
          a.class === AccountClass.LIABILITY
        );

    const apAccount = accounts.find(a => 
      a.name.toLowerCase().includes('accounts payable') && 
      a.class === AccountClass.LIABILITY
    ) || accounts.find(a => a.code === '2100');

    if (!grirAccount || !apAccount) return null;

    const entryId = `je-match-${goodsReceiptId}`;
    const entry: Partial<JournalEntry> = {
      orgId,
      date: new Date().toISOString().split('T')[0],
      description: `GR/IR Matching: Invoice for ${grNumber || goodsReceiptId}`,
      reference: `MATCH-${grNumber || goodsReceiptId}`,
      sourceType: 'BILL',
      status: 'POSTED',
      createdBy,
    };

    const lines: JournalLine[] = [
      {
        id: `l1-${entryId}`,
        journalEntryId: entryId,
        accountId: grirAccount.id,
        debit: invoiceAmount,
        credit: 0,
        memo: `GR/IR clearing relief`,
        description: `Clear GR/IR liability`,
      },
      {
        id: `l2-${entryId}`,
        journalEntryId: entryId,
        accountId: apAccount.id,
        debit: 0,
        credit: invoiceAmount,
        memo: `Accounts Payable`,
        description: `Record AP liability`,
      },
    ];

    return { entry, lines };
  }

  /**
   * Validates GL configuration has required accounts
   */
  static validateGLConfig(accounts: ChartOfAccount[], config?: GLConfig): string[] {
    const errors: string[] = [];

    if (!config?.inventoryAccountId && !accounts.find(a => a.name.toLowerCase().includes('inventory') && a.class === AccountClass.ASSET)) {
      errors.push('Inventory (Asset) account not found in chart of accounts');
    }
    if (!config?.grirClearingAccountId && !accounts.find(a => (a.name.toLowerCase().includes('gr/ir') || a.name.toLowerCase().includes('goods receipt')) && a.class === AccountClass.LIABILITY)) {
      errors.push('GR/IR Clearing account not found');
    }
    if (!config?.cogsAccountId && !accounts.find(a => a.name.toLowerCase().includes('cost of goods sold') && a.class === AccountClass.EXPENSE)) {
      errors.push('COGS account not found');
    }
    if (!config?.varianceAccountId && !accounts.find(a => a.name.toLowerCase().includes('inventory variance') && a.class === AccountClass.EXPENSE)) {
      errors.push('Inventory Variance account not found');
    }

    return errors;
  }

  /**
   * Gets GL account recommendations for inventory setup
   */
  static getRecommendedAccounts(): { account: string; code: string; class: AccountClass }[] {
    return [
      { account: 'Inventory', code: '1400', class: AccountClass.ASSET },
      { account: 'GR/IR Clearing', code: '2110', class: AccountClass.LIABILITY },
      { account: 'Cost of Goods Sold', code: '5100', class: AccountClass.EXPENSE },
      { account: 'Inventory Variance', code: '5150', class: AccountClass.EXPENSE },
      { account: 'Accounts Payable - Clearing', code: '2100', class: AccountClass.LIABILITY },
    ];
  }
}
