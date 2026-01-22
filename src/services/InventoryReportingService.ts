/**
 * InventoryReportingService
 * Advanced inventory analytics and reporting
 * Provides stock aging, valuation, movement trends, variance, and ABC analysis
 */

import { 
  StockItem, InventoryLevel, InventoryTransaction, 
  StockAdjustment, JournalEntryLine 
} from '../types';

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
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

      const lastMovement = itemTransactions.length > 0 
        ? itemTransactions[0].transactionDate 
        : item.createdAt;

      const daysInStock = Math.floor(
        (asOfTime - new Date(lastMovement).getTime()) / (1000 * 60 * 60 * 24)
      );

      const currentQuantity = level?.quantity || 0;
      const value = currentQuantity * item.costPrice;

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
      const quantity = level?.quantity || 0;

      // FIFO: Assumes oldest costs are consumed first
      // Current stock valued at most recent costs
      const itemTransactions = transactions
        .filter(t => t.stockItemId === item.id && t.type === 'IN')
        .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

      let fifoValue = 0;
      let remainingQty = quantity;
      for (let i = itemTransactions.length - 1; i >= 0 && remainingQty > 0; i--) {
        const txn = itemTransactions[i];
        const qtyFromTxn = Math.min(txn.quantity, remainingQty);
        // Approximate: use historical cost price (simplified)
        fifoValue += qtyFromTxn * item.costPrice;
        remainingQty -= qtyFromTxn;
      }

      // LIFO: Assumes newest costs are consumed first
      // Current stock valued at oldest costs
      let lifoValue = 0;
      remainingQty = quantity;
      for (let i = 0; i < itemTransactions.length && remainingQty > 0; i++) {
        const txn = itemTransactions[i];
        const qtyFromTxn = Math.min(txn.quantity, remainingQty);
        lifoValue += qtyFromTxn * item.costPrice;
        remainingQty -= qtyFromTxn;
      }

      // Weighted Average Cost
      const totalInboundQty = itemTransactions.reduce((sum, t) => sum + t.quantity, 0);
      const totalInboundValue = itemTransactions.reduce(
        (sum, t) => sum + (t.quantity * item.costPrice), 
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
        currentCostPrice: item.costPrice,
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
      const period = date.toISOString().slice(0, 7); // YYYY-MM
      periodMap[period] = { inbound: 0, outbound: 0 };
    }

    // Aggregate transactions by period
    transactions.forEach(txn => {
      const period = txn.transactionDate.slice(0, 7);
      if (periodMap[period]) {
        if (txn.type === 'IN') periodMap[period].inbound += txn.quantity;
        else if (txn.type === 'OUT') periodMap[period].outbound += txn.quantity;
      }
    });

    // Build trends per item
    items.forEach(item => {
      let runningBalance = 0;
      Object.entries(periodMap).forEach(([period, { inbound, outbound }]) => {
        const itemTxns = transactions.filter(
          t => t.stockItemId === item.id && t.transactionDate.startsWith(period)
        );
        
        const itemInbound = itemTxns.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.quantity, 0);
        const itemOutbound = itemTxns.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0);
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
    ledgerLines: JournalEntryLine[]
  ): VarianceData[] {
    return items.map(item => {
      const level = levels.find(l => l.stockItemId === item.id);
      const actualQuantity = level?.quantity || 0;

      // Expected quantity from GL ledger
      const itemLines = ledgerLines.filter(l => l.itemId === item.id);
      const expectedQuantity = itemLines.reduce((sum, l) => sum + ((l.debit || 0) - (l.credit || 0)), 0);

      const variance = actualQuantity - expectedQuantity;
      const variancePercent = expectedQuantity > 0 ? (variance / expectedQuantity) * 100 : 0;
      const varianceValue = Math.abs(variance) * item.costPrice;

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
        t => t.stockItemId === item.id && t.type === 'OUT'
      );
      const annualConsumption = itemTransactions.reduce((sum, t) => sum + t.quantity, 0);
      const annualConsumptionValue = annualConsumption * item.costPrice;

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
        return !level || level.quantity < item.minStockLevel;
      })
      .map(item => {
        const level = levels.find(l => l.stockItemId === item.id);
        return {
          itemCode: item.code,
          itemName: item.name,
          currentQuantity: level?.quantity || 0,
          minLevel: item.minStockLevel,
          deficit: item.minStockLevel - (level?.quantity || 0),
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
        return sum + ((level.quantity || 0) * (item?.costPrice || 0));
      },
      0
    );

    const annualCarryingCost = totalInventoryValue * carryCostPercentage;

    // Inventory Turnover = Cost of Goods Sold / Average Inventory Value
    const totalOutbound = transactions
      .filter(t => t.type === 'OUT')
      .reduce((sum, t) => {
        const item = items.find(i => i.id === t.stockItemId);
        return sum + (t.quantity * (item?.costPrice || 0));
      }, 0);

    const inventoryTurnover = totalInventoryValue > 0 ? totalOutbound / totalInventoryValue : 0;
    const daysInventoryOutstanding = inventoryTurnover > 0 ? 365 / inventoryTurnover : 365;

    return {
      totalInventoryValue,
      annualCarryingCost,
      inventoryTurnover,
      daysInventoryOutstanding,
      itemCount: items.length,
      activeItems: items.filter(i => levels.find(l => l.stockItemId === i.id && l.quantity > 0)).length,
    };
  }
}
