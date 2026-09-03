import { describe, it, expect } from 'vitest';
import { AccountingService } from '../accountingService';
import { AccountClass, ChartOfAccount, TransactionSummary } from '../types';

describe('AccountingService - Balance Sheet Equation & Financial Integrity', () => {
  const accounts: ChartOfAccount[] = [
    {
      id: 'acc-cash',
      orgId: 'org-1',
      code: '1100',
      name: 'Cash and Cash Equivalents',
      class: AccountClass.ASSET,
      type: 'CURRENT_ASSET',
      isActive: true,
      description: 'Cash in Bank'
    },
    {
      id: 'acc-ar',
      orgId: 'org-1',
      code: '1200',
      name: 'Accounts Receivable',
      class: AccountClass.ASSET,
      type: 'CURRENT_ASSET',
      isActive: true,
      description: 'Student receivables'
    },
    {
      id: 'acc-ap',
      orgId: 'org-1',
      code: '2100',
      name: 'Accounts Payable',
      class: AccountClass.LIABILITY,
      type: 'CURRENT_LIABILITY',
      isActive: true,
      description: 'Vendor bills'
    },
    {
      id: 'acc-capital',
      orgId: 'org-1',
      code: '3000',
      name: 'Owner Capital / Retained Earnings',
      class: AccountClass.EQUITY,
      type: 'EQUITY',
      isActive: true,
      description: 'Beginning capital'
    },
    {
      id: 'acc-tuition',
      orgId: 'org-1',
      code: '4000',
      name: 'Tuition & Training Revenue',
      class: AccountClass.REVENUE,
      type: 'OPERATING_REVENUE',
      isActive: true,
      description: 'Course fees'
    },
    {
      id: 'acc-salaries',
      orgId: 'org-1',
      code: '5100',
      name: 'Salaries & Wages Expense',
      class: AccountClass.EXPENSE,
      type: 'OPERATING_EXPENSE',
      isActive: true,
      description: 'Instructor salaries'
    }
  ];

  it('calculates normal account balances correctly', () => {
    // Asset: Dr - Cr
    expect(AccountingService.calculateBalance(accounts[0], 1000, 200)).toBe(800);
    // Liability: Cr - Dr
    expect(AccountingService.calculateBalance(accounts[2], 200, 1000)).toBe(800);
    // Revenue: Cr - Dr
    expect(AccountingService.calculateBalance(accounts[4], 0, 5000)).toBe(5000);
    // Expense: Dr - Cr
    expect(AccountingService.calculateBalance(accounts[5], 3000, 0)).toBe(3000);
  });

  it('balances Total Assets with Total Liabilities and Equity by including Current Period Net Income', () => {
    // Scenario:
    // Initial capital = ₱100,000 in Cash and Capital
    // Earned tuition = ₱50,000 (received in Cash)
    // Incurred salaries = ₱20,000 (paid in Cash)
    // Outstanding AP = ₱10,000 with supplies expense (₱10,000)
    // Cash ending balance = 100,000 + 50,000 - 20,000 = 130,000
    // Total Revenue = ₱50,000
    // Total Expenses = ₱20,000 + ₱10,000 = ₱30,000
    // Net Income = ₱50,000 - ₱30,000 = ₱20,000
    // Total Assets = Cash ₱130,000
    // Total Liabilities = AP ₱10,000
    // Raw Equity = Capital ₱100,000
    // Total Equity with Net Income = 100,000 + 20,000 = 120,000
    // Total Liabilities + Equity = 10,000 + 120,000 = 130,000 === Total Assets!

    const summaries: TransactionSummary[] = [
      {
        accountId: 'acc-cash',
        accountName: 'Cash and Cash Equivalents',
        accountClass: AccountClass.ASSET,
        totalDebit: 150000,
        totalCredit: 20000,
        balance: 130000
      },
      {
        accountId: 'acc-ap',
        accountName: 'Accounts Payable',
        accountClass: AccountClass.LIABILITY,
        totalDebit: 0,
        totalCredit: 10000,
        balance: 10000
      },
      {
        accountId: 'acc-capital',
        accountName: 'Owner Capital / Retained Earnings',
        accountClass: AccountClass.EQUITY,
        totalDebit: 0,
        totalCredit: 100000,
        balance: 100000
      },
      {
        accountId: 'acc-tuition',
        accountName: 'Tuition & Training Revenue',
        accountClass: AccountClass.REVENUE,
        totalDebit: 0,
        totalCredit: 50000,
        balance: 50000
      },
      {
        accountId: 'acc-salaries',
        accountName: 'Salaries & Wages Expense',
        accountClass: AccountClass.EXPENSE,
        totalDebit: 30000,
        totalCredit: 0,
        balance: 30000
      }
    ];

    const bs = AccountingService.generateBalanceSheet(summaries, accounts);
    const is = AccountingService.generateIncomeStatement(summaries, accounts);

    expect(is.totalRevenue).toBe(50000);
    expect(is.totalExpenses).toBe(30000);
    expect(is.netIncome).toBe(20000);

    expect(bs.totalAssets).toBe(130000);
    expect(bs.totalLiabilities).toBe(10000);
    expect(bs.rawEquity).toBe(100000);
    expect(bs.currentPeriodNetIncome).toBe(20000);
    expect(bs.totalEquity).toBe(120000);

    // Fundamental Accounting Equation verification: Assets == Liabilities + Equity
    expect(bs.totalAssets).toBe(bs.totalLiabilities + bs.totalEquity);
  });

  it('generates accurate Cash Flow Statement for non-standard or BIR Chart of Accounts (e.g., 1010 Cash, 1610 Equipment)', () => {
    const birAccounts: ChartOfAccount[] = [
      { id: 'acc-bir-cash', orgId: 'org-1', code: '1010', name: 'Cash in Bank - BDO', class: AccountClass.ASSET, isActive: true, isHeader: false },
      { id: 'acc-bir-ar', orgId: 'org-1', code: '1030', name: 'Accounts Receivable', class: AccountClass.ASSET, isActive: true, isHeader: false },
      { id: 'acc-bir-equip', orgId: 'org-1', code: '1610', name: 'Office Equipment & Computers', class: AccountClass.ASSET, isActive: true, isHeader: false },
      { id: 'acc-bir-ap', orgId: 'org-1', code: '2010', name: 'Vouchers Payable', class: AccountClass.LIABILITY, isActive: true, isHeader: false },
      { id: 'acc-bir-equity', orgId: 'org-1', code: '3010', name: 'Share Capital', class: AccountClass.EQUITY, isActive: true, isHeader: false },
      { id: 'acc-bir-rev', orgId: 'org-1', code: '4010', name: 'Tuition Fees', class: AccountClass.REVENUE, isActive: true, isHeader: false },
      { id: 'acc-bir-exp', orgId: 'org-1', code: '5010', name: 'Instructors Payroll', class: AccountClass.EXPENSE, isActive: true, isHeader: false }
    ];

    const periodSummaries: TransactionSummary[] = [
      { accountId: 'acc-bir-cash', accountName: 'Cash in Bank - BDO', accountClass: AccountClass.ASSET, totalDebit: 80000, totalCredit: 20000, balance: 60000 },
      { accountId: 'acc-bir-ar', accountName: 'Accounts Receivable', accountClass: AccountClass.ASSET, totalDebit: 0, totalCredit: 0, balance: 0 },
      { accountId: 'acc-bir-equip', accountName: 'Office Equipment & Computers', accountClass: AccountClass.ASSET, totalDebit: 20000, totalCredit: 0, balance: 20000 },
      { accountId: 'acc-bir-ap', accountName: 'Vouchers Payable', accountClass: AccountClass.LIABILITY, totalDebit: 0, totalCredit: 0, balance: 0 },
      { accountId: 'acc-bir-equity', accountName: 'Share Capital', accountClass: AccountClass.EQUITY, totalDebit: 0, totalCredit: 50000, balance: 50000 },
      { accountId: 'acc-bir-rev', accountName: 'Tuition Fees', accountClass: AccountClass.REVENUE, totalDebit: 0, totalCredit: 50000, balance: 50000 },
      { accountId: 'acc-bir-exp', accountName: 'Instructors Payroll', accountClass: AccountClass.EXPENSE, totalDebit: 20000, totalCredit: 0, balance: 20000 }
    ];

    const openingSummaries: TransactionSummary[] = [
      { accountId: 'acc-bir-cash', accountName: 'Cash in Bank - BDO', accountClass: AccountClass.ASSET, totalDebit: 50000, totalCredit: 0, balance: 50000 }
    ];

    const lines = [
      // Purchase of computer equipment: ₱20,000 cash paid
      { id: 'l1', journalEntryId: 'je-1', orgId: 'org-1', accountId: 'acc-bir-equip', debit: 20000, credit: 0 },
      { id: 'l2', journalEntryId: 'je-1', orgId: 'org-1', accountId: 'acc-bir-cash', debit: 0, credit: 20000 }
    ];

    const cf = AccountingService.generateCashFlow(periodSummaries, birAccounts, lines, openingSummaries, periodSummaries);

    // Operating: Net Income = 50,000 - 20,000 = 30,000
    expect(cf.netIncome).toBe(30000);
    expect(cf.operatingCashFlow).toBe(30000);

    // Investing: ₱20,000 equipment purchase outflow (using account code 1610)
    expect(cf.investingCashFlow).toBe(-20000);

    // Net Cash Flow = 30,000 - 20,000 = 10,000
    expect(cf.netCashFlow).toBe(10000);

    // Beginning cash = 50,000, Ending cash = 60,000
    expect(cf.beginningCash).toBe(50000);
    expect(cf.endingCash).toBe(60000);
    expect(cf.beginningCash + cf.netCashFlow).toBe(cf.endingCash);
  });
});
