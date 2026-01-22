import {
  RecurringBill,
  RecurringBillHistory,
  RecurrenceFrequency,
  Payable,
  PayableStatus
} from '../types';

/**
 * RecurringBillService
 * Handles scheduling, generation, and management of recurring bills/subscriptions
 */
export class RecurringBillService {
  /**
   * Calculate next bill date based on frequency and current date
   */
  static calculateNextBillDate(
    currentDate: Date,
    frequency: RecurrenceFrequency,
    billDayOfMonth?: number
  ): Date {
    const next = new Date(currentDate);

    switch (frequency) {
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;

      case 'BIWEEKLY':
        next.setDate(next.getDate() + 14);
        break;

      case 'MONTHLY':
        if (billDayOfMonth) {
          // If specified day of month, use that
          const targetDay = billDayOfMonth;
          next.setMonth(next.getMonth() + 1);
          next.setDate(targetDay);
          // Handle month-end dates (e.g., Feb 30 → Feb 28)
          if (next.getDate() !== targetDay) {
            next.setDate(0);
          }
        } else {
          next.setMonth(next.getMonth() + 1);
        }
        break;

      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;

      case 'SEMIANNUAL':
        next.setMonth(next.getMonth() + 6);
        break;

      case 'ANNUAL':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next;
  }

  /**
   * Generate payable from recurring bill
   */
  static generatePayableFromRecurringBill(
    recurringBill: RecurringBill,
    vendorName: string,
    userId: string
  ): Partial<Payable> {
    const now = new Date();
    const dueDate = new Date(recurringBill.nextBillDate);
    if (recurringBill.paymentTermsDays) {
      dueDate.setDate(dueDate.getDate() + recurringBill.paymentTermsDays);
    }

    return {
      orgId: recurringBill.orgId,
      vendorId: recurringBill.vendorId,
      payableNumber: `REC-${recurringBill.billName}-${now.getTime()}`,
      category: recurringBill.category || 'OTHER_EXPENSES',
      description: recurringBill.description || recurringBill.billName,
      amount: this.calculatePayableAmount(
        recurringBill.amount,
        recurringBill.appliedRatePercent || 0,
        recurringBill.includeWithholding || false
      ),
      billDate: recurringBill.nextBillDate,
      dueDate: dueDate.toISOString().split('T')[0],
      currency: recurringBill.currency || 'USD',
      status: 'pending' as PayableStatus,
      glAccountId: recurringBill.glAccountId,
      expenseAccountId: recurringBill.expenseAccountId,
      departmentId: recurringBill.departmentId,
      costCenterId: recurringBill.costCenterId,
      withholdingType: recurringBill.withholdingType,
      atcItemId: recurringBill.atcItemId,
      atcRateId: recurringBill.atcRateId,
      appliedRatePercent: recurringBill.appliedRatePercent,
      createdBy: userId,
      createdAt: now.toISOString()
    };
  }

  /**
   * Calculate payable amount with withholding if applicable
   */
  static calculatePayableAmount(
    baseAmount: number,
    withholdingPercent: number = 0,
    includeWithholding: boolean = false
  ): number {
    if (!includeWithholding || withholdingPercent === 0) {
      return baseAmount;
    }
    const withholdingAmount = (baseAmount * withholdingPercent) / 100;
    return baseAmount - withholdingAmount;
  }

  /**
   * Calculate withholding amount
   */
  static calculateWithholdingAmount(
    baseAmount: number,
    withholdingPercent: number
  ): number {
    return (baseAmount * withholdingPercent) / 100;
  }

  /**
   * Check which recurring bills are due today/overdue
   */
  static getDueBills(
    recurringBills: RecurringBill[],
    currentDate: Date = new Date()
  ): RecurringBill[] {
    return recurringBills.filter(bill => {
      if (bill.status !== 'ACTIVE') return false;
      const nextBillDate = new Date(bill.nextBillDate);
      return nextBillDate <= currentDate;
    });
  }

  /**
   * Get upcoming bills in next N days
   */
  static getUpcomingBills(
    recurringBills: RecurringBill[],
    daysAhead: number = 30,
    currentDate: Date = new Date()
  ): RecurringBill[] {
    const futureDate = new Date(currentDate);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return recurringBills.filter(bill => {
      if (bill.status !== 'ACTIVE') return false;
      const nextBillDate = new Date(bill.nextBillDate);
      return nextBillDate > currentDate && nextBillDate <= futureDate;
    });
  }

  /**
   * Get summary statistics for recurring bills
   */
  static getSummaryStats(recurringBills: RecurringBill[]) {
    const activeBills = recurringBills.filter(b => b.status === 'ACTIVE');
    const pausedBills = recurringBills.filter(b => b.status === 'PAUSED');
    const completedBills = recurringBills.filter(b => b.status === 'COMPLETED');
    const cancelledBills = recurringBills.filter(b => b.status === 'CANCELLED');

    const totalMonthlyAmount = activeBills
      .filter(b => b.frequency === 'MONTHLY')
      .reduce((sum, b) => sum + b.amount, 0);

    const totalAnnualAmount = activeBills.reduce((sum, b) => {
      const multiplier = this.getAnnualMultiplier(b.frequency);
      return sum + (b.amount * multiplier);
    }, 0);

    const due30Days = this.getDueBills(activeBills);
    const upcoming30Days = this.getUpcomingBills(activeBills, 30);

    return {
      totalRecurringBills: recurringBills.length,
      activeBills: activeBills.length,
      pausedBills: pausedBills.length,
      completedBills: completedBills.length,
      cancelledBills: cancelledBills.length,
      totalMonthlyAmount,
      totalAnnualAmount,
      dueBillsCount: due30Days.length,
      upcomingBillsCount: upcoming30Days.length
    };
  }

  /**
   * Get annual multiplier for frequency
   */
  static getAnnualMultiplier(frequency: RecurrenceFrequency): number {
    const multipliers: Record<RecurrenceFrequency, number> = {
      WEEKLY: 52,
      BIWEEKLY: 26,
      MONTHLY: 12,
      QUARTERLY: 4,
      SEMIANNUAL: 2,
      ANNUAL: 1
    };
    return multipliers[frequency] || 1;
  }

  /**
   * Format frequency for display
   */
  static formatFrequency(frequency: RecurrenceFrequency): string {
    const labels: Record<RecurrenceFrequency, string> = {
      WEEKLY: 'Weekly',
      BIWEEKLY: 'Bi-weekly',
      MONTHLY: 'Monthly',
      QUARTERLY: 'Quarterly',
      SEMIANNUAL: 'Semi-annual',
      ANNUAL: 'Annual'
    };
    return labels[frequency] || frequency;
  }

  /**
   * Get frequency abbreviation
   */
  static getFrequencyAbbreviation(frequency: RecurrenceFrequency): string {
    const abbreviations: Record<RecurrenceFrequency, string> = {
      WEEKLY: 'W',
      BIWEEKLY: 'BW',
      MONTHLY: 'M',
      QUARTERLY: 'Q',
      SEMIANNUAL: 'SA',
      ANNUAL: 'A'
    };
    return abbreviations[frequency] || frequency;
  }

  /**
   * Validate recurring bill configuration
   */
  static validateRecurringBill(bill: Partial<RecurringBill>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!bill.billName?.trim()) {
      errors.push('Bill name is required');
    }

    if (!bill.vendorId?.trim()) {
      errors.push('Vendor is required');
    }

    if (!bill.amount || bill.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!bill.frequency) {
      errors.push('Frequency is required');
    }

    if (!bill.startDate) {
      errors.push('Start date is required');
    } else {
      const startDate = new Date(bill.startDate);
      if (startDate < new Date()) {
        errors.push('Start date cannot be in the past');
      }
    }

    if (bill.endDate) {
      const endDate = new Date(bill.endDate);
      const startDate = new Date(bill.startDate || new Date());
      if (endDate <= startDate) {
        errors.push('End date must be after start date');
      }
    }

    if (bill.billDaysAfterMonth !== undefined) {
      if (bill.billDaysAfterMonth < 1 || bill.billDaysAfterMonth > 31) {
        errors.push('Bill day of month must be between 1 and 31');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate next N bill dates
   */
  static getNextBillDates(
    recurringBill: RecurringBill,
    count: number = 5
  ): Date[] {
    const dates: Date[] = [];
    let current = new Date(recurringBill.nextBillDate);

    for (let i = 0; i < count; i++) {
      // Check if end date would be exceeded
      if (recurringBill.endDate && current > new Date(recurringBill.endDate)) {
        break;
      }
      dates.push(new Date(current));
      current = this.calculateNextBillDate(current, recurringBill.frequency, recurringBill.billDaysAfterMonth);
    }

    return dates;
  }

  /**
   * Create history record for generated bill
   */
  static createHistoryRecord(
    recurringBillId: string,
    orgId: string,
    billDate: string,
    amount: number,
    status: 'GENERATED' | 'CREATED' | 'SKIPPED' | 'FAILED',
    payableId?: string,
    notes?: string
  ): Partial<RecurringBillHistory> {
    return {
      recurringBillId,
      orgId,
      billDate,
      amount,
      status,
      payableId,
      notes,
      createdAt: new Date().toISOString()
    };
  }
}
