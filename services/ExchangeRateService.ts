import { ExchangeRate, CurrencyConversion, JournalLine } from '../types';

/**
 * ExchangeRateService
 * Handles multi-currency operations including:
 * - Exchange rate management
 * - Currency conversion calculations
 * - Unrealized gain/loss tracking
 * - Historical rate lookups
 */
export class ExchangeRateService {
  /**
   * Get the most recent exchange rate between two currencies for a given date
   */
  static getExchangeRate(
    rates: ExchangeRate[],
    fromCurrency: string,
    toCurrency: string,
    onDate: string,
    orgId: string
  ): ExchangeRate | null {
    if (fromCurrency === toCurrency) {
      return {
        id: 'implicit',
        orgId,
        fromCurrency,
        toCurrency,
        rate: 1,
        effectiveDate: onDate,
        source: 'IMPLICIT',
        isManual: false,
        createdAt: new Date().toISOString()
      };
    }

    // Find rates for this org and currency pair, effective on or before the given date
    const applicableRates = rates.filter(r =>
      r.orgId === orgId &&
      r.fromCurrency === fromCurrency &&
      r.toCurrency === toCurrency &&
      r.effectiveDate <= onDate &&
      !r.isDeleted
    );

    if (applicableRates.length === 0) {
      return null; // No rate found
    }

    // Return the most recent rate
    return applicableRates.sort((a, b) =>
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    )[0];
  }

  /**
   * Get the inverse rate (e.g., PHP to USD if we have USD to PHP)
   */
  static getInverseRate(
    rates: ExchangeRate[],
    fromCurrency: string,
    toCurrency: string,
    onDate: string,
    orgId: string
  ): ExchangeRate | null {
    // Try direct rate first
    let rate = this.getExchangeRate(rates, fromCurrency, toCurrency, onDate, orgId);
    if (rate) return rate;

    // Try inverse rate
    rate = this.getExchangeRate(rates, toCurrency, fromCurrency, onDate, orgId);
    if (rate) {
      return {
        ...rate,
        fromCurrency: toCurrency,
        toCurrency: fromCurrency,
        rate: 1 / rate.rate
      };
    }

    return null;
  }

  /**
   * Convert an amount from one currency to another using the rate as of a specific date
   */
  static convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rate: number
  ): CurrencyConversion {
    if (fromCurrency === toCurrency) {
      return {
        originalAmount: amount,
        originalCurrency: fromCurrency,
        targetCurrency: toCurrency,
        rate: 1,
        convertedAmount: amount,
        rateDate: new Date().toISOString().split('T')[0]
      };
    }

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      targetCurrency: toCurrency,
      rate,
      convertedAmount: amount * rate,
      rateDate: new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Calculate unrealized gain/loss on a foreign currency balance
   * Compares the original transaction rate to the current period-end rate
   */
  static calculateUnrealizedGainLoss(
    foreignAmount: number,
    transactionRate: number,
    periodEndRate: number,
    functionalCurrency: string
  ): {
    functionalCurrencyAmount: number;
    transactionAmount: number;
    unrealizedGainLoss: number;
    isGain: boolean;
  } {
    const transactionAmount = foreignAmount * transactionRate;
    const functionalCurrencyAmount = foreignAmount * periodEndRate;
    const unrealizedGainLoss = functionalCurrencyAmount - transactionAmount;

    return {
      functionalCurrencyAmount: Math.round(functionalCurrencyAmount * 100) / 100,
      transactionAmount: Math.round(transactionAmount * 100) / 100,
      unrealizedGainLoss: Math.round(unrealizedGainLoss * 100) / 100,
      isGain: unrealizedGainLoss > 0
    };
  }

  /**
   * Generate journal entry lines for unrealized gain/loss on a foreign currency balance
   * Returns array of lines to be added to a period-end adjustment entry
   */
  static generateUnrealizedGainLossEntries(
    foreignAmount: number,
    foreignCurrency: string,
    transactionRate: number,
    periodEndRate: number,
    functionalCurrency: string,
    gainAccountId: string,
    lossAccountId: string,
    assetAccountId: string
  ): Partial<JournalLine>[] {
    const gapl = this.calculateUnrealizedGainLoss(
      foreignAmount,
      transactionRate,
      periodEndRate,
      functionalCurrency
    );

    if (Math.abs(gapl.unrealizedGainLoss) < 0.01) {
      return []; // Negligible
    }

    const lines: Partial<JournalLine>[] = [];

    if (gapl.isGain) {
      // Debit asset account, credit gain account
      lines.push({
        accountId: assetAccountId,
        debit: Math.abs(gapl.unrealizedGainLoss),
        credit: 0,
        memo: `Unrealized gain on ${foreignCurrency} at ${periodEndRate.toFixed(8)}`
      });
      lines.push({
        accountId: gainAccountId,
        debit: 0,
        credit: Math.abs(gapl.unrealizedGainLoss),
        memo: `Unrealized gain on ${foreignCurrency}`
      });
    } else {
      // Debit loss account, credit asset account
      lines.push({
        accountId: lossAccountId,
        debit: Math.abs(gapl.unrealizedGainLoss),
        credit: 0,
        memo: `Unrealized loss on ${foreignCurrency} at ${periodEndRate.toFixed(8)}`
      });
      lines.push({
        accountId: assetAccountId,
        debit: 0,
        credit: Math.abs(gapl.unrealizedGainLoss),
        memo: `Unrealized loss on ${foreignCurrency}`
      });
    }

    return lines;
  }

  /**
   * Check if a rate needs adjustment based on percentage change threshold
   * Useful for triggering revaluation processes
   */
  static needsRevaluation(
    previousRate: number,
    currentRate: number,
    thresholdPercent: number = 1 // 1% threshold
  ): boolean {
    if (previousRate === 0) return true;
    const change = Math.abs((currentRate - previousRate) / previousRate) * 100;
    return change >= thresholdPercent;
  }

  /**
   * Get all active rates for an organization on a specific date
   * Useful for generating lists of rates in use
   */
  static getActiveRatesForDate(
    rates: ExchangeRate[],
    orgId: string,
    onDate: string
  ): ExchangeRate[] {
    const uniquePairs = new Map<string, ExchangeRate>();

    rates
      .filter(r =>
        r.orgId === orgId &&
        r.effectiveDate <= onDate &&
        !r.isDeleted
      )
      .forEach(rate => {
        const key = `${rate.fromCurrency}-${rate.toCurrency}`;
        const existing = uniquePairs.get(key);
        // Keep the most recent rate for each pair
        if (!existing || new Date(rate.effectiveDate) > new Date(existing.effectiveDate)) {
          uniquePairs.set(key, rate);
        }
      });

    return Array.from(uniquePairs.values());
  }

  /**
   * Validate exchange rate data
   */
  static validateRate(rate: Partial<ExchangeRate>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!rate.fromCurrency || rate.fromCurrency.length !== 3) {
      errors.push('From currency must be a valid 3-letter ISO code');
    }
    if (!rate.toCurrency || rate.toCurrency.length !== 3) {
      errors.push('To currency must be a valid 3-letter ISO code');
    }
    if (rate.fromCurrency === rate.toCurrency) {
      errors.push('From and to currencies cannot be the same');
    }
    if (!rate.rate || rate.rate <= 0) {
      errors.push('Exchange rate must be greater than 0');
    }
    if (!rate.effectiveDate) {
      errors.push('Effective date is required');
    }
    if (rate.rate && rate.rate > 1000000) {
      errors.push('Exchange rate seems unusually high (greater than 1,000,000)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
