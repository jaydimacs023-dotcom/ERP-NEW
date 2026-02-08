/**
 * RecurringJournalEntryService
 * 
 * Handles all recurring journal entry logic including:
 * - Scheduling recurring entries based on frequency
 * - Auto-generating journal entries from templates
 * - Managing execution history
 * - Calculating next run dates
 */

import { RecurringJournalEntry, JournalEntry, JournalLine, RecurrenceFrequency } from '../types';

export interface RecurrenceSchedule {
  nextRunDate: string;
  daysUntilRun: number;
  isOverdue: boolean;
  frequency: RecurrenceFrequency;
  customDayInterval?: number;
}

export class RecurringJournalEntryService {
  /**
   * Calculate next run date based on frequency and current date
   */
  static calculateNextRunDate(
    lastRunDate: string | null,
    startDate: string,
    frequency: RecurrenceFrequency,
    customDayInterval?: number
  ): string {
    const refDate = lastRunDate ? new Date(lastRunDate) : new Date(startDate);
    const nextDate = new Date(refDate);

    switch (frequency) {
      case 'DAILY':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
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
      case 'CUSTOM':
        if (customDayInterval && customDayInterval > 0) {
          nextDate.setDate(nextDate.getDate() + customDayInterval);
        }
        break;
    }

    return nextDate.toISOString().split('T')[0];
  }

  /**
   * Check if recurring entry is due to run
   */
  static isDueToRun(nextRunDate: string, endDate?: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if past end date
    if (endDate && today > endDate) {
      return false;
    }
    
    return today >= nextRunDate;
  }

