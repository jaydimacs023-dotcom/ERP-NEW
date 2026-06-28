/**
 * InventoryReportingService
 * Advanced inventory analytics and reporting
 * Provides stock aging, valuation, movement trends, variance, and ABC analysis
 */

import { 
  StockItem, InventoryLevel, InventoryTransaction, 
  JournalLine
} from '../types';

const levelQuantity = (level?: InventoryLevel): number =>
  Number(level?.quantityOnHand ?? level?.quantityAvailable ?? 0);

const itemCost = (item?: StockItem): number =>
  Number(item?.standardCost ?? item?.costPrice ?? 0);

const transactionDate = (transaction: InventoryTransaction): string =>
  String((transaction as InventoryTransaction & { postingDate?: string }).postingDate || transaction.createdAt || '');

const transactionDirection = (transaction: InventoryTransaction): 'IN' | 'OUT' => {
  const signedQuantity = Number((transaction as InventoryTransaction & { quantityChange?: number }).quantityChange);
  if (Number.isFinite(signedQuantity) && signedQuantity !== 0) return signedQuantity > 0 ? 'IN' : 'OUT';
  const type = String(transaction.transactionType || '').toUpperCase();
  return ['SALE', 'DAMAGE', 'WRITEOFF', 'INVENTORY_WRITEOFF'].includes(type) ? 'OUT' : 'IN';
};

export interface StockAgingData {
  itemCode: string;
  itemName: string;
  currentQuantity: number;
  daysInStock: number;
  lastMovement: string;
  value: number;
  ageCategory: 'Fresh' | 'Active' | 'Slow' | 'Dead';
}

export interface ValuationData {
  itemCode: string;
  itemName: string;
  quantity: number;
  fifoValue: number;
  lifoValue: number;
  weightedAvgValue: number;
  currentCostPrice: number;
}

export interface MovementTrendData {
  period: string; // YYYY-MM
  itemCode: string;
  inbound: number;
  outbound: number;
  netMovement: number;
  runningBalance: number;
}

export interface VarianceData {
  itemCode: string;
  itemName: string;
  expectedQuantity: number;
  actualQuantity: number;
  variance: number;
  variancePercent: number;
  varianceValue: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
}

export interface ABCAnalysisData {
  itemCode: string;
  itemName: string;
  annualConsumptionValue: number;
  cumulativePercent: number;
  category: 'A' | 'B' | 'C';
  managementFocus: 'Tight Control' | 'Normal Control' | 'Loose Control';
}

export class InventoryReportingService {
  /**
   * Calculates stock aging: How long items have been in inventory
   * Dead stock = no movement in 180+ days
   * Slow = 90-180 days
   * Active = 30-90 days
   * Fresh = < 30 days
   */
  static getStockAging(
    items: StockItem[],
    levels: InventoryLevel[],
    transactions: InventoryTransaction[],
    asOfDate: string = new Date().toISOString().split('T')[0]
  ): StockAgingData[] {
    const asOfTime = new Date(asOfDate).getTime();

    return items.map(item => {
      const level = levels.find(l => l.stockItemId === item.id);
      const itemTransactions = transactions
        .filter(t => t.stockItemId === item.id)
        .sort((a, b) => new Date(transactionDate(b)).getTime() - new Date(transactionDate(a)).getTime());

      const lastMovement = itemTransactions.length > 0 
        ? transactionDate(itemTransactions[0])
        : item.createdAt;

      const daysInStock = Math.floor(
        (asOfTime - new Date(lastMovement).getTime()) / (1000 * 60 * 60 * 24)
      );

      const currentQuantity = levelQuantity(level);
      const value = currentQuantity * itemCost(item);

      let ageCategory: 'Fresh' | 'Active' | 'Slow' | 'Dead';
      if (daysInStock < 30) ageCategory = 'Fresh';
      else if (daysInStock < 90) ageCategory = 'Active';
      else if (daysInStock < 180) ageCategory = 'Slow';
      else ageCategory = 'Dead';

      return {
        itemCode: item.code,
        itemName: item.name,
        currentQuantity,
        daysInStock,
        lastMovement,
        value,
        ageCategory,
      };
    });
  }

