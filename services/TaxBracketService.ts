/**
 * TaxBracketService
 * 
 * Handles Philippine BIR withholding tax calculations based on configurable tax brackets.
 * Supports multiple pay frequencies and allows for future tax table updates.
 * 
 * Default tables follow BIR TRAIN Law (RA 10963) withholding tax rates.
 */

import { TaxBracket, TaxTable, TaxCalculationResult, PayFrequency } from '../types';

/**
 * BIR 2024 Monthly Withholding Tax Table
 * Based on TRAIN Law (effective January 2018, updated rates)
 * 
 * Reference: BIR Revenue Regulations
 */
const BIR_2024_MONTHLY_BRACKETS: Omit<TaxBracket, 'id' | 'orgId' | 'tableId'>[] = [
  {
    bracketNumber: 1,
    minAmount: 0,
    maxAmount: 10416.99,
    baseTax: 0,
    rate: 0,
    overAmount: 0,
    description: '₱10,416.99 and below - Exempt'
  },
  {
    bracketNumber: 2,
    minAmount: 10417.00,
    maxAmount: 16666.99,
    baseTax: 0,
    rate: 0.15,
    overAmount: 10417.00,
    description: '₱10,417 - ₱16,666.99 @ 15%'
  },
  {
    bracketNumber: 3,
    minAmount: 16667.00,
    maxAmount: 33332.99,
    baseTax: 937.50,
    rate: 0.20,
    overAmount: 16667.00,
    description: '₱16,667 - ₱33,332.99 @ 20%'
  },
  {
    bracketNumber: 4,
    minAmount: 33333.00,
    maxAmount: 83332.99,
    baseTax: 4270.70,
    rate: 0.25,
    overAmount: 33333.00,
    description: '₱33,333 - ₱83,332.99 @ 25%'
  },
  {
    bracketNumber: 5,
    minAmount: 83333.00,
    maxAmount: 333332.99,
    baseTax: 16770.70,
    rate: 0.30,
    overAmount: 83333.00,
    description: '₱83,333 - ₱333,332.99 @ 30%'
  },
  {
    bracketNumber: 6,
    minAmount: 333333.00,
    maxAmount: null,
    baseTax: 91770.70,
    rate: 0.35,
    overAmount: 333333.00,
    description: '₱333,333 and above @ 35%'
  }
];

/**
 * BIR 2024 Semi-Monthly Withholding Tax Table
 * Values are half of monthly amounts
 */
const BIR_2024_SEMIMONTHLY_BRACKETS: Omit<TaxBracket, 'id' | 'orgId' | 'tableId'>[] = [
  {
    bracketNumber: 1,
    minAmount: 0,
    maxAmount: 5208.49,
    baseTax: 0,
    rate: 0,
    overAmount: 0,
    description: '₱5,208.49 and below - Exempt'
  },
  {
    bracketNumber: 2,
    minAmount: 5208.50,
    maxAmount: 8333.49,
    baseTax: 0,
    rate: 0.15,
    overAmount: 5208.50,
    description: '₱5,208.50 - ₱8,333.49 @ 15%'
  },
  {
    bracketNumber: 3,
    minAmount: 8333.50,
    maxAmount: 16666.49,
    baseTax: 468.75,
    rate: 0.20,
    overAmount: 8333.50,
    description: '₱8,333.50 - ₱16,666.49 @ 20%'
  },
  {
    bracketNumber: 4,
    minAmount: 16666.50,
    maxAmount: 41666.49,
    baseTax: 2135.35,
    rate: 0.25,
    overAmount: 16666.50,
    description: '₱16,666.50 - ₱41,666.49 @ 25%'
  },
  {
    bracketNumber: 5,
    minAmount: 41666.50,
    maxAmount: 166666.49,
    baseTax: 8385.35,
    rate: 0.30,
    overAmount: 41666.50,
    description: '₱41,666.50 - ₱166,666.49 @ 30%'
  },
  {
    bracketNumber: 6,
    minAmount: 166666.50,
    maxAmount: null,
    baseTax: 45885.35,
    rate: 0.35,
    overAmount: 166666.50,
    description: '₱166,666.50 and above @ 35%'
  }
];

/**
 * BIR 2024 Weekly Withholding Tax Table
 */
