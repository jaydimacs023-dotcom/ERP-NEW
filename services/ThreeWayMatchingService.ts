/**
 * Three-Way Matching Service
 * 
 * Validates the matching of three critical documents in procurement:
 * 1. Purchase Order (PO) - What we ordered
 * 2. Goods Receipt (GR) - What we received
 * 3. Payable/Invoice - What we're being billed for
 * 
 * Identifies discrepancies in quantity, price, dates, and amounts
 */

import {
  PurchaseOrder,
  PurchaseOrderLine,
  GoodsReceipt,
  GoodsReceiptLine,
  Payable,
  ChartOfAccount,
  Vendor
} from '../types';

export enum MatchingStatus {
  FULLY_MATCHED = 'fully_matched',           // PO ↔ GR ↔ Invoice all aligned
  PARTIALLY_MATCHED = 'partially_matched',   // Some discrepancies but within tolerance
  UNMATCHED = 'unmatched',                   // Major discrepancies, needs investigation
  NO_GR = 'no_gr',                           // Invoice received but no GR
  NO_INVOICE = 'no_invoice',                 // GR received but no invoice yet
  NO_PO = 'no_po'                            // Invoice without PO (non-PO purchase)
}

export enum DiscrepancyType {
  QUANTITY_VARIANCE = 'quantity_variance',   // QR qty ≠ GR qty or GR qty ≠ Invoice qty
  PRICE_VARIANCE = 'price_variance',         // Unit price mismatch
  AMOUNT_VARIANCE = 'amount_variance',       // Total amount mismatch >tolerance
  DATE_VARIANCE = 'date_variance',           // Invoice date after GR + X days
  MISSING_DOCUMENT = 'missing_document',     // PO/GR/Invoice missing
  ITEM_MISMATCH = 'item_mismatch'            // Different items ordered vs received
}

export interface DiscrepancyDetail {
  type: DiscrepancyType;
  severity: 'critical' | 'major' | 'minor'; // Critical blocks payment, major needs approval, minor is informational
  field: string;                             // e.g., 'quantity', 'unitPrice', 'invoiceDate'
  poValue?: string | number;                 // PO value
  grValue?: string | number;                 // GR value
  invoiceValue?: string | number;            // Invoice value
  message: string;                           // Human readable description
  variance?: number;                         // Percentage or absolute variance
  tolerance?: number;                        // Allowed tolerance
  canAutoResolve?: boolean;                  // Can system auto-resolve (e.g., rounding)
}

export interface LineItemMatch {
  poLine?: PurchaseOrderLine;
  grLine?: GoodsReceiptLine;
  invoiceLineNumber?: number;
  invoiceLineAmount?: number;
  matchingStatus: MatchingStatus;
  discrepancies: DiscrepancyDetail[];
}

export interface ThreeWayMatchResult {
  // Document References
  poNumber: string;
  grNumber?: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;

  // Overall Status
  matchingStatus: MatchingStatus;
  overallDiscrepancies: DiscrepancyDetail[];
  
  // Line-by-line matching
  lineMatches: LineItemMatch[];
  
  // Summary Metrics
  totalPOAmount: number;
  totalGRAmount: number;
  totalInvoiceAmount: number;
  
  // Can this invoice be paid?
  canProceedToPayment: boolean;
  blockers: DiscrepancyDetail[]; // Critical issues
  warnings: DiscrepancyDetail[]; // Major issues requiring approval
  info: DiscrepancyDetail[];      // Minor issues
  
  // Audit Trail
  checkedAt: string;
  checkedBy?: string;
}