  /**
   * Calculates inventory valuation using FIFO, LIFO, and Weighted Average Cost methods
   * Useful for comparing valuation impact under different accounting methods
   */
  static getValuationComparison(
    items: StockItem[],
    levels: InventoryLevel[],
    transactions: InventoryTransaction[]
  ): ValuationData[] {
    return items.map(item => {
      const level = levels.find(l => l.stockItemId === item.id);
      const quantity = levelQuantity(level);

      // FIFO: Assumes oldest costs are consumed first
      // Current stock valued at most recent costs
      const itemTransactions = transactions
        .filter(t => t.stockItemId === item.id && transactionDirection(t) === 'IN')
        .sort((a, b) => new Date(transactionDate(a)).getTime() - new Date(transactionDate(b)).getTime());

      let fifoValue = 0;
      let remainingQty = quantity;
      for (let i = itemTransactions.length - 1; i >= 0 && remainingQty > 0; i--) {
        const txn = itemTransactions[i];
        const qtyFromTxn = Math.min(txn.quantity, remainingQty);
        // Approximate: use historical cost price (simplified)
        fifoValue += qtyFromTxn * Number(txn.unitCost || itemCost(item));
        remainingQty -= qtyFromTxn;
      }

      // LIFO: Assumes newest costs are consumed first
      // Current stock valued at oldest costs
      let lifoValue = 0;
      remainingQty = quantity;
      for (let i = 0; i < itemTransactions.length && remainingQty > 0; i++) {
        const txn = itemTransactions[i];
        const qtyFromTxn = Math.min(txn.quantity, remainingQty);
        lifoValue += qtyFromTxn * Number(txn.unitCost || itemCost(item));
        remainingQty -= qtyFromTxn;
      }

      // Weighted Average Cost
      const totalInboundQty = itemTransactions.reduce((sum, t) => sum + t.quantity, 0);
      const totalInboundValue = itemTransactions.reduce(
        (sum, t) => sum + (t.quantity * Number(t.unitCost || itemCost(item))),
        0
      );
      const weightedAvgCost = totalInboundQty > 0 ? totalInboundValue / totalInboundQty : 0;
      const weightedAvgValue = quantity * weightedAvgCost;

      return {
        itemCode: item.code,
        itemName: item.name,
        quantity,
        fifoValue,
        lifoValue,
        weightedAvgValue,
        currentCostPrice: itemCost(item),
      };
    });
  }

  /**
   * Analyzes stock movement trends over time
   * Shows inbound, outbound, and net movement per period
   */
  static getMovementTrends(
    items: StockItem[],
    transactions: InventoryTransaction[],
    months: number = 12
  ): MovementTrendData[] {
    const trends: MovementTrendData[] = [];
    const now = new Date();
    const periodMap: Record<string, { inbound: number; outbound: number }> = {};

    // Generate periods (last N months)
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      periodMap[period] = { inbound: 0, outbound: 0 };
    }

    // Aggregate transactions by period
    transactions.forEach(txn => {
      const period = transactionDate(txn).slice(0, 7);
      if (periodMap[period]) {
        if (transactionDirection(txn) === 'IN') periodMap[period].inbound += txn.quantity;
        else periodMap[period].outbound += txn.quantity;
      }
    });

    // Build trends per item
    items.forEach(item => {
      let runningBalance = 0;
      Object.entries(periodMap).forEach(([period, { inbound, outbound }]) => {
        const itemTxns = transactions.filter(
          t => t.stockItemId === item.id && transactionDate(t).startsWith(period)
        );
        
        const itemInbound = itemTxns.filter(t => transactionDirection(t) === 'IN').reduce((sum, t) => sum + t.quantity, 0);
        const itemOutbound = itemTxns.filter(t => transactionDirection(t) === 'OUT').reduce((sum, t) => sum + t.quantity, 0);
        const netMovement = itemInbound - itemOutbound;
        runningBalance += netMovement;

        trends.push({
          period,
          itemCode: item.code,
          inbound: itemInbound,
          outbound: itemOutbound,
          netMovement,
          runningBalance,
        });
      });
    });

