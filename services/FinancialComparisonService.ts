import { TransactionSummary, ChartOfAccount, JournalLine, JournalEntry, AccountingPeriod } from '../types';
import { AccountingService } from '../accountingService';

/**
 * FinancialComparisonService
 * Provides year-over-year (YoY) and period-over-period financial analysis
 */
export class FinancialComparisonService {
  /**
   * Calculate variance between two periods
   */
  static calculateVariance(
    currentAmount: number,
    previousAmount: number
  ): {
    variance: number;
    variancePercent: number;
    trend: 'increase' | 'decrease' | 'no_change';
  } {
    const variance = currentAmount - previousAmount;
    const variancePercent = previousAmount === 0 
      ? (currentAmount === 0 ? 0 : 100)
      : (variance / Math.abs(previousAmount)) * 100;

    let trend: 'increase' | 'decrease' | 'no_change' = 'no_change';
    if (variance > 0.01) trend = 'increase';
    if (variance < -0.01) trend = 'decrease';

    return {
      variance: Math.round(variance * 100) / 100,
      variancePercent: Math.round(variancePercent * 100) / 100,
      trend
    };
  }

  /**
   * Generate Balance Sheet comparison between two dates
   */
  static generateBalanceSheetComparison(
    currentSummaries: TransactionSummary[],
    previousSummaries: TransactionSummary[],
    accounts: ChartOfAccount[]
  ) {
    const currentBS = AccountingService.generateBalanceSheet(currentSummaries, accounts);
    const previousBS = AccountingService.generateBalanceSheet(previousSummaries, accounts);

    // Compare assets
    const assetsComparison = this.compareAccountLines(
      currentBS.assets,
      previousBS.assets
    );

    // Compare liabilities
    const liabilitiesComparison = this.compareAccountLines(
      currentBS.liabilities,
      previousBS.liabilities
    );

    // Compare equity
    const equityComparison = this.compareAccountLines(
      currentBS.equity,
      previousBS.equity
    );

    // Summary variances
    const totalAssetsVariance = this.calculateVariance(
      currentBS.totalAssets,
      previousBS.totalAssets
    );
    const totalLiabilitiesVariance = this.calculateVariance(
      currentBS.totalLiabilities,
      previousBS.totalLiabilities
    );
    const totalEquityVariance = this.calculateVariance(
      currentBS.totalEquity,
      previousBS.totalEquity
    );

    return {
      current: currentBS,
      previous: previousBS,
      assetsComparison,
      liabilitiesComparison,
      equityComparison,
      totalAssetsVariance,
      totalLiabilitiesVariance,
      totalEquityVariance,
      // Ratio analysis
      currentDebtToEquity: currentBS.totalLiabilities / Math.max(currentBS.totalEquity, 1),
      previousDebtToEquity: previousBS.totalLiabilities / Math.max(previousBS.totalEquity, 1),
      currentWorkingCapital: currentBS.assets[0]?.balance || 0 - currentBS.liabilities[0]?.balance || 0,
      previousWorkingCapital: previousBS.assets[0]?.balance || 0 - previousBS.liabilities[0]?.balance || 0
    };
  }

  /**
   * Generate Income Statement comparison between two periods
   */
  static generateIncomeStatementComparison(
    currentSummaries: TransactionSummary[],
    previousSummaries: TransactionSummary[],
    accounts: ChartOfAccount[]
  ) {
    const currentIS = AccountingService.generateIncomeStatement(currentSummaries, accounts);
    const previousIS = AccountingService.generateIncomeStatement(previousSummaries, accounts);

    // Compare revenue
    const revenueComparison = this.compareAccountLines(
      currentIS.revenue,
      previousIS.revenue
    );

    // Compare expenses
    const expensesComparison = this.compareAccountLines(
      currentIS.expenses,
      previousIS.expenses
    );

    // Summary variances
    const totalRevenueVariance = this.calculateVariance(
      currentIS.totalRevenue,
      previousIS.totalRevenue
    );
    const totalExpensesVariance = this.calculateVariance(
      currentIS.totalExpenses,
      previousIS.totalExpenses
    );
    const netIncomeVariance = this.calculateVariance(
      currentIS.netIncome,
      previousIS.netIncome
    );

    // Profitability ratios
    const currentGrossMargin = currentIS.totalRevenue === 0 
      ? 0 
      : ((currentIS.totalRevenue - currentIS.totalExpenses) / currentIS.totalRevenue) * 100;
    const previousGrossMargin = previousIS.totalRevenue === 0 
      ? 0 
      : ((previousIS.totalRevenue - previousIS.totalExpenses) / previousIS.totalRevenue) * 100;

    return {
      current: currentIS,
      previous: previousIS,
      revenueComparison,
      expensesComparison,
      totalRevenueVariance,
      totalExpensesVariance,
      netIncomeVariance,
      currentGrossMargin: Math.round(currentGrossMargin * 100) / 100,
      previousGrossMargin: Math.round(previousGrossMargin * 100) / 100,
      marginVariance: Math.round((currentGrossMargin - previousGrossMargin) * 100) / 100
    };
  }