export class ThreeWayMatchingService {
  /**
   * Main matching function - performs complete 3-way validation
   */
  static performThreeWayMatch(
    po: PurchaseOrder | null,
    gr: GoodsReceipt | null,
    invoice: Payable,
    grLines: GoodsReceiptLine[] = [],
    poLines: PurchaseOrderLine[] = [],
    vendor?: Vendor
  ): ThreeWayMatchResult {
    const result: ThreeWayMatchResult = {
      poNumber: po?.reference || 'N/A',
      grNumber: gr?.grNumber,
      invoiceNumber: invoice.payableNumber,
      vendorId: invoice.vendorId,
      vendorName: vendor?.name || 'Unknown',
      matchingStatus: MatchingStatus.UNMATCHED,
      overallDiscrepancies: [],
      lineMatches: [],
      totalPOAmount: po?.totalAmount || 0,
      totalGRAmount: gr?.totalAmount || 0,
      totalInvoiceAmount: invoice.amount,
      canProceedToPayment: false,
      blockers: [],
      warnings: [],
      info: [],
      checkedAt: new Date().toISOString()
    };

    // Step 1: Check document availability
    if (!po) {
      result.matchingStatus = MatchingStatus.NO_PO;
      result.blockers.push({
        type: DiscrepancyType.MISSING_DOCUMENT,
        severity: 'major',
        field: 'purchase_order',
        message: 'No Purchase Order found for this invoice. Non-PO purchase?',
        canAutoResolve: false
      });
    }

    if (!gr) {
      result.matchingStatus = MatchingStatus.NO_GR;
      result.blockers.push({
        type: DiscrepancyType.MISSING_DOCUMENT,
        severity: 'major',
        field: 'goods_receipt',
        message: 'No Goods Receipt found. Invoice received before goods?',
        canAutoResolve: false
      });
    }

    // Step 2: If we have all three documents, perform matching
    if (po && gr && poLines.length > 0 && grLines.length > 0) {
      this.matchLineItems(po, gr, invoice, poLines, grLines, result);
      this.validateAmounts(po, gr, invoice, result);
      this.validateDates(po, gr, invoice, result);
      this.determineOverallStatus(result);
    }

    // Step 3: Classify discrepancies by severity
    this.classifyDiscrepancies(result);

    // Step 4: Determine if payment can proceed
    result.canProceedToPayment = result.blockers.length === 0;

    return result;
  }

  /**
   * Match PO lines with GR lines with invoice line items
   */
  private static matchLineItems(
    po: PurchaseOrder,
    gr: GoodsReceipt,
    invoice: Payable,
    poLines: PurchaseOrderLine[],
    grLines: GoodsReceiptLine[],
    result: ThreeWayMatchResult
  ): void {
    // Build invoice lines from payable (simple reference for now)
    const invoiceLineCount = invoice.amount > 0 ? 1 : 0; // Simplified - normally would parse line items

    for (const poLine of poLines) {
      const grLine = grLines.find(l => l.purchaseOrderLineId === poLine.id);
      
      const lineMatch: LineItemMatch = {
        poLine,
        grLine,
        invoiceLineNumber: 1,
        invoiceLineAmount: invoice.amount,
        matchingStatus: MatchingStatus.UNMATCHED,
        discrepancies: []
      };

      // Check quantity match: PO qty should equal GR qty
      if (grLine) {
        if (poLine.qty !== grLine.quantity) {
          const variance = ((grLine.quantity - poLine.qty) / poLine.qty) * 100;
          lineMatch.discrepancies.push({
            type: DiscrepancyType.QUANTITY_VARIANCE,
            severity: Math.abs(variance) > 5 ? 'major' : 'minor',
            field: 'quantity',
            poValue: poLine.qty,
            grValue: grLine.quantity,
            message: `Quantity variance: PO qty=${poLine.qty}, GR qty=${grLine.quantity}`,
            variance: variance,
            tolerance: 5 // 5% tolerance
          });
        }

        // Check unit price: GR unit cost should match PO unit price
        if (poLine.unitPrice !== grLine.unitCost) {
          const variance = ((grLine.unitCost - poLine.unitPrice) / poLine.unitPrice) * 100;
          lineMatch.discrepancies.push({
            type: DiscrepancyType.PRICE_VARIANCE,
            severity: Math.abs(variance) > 3 ? 'major' : 'minor',
            field: 'unitPrice',
            poValue: poLine.unitPrice,
            grValue: grLine.unitCost,
            message: `Price variance: PO price=${poLine.unitPrice}, GR cost=${grLine.unitCost}`,
            variance: variance,
            tolerance: 3 // 3% tolerance
          });
        }

        // If quantities and prices match, line is matched
        if (lineMatch.discrepancies.length === 0) {
          lineMatch.matchingStatus = MatchingStatus.FULLY_MATCHED;
        } else if (lineMatch.discrepancies.every(d => d.severity === 'minor')) {
          lineMatch.matchingStatus = MatchingStatus.PARTIALLY_MATCHED;
        }
      } else {
        lineMatch.matchingStatus = MatchingStatus.NO_GR;
        lineMatch.discrepancies.push({
          type: DiscrepancyType.MISSING_DOCUMENT,
          severity: 'major',
          field: 'goods_receipt',
          poValue: poLine.qty,
          message: `PO line not found in GR. Expected ${poLine.qty} units of ${poLine.description}`,
          canAutoResolve: false
        });
      }

      result.lineMatches.push(lineMatch);
    }

    // Check for GR lines not in PO
    for (const grLine of grLines) {
      if (!poLines.find(l => l.id === grLine.purchaseOrderLineId)) {
        result.warnings.push({
          type: DiscrepancyType.ITEM_MISMATCH,
          severity: 'major',
          field: 'po_line_reference',
          grValue: grLine.quantity,
          message: `GR line not found in PO: ${grLine.description} (qty=${grLine.quantity})`,
          canAutoResolve: false
        });
      }
    }
  }

