/**
 * DataExportService.ts
 * Utility service for exporting data to CSV format
 * Provides consistent CSV export across all views
 */

export interface ExportOptions {
  filename: string;
  headers: string[];
  data: any[];
  formatters?: Record<string, (value: any) => string>;
}

export class DataExportService {
  /**
   * Escape CSV field values (handle quotes, commas, newlines)
   */
  private static escapeCsvField(field: any): string {
    const value = String(field ?? '');
    
    // If field contains special characters, wrap in quotes and escape internal quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    
    return value;
  }

  /**
   * Convert array of objects to CSV content
   */
  static objectsToCsv(data: any[], headers: string[], headerLabels?: string[]): string {
    if (data.length === 0) {
      return '';
    }

    // Build header row
    const headerRow = (headerLabels || headers).map(h => this.escapeCsvField(h)).join(',');
    
    // Build data rows
    const dataRows = data.map(obj => {
      return headers.map(header => {
        const value = obj[header];
        return this.escapeCsvField(value);
      }).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
  }

  /**
   * Export data to CSV file
   */
  static downloadCsv(options: ExportOptions): void {
    const { filename, headers, data, formatters } = options;

    // Apply formatters if provided
    const formattedData = data.map(row => {
      const formattedRow: any = { ...row };
      Object.entries(formatters || {}).forEach(([field, formatter]) => {
        if (formattedRow.hasOwnProperty(field)) {
          formattedRow[field] = formatter(formattedRow[field]);
        }
      });
      return formattedRow;
    });

    // Generate CSV content
    const csvContent = this.objectsToCsv(formattedData, headers);
    const csvWithBOM = '\uFEFF' + csvContent; // Add BOM for Excel UTF-8 compatibility

    // Create blob and download
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export inventory items to CSV
   */
  static exportInventoryItems(items: any[], currency: string = 'USD'): void {
    const timestamp = new Date().toISOString().split('T')[0];
    
    this.downloadCsv({
      filename: `Inventory_Items_${timestamp}.csv`,
      headers: ['id', 'name', 'sku', 'category', 'unitCost', 'reorderPoint', 'safetyStock'],
      headerLabels: ['ID', 'Item Name', 'SKU', 'Category', `Unit Cost (${currency})`, 'Reorder Point', 'Safety Stock'],
      data: items,
      formatters: {
        unitCost: (val) => (val ?? 0).toFixed(2),
        reorderPoint: (val) => (val ?? 0).toString(),
        safetyStock: (val) => (val ?? 0).toString(),
      }
    });
  }

  /**
   * Export stock levels to CSV
   */
  static exportStockLevels(levels: any[], currency: string = 'USD'): void {
    const timestamp = new Date().toISOString().split('T')[0];
    
    this.downloadCsv({
      filename: `Stock_Levels_${timestamp}.csv`,
      headers: ['itemId', 'warehouseId', 'quantity', 'reservedQuantity', 'availableQuantity', 'lastUpdated'],
      headerLabels: ['Item ID', 'Warehouse ID', 'On Hand', 'Reserved', 'Available', 'Last Updated'],
      data: levels,
      formatters: {
        quantity: (val) => (val ?? 0).toString(),
        reservedQuantity: (val) => (val ?? 0).toString(),
        availableQuantity: (val) => (val ?? 0).toString(),
        lastUpdated: (val) => val ? new Date(val).toLocaleDateString() : 'N/A',
      }
    });
  }

  /**
   * Export stock adjustments to CSV
   */
  static exportStockAdjustments(adjustments: any[], currency: string = 'USD'): void {
    const timestamp = new Date().toISOString().split('T')[0];
    
    this.downloadCsv({
      filename: `Stock_Adjustments_${timestamp}.csv`,
      headers: ['id', 'referenceNumber', 'itemName', 'warehouseId', 'quantityChange', 'reason', 'status', 'approvedAt'],
      headerLabels: ['ID', 'Reference #', 'Item Name', 'Warehouse', 'Qty Change', 'Reason', 'Status', 'Approved Date'],
      data: adjustments,
      formatters: {
        quantityChange: (val) => (val ?? 0).toString(),
        approvedAt: (val) => val ? new Date(val).toLocaleDateString() : 'Pending',
      }
    });
  }

  /**
   * Export inventory transactions to CSV
   */
  static exportInventoryTransactions(transactions: any[], currency: string = 'USD'): void {
    const timestamp = new Date().toISOString().split('T')[0];
    
    this.downloadCsv({
      filename: `Inventory_Transactions_${timestamp}.csv`,
      headers: ['id', 'itemId', 'type', 'quantity', 'fromWarehouse', 'toWarehouse', 'date', 'reference'],
      headerLabels: ['ID', 'Item ID', 'Type', 'Quantity', 'From Warehouse', 'To Warehouse', 'Date', 'Reference'],
      data: transactions,
      formatters: {
        quantity: (val) => (val ?? 0).toString(),
        date: (val) => val ? new Date(val).toLocaleDateString() : 'N/A',
      }
    });
  }

  /**
   * Export aging report to CSV
   */
  static exportAgingReport(items: any[]): void {
    const timestamp = new Date().toISOString().split('T')[0];
    
    this.downloadCsv({
      filename: `Stock_Aging_Report_${timestamp}.csv`,
      headers: ['itemName', 'category', 'daysSinceMovement', 'agingCategory', 'quantity', 'value'],
      headerLabels: ['Item', 'Category', 'Days Since Movement', 'Aging Category', 'Quantity', 'Value'],
      data: items,
      formatters: {
        daysSinceMovement: (val) => (val ?? 0).toString(),
        quantity: (val) => (val ?? 0).toString(),
        value: (val) => (val ?? 0).toFixed(2),
      }
    });
  }

  /**
   * Export ABC analysis to CSV
   */
  static exportABCAnalysis(items: any[]): void {
    const timestamp = new Date().toISOString().split('T')[0];
    
    this.downloadCsv({
      filename: `ABC_Analysis_${timestamp}.csv`,
      headers: ['itemName', 'classification', 'annualValue', 'quantity', 'valuePercentage', 'priority'],
      headerLabels: ['Item', 'Classification (A/B/C)', 'Annual Value', 'Quantity', 'Value %', 'Priority'],
      data: items,
      formatters: {
        annualValue: (val) => (val ?? 0).toFixed(2),
        quantity: (val) => (val ?? 0).toString(),
        valuePercentage: (val) => ((val ?? 0) * 100).toFixed(2) + '%',
      }
    });
  }

  /**
   * Export valuation comparison to CSV
   */
  static exportValuationComparison(items: any[]): void {
    const timestamp = new Date().toISOString().split('T')[0];
    
    this.downloadCsv({
      filename: `Valuation_Comparison_${timestamp}.csv`,
      headers: ['itemName', 'quantity', 'fifoValue', 'lifoValue', 'wacValue', 'variance'],
      headerLabels: ['Item', 'Quantity', 'FIFO Value', 'LIFO Value', 'WAC Value', 'Variance (FIFO-LIFO)'],
      data: items,
      formatters: {
        quantity: (val) => (val ?? 0).toString(),
        fifoValue: (val) => (val ?? 0).toFixed(2),
        lifoValue: (val) => (val ?? 0).toFixed(2),
        wacValue: (val) => (val ?? 0).toFixed(2),
        variance: (val) => (val ?? 0).toFixed(2),
      }
    });
  }

  /**
   * Export movement trends to CSV
   */
  static exportMovementTrends(trends: any[]): void {
    const timestamp = new Date().toISOString().split('T')[0];
    
    this.downloadCsv({
      filename: `Movement_Trends_${timestamp}.csv`,
      headers: ['itemName', 'period', 'quantity', 'value', 'trend'],
      headerLabels: ['Item', 'Period', 'Quantity', 'Value', 'Trend'],
      data: trends,
      formatters: {
        quantity: (val) => (val ?? 0).toString(),
        value: (val) => (val ?? 0).toFixed(2),
      }
    });
  }

  /**
   * Export variance analysis to CSV
   */
  static exportVarianceAnalysis(items: any[]): void {
    const timestamp = new Date().toISOString().split('T')[0];
    
    this.downloadCsv({
      filename: `Variance_Analysis_${timestamp}.csv`,
      headers: ['itemName', 'expectedQuantity', 'actualQuantity', 'variance', 'variancePercent'],
      headerLabels: ['Item', 'Expected Qty', 'Actual Qty', 'Variance', 'Variance %'],
      data: items,
      formatters: {
        expectedQuantity: (val) => (val ?? 0).toString(),
        actualQuantity: (val) => (val ?? 0).toString(),
        variance: (val) => (val ?? 0).toString(),
        variancePercent: (val) => ((val ?? 0) * 100).toFixed(2) + '%',
      }
    });
  }

  /**
   * Export generic table data to CSV
   */
  static exportTableData(
    tableName: string,
    data: any[],
    headers: string[],
    headerLabels?: string[]
  ): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${tableName}_${timestamp}.csv`;
    
    this.downloadCsv({
      filename,
      headers,
      headerLabels: headerLabels || headers,
      data
    });
  }
}