  /**
   * Compare two sets of account lines for variance analysis
   */
  static compareAccountLines(
    current: Array<{ accountId: string; accountName: string; balance: number }>,
    previous: Array<{ accountId: string; accountName: string; balance: number }>
  ) {
    const previousMap = new Map(previous.map(a => [a.accountId, a]));

    return current.map(currAccount => {
      const prevAccount = previousMap.get(currAccount.accountId);
      const previousBalance = prevAccount?.balance || 0;

      const variance = this.calculateVariance(currAccount.balance, previousBalance);

      return {
        accountId: currAccount.accountId,
        accountName: currAccount.accountName,
        current: currAccount.balance,
        previous: previousBalance,
        ...variance
      };
    });
  }

  /**
   * Calculate key financial metrics for comparison
   */
  static calculateFinancialMetrics(summaries: TransactionSummary[], accounts: ChartOfAccount[]) {
    const bs = AccountingService.generateBalanceSheet(summaries, accounts);
    const is = AccountingService.generateIncomeStatement(summaries, accounts);

    return {
      // Liquidity Ratios
      currentRatio: bs.assets[0]?.balance || 0 / Math.max(bs.liabilities[0]?.balance || 1, 1),
      quickRatio: (bs.assets[0]?.balance || 0 - (bs.assets[1]?.balance || 0)) / Math.max(bs.liabilities[0]?.balance || 1, 1),
      
      // Profitability Ratios
      netProfitMargin: is.totalRevenue === 0 ? 0 : (is.netIncome / is.totalRevenue) * 100,
      returnOnAssets: bs.totalAssets === 0 ? 0 : (is.netIncome / bs.totalAssets) * 100,
      returnOnEquity: bs.totalEquity === 0 ? 0 : (is.netIncome / bs.totalEquity) * 100,
      
      // Efficiency Ratios
      assetTurnover: bs.totalAssets === 0 ? 0 : is.totalRevenue / bs.totalAssets,
      equityMultiplier: bs.totalEquity === 0 ? 0 : bs.totalAssets / bs.totalEquity,
      
      // Solvency Ratios
      debtToEquity: bs.totalEquity === 0 ? 0 : bs.totalLiabilities / bs.totalEquity,
      debtToAssets: bs.totalAssets === 0 ? 0 : bs.totalLiabilities / bs.totalAssets,
      equityRatio: bs.totalAssets === 0 ? 0 : bs.totalEquity / bs.totalAssets
    };
  }

  /**
   * Calculate metrics comparison
   */
  static compareMetrics(
    currentMetrics: ReturnType<typeof this.calculateFinancialMetrics>,
    previousMetrics: ReturnType<typeof this.calculateFinancialMetrics>
  ) {
    const comparison: any = {};

    Object.entries(currentMetrics).forEach(([key, currentValue]) => {
      const previousValue = previousMetrics[key as keyof typeof previousMetrics];
      if (typeof currentValue === 'number') {
        comparison[key] = {
          current: Math.round(currentValue * 10000) / 10000,
          previous: Math.round(previousValue * 10000) / 10000,
          variance: Math.round((currentValue - previousValue) * 10000) / 10000,
          variancePercent: previousValue === 0 
            ? 0 
            : Math.round(((currentValue - previousValue) / Math.abs(previousValue)) * 10000) / 100
        };
      }
    });

    return comparison;
  }

