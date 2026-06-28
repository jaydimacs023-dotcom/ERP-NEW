// services/InventoryService.ts
// Inventory management utility service with calculations for stock movements,
// valuations, adjustments, and reorder logic

import { 
  StockItem, InventoryLevel, InventoryTransaction, 
  InventoryTransactionType, InventoryValuationMethod,
  StockAdjustment, ReorderPoint 
} from '../types';

export class InventoryService {
  /**
   * Calculate available quantity across one or more warehouse levels.
   */
  static getAvailableQuantity(levels: InventoryLevel | InventoryLevel[]): number {
    const rows = Array.isArray(levels) ? levels : [levels];
    return rows.reduce((total, level) => {
      const storedAvailable = Number(level.quantityAvailable);
      const available = Number.isFinite(storedAvailable)
        ? storedAvailable
        : Number(level.quantityOnHand || 0) - Number(level.quantityReserved || 0);
      return total + available;
    }, 0);
  }

  /**
   * Generate next inventory transaction reference number
   * Format: INV-YYYY-MM-NNNN
   */
  static generateTransactionReference(type: InventoryTransactionType): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const sequence = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `${type.substring(0, 3)}-${year}-${month}-${sequence}`;
  }

  /**
   * Generate stock adjustment reference number
   * Format: ADJ-YYYY-MM-NNNN
   */
  static generateAdjustmentReference(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const sequence = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `ADJ-${year}-${month}-${sequence}`;
  }

  /**
   * Check if stock level is below minimum threshold
   */
  static isLowStock(availableQuantity: number, reorderLevel: number, safetyStock: number = 0): boolean {
    return availableQuantity <= Math.max(Number(reorderLevel || 0), Number(safetyStock || 0));
  }

  /**
   * Check if stock level exceeds maximum threshold
   */
  static isOverstocked(availableQuantity: number, maxLevel: number): boolean {
    return Number(maxLevel || 0) > 0 && availableQuantity > maxLevel;
  }

  /**
   * Calculate required reorder quantity based on current level
   */
  static calculateReorderQuantity(
    currentLevel: number,
    maxLevel: number,
    minLevel: number
  ): number {
    if (currentLevel >= maxLevel) return 0;
    if (currentLevel < minLevel) {
      return maxLevel - currentLevel;
    }
    return Math.max(0, maxLevel - currentLevel);
  }

  /**
   * Calculate weighted average cost
   * Cost = Total Cost of Units / Total Units
   */
  static calculateWeightedAverageCost(
    transactions: InventoryTransaction[]
  ): number {
    const purchases = transactions.filter(t => t.transactionType === 'PURCHASE');
    if (purchases.length === 0) return 0;

    const totalCost = purchases.reduce((sum, t) => sum + t.totalCost, 0);
    const totalQuantity = purchases.reduce((sum, t) => sum + t.quantity, 0);

    return totalQuantity > 0 ? totalCost / totalQuantity : 0;
  }

  /**
   * Calculate stock value based on valuation method
   */
  static calculateStockValue(
    quantity: number,
    unitCost: number,
    valuationMethod: InventoryValuationMethod
  ): number {
    return quantity * unitCost;
  }

  /**
   * Get valuation cost based on method
   * FIFO: First in, first out (oldest cost)
   * LIFO: Last in, first out (newest cost)
   * WEIGHTED_AVERAGE: Average cost of all units
   * STANDARD_COST: Predefined standard cost
   */
  static getValuationCost(
    transactions: InventoryTransaction[],
    method: InventoryValuationMethod,
    standardCost?: number
  ): number {
    if (transactions.length === 0) return standardCost || 0;

    const purchases = transactions.filter(t => t.transactionType === 'PURCHASE')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    switch (method) {
      case InventoryValuationMethod.FIFO:
        // Return cost of oldest purchase
        return purchases.length > 0 ? purchases[0].unitCost : 0;

      case InventoryValuationMethod.LIFO:
        // Return cost of newest purchase
        return purchases.length > 0 ? purchases[purchases.length - 1].unitCost : 0;

      case InventoryValuationMethod.WEIGHTED_AVERAGE:
        return this.calculateWeightedAverageCost(transactions);

      case InventoryValuationMethod.STANDARD_COST:
        return standardCost || 0;

      default:
        return 0;
    }
  }

  /**
   * Generate COGS (Cost of Goods Sold) entry for a sale
   * Returns: { cogsAmount, revenueAmount, balanceAmount }
   */
  static calculateCOGS(
    quantity: number,
    salePrice: number,
    unitCost: number
  ): { cogsAmount: number; revenueAmount: number; profitAmount: number } {
    const revenueAmount = quantity * salePrice;
    const cogsAmount = quantity * unitCost;
    const profitAmount = revenueAmount - cogsAmount;

    return { cogsAmount, revenueAmount, profitAmount };
  }

  /**
   * Validate stock adjustment (quantity change)
   * Returns: { isValid, errors }
   */
  static validateAdjustment(
    adjustment: Partial<StockAdjustment>,
    currentLevel: InventoryLevel
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!adjustment.quantityChange) {
      errors.push('Quantity change is required');
    }

    if (adjustment.quantityChange < 0) {
      if (Math.abs(adjustment.quantityChange) > currentLevel.quantityOnHand) {
        errors.push(`Cannot remove ${Math.abs(adjustment.quantityChange)} units. Only ${currentLevel.quantityOnHand} available.`);
      }
    }

    if (!adjustment.reason) {
      errors.push('Reason for adjustment is required');
    }

    if (!adjustment.warehouseLocationId) {
      errors.push('Warehouse location is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if stock movement is valid
   * Validates sufficient quantity for transfer/sale
   */
  static validateStockMovement(
    quantity: number,
    availableQuantity: number,
    transactionType: InventoryTransactionType
  ): { isValid: boolean; error?: string } {
    if (quantity <= 0) {
      return { isValid: false, error: 'Quantity must be greater than zero' };
    }

    if (['SALE', 'TRANSFER', 'RETURN'].includes(transactionType)) {
      if (quantity > availableQuantity) {
        return { 
          isValid: false, 
          error: `Insufficient stock. Available: ${availableQuantity}, Requested: ${quantity}` 
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Calculate shelf life warning for perishable items
   * Returns days until expiry
   */
  static calculateDaysUntilExpiry(
    receiveDate: Date,
    shelfLifeDays: number
  ): { daysRemaining: number; isExpired: boolean; isExpiringSoon: boolean } {
    const today = new Date();
    const expiryDate = new Date(receiveDate);
    expiryDate.setDate(expiryDate.getDate() + shelfLifeDays);

    const daysRemaining = Math.floor(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      daysRemaining: Math.max(0, daysRemaining),
      isExpired: daysRemaining < 0,
      isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 7
    };
  }

  /**
   * Create stock transaction record
   * Handles PURCHASE, SALE, ADJUSTMENT, TRANSFER, RETURN, DAMAGE, WRITEOFF
   */
  static createStockMovement(
    itemId: string,
    quantity: number,
    cost: number,
    type: InventoryTransactionType,
    fromLocation?: string,
    toLocation?: string
  ): Partial<InventoryTransaction> {
    return {
      stockItemId: itemId,
      transactionType: type,
      quantity: Math.abs(quantity),
      unitCost: Math.abs(cost),
      totalCost: Math.abs(quantity) * Math.abs(cost),
      fromLocationId: fromLocation,
      toLocationId: toLocation || fromLocation,
      referenceNumber: this.generateTransactionReference(type)
    };
  }

  /**
   * Calculate inventory holding cost
   * Annual holding cost = (Average Inventory * Unit Cost) * Holding Cost Rate
   * Typical holding cost rate: 20-30% per year
   */
  static calculateHoldingCost(
    averageQuantity: number,
    unitCost: number,
    holdingCostRate: number = 0.25 // 25% annual
  ): number {
    return averageQuantity * unitCost * holdingCostRate;
  }

  /**
   * Calculate EOQ (Economic Order Quantity)
   * EOQ = sqrt(2 * D * S / H)
   * D = Annual demand, S = Order cost, H = Holding cost per unit
   */
  static calculateEOQ(
    annualDemand: number,
    orderCost: number = 100, // per order
    holdingCostPerUnit: number = 5 // per unit per year
  ): number {
    const eqo = Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit);
    return Math.ceil(eqo);
  }

  /**
   * Get stock status badge for UI display
   */
  static getStockStatusBadge(
    availableQuantity: number,
    reorderLevel: number,
    safetyStock: number = 0,
    reorderQuantity: number = 0
  ): 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' {
    if (availableQuantity <= Number(safetyStock || 0)) return 'RED';
    if (availableQuantity <= Number(reorderLevel || 0)) return 'YELLOW';
    const overstockThreshold = Number(reorderLevel || 0) + (Number(reorderQuantity || 0) * 2);
    if (overstockThreshold > 0 && availableQuantity > overstockThreshold) return 'BLUE';
    return 'GREEN';
  }
}
