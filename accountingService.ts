
import { AccountClass, JournalLine, ChartOfAccount, TransactionSummary, JournalEntry } from './types';

export class AccountingService {
  /**
   * Calculates the balance of an account based on its Normal Balance rules.
   * Assets/Expenses = Dr - Cr
   * Liabilities/Equity/Revenue = Cr - Dr
   */
  static calculateBalance(account: ChartOfAccount, debit: number, credit: number): number {
    if (account.class === AccountClass.ASSET || account.class === AccountClass.EXPENSE) {
      return debit - credit;
    }
    return credit - debit;
  }

  /**
   * Generates the next sequential reference number for a document type.
   * Format: PREFIX-YYYY-0000X (e.g., SI-2024-00001)
   */
  static getNextReference(entries: JournalEntry[], prefix: string): string {
    const year = new Date().getFullYear();
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    
    let maxSeq = 0;
    entries.forEach(e => {
      const match = e.reference.match(pattern);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    });

    const nextSeq = (maxSeq + 1).toString().padStart(5, '0');
    return `${prefix}-${year}-${nextSeq}`;
  }

  static getLedgerSummaries(
    accounts: ChartOfAccount[],
    lines: JournalLine[]
  ): TransactionSummary[] {
    const summaries: Map<string, TransactionSummary> = new Map();

    accounts.forEach(acc => {
      const accLines = lines.filter(l => l.accountId === acc.id);
      const totalDebit = accLines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = accLines.reduce((sum, l) => sum + l.credit, 0);
      const balance = this.calculateBalance(acc, totalDebit, totalCredit);

      summaries.set(acc.id, {
        accountId: acc.id,
        accountName: acc.name,
        accountClass: acc.class,
        totalDebit,
        totalCredit,
        balance
      });
    });

    const finalSummaries: TransactionSummary[] = accounts.map(acc => {
      let rolledBalance = 0;
      let rolledDebit = 0;
      let rolledCredit = 0;

      const descendants = this.getAllDescendants(acc.id, accounts);
      
      descendants.forEach(dId => {
        const s = summaries.get(dId);
        if (s) {
          rolledBalance += s.balance;
          rolledDebit += s.totalDebit;
          rolledCredit += s.totalCredit;
        }
      });

      return {
        accountId: acc.id,
        accountName: acc.name,
        accountClass: acc.class,
        totalDebit: rolledDebit,
        totalCredit: rolledCredit,
        balance: rolledBalance
      };
    });

    return finalSummaries;
  }

  private static getAllDescendants(parentId: string, accounts: ChartOfAccount[]): string[] {
    const children = accounts.filter(a => a.parentId === parentId);
    let descendants = [parentId];
    children.forEach(child => {
      descendants = [...descendants, ...this.getAllDescendants(child.id, accounts)];
    });
    return Array.from(new Set(descendants));
  }

  static generateBalanceSheet(summaries: TransactionSummary[], accounts: ChartOfAccount[]) {
    const topLevel = accounts.filter(a => !a.parentId);
    
    const assets = summaries.filter(s => s.accountClass === AccountClass.ASSET && topLevel.some(t => t.id === s.accountId));
    const liabilities = summaries.filter(s => s.accountClass === AccountClass.LIABILITY && topLevel.some(t => t.id === s.accountId));
    const equity = summaries.filter(s => s.accountClass === AccountClass.EQUITY && topLevel.some(t => t.id === s.accountId));

    const totalAssets = assets.reduce((sum, s) => sum + s.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, s) => sum + s.balance, 0);
    const totalEquity = equity.reduce((sum, s) => sum + s.balance, 0);

    return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
  }

  static generateIncomeStatement(summaries: TransactionSummary[], accounts: ChartOfAccount[]) {
    const topLevel = accounts.filter(a => !a.parentId);

    const revenue = summaries.filter(s => s.accountClass === AccountClass.REVENUE && topLevel.some(t => t.id === s.accountId));
    const expenses = summaries.filter(s => s.accountClass === AccountClass.EXPENSE && topLevel.some(t => t.id === s.accountId));

    const totalRevenue = revenue.reduce((sum, s) => sum + s.balance, 0);
    const totalExpenses = expenses.reduce((sum, s) => sum + s.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    return { revenue, expenses, totalRevenue, totalExpenses, netIncome };
  }

  static generateCashFlow(
    periodSummaries: TransactionSummary[],
    accounts: ChartOfAccount[],
    lines: JournalLine[],
    openingSummaries: TransactionSummary[] = [],
    endingSummaries: TransactionSummary[] = periodSummaries
  ) {
    const incomeStatement = this.generateIncomeStatement(periodSummaries, accounts);
    const netIncome = incomeStatement.netIncome;

    // 1. Operating Activities (Indirect Method)
    const deprAccounts = accounts.filter(a => a.name.toLowerCase().includes('depreciation') && a.class === AccountClass.ASSET);
    const deprIds = new Set(deprAccounts.map(a => a.id));
    const depreciationAdjustment = lines
      .filter(l => deprIds.has(l.accountId))
      .reduce((sum, l) => sum + (l.credit - l.debit), 0);

    const arAccounts = accounts.filter(a => a.name.toLowerCase().includes('receivable') && a.class === AccountClass.ASSET);
    const openingAR = openingSummaries.filter(s => arAccounts.some(a => a.id === s.accountId)).reduce((sum, s) => sum + s.balance, 0);
    const endingAR = endingSummaries.filter(s => arAccounts.some(a => a.id === s.accountId)).reduce((sum, s) => sum + s.balance, 0);
    const changeInAR = openingAR - endingAR;

    const apAccounts = accounts.filter(a => a.name.toLowerCase().includes('payable') && a.class === AccountClass.LIABILITY);
    const openingAP = openingSummaries.filter(s => apAccounts.some(a => a.id === s.accountId)).reduce((sum, s) => sum + s.balance, 0);
    const endingAP = endingSummaries.filter(s => apAccounts.some(a => a.id === s.accountId)).reduce((sum, s) => sum + s.balance, 0);
    const changeInAP = endingAP - openingAP;

    const operatingCashFlow = netIncome + depreciationAdjustment + changeInAR + changeInAP;

    // 2. Investing Activities
    const assetCostAccounts = accounts.filter(a => a.code.startsWith('15') && !a.isHeader);
    const assetCostIds = new Set(assetCostAccounts.map(a => a.id));
    const investingCashFlow = -lines
      .filter(l => assetCostIds.has(l.accountId))
      .reduce((sum, l) => sum + (l.debit - l.credit), 0);

    // 3. Financing Activities
    const equityAccounts = accounts.filter(a => a.class === AccountClass.EQUITY && !a.isHeader);
    const equityIds = new Set(equityAccounts.map(a => a.id));
    const financingCashFlow = lines
      .filter(l => equityIds.has(l.accountId))
      .reduce((sum, l) => sum + (l.credit - l.debit), 0);

    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

    const cashAccounts = accounts.filter(a => (a.code.startsWith('11') || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('checking')) && !a.isHeader);
    const beginningCash = openingSummaries.filter(s => cashAccounts.some(a => a.id === s.accountId)).reduce((sum, s) => sum + s.balance, 0);
    const totalCash = endingSummaries.filter(s => cashAccounts.some(a => a.id === s.accountId)).reduce((sum, s) => sum + s.balance, 0);

    return {
      netIncome,
      depreciationAdjustment,
      changeInAR,
      changeInAP,
      operatingCashFlow,
      investingCashFlow,
      financingCashFlow,
      netCashFlow,
      beginningCash,
      endingCash: totalCash
    };
  }
}
