/**
 * BankReconciliationService
 * 
 * Provides all bank reconciliation logic including:
 * - Calculating book balances from journal entries
 * - Matching cleared transactions with statement
 * - Tracking reconciliation variance
 * - Persisting reconciliation records
 */

import { BankReconciliation, JournalEntryLine, BankAccount, JournalEntry } from '../types';

export interface ReconciliationResult {
  bankAccountId: string;
  asOfDate: string;
  statementBalance: number;
  bookBalance: number;
  clearedBalance: number;
  difference: number;
  unclearedCount: number;
  clearedCount: number;
  unclearedLines: JournalEntryLine[];
  clearedLines: JournalEntryLine[];
}

export class BankReconciliationService {
  /**
   * Calculate the book balance from all journal lines for a given account
   */
  static calculateBookBalance(lines: JournalEntryLine[], accountId: string): number {
    return lines
      .filter(l => l.accountId === accountId)
      .reduce((sum, l) => sum + (l.debit - l.credit), 0);
  }

  /**
   * Calculate balance from only cleared transactions
   */
  static calculateClearedBalance(lines: JournalEntryLine[], accountId: string): number {
    return lines
      .filter(l => l.accountId === accountId && l.isCleared)
      .reduce((sum, l) => sum + (l.debit - l.credit), 0);
  }

  /**
   * Perform full reconciliation analysis for a bank account
   */
  static performReconciliation(
    bankAccount: BankAccount,
    statementBalance: number,
    lines: JournalEntryLine[],
    asOfDate: string
  ): ReconciliationResult {
    const bankLines = lines.filter(l => l.accountId === bankAccount.glAccountId);
    const clearedLines = bankLines.filter(l => l.isCleared);
    const unclearedLines = bankLines.filter(l => !l.isCleared);

    const bookBalance = this.calculateBookBalance(lines, bankAccount.glAccountId);
    const clearedBalance = this.calculateClearedBalance(lines, bankAccount.glAccountId);
    const difference = statementBalance - clearedBalance;

    return {
      bankAccountId: bankAccount.id,
      asOfDate,
      statementBalance,
      bookBalance,
      clearedBalance,
      difference,
      unclearedCount: unclearedLines.length,
      clearedCount: clearedLines.length,
      unclearedLines,
      clearedLines
    };
  }

  /**
   * Identify outstanding items (uncleared transactions)
   */
  static getOutstandingItems(
    lines: JournalEntryLine[],
    accountId: string,
    entries: JournalEntry[]
  ): (JournalEntryLine & { entryDate?: string; entryReference?: string; entryDescription?: string })[] {
    return lines
      .filter(l => l.accountId === accountId && !l.isCleared)
      .map(line => {
        const entry = entries.find(e => e.id === line.journalEntryId);
        return {
          ...line,
          entryDate: entry?.date,
          entryReference: entry?.reference,
          entryDescription: entry?.description
        };
      });
  }

  /**
   * Check if reconciliation is complete (variance = 0)
   */
  static isReconciled(difference: number, tolerance: number = 0.01): boolean {
    return Math.abs(difference) < tolerance;
  }

  /**
   * Create reconciliation record
   */
  static createReconciliationRecord(
    orgId: string,
    result: ReconciliationResult,
    reconciliationNotes: string = ''
  ): Partial<BankReconciliation> {
    return {
      id: `reconcil-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      orgId,
      bankAccountId: result.bankAccountId,
      asOfDate: result.asOfDate,
      statementBalance: result.statementBalance,
      bookBalance: result.bookBalance,
      clearedBalance: result.clearedBalance,
      difference: result.difference,
      status: this.isReconciled(result.difference) ? 'RECONCILED' : 'IN_PROGRESS',
      reconciliationDetails: reconciliationNotes || `Reconciliation as of ${result.asOfDate}. Statement: ${result.statementBalance}, Cleared: ${result.clearedBalance}, Difference: ${result.difference}`,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Lock reconciliation (immutable snapshot)
   */
  static lockReconciliation(
    record: BankReconciliation,
    userId: string
  ): BankReconciliation {
    return {
      ...record,
      status: 'LOCKED',
      lockedBy: userId,
      lockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate reconciliation variance report
   */
  static generateVarianceReport(result: ReconciliationResult): {
    isReconciled: boolean;
    varianceAmount: number;
    variancePercentage: number;
    itemsSummary: string;
  } {
    const isReconciled = this.isReconciled(result.difference);
    const variancePercentage = result.statementBalance !== 0 
      ? (Math.abs(result.difference) / Math.abs(result.statementBalance)) * 100 
      : 0;

    return {
      isReconciled,
      varianceAmount: result.difference,
      variancePercentage,
      itemsSummary: `${result.clearedCount} cleared, ${result.unclearedCount} outstanding`
    };
  }

  /**
   * Suggest common reconciliation issues
   */
  static diagnosticSuggestions(result: ReconciliationResult): string[] {
    const suggestions: string[] = [];
    const diff = Math.abs(result.difference);

    if (diff > 1000) {
      suggestions.push('Large variance detected. Review recent deposits or large withdrawals.');
    }

    if (result.unclearedCount > 20) {
      suggestions.push('Many outstanding items. Consider reviewing clearing practices.');
    }

    // Check for common penny/amount issues
    if (diff > 0 && diff < 1) {
      suggestions.push('Possible rounding error. Review transaction amounts.');
    }

    if (diff > 0 && (diff % 10 === 0 || diff % 100 === 0)) {
      suggestions.push('Variance is round amount. Check for missing zeros or duplicates.');
    }

    if (result.unclearedCount === 0 && !this.isReconciled(result.difference)) {
      suggestions.push('No outstanding items but variance exists. Statement balance may be incorrect.');
    }

    return suggestions.length > 0 ? suggestions : ['Reconciliation appears normal'];
  }

  /**
   * Calculate reconciliation progress percentage
   */
  static getReconciliationProgress(result: ReconciliationResult): number {
    if (result.clearedCount === 0) return 0;
    const total = result.clearedCount + result.unclearedCount;
    return total > 0 ? (result.clearedCount / total) * 100 : 0;
  }

  /**
   * Compare two reconciliation records to show changes
   */
  static comparePreviousReconciliation(
    current: ReconciliationResult,
    previous: ReconciliationResult | null
  ): {
    balanceChange: number;
    varianceImprovement: number;
    clearedCountChange: number;
  } {
    if (!previous) {
      return { balanceChange: 0, varianceImprovement: 0, clearedCountChange: 0 };
    }

    return {
      balanceChange: current.bookBalance - previous.bookBalance,
      varianceImprovement: previous.difference - current.difference,
      clearedCountChange: current.clearedCount - previous.clearedCount
    };
  }
}