  /**
   * Validate total amounts: PO total ≈ GR total ≈ Invoice total
   */
  private static validateAmounts(
    po: PurchaseOrder,
    gr: GoodsReceipt,
    invoice: Payable,
    result: ThreeWayMatchResult
  ): void {
    const AMOUNT_TOLERANCE = 0.01; // 1 cent tolerance for rounding

    // PO vs GR amount
    const poGrVariance = Math.abs(po.totalAmount - gr.totalAmount);
    if (poGrVariance > AMOUNT_TOLERANCE) {
      const variance = (poGrVariance / po.totalAmount) * 100;
      result.overallDiscrepancies.push({
        type: DiscrepancyType.AMOUNT_VARIANCE,
        severity: variance > 5 ? 'critical' : 'major',
        field: 'total_amount_po_vs_gr',
        poValue: po.totalAmount,
        grValue: gr.totalAmount,
        message: `Total amount mismatch between PO and GR: PO=${po.totalAmount}, GR=${gr.totalAmount}`,
        variance: variance,
        tolerance: 5
      });
    }

    // GR vs Invoice amount
    const grInvoiceVariance = Math.abs(gr.totalAmount - invoice.amount);
    if (grInvoiceVariance > AMOUNT_TOLERANCE) {
      const variance = (grInvoiceVariance / gr.totalAmount) * 100;
      result.overallDiscrepancies.push({
        type: DiscrepancyType.AMOUNT_VARIANCE,
        severity: variance > 5 ? 'critical' : 'major',
        field: 'total_amount_gr_vs_invoice',
        grValue: gr.totalAmount,
        invoiceValue: invoice.amount,
        message: `Total amount mismatch between GR and Invoice: GR=${gr.totalAmount}, Invoice=${invoice.amount}`,
        variance: variance,
        tolerance: 5
      });
    }

    // PO vs Invoice amount
    const poInvoiceVariance = Math.abs(po.totalAmount - invoice.amount);
    if (poInvoiceVariance > AMOUNT_TOLERANCE) {
      const variance = (poInvoiceVariance / po.totalAmount) * 100;
      result.overallDiscrepancies.push({
        type: DiscrepancyType.AMOUNT_VARIANCE,
        severity: variance > 5 ? 'critical' : 'major',
        field: 'total_amount_po_vs_invoice',
        poValue: po.totalAmount,
        invoiceValue: invoice.amount,
        message: `Total amount mismatch between PO and Invoice: PO=${po.totalAmount}, Invoice=${invoice.amount}`,
        variance: variance,
        tolerance: 5
      });
    }
  }