  /**
   * Get schedule information for a recurring entry
   */
  static getScheduleInfo(recurringEntry: RecurringJournalEntry): RecurrenceSchedule {
    const today = new Date();
    const nextRunDate = new Date(recurringEntry.nextRunDate);
    const daysUntilRun = Math.ceil((nextRunDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = this.isDueToRun(recurringEntry.nextRunDate, recurringEntry.endDate);

    return {
      nextRunDate: recurringEntry.nextRunDate,
      daysUntilRun,
      isOverdue,
      frequency: recurringEntry.frequency,
      customDayInterval: recurringEntry.customDayInterval
    };
  }

  /**
   * Check if recurring entry should be completed
   */
  static isCompleted(recurringEntry: RecurringJournalEntry): boolean {
    // Check if maxRuns reached
    if (recurringEntry.maxRuns && recurringEntry.timesRun >= recurringEntry.maxRuns) {
      return true;
    }

    // Check if past end date
    if (recurringEntry.endDate) {
      const today = new Date().toISOString().split('T')[0];
      if (today > recurringEntry.endDate) {
        return true;
      }
    }

    return recurringEntry.status === 'COMPLETED';
  }

  /**
   * Generate a journal entry from recurring template
   */
  static generateEntryFromTemplate(
    recurringEntry: RecurringJournalEntry,
    entryDate: string,
    generatedId: string
  ): { entry: Partial<JournalEntry>; lines: Omit<JournalLine, 'id' | 'journalEntryId'>[] } {
    const { templateEntry } = recurringEntry;
    const { lineTemplate, ...entryTemplate } = templateEntry;

    // Generate entry reference with date
    const dateStr = entryDate.replace(/-/g, '');
    const reference = `REC-${dateStr}-${generatedId.substring(0, 6).toUpperCase()}`;

    const entry: Partial<JournalEntry> = {
      ...entryTemplate,
      id: generatedId,
      date: entryDate,
      reference,
      createdAt: new Date().toISOString(),
      status: recurringEntry.autoPost ? 'POSTED' : 'DRAFT',
      recurringEntryId: recurringEntry.id
    };

    // Generate lines from template (without id/journalEntryId)
    const lines: Omit<JournalLine, 'id' | 'journalEntryId'>[] = lineTemplate.map(line => ({
      ...line
    }));

    return { entry, lines };
  }

  /**
   * Create a recurring journal entry template
   */
  static createRecurringTemplate(
    orgId: string,
    name: string,
    frequency: RecurrenceFrequency,
    startDate: string,
    templateEntry: Omit<JournalEntry, 'id' | 'orgId' | 'createdAt' | 'createdBy' | 'date' | 'reference'> & {
      lineTemplate: Omit<JournalLine, 'id' | 'journalEntryId'>[]
    },
    options?: {
      description?: string;
      endDate?: string;
      customDayInterval?: number;
      maxRuns?: number;
      autoPost?: boolean;
      createdBy?: string;
    }
  ): Partial<RecurringJournalEntry> {
    const nextRunDate = this.calculateNextRunDate(null, startDate, frequency, options?.customDayInterval);

    return {
      id: `recurring-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      orgId,
      name,
      description: options?.description,
      frequency,
      customDayInterval: options?.customDayInterval,
      startDate,
      endDate: options?.endDate,
      nextRunDate,
      status: 'ACTIVE',
      templateEntry,
      timesRun: 0,
      maxRuns: options?.maxRuns,
      autoPost: options?.autoPost ?? false,
      createdBy: options?.createdBy || 'system',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Update execution after running
   */
  static updateAfterExecution(
    recurringEntry: RecurringJournalEntry,
    generatedEntryId: string
  ): Partial<RecurringJournalEntry> {
    const nextRunDate = this.calculateNextRunDate(
      recurringEntry.nextRunDate,
      recurringEntry.startDate,
      recurringEntry.frequency,
      recurringEntry.customDayInterval
    );

    const newTimesRun = recurringEntry.timesRun + 1;
    const isCompleted = recurringEntry.maxRuns && newTimesRun >= recurringEntry.maxRuns;
    const isPastEndDate = recurringEntry.endDate && nextRunDate > recurringEntry.endDate;

    return {
      timesRun: newTimesRun,
      lastRunDate: new Date().toISOString().split('T')[0],
      nextRunDate,
      lastGeneratedEntryId: generatedEntryId,
      status: isCompleted || isPastEndDate ? 'COMPLETED' : recurringEntry.status,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Pause a recurring entry
   */
  static pause(recurringEntry: RecurringJournalEntry): Partial<RecurringJournalEntry> {
    return {
      status: 'PAUSED',
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Resume a paused recurring entry
   */
  static resume(recurringEntry: RecurringJournalEntry): Partial<RecurringJournalEntry> {
    return {
      status: 'ACTIVE',
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Cancel a recurring entry (mark as inactive)
   */
  static cancel(recurringEntry: RecurringJournalEntry): Partial<RecurringJournalEntry> {
    return {
      status: 'INACTIVE',
      endDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Get all entries due to run
   */
  static filterDueEntries(recurringEntries: RecurringJournalEntry[]): RecurringJournalEntry[] {
    return recurringEntries.filter(entry => {
      if (entry.status !== 'ACTIVE') return false;
      if (this.isCompleted(entry)) return false;
      return this.isDueToRun(entry.nextRunDate, entry.endDate);
    });
  }

  /**
   * Get scheduling summary for dashboard
   */
  static getSummary(recurringEntries: RecurringJournalEntry[]): {
    totalActive: number;
    totalPaused: number;
    totalDue: number;
    totalCompleted: number;
    nextScheduledRun?: string;
    totalTimesRun: number;
  } {
    const active = recurringEntries.filter(e => e.status === 'ACTIVE').length;
    const paused = recurringEntries.filter(e => e.status === 'PAUSED').length;
    const due = this.filterDueEntries(recurringEntries).length;
    const completed = recurringEntries.filter(e => e.status === 'COMPLETED').length;
    const totalTimesRun = recurringEntries.reduce((sum, e) => sum + e.timesRun, 0);

    const upcomingRuns = recurringEntries
      .filter(e => e.status === 'ACTIVE' && !this.isCompleted(e))
      .map(e => e.nextRunDate)
      .sort();

    return {
      totalActive: active,
      totalPaused: paused,
      totalDue: due,
      totalCompleted: completed,
      nextScheduledRun: upcomingRuns[0],
      totalTimesRun
    };
  }

  /**
   * Validate recurring entry configuration
   */
  static validate(
    recurringEntry: Partial<RecurringJournalEntry>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!recurringEntry.name || recurringEntry.name.trim() === '') {
      errors.push('Recurring entry name is required');
    }

    if (!recurringEntry.frequency) {
      errors.push('Frequency is required');
    }

    if (!recurringEntry.startDate) {
      errors.push('Start date is required');
    }

    if (recurringEntry.frequency === 'CUSTOM' && (!recurringEntry.customDayInterval || recurringEntry.customDayInterval <= 0)) {
      errors.push('Custom interval must be greater than 0 for CUSTOM frequency');
    }

    if (recurringEntry.endDate && recurringEntry.startDate && recurringEntry.endDate < recurringEntry.startDate) {
      errors.push('End date must be after start date');
    }

    if (recurringEntry.templateEntry?.lineTemplate) {
      const lines = recurringEntry.templateEntry.lineTemplate;
      const hasDebit = lines.some(l => l.debit > 0);
      const hasCredit = lines.some(l => l.credit > 0);

      if (!hasDebit || !hasCredit) {
        errors.push('Entry must have both debit and credit lines');
      }

      const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        errors.push(`Debits (${totalDebit}) and credits (${totalCredit}) do not balance`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate statistics for recurring entries
   */
  static getStatistics(recurringEntries: RecurringJournalEntry[]): {
    byFrequency: Record<RecurrenceFrequency, number>;
    byStatus: Record<string, number>;
    averageRunsPerEntry: number;
    totalAmountRecurring: number;
  } {
    const byFrequency: Record<RecurrenceFrequency, number> = {
      DAILY: 0,
      WEEKLY: 0,
      BIWEEKLY: 0,
      MONTHLY: 0,
      QUARTERLY: 0,
      SEMIANNUAL: 0,
      ANNUAL: 0,
      CUSTOM: 0
    };

    const byStatus: Record<string, number> = {};
    let totalAmountRecurring = 0;

    recurringEntries.forEach(entry => {
      byFrequency[entry.frequency]++;
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;

      if (entry.templateEntry?.lineTemplate) {
        const totalAmount = entry.templateEntry.lineTemplate.reduce((sum, line) => sum + (line.debit || line.credit), 0);
        totalAmountRecurring += totalAmount * entry.timesRun;
      }
    });

    const avgRuns = recurringEntries.length > 0
      ? recurringEntries.reduce((sum, e) => sum + e.timesRun, 0) / recurringEntries.length
      : 0;

    return {
      byFrequency,
      byStatus,
      averageRunsPerEntry: Math.round(avgRuns * 100) / 100,
      totalAmountRecurring
    };
  }
}