const BIR_2024_WEEKLY_BRACKETS: Omit<TaxBracket, 'id' | 'orgId' | 'tableId'>[] = [
  {
    bracketNumber: 1,
    minAmount: 0,
    maxAmount: 2403.84,
    baseTax: 0,
    rate: 0,
    overAmount: 0,
    description: '₱2,403.84 and below - Exempt'
  },
  {
    bracketNumber: 2,
    minAmount: 2403.85,
    maxAmount: 3846.14,
    baseTax: 0,
    rate: 0.15,
    overAmount: 2403.85,
    description: '₱2,403.85 - ₱3,846.14 @ 15%'
  },
  {
    bracketNumber: 3,
    minAmount: 3846.15,
    maxAmount: 7692.30,
    baseTax: 216.35,
    rate: 0.20,
    overAmount: 3846.15,
    description: '₱3,846.15 - ₱7,692.30 @ 20%'
  },
  {
    bracketNumber: 4,
    minAmount: 7692.31,
    maxAmount: 19230.76,
    baseTax: 985.58,
    rate: 0.25,
    overAmount: 7692.31,
    description: '₱7,692.31 - ₱19,230.76 @ 25%'
  },
  {
    bracketNumber: 5,
    minAmount: 19230.77,
    maxAmount: 76923.07,
    baseTax: 3870.19,
    rate: 0.30,
    overAmount: 19230.77,
    description: '₱19,230.77 - ₱76,923.07 @ 30%'
  },
  {
    bracketNumber: 6,
    minAmount: 76923.08,
    maxAmount: null,
    baseTax: 21177.88,
    rate: 0.35,
    overAmount: 76923.08,
    description: '₱76,923.08 and above @ 35%'
  }
];

/**
 * BIR 2024 Daily Withholding Tax Table
 */
const BIR_2024_DAILY_BRACKETS: Omit<TaxBracket, 'id' | 'orgId' | 'tableId'>[] = [
  {
    bracketNumber: 1,
    minAmount: 0,
    maxAmount: 343.41,
    baseTax: 0,
    rate: 0,
    overAmount: 0,
    description: '₱343.41 and below - Exempt'
  },
  {
    bracketNumber: 2,
    minAmount: 343.42,
    maxAmount: 549.45,
    baseTax: 0,
    rate: 0.15,
    overAmount: 343.42,
    description: '₱343.42 - ₱549.45 @ 15%'
  },
  {
    bracketNumber: 3,
    minAmount: 549.46,
    maxAmount: 1098.90,
    baseTax: 30.91,
    rate: 0.20,
    overAmount: 549.46,
    description: '₱549.46 - ₱1,098.90 @ 20%'
  },
  {
    bracketNumber: 4,
    minAmount: 1098.91,
    maxAmount: 2747.25,
    baseTax: 140.80,
    rate: 0.25,
    overAmount: 1098.91,
    description: '₱1,098.91 - ₱2,747.25 @ 25%'
  },
  {
    bracketNumber: 5,
    minAmount: 2747.26,
    maxAmount: 10989.01,
    baseTax: 552.88,
    rate: 0.30,
    overAmount: 2747.26,
    description: '₱2,747.26 - ₱10,989.01 @ 30%'
  },
  {
    bracketNumber: 6,
    minAmount: 10989.02,
    maxAmount: null,
    baseTax: 3025.41,
    rate: 0.35,
    overAmount: 10989.02,
    description: '₱10,989.02 and above @ 35%'
  }
];

export class TaxBracketService {
  /**
   * Get default BIR 2024 tax brackets based on pay frequency
   */
  static getDefaultBrackets(frequency: PayFrequency): Omit<TaxBracket, 'id' | 'orgId' | 'tableId'>[] {
    switch (frequency) {
      case 'MONTHLY':
        return BIR_2024_MONTHLY_BRACKETS;
      case 'SEMI_MONTHLY':
        return BIR_2024_SEMIMONTHLY_BRACKETS;
      case 'WEEKLY':
        return BIR_2024_WEEKLY_BRACKETS;
      case 'DAILY':
        return BIR_2024_DAILY_BRACKETS;
      default:
        return BIR_2024_MONTHLY_BRACKETS;
    }
  }

  /**
   * Calculate withholding tax using provided brackets
   */
  static calculateWithholdingTax(
    grossCompensation: number,
    brackets: Pick<TaxBracket, 'bracketNumber' | 'minAmount' | 'maxAmount' | 'baseTax' | 'rate' | 'overAmount' | 'description'>[]
  ): TaxCalculationResult {
    // Sort brackets by minAmount ascending
    const sortedBrackets = [...brackets].sort((a, b) => a.minAmount - b.minAmount);
    
    // Find applicable bracket
    let applicableBracket = sortedBrackets[0];
    for (const bracket of sortedBrackets) {
      if (grossCompensation >= bracket.minAmount) {
        if (bracket.maxAmount === null || grossCompensation <= bracket.maxAmount) {
          applicableBracket = bracket;
          break;
        }
        // Keep going to find the correct bracket
        applicableBracket = bracket;
      }
    }

    // Calculate tax
    const excessAmount = Math.max(0, grossCompensation - applicableBracket.overAmount);
    const taxOnExcess = excessAmount * applicableBracket.rate;
    const totalWithholdingTax = applicableBracket.baseTax + taxOnExcess;

    return {
      grossCompensation,
      taxableIncome: grossCompensation,
      bracketNumber: applicableBracket.bracketNumber,
      bracketDescription: applicableBracket.description,
      baseTax: applicableBracket.baseTax,
      excessAmount,
      taxOnExcess,
      totalWithholdingTax: Math.round(totalWithholdingTax * 100) / 100
    };
  }