    return trends;
  }

  /**
   * Identifies inventory variances (expected vs. actual)
   * Critical: > 10% variance
   * High: 5-10%
   * Medium: 2-5%
   * Low: < 2%
   */
  static getVarianceAnalysis(
    items: StockItem[],
    levels: InventoryLevel[],
    ledgerLines: JournalLine[]
  ): VarianceData[] {
    return items.map(item => {
      const level = levels.find(l => l.stockItemId === item.id);
      const actualQuantity = levelQuantity(level);

      // Expected quantity from GL ledger
      const itemLines = ledgerLines.filter(l => l.itemId === item.id);
      const expectedQuantity = itemLines.reduce((sum, l) => sum + ((l.debit || 0) - (l.credit || 0)), 0);

      const variance = actualQuantity - expectedQuantity;
      const variancePercent = expectedQuantity > 0 ? (variance / expectedQuantity) * 100 : 0;
      const varianceValue = Math.abs(variance) * itemCost(item);

      let severity: 'Critical' | 'High' | 'Medium' | 'Low';
      const absVariancePercent = Math.abs(variancePercent);
      if (absVariancePercent > 10) severity = 'Critical';
      else if (absVariancePercent > 5) severity = 'High';
      else if (absVariancePercent > 2) severity = 'Medium';
      else severity = 'Low';

      return {
        itemCode: item.code,
        itemName: item.name,
        expectedQuantity,
        actualQuantity,
        variance,
        variancePercent,
        varianceValue,
        severity,
      };
    });
  }

  /**
   * ABC Analysis: Classifies inventory by annual consumption value
   * A: 70% of value (tight control)
   * B: 20% of value (normal control)
   * C: 10% of value (loose control)
   */
  static getABCAnalysis(
    items: StockItem[],
    transactions: InventoryTransaction[]
  ): ABCAnalysisData[] {
    // Calculate annual consumption value per item
    const itemValues = items.map(item => {
      const itemTransactions = transactions.filter(
        t => t.stockItemId === item.id && transactionDirection(t) === 'OUT'
      );
      const annualConsumption = itemTransactions.reduce((sum, t) => sum + t.quantity, 0);
      const annualConsumptionValue = itemTransactions.reduce(
        (sum, transaction) => sum + transaction.quantity * Number(transaction.unitCost || itemCost(item)),
        0
      );

      return {
        itemCode: item.code,
        itemName: item.name,
        annualConsumptionValue,
        itemId: item.id,
      };
    });

    // Sort by annual consumption value (descending)
    const sorted = itemValues.sort((a, b) => b.annualConsumptionValue - a.annualConsumptionValue);

    // Calculate cumulative percentage
    const totalValue = sorted.reduce((sum, iv) => sum + iv.annualConsumptionValue, 0);
    let cumulativeValue = 0;

    return sorted.map(iv => {
      cumulativeValue += iv.annualConsumptionValue;
      const cumulativePercent = totalValue > 0 ? (cumulativeValue / totalValue) * 100 : 0;

      let category: 'A' | 'B' | 'C';
      let managementFocus: 'Tight Control' | 'Normal Control' | 'Loose Control';

      if (cumulativePercent <= 70) {
        category = 'A';
        managementFocus = 'Tight Control';
      } else if (cumulativePercent <= 90) {
        category = 'B';
        managementFocus = 'Normal Control';
      } else {
        category = 'C';
        managementFocus = 'Loose Control';
      }

      return {
        itemCode: iv.itemCode,
        itemName: iv.itemName,
        annualConsumptionValue: iv.annualConsumptionValue,
        cumulativePercent,
        category,
        managementFocus,
      };
    });
  }

  /**
   * Identifies items below reorder point
   */
  static getLowStockItems(items: StockItem[], levels: InventoryLevel[]) {
    return items
      .filter(item => {
        const level = levels.find(l => l.stockItemId === item.id);
        return !level || levelQuantity(level) < item.minStockLevel;
      })
      .map(item => {
        const level = levels.find(l => l.stockItemId === item.id);
        return {
          itemCode: item.code,
          itemName: item.name,
          currentQuantity: levelQuantity(level),
          minLevel: item.minStockLevel,
          deficit: item.minStockLevel - levelQuantity(level),
          reorderQuantity: item.reorderQuantity,
        };
      });
  }

  /**
   * Calculates carrying cost and inventory turnover metrics
   */
  static getInventoryMetrics(
    items: StockItem[],
    levels: InventoryLevel[],
    transactions: InventoryTransaction[],
    carryCostPercentage: number = 0.20 // 20% per annum
  ) {
    const totalInventoryValue = levels.reduce(
      (sum, level) => {
        const item = items.find(i => i.id === level.stockItemId);
        return sum + (levelQuantity(level) * itemCost(item));
      },
      0
    );

    const annualCarryingCost = totalInventoryValue * carryCostPercentage;

    // Inventory Turnover = Cost of Goods Sold / Average Inventory Value
    const totalOutbound = transactions
      .filter(t => transactionDirection(t) === 'OUT')
      .reduce((sum, t) => {
        const item = items.find(i => i.id === t.stockItemId);
        return sum + (t.quantity * Number(t.unitCost || itemCost(item)));
      }, 0);

    const inventoryTurnover = totalInventoryValue > 0 ? totalOutbound / totalInventoryValue : 0;
    const daysInventoryOutstanding = inventoryTurnover > 0 ? 365 / inventoryTurnover : 365;

    return {
      totalInventoryValue,
      annualCarryingCost,
      inventoryTurnover,
      daysInventoryOutstanding,
      itemCount: items.length,
      activeItems: items.filter(i => levels.find(l => l.stockItemId === i.id && levelQuantity(l) > 0)).length,
    };
  }
}