  /**
   * Validate dates: GR date should be <= PO date, Invoice date should be ~= GR date (within X days)
   */
  private static validateDates(
    po: PurchaseOrder,
    gr: GoodsReceipt,
    invoice: Payable,
    result: ThreeWayMatchResult
  ): void {
    const INVOICE_DELAY_DAYS = 7; // Invoice should arrive within 7 days of GR

    const poDate = new Date(po.date);
    const grDate = new Date(gr.receiptDate);
    const invoiceDate = new Date(invoice.billDate);

    // GR date should not be before PO date
    if (grDate < poDate) {
      result.warnings.push({
        type: DiscrepancyType.DATE_VARIANCE,
        severity: 'minor',
        field: 'gr_date_before_po',
        poValue: po.date,
        grValue: gr.receiptDate,
        message: `GR date (${gr.receiptDate}) is before PO date (${po.date}). Possible data entry error?`,
        canAutoResolve: false
      });
    }

    // Invoice date should be within X days of GR date
    const daysDifference = Math.floor((invoiceDate.getTime() - grDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDifference > INVOICE_DELAY_DAYS) {
      result.info.push({
        type: DiscrepancyType.DATE_VARIANCE,
        severity: 'minor',
        field: 'invoice_date_delay',
        grValue: gr.receiptDate,
        invoiceValue: invoice.billDate,
        message: `Invoice received ${daysDifference} days after GR (expected within ${INVOICE_DELAY_DAYS} days)`,
        variance: daysDifference,
        tolerance: INVOICE_DELAY_DAYS
      });
    }

    if (daysDifference < 0) {
      result.blockers.push({
        type: DiscrepancyType.DATE_VARIANCE,
        severity: 'critical',
        field: 'invoice_date_before_gr',
        grValue: gr.receiptDate,
        invoiceValue: invoice.billDate,
        message: `Invoice date (${invoice.billDate}) is before GR date (${gr.receiptDate}). Invoice cannot precede goods receipt!`,
        canAutoResolve: false
      });
    }
  }

  /**
   * Determine overall matching status based on line matches
   */
  private static determineOverallStatus(result: ThreeWayMatchResult): void {
    if (result.lineMatches.length === 0) {
      result.matchingStatus = MatchingStatus.UNMATCHED;
      return;
    }

    const fullyMatched = result.lineMatches.filter(m => m.matchingStatus === MatchingStatus.FULLY_MATCHED).length;
    const partiallyMatched = result.lineMatches.filter(m => m.matchingStatus === MatchingStatus.PARTIALLY_MATCHED).length;

    if (fullyMatched === result.lineMatches.length) {
      result.matchingStatus = MatchingStatus.FULLY_MATCHED;
    } else if (fullyMatched + partiallyMatched >= result.lineMatches.length) {
      result.matchingStatus = MatchingStatus.PARTIALLY_MATCHED;
    } else {
      result.matchingStatus = MatchingStatus.UNMATCHED;
    }
  }

  /**
   * Classify all discrepancies by severity into blockers/warnings/info
   */
  private static classifyDiscrepancies(result: ThreeWayMatchResult): void {
    for (const lineMatch of result.lineMatches) {
      for (const discrepancy of lineMatch.discrepancies) {
        if (discrepancy.severity === 'critical') {
          result.blockers.push(discrepancy);
        } else if (discrepancy.severity === 'major') {
          result.warnings.push(discrepancy);
        } else {
          result.info.push(discrepancy);
        }
      }
    }

    for (const discrepancy of result.overallDiscrepancies) {
      if (discrepancy.severity === 'critical') {
        result.blockers.push(discrepancy);
      } else if (discrepancy.severity === 'major') {
        result.warnings.push(discrepancy);
      } else {
        result.info.push(discrepancy);
      }
    }
  }

  /**
   * Get matching status color for UI display
   */
  static getStatusColor(status: MatchingStatus): string {
    switch (status) {
      case MatchingStatus.FULLY_MATCHED:
        return 'text-green-600 bg-green-50';
      case MatchingStatus.PARTIALLY_MATCHED:
        return 'text-amber-600 bg-amber-50';
      case MatchingStatus.NO_GR:
      case MatchingStatus.NO_INVOICE:
      case MatchingStatus.NO_PO:
        return 'text-blue-600 bg-blue-50';
      case MatchingStatus.UNMATCHED:
      default:
        return 'text-red-600 bg-red-50';
    }
  }

  /**
   * Get human-readable status label
   */
  static getStatusLabel(status: MatchingStatus): string {
    switch (status) {
      case MatchingStatus.FULLY_MATCHED:
        return '✓ Fully Matched';
      case MatchingStatus.PARTIALLY_MATCHED:
        return '⚠ Partially Matched';
      case MatchingStatus.NO_GR:
        return '○ No Goods Receipt';
      case MatchingStatus.NO_INVOICE:
        return '○ No Invoice';
      case MatchingStatus.NO_PO:
        return '○ No Purchase Order';
      case MatchingStatus.UNMATCHED:
        return '✗ Unmatched';
    }
  }

  /**
   * Generate summary statistics for UI dashboard
   */
  static getSummaryStats(matchResults: ThreeWayMatchResult[]): {
    totalInvoices: number;
    fullyMatched: number;
    partiallyMatched: number;
    unmatched: number;
    blockedAmount: number;
    warningAmount: number;
    approvedAmount: number;
  } {
    return {
      totalInvoices: matchResults.length,
      fullyMatched: matchResults.filter(r => r.matchingStatus === MatchingStatus.FULLY_MATCHED).length,
      partiallyMatched: matchResults.filter(r => r.matchingStatus === MatchingStatus.PARTIALLY_MATCHED).length,
      unmatched: matchResults.filter(r => r.matchingStatus === MatchingStatus.UNMATCHED).length,
      blockedAmount: matchResults.filter(r => r.blockers.length > 0).reduce((sum, r) => sum + r.totalInvoiceAmount, 0),
      warningAmount: matchResults.filter(r => r.blockers.length === 0 && r.warnings.length > 0).reduce((sum, r) => sum + r.totalInvoiceAmount, 0),
      approvedAmount: matchResults.filter(r => r.canProceedToPayment && r.warnings.length === 0).reduce((sum, r) => sum + r.totalInvoiceAmount, 0)
    };
  }
}