  /**
   * Generate detailed variance analysis report
   */
  static generateVarianceAnalysis(
    currentSummaries: TransactionSummary[],
    previousSummaries: TransactionSummary[],
    accounts: ChartOfAccount[],
    threshold: number = 5 // 5% default threshold
  ) {
    const isComparison = this.generateIncomeStatementComparison(
      currentSummaries,
      previousSummaries,
      accounts
    );

    // Find significant variances
    const significantVariances = [
      ...isComparison.revenueComparison,
      ...isComparison.expensesComparison
    ]
      .filter(item => Math.abs(item.variancePercent) >= threshold)
      .sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent));

    return {
      comparison: isComparison,
      significantVariances,
      summary: {
        totalRevenueVariance: isComparison.totalRevenueVariance,
        totalExpensesVariance: isComparison.totalExpensesVariance,
        netIncomeVariance: isComparison.netIncomeVariance,
        accountsWithMajorVariance: significantVariances.length
      }
    };
  }

  /**
   * Calculate year-over-year growth rates
   */
  static calculateYoYGrowth(
    currentAmount: number,
    yearAgoAmount: number
  ): number {
    if (yearAgoAmount === 0) return currentAmount === 0 ? 0 : 100;
    return Math.round(((currentAmount - yearAgoAmount) / Math.abs(yearAgoAmount)) * 10000) / 100;
  }

  /**
   * Generate multi-period comparison (e.g., last 4 quarters)
   */
  static generateMultiPeriodComparison(
    periodSummaries: Array<{ summaries: TransactionSummary[]; label: string; date: string }>,
    accounts: ChartOfAccount[]
  ) {
    const periods = periodSummaries.map(p => ({
      label: p.label,
      date: p.date,
      totalAssets: AccountingService.generateBalanceSheet(p.summaries, accounts).totalAssets,
      totalLiabilities: AccountingService.generateBalanceSheet(p.summaries, accounts).totalLiabilities,
      totalEquity: AccountingService.generateBalanceSheet(p.summaries, accounts).totalEquity,
      totalRevenue: AccountingService.generateIncomeStatement(p.summaries, accounts).totalRevenue,
      totalExpenses: AccountingService.generateIncomeStatement(p.summaries, accounts).totalExpenses,
      netIncome: AccountingService.generateIncomeStatement(p.summaries, accounts).netIncome
    }));

    // Calculate period-over-period growth
    const growth = periods.map((period, index) => {
      if (index === 0) {
        return {
          label: period.label,
          assetGrowth: 0,
          revenueGrowth: 0,
          incomeGrowth: 0
        };
      }

      const previous = periods[index - 1];
      return {
        label: period.label,
        assetGrowth: this.calculateYoYGrowth(period.totalAssets, previous.totalAssets),
        revenueGrowth: this.calculateYoYGrowth(period.totalRevenue, previous.totalRevenue),
        incomeGrowth: this.calculateYoYGrowth(period.netIncome, previous.netIncome)
      };
    });

    return {
      periods,
      growth
    };
  }

  /**
   * Generate comparison summary text
   */
  static generateSummary(variance: ReturnType<typeof this.calculateVariance>): string {
    const { variancePercent, trend } = variance;
    
    if (trend === 'no_change') {
      return 'No significant change';
    }

    const direction = trend === 'increase' ? 'increased' : 'decreased';
    const absPercent = Math.abs(variancePercent);

    if (absPercent >= 25) return `${direction} significantly by ${absPercent.toFixed(1)}%`;
    if (absPercent >= 10) return `${direction} substantially by ${absPercent.toFixed(1)}%`;
    if (absPercent >= 5) return `${direction} moderately by ${absPercent.toFixed(1)}%`;
    return `${direction} slightly by ${absPercent.toFixed(1)}%`;
  }

  /**
   * Format comparison data for display
   */
  static formatComparisonDisplay(
    currentValue: number,
    previousValue: number,
    currencyFormatter: (val: number) => string
  ) {
    const variance = this.calculateVariance(currentValue, previousValue);
    
    return {
      current: currencyFormatter(currentValue),
      previous: currencyFormatter(previousValue),
      variance: currencyFormatter(variance.variance),
      variancePercent: variance.variancePercent,
      trend: variance.trend,
      summary: this.generateSummary(variance)
    };
  }
}
