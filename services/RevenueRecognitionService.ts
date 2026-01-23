/**
 * RevenueRecognitionService
 * 
 * Handles all revenue recognition and deferred revenue logic including:
 * - Creating revenue schedules from invoices/receivables
 * - Calculating recognition periods and amounts
 * - Generating recognition entries
 * - Managing deferred revenue lifecycle
 */

import { 
  RevenueSchedule, 
  RevenueRecognitionEntry, 
  RecognitionMethod, 
  RecognitionPeriod,
  DeferredRevenueSummary,
  JournalEntry,
  JournalLine
} from '../types';

export interface RecognitionPeriodInfo {
  periodStart: string;
  periodEnd: string;
  amount: number;
  periodNumber: number;
  totalPeriods: number;
}

export class RevenueRecognitionService {
  /**
   * Calculate the number of recognition periods between start and end dates
   */
  static calculatePeriodCount(
    startDate: string,
    endDate: string,
    period: RecognitionPeriod
  ): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.ceil(diffMs / dayMs);

    switch (period) {
      case 'DAILY':
        return Math.max(1, days);
      case 'WEEKLY':
        return Math.max(1, Math.ceil(days / 7));
      case 'MONTHLY':
        // Calculate months difference
        const monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                         (end.getMonth() - start.getMonth());
        return Math.max(1, monthDiff + 1);
      case 'QUARTERLY':
        const quarterDiff = Math.ceil(
          ((end.getFullYear() - start.getFullYear()) * 12 + 
           (end.getMonth() - start.getMonth())) / 3
        );
        return Math.max(1, quarterDiff + 1);
      default:
        return 1;
    }
  }

  /**
   * Calculate amount per period for straight-line recognition
   */
  static calculatePeriodAmount(
    totalAmount: number,
    totalPeriods: number
  ): number {
    if (totalPeriods <= 0) return totalAmount;
    return Math.round((totalAmount / totalPeriods) * 100) / 100;
  }

  /**
   * Generate recognition schedule periods
   */
  static generateRecognitionPeriods(
    schedule: RevenueSchedule
  ): RecognitionPeriodInfo[] {
    if (schedule.recognitionMethod === 'POINT_IN_TIME') {
      // Single recognition at end date
      return [{
        periodStart: schedule.startDate,
        periodEnd: schedule.endDate,
        amount: schedule.totalAmount,
        periodNumber: 1,
        totalPeriods: 1
      }];
    }

    if (schedule.recognitionMethod === 'PERCENTAGE_OF_COMPLETION') {
      // For percentage, periods are created manually based on milestones
      return [];
    }

    // Straight-line recognition
    const period = schedule.recognitionPeriod || 'MONTHLY';
    const totalPeriods = this.calculatePeriodCount(
      schedule.startDate, 
      schedule.endDate, 
      period
    );
    const periodAmount = this.calculatePeriodAmount(schedule.totalAmount, totalPeriods);
    
    const periods: RecognitionPeriodInfo[] = [];
    let currentDate = new Date(schedule.startDate);
    let remainingAmount = schedule.totalAmount;

    for (let i = 0; i < totalPeriods; i++) {
      const periodStart = currentDate.toISOString().split('T')[0];
      
      // Calculate period end
      const periodEnd = new Date(currentDate);
      switch (period) {
        case 'DAILY':
          periodEnd.setDate(periodEnd.getDate() + 1);
          break;
        case 'WEEKLY':
          periodEnd.setDate(periodEnd.getDate() + 7);
          break;
        case 'MONTHLY':
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          break;
        case 'QUARTERLY':
          periodEnd.setMonth(periodEnd.getMonth() + 3);
          break;
      }
      periodEnd.setDate(periodEnd.getDate() - 1);

      // Ensure last period doesn't exceed end date
      const endDateObj = new Date(schedule.endDate);
      if (periodEnd > endDateObj) {
        periodEnd.setTime(endDateObj.getTime());
      }

      // Calculate amount (last period gets remaining to avoid rounding issues)
      const isLastPeriod = i === totalPeriods - 1;
      const amount = isLastPeriod ? remainingAmount : periodAmount;
      remainingAmount -= amount;

      periods.push({
        periodStart,
        periodEnd: periodEnd.toISOString().split('T')[0],
        amount,
        periodNumber: i + 1,
        totalPeriods
      });

      // Move to next period
      currentDate = new Date(periodEnd);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return periods;
  }

  /**
   * Get periods due for recognition as of a given date
   */
  static getPeriodsDueForRecognition(
    schedule: RevenueSchedule,
    existingEntries: RevenueRecognitionEntry[],
    asOfDate: string = new Date().toISOString().split('T')[0]
  ): RecognitionPeriodInfo[] {
    if (schedule.status !== 'ACTIVE') {
      return [];
    }

    const allPeriods = this.generateRecognitionPeriods(schedule);
    const recognizedPeriods = new Set(
      existingEntries
        .filter(e => e.status !== 'REVERSED')
        .map(e => `${e.periodStart}_${e.periodEnd}`)
    );

    return allPeriods.filter(p => {
      const periodKey = `${p.periodStart}_${p.periodEnd}`;
      const isPeriodDue = p.periodEnd <= asOfDate;
      const isNotRecognized = !recognizedPeriods.has(periodKey);
      return isPeriodDue && isNotRecognized;
    });
  }

  /**
   * Create a recognition entry for a period
   */
  static createRecognitionEntry(
    schedule: RevenueSchedule,
    period: RecognitionPeriodInfo,
    options?: {
      percentageComplete?: number;
      milestone?: string;
      notes?: string;
    }
  ): Partial<RevenueRecognitionEntry> {
    return {
      id: `rev-entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      orgId: schedule.orgId,
      scheduleId: schedule.id,
      recognitionDate: new Date().toISOString().split('T')[0],
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      amount: period.amount,
      status: 'PENDING',
      percentageComplete: options?.percentageComplete,
      milestone: options?.milestone,
      notes: options?.notes,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Generate journal entry for a recognition entry
   * DR: Deferred Revenue (Liability)
   * CR: Revenue (Income)
   */
  static generateJournalEntry(
    schedule: RevenueSchedule,
    entry: RevenueRecognitionEntry,
    referencePrefix: string = 'REV-REC'
  ): { entry: Partial<JournalEntry>; lines: Partial<JournalLine>[] } {
    const entryId = `je-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dateStr = entry.recognitionDate.replace(/-/g, '');
    const reference = `${referencePrefix}-${dateStr}-${entryId.substring(3, 9).toUpperCase()}`;

    const journalEntry: Partial<JournalEntry> = {
      id: entryId,
      orgId: schedule.orgId,
      reference,
      date: entry.recognitionDate,
      description: `Revenue recognition: ${schedule.description} (${entry.periodStart} to ${entry.periodEnd})`,
      status: 'DRAFT',
      createdAt: new Date().toISOString()
    };

    const lines: Partial<JournalLine>[] = [
      {
        id: `${entryId}-line-1`,
        journalEntryId: entryId,
        accountId: schedule.deferredRevenueAccountId,
        description: `Deferred revenue recognition - ${schedule.description}`,
        debit: entry.amount,
        credit: 0
      },
      {
        id: `${entryId}-line-2`,
        journalEntryId: entryId,
        accountId: schedule.revenueAccountId,
        description: `Revenue earned - ${schedule.description}`,
        debit: 0,
        credit: entry.amount
      }
    ];

    return { entry: journalEntry, lines };
  }

  /**
   * Update schedule after recognition
   */
  static updateScheduleAfterRecognition(
    schedule: RevenueSchedule,
    recognizedAmount: number,
    recognitionDate: string
  ): Partial<RevenueSchedule> {
    const newRecognizedAmount = schedule.recognizedAmount + recognizedAmount;
    const newDeferredBalance = schedule.totalAmount - newRecognizedAmount;
    
    // Check if schedule is complete
    const isComplete = newDeferredBalance <= 0.01; // Allow for small rounding differences

    // Calculate next recognition date
    let nextRecognitionDate: string | undefined;
    if (!isComplete && schedule.recognitionPeriod) {
      const next = new Date(recognitionDate);
      switch (schedule.recognitionPeriod) {
        case 'DAILY':
          next.setDate(next.getDate() + 1);
          break;
        case 'WEEKLY':
          next.setDate(next.getDate() + 7);
          break;
        case 'MONTHLY':
          next.setMonth(next.getMonth() + 1);
          break;
        case 'QUARTERLY':
          next.setMonth(next.getMonth() + 3);
          break;
      }
      nextRecognitionDate = next.toISOString().split('T')[0];
    }

    return {
      recognizedAmount: newRecognizedAmount,
      deferredBalance: Math.max(0, newDeferredBalance),
      lastRecognitionDate: recognitionDate,
      nextRecognitionDate: isComplete ? undefined : nextRecognitionDate,
      status: isComplete ? 'COMPLETED' : schedule.status,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Create a new revenue schedule from an invoice/receivable
   */
  static createScheduleFromInvoice(
    orgId: string,
    customerId: string,
    customerName: string,
    amount: number,
    serviceStartDate: string,
    serviceEndDate: string,
    deferredRevenueAccountId: string,
    revenueAccountId: string,
    options?: {
      sourceType?: 'INVOICE' | 'RECEIVABLE' | 'MANUAL';
      sourceId?: string;
      sourceReference?: string;
      description?: string;
      currency?: string;
      recognitionMethod?: RecognitionMethod;
      recognitionPeriod?: RecognitionPeriod;
      createdBy?: string;
      notes?: string;
    }
  ): Partial<RevenueSchedule> {
    const method = options?.recognitionMethod || 'STRAIGHT_LINE';
    const period = options?.recognitionPeriod || 'MONTHLY';
    
    // Calculate next recognition date
    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date(serviceStartDate);
    let nextRecognitionDate = serviceStartDate;
    
    if (serviceStartDate < today) {
      // Service already started, next recognition is at next period boundary
      const now = new Date();
      switch (period) {
        case 'DAILY':
          nextRecognitionDate = now.toISOString().split('T')[0];
          break;
        case 'WEEKLY':
          now.setDate(now.getDate() + (7 - now.getDay()));
          nextRecognitionDate = now.toISOString().split('T')[0];
          break;
        case 'MONTHLY':
          now.setMonth(now.getMonth() + 1, 1);
          nextRecognitionDate = now.toISOString().split('T')[0];
          break;
        case 'QUARTERLY':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          now.setMonth((currentQuarter + 1) * 3, 1);
          nextRecognitionDate = now.toISOString().split('T')[0];
          break;
      }
    }

    return {
      id: `rev-sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      orgId,
      sourceType: options?.sourceType || 'MANUAL',
      sourceId: options?.sourceId,
      sourceReference: options?.sourceReference,
      customerId,
      customerName,
      description: options?.description || `Deferred revenue - ${customerName}`,
      totalAmount: amount,
      currency: options?.currency,
      recognitionMethod: method,
      recognitionPeriod: method === 'STRAIGHT_LINE' ? period : undefined,
      startDate: serviceStartDate,
      endDate: serviceEndDate,
      recognizedAmount: 0,
      deferredBalance: amount,
      deferredRevenueAccountId,
      revenueAccountId,
      status: 'ACTIVE',
      nextRecognitionDate,
      createdBy: options?.createdBy || 'system',
      createdAt: new Date().toISOString(),
      notes: options?.notes
    };
  }

  /**
   * Get schedule status display info
   */
  static getStatusInfo(status: string): { label: string; color: string } {
    const statusMap: Record<string, { label: string; color: string }> = {
      'ACTIVE': { label: 'Active', color: 'bg-green-100 text-green-800' },
      'PAUSED': { label: 'Paused', color: 'bg-yellow-100 text-yellow-800' },
      'COMPLETED': { label: 'Completed', color: 'bg-blue-100 text-blue-800' },
      'CANCELLED': { label: 'Cancelled', color: 'bg-red-100 text-red-800' }
    };
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  }

  /**
   * Get recognition method display label
   */
  static getMethodLabel(method: RecognitionMethod): string {
    const labels: Record<RecognitionMethod, string> = {
      'STRAIGHT_LINE': 'Straight-Line',
      'PERCENTAGE_OF_COMPLETION': 'Percentage of Completion',
      'POINT_IN_TIME': 'Point in Time'
    };
    return labels[method] || method;
  }

  /**
   * Get recognition period display label
   */
  static getPeriodLabel(period: RecognitionPeriod): string {
    const labels: Record<RecognitionPeriod, string> = {
      'DAILY': 'Daily',
      'WEEKLY': 'Weekly',
      'MONTHLY': 'Monthly',
      'QUARTERLY': 'Quarterly'
    };
    return labels[period] || period;
  }

  /**
   * Calculate deferred revenue summaries by customer
   */
  static calculateSummaryByCustomer(
    schedules: RevenueSchedule[]
  ): DeferredRevenueSummary[] {
    const summaryMap = new Map<string, DeferredRevenueSummary>();

    for (const schedule of schedules) {
      if (schedule.status === 'CANCELLED') continue;

      const existing = summaryMap.get(schedule.customerId);
      if (existing) {
        existing.totalDeferred += schedule.totalAmount;
        existing.totalRecognized += schedule.recognizedAmount;
        existing.totalRemaining += schedule.deferredBalance;
        existing.scheduleCount += 1;
        if (schedule.startDate < existing.oldestScheduleDate) {
          existing.oldestScheduleDate = schedule.startDate;
        }
        if (schedule.startDate > existing.newestScheduleDate) {
          existing.newestScheduleDate = schedule.startDate;
        }
      } else {
        summaryMap.set(schedule.customerId, {
          customerId: schedule.customerId,
          customerName: schedule.customerName || 'Unknown',
          totalDeferred: schedule.totalAmount,
          totalRecognized: schedule.recognizedAmount,
          totalRemaining: schedule.deferredBalance,
          scheduleCount: 1,
          oldestScheduleDate: schedule.startDate,
          newestScheduleDate: schedule.startDate
        });
      }
    }

    return Array.from(summaryMap.values())
      .sort((a, b) => b.totalRemaining - a.totalRemaining);
  }

  /**
   * Check if any schedules are due for recognition
   */
  static getSchedulesDueForRecognition(
    schedules: RevenueSchedule[],
    entries: RevenueRecognitionEntry[],
    asOfDate: string = new Date().toISOString().split('T')[0]
  ): { schedule: RevenueSchedule; periodsDue: RecognitionPeriodInfo[] }[] {
    const result: { schedule: RevenueSchedule; periodsDue: RecognitionPeriodInfo[] }[] = [];

    for (const schedule of schedules) {
      if (schedule.status !== 'ACTIVE') continue;

      const scheduleEntries = entries.filter(e => e.scheduleId === schedule.id);
      const periodsDue = this.getPeriodsDueForRecognition(schedule, scheduleEntries, asOfDate);

      if (periodsDue.length > 0) {
        result.push({ schedule, periodsDue });
      }
    }

    return result;
  }
}
