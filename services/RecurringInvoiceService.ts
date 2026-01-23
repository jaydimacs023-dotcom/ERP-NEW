/**
 * RecurringInvoiceService
 * 
 * Handles all recurring invoice logic including:
 * - Scheduling recurring invoices based on frequency
 * - Auto-generating invoices from templates
 * - Managing execution history
 * - Calculating next run dates
 */

import { RecurringInvoice, RecurrenceFrequency, RecurringInvoiceLineItem } from '../types';

export interface RecurrenceSchedule {
  nextInvoiceDate: string;
  daysUntilRun: number;
  isOverdue: boolean;
  frequency: RecurrenceFrequency;
}

export class RecurringInvoiceService {
  /**
   * Calculate next invoice date based on frequency and current date
   */
  static calculateNextInvoiceDate(
    lastInvoiceDate: string | null,
    startDate: string,
    frequency: RecurrenceFrequency
  ): string {
    const refDate = lastInvoiceDate ? new Date(lastInvoiceDate) : new Date(startDate);
    const nextDate = new Date(refDate);

    switch (frequency) {
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'BIWEEKLY':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'QUARTERLY':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'SEMIANNUAL':
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;
      case 'ANNUAL':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    return nextDate.toISOString().split('T')[0];
  }

  /**
   * Check if recurring invoice is due to run
   */
  static isDueToRun(recurringInvoice: RecurringInvoice): boolean {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if past end date
    if (recurringInvoice.endDate && today > recurringInvoice.endDate) {
      return false;
    }
    
    // Check if paused or cancelled
    if (recurringInvoice.status !== 'ACTIVE') {
      return false;
    }
    
    return today >= recurringInvoice.nextInvoiceDate;
  }

  /**
   * Get schedule information for a recurring invoice
   */
  static getScheduleInfo(recurringInvoice: RecurringInvoice): RecurrenceSchedule {
    const today = new Date();
    const nextInvoiceDate = new Date(recurringInvoice.nextInvoiceDate);
    const daysUntilRun = Math.ceil((nextInvoiceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = this.isDueToRun(recurringInvoice);

    return {
      nextInvoiceDate: recurringInvoice.nextInvoiceDate,
      daysUntilRun,
      isOverdue,
      frequency: recurringInvoice.frequency
    };
  }

  /**
   * Check if recurring invoice should be completed
   */
  static isCompleted(recurringInvoice: RecurringInvoice): boolean {
    // Check if past end date
    if (recurringInvoice.endDate) {
      const today = new Date().toISOString().split('T')[0];
      if (today > recurringInvoice.endDate) {
        return true;
      }
    }

    return recurringInvoice.status === 'COMPLETED';
  }

  /**
   * Generate an invoice from recurring template
   */
  static generateInvoiceFromTemplate(
    recurringInvoice: RecurringInvoice,
    invoiceDate: string,
    generatedId: string
  ): { invoice: any; lines: any[] } {
    // Generate invoice reference with date
    const dateStr = invoiceDate.replace(/-/g, '');
    const reference = `REC-INV-${dateStr}-${generatedId.substring(0, 6).toUpperCase()}`;

    const invoice: any = {
      id: generatedId,
      orgId: recurringInvoice.orgId,
      customerId: recurringInvoice.customerId,
      invoiceNumber: reference,
      invoiceDate,
      dueDate: this.calculateDueDate(invoiceDate, recurringInvoice.paymentTermsDays || 30),
      amount: recurringInvoice.amount,
      currency: recurringInvoice.currency,
      description: recurringInvoice.description,
      status: 'DRAFT',
      recurringInvoiceId: recurringInvoice.id,
      arAccountId: recurringInvoice.arAccountId,
      revenueAccountId: recurringInvoice.revenueAccountId,
      createdAt: new Date().toISOString()
    };

    // Generate line items from template line items if available
    let lines: any[] = [];
    if (recurringInvoice.lineItems && recurringInvoice.lineItems.length > 0) {
      lines = recurringInvoice.lineItems.map((item, index) => ({
        id: `${generatedId}-line-${index}`,
        itemId: item.itemId,
        description: item.description || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxAmount: item.taxAmount || (item.quantity * item.unitPrice * 0.12), // 12% VAT
        lineTotal: item.quantity * item.unitPrice + (item.taxAmount || item.quantity * item.unitPrice * 0.12),
        accountId: recurringInvoice.revenueAccountId
      }));
    } else {
      // Fallback: single line item from template amount
      lines = [{
        description: recurringInvoice.description,
        amount: recurringInvoice.amount,
        accountId: recurringInvoice.revenueAccountId
      }];
    }

    return { invoice, lines };
  }

  /**
   * Calculate due date based on invoice date and payment terms
   */
  static calculateDueDate(invoiceDate: string, paymentTermsDays: number): string {
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + paymentTermsDays);
    return date.toISOString().split('T')[0];
  }

  /**
   * Update execution after running
   */
  static updateAfterExecution(
    recurringInvoice: RecurringInvoice,
    generatedInvoiceId: string
  ): Partial<RecurringInvoice> {
    const nextInvoiceDate = this.calculateNextInvoiceDate(
      new Date().toISOString().split('T')[0],
      recurringInvoice.startDate,
      recurringInvoice.frequency
    );

    const totalInvoicesGenerated = (recurringInvoice.totalInvoicesGenerated || 0) + 1;

    // Check if should be completed after this run
    let status = recurringInvoice.status;
    if (recurringInvoice.endDate && nextInvoiceDate > recurringInvoice.endDate) {
      status = 'COMPLETED';
    }

    return {
      lastInvoiceDate: new Date().toISOString().split('T')[0],
      nextInvoiceDate,
      totalInvoicesGenerated,
      status,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Create a new recurring invoice template
   */
  static createRecurringInvoiceTemplate(
    orgId: string,
    customerId: string,
    invoiceName: string,
    amount: number,
    frequency: RecurrenceFrequency,
    startDate: string,
    options?: {
      description?: string;
      currency?: string;
      endDate?: string;
      paymentTermsDays?: number;
      arAccountId?: string;
      revenueAccountId?: string;
      autoCreateReceivable?: boolean;
      createdBy?: string;
      notes?: string;
      lineItems?: RecurringInvoiceLineItem[];
    }
  ): Partial<RecurringInvoice> {
    const nextInvoiceDate = this.calculateNextInvoiceDate(null, startDate, frequency);

    return {
      id: `recurring-inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      orgId,
      customerId,
      invoiceName,
      description: options?.description || invoiceName,
      amount,
      currency: options?.currency,
      frequency,
      startDate,
      endDate: options?.endDate,
      nextInvoiceDate,
      status: 'ACTIVE',
      arAccountId: options?.arAccountId,
      revenueAccountId: options?.revenueAccountId,
      paymentTermsDays: options?.paymentTermsDays || 30,
      totalInvoicesGenerated: 0,
      autoCreateReceivable: options?.autoCreateReceivable ?? true,
      createdBy: options?.createdBy || 'system',
      createdAt: new Date().toISOString(),
      notes: options?.notes,
      lineItems: options?.lineItems
    };
  }

  /**
   * Get frequency display label
   */
  static getFrequencyLabel(frequency: RecurrenceFrequency): string {
    const labels: Record<RecurrenceFrequency, string> = {
      'WEEKLY': 'Weekly',
      'BIWEEKLY': 'Bi-Weekly',
      'MONTHLY': 'Monthly',
      'QUARTERLY': 'Quarterly',
      'SEMIANNUAL': 'Semi-Annual',
      'ANNUAL': 'Annual'
    };
    return labels[frequency] || frequency;
  }

  /**
   * Get status badge color
   */
  static getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'ACTIVE': 'bg-green-100 text-green-800',
      'PAUSED': 'bg-yellow-100 text-yellow-800',
      'COMPLETED': 'bg-blue-100 text-blue-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }
}