  /**
   * Calculate withholding tax using default BIR brackets
   */
  static calculateWithDefault(
    grossCompensation: number,
    frequency: PayFrequency = 'MONTHLY'
  ): TaxCalculationResult {
    const brackets = this.getDefaultBrackets(frequency);
    return this.calculateWithholdingTax(grossCompensation, brackets);
  }

  /**
   * Create a new tax table with brackets
   */
  static createTaxTable(
    orgId: string,
    name: string,
    frequency: PayFrequency,
    brackets: Omit<TaxBracket, 'id' | 'orgId' | 'tableId'>[],
    options?: {
      description?: string;
      effectiveFrom?: string;
      effectiveTo?: string;
      country?: string;
      version?: string;
      isDefault?: boolean;
    }
  ): { table: Partial<TaxTable>; brackets: Partial<TaxBracket>[] } {
    const tableId = `tax-table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const table: Partial<TaxTable> = {
      id: tableId,
      orgId,
      name,
      description: options?.description,
      frequency,
      effectiveFrom: options?.effectiveFrom || new Date().toISOString().split('T')[0],
      effectiveTo: options?.effectiveTo,
      isDefault: options?.isDefault ?? false,
      country: options?.country || 'PH',
      version: options?.version || '2024'
    };

    const fullBrackets: Partial<TaxBracket>[] = brackets.map((b, index) => ({
      id: `tax-bracket-${tableId}-${index + 1}`,
      orgId,
      tableId,
      ...b
    }));

    return { table, brackets: fullBrackets };
  }

  /**
   * Get bracket summary for display
   */
  static getBracketSummary(brackets: Pick<TaxBracket, 'bracketNumber' | 'minAmount' | 'maxAmount' | 'baseTax' | 'rate'>[]): string[] {
    return brackets.map(b => {
      const maxStr = b.maxAmount === null ? 'above' : `₱${b.maxAmount.toLocaleString()}`;
      const rateStr = b.rate > 0 ? `${(b.rate * 100).toFixed(0)}%` : 'Exempt';
      return `Bracket ${b.bracketNumber}: ₱${b.minAmount.toLocaleString()} - ${maxStr} → ${rateStr}`;
    });
  }

  /**
   * Format currency for display
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  /**
   * Get tax calculation explanation for paystub
   */
  static getCalculationExplanation(result: TaxCalculationResult): string {
    if (result.totalWithholdingTax === 0) {
      return `Gross: ${this.formatCurrency(result.grossCompensation)} - Tax exempt (below threshold)`;
    }
    
    return `Gross: ${this.formatCurrency(result.grossCompensation)} → ` +
           `Base tax: ${this.formatCurrency(result.baseTax)} + ` +
           `${this.formatCurrency(result.excessAmount)} excess × rate = ` +
           `${this.formatCurrency(result.taxOnExcess)} → ` +
           `Total WHT: ${this.formatCurrency(result.totalWithholdingTax)}`;
  }

  /**
   * Get all default tax tables (for initialization)
   */
  static getDefaultTaxTables(orgId: string): { table: Partial<TaxTable>; brackets: Partial<TaxBracket>[] }[] {
    const frequencies: PayFrequency[] = ['MONTHLY', 'SEMI_MONTHLY', 'WEEKLY', 'DAILY'];
    const frequencyLabels: Record<PayFrequency, string> = {
      'MONTHLY': 'Monthly',
      'SEMI_MONTHLY': 'Semi-Monthly',
      'WEEKLY': 'Weekly',
      'DAILY': 'Daily'
    };

    return frequencies.map(freq => 
      this.createTaxTable(
        orgId,
        `BIR 2024 ${frequencyLabels[freq]} Withholding Tax`,
        freq,
        this.getDefaultBrackets(freq),
        {
          description: `Philippine BIR withholding tax table for ${frequencyLabels[freq].toLowerCase()} payroll`,
          effectiveFrom: '2024-01-01',
          country: 'PH',
          version: 'TRAIN Law 2024',
          isDefault: true
        }
      )
    );
  }
}
