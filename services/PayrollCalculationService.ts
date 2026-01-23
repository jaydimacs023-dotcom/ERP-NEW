/**
 * PayrollCalculationService
 * 
 * Handles Philippine payroll calculations including:
 * - Overtime with DOLE-mandated rates
 * - 13th Month Pay computation
 * - Separation Pay computation
 * - Daily/hourly rate derivations
 * 
 * All calculations follow Philippine DOLE regulations.
 */

import { 
  OvertimeType, 
  OvertimeRateTable, 
  OvertimeEntry,
  ThirteenthMonthPay,
  SeparationType,
  SeparationPay,
  Employee
} from '../types';

// ============================================================================
// DOLE OVERTIME RATES (2024)
// ============================================================================

/**
 * DOLE-mandated overtime rate multipliers
 * Base: 100% = regular hourly rate
 */
const DOLE_OVERTIME_RATES: Record<OvertimeType, number> = {
  // Regular day
  'REGULAR_OT': 1.25,              // +25% for work beyond 8 hours
  
  // Rest day
  'REST_DAY': 1.30,                // +30% for working on rest day
  'REST_DAY_OT': 1.69,             // Rest day OT: 130% × 130% = 169%
  
  // Special Non-Working Holiday
  'SPECIAL_HOLIDAY': 1.30,         // +30% for special holiday
  'SPECIAL_HOLIDAY_OT': 1.69,      // Special holiday OT: 130% × 130% = 169%
  'SPECIAL_HOLIDAY_REST': 1.50,    // Special holiday on rest day: +50%
  'SPECIAL_HOLIDAY_REST_OT': 1.95, // 150% × 130% = 195%
  
  // Regular Holiday
  'REGULAR_HOLIDAY': 2.00,         // 200% for regular holiday (100% + 100%)
  'REGULAR_HOLIDAY_OT': 2.60,      // Regular holiday OT: 200% × 130% = 260%
  'REGULAR_HOLIDAY_REST': 2.60,    // Regular holiday on rest day: 200% + 30%
  'REGULAR_HOLIDAY_REST_OT': 3.38, // 260% × 130% = 338%
  
  // Double Holiday (Regular + Special on same day)
  'DOUBLE_HOLIDAY': 3.00,          // 300% for double holiday
  'DOUBLE_HOLIDAY_OT': 3.90,       // 300% × 130% = 390%
  
  // Night Differential (10pm - 6am)
  'NIGHT_DIFF': 0.10               // +10% of hourly rate
};

/**
 * Separation pay rates per DOLE
 * Based on years of service
 */
const SEPARATION_PAY_RATES: Partial<Record<SeparationType, { rate: number; basis: 'MONTH' | 'HALF_MONTH' }>> = {
  'RESIGNATION': { rate: 0, basis: 'MONTH' },              // No mandatory separation pay
  'RETIREMENT': { rate: 0.5, basis: 'MONTH' },             // 1/2 month per year (RA 7641)
  'REDUNDANCY': { rate: 1, basis: 'MONTH' },               // 1 month per year
  'RETRENCHMENT': { rate: 0.5, basis: 'MONTH' },           // 1/2 month per year or 1 month, whichever higher
  'CLOSURE': { rate: 0.5, basis: 'MONTH' },                // 1/2 month per year (non-serious losses)
  'DISEASE': { rate: 0.5, basis: 'MONTH' },                // 1/2 month per year
  'DEATH': { rate: 0.5, basis: 'MONTH' },                  // Benefits to heirs
  'AUTHORIZED_CAUSE': { rate: 1, basis: 'MONTH' },         // 1 month per year
  'JUST_CAUSE': { rate: 0, basis: 'MONTH' },               // No separation pay
  'CONSTRUCTIVE_DISMISSAL': { rate: 1, basis: 'MONTH' },   // Full back wages + separation
  'END_OF_CONTRACT': { rate: 0, basis: 'MONTH' }           // No mandatory pay
};

export class PayrollCalculationService {
  
  // ============================================================================
  // BASIC RATE CALCULATIONS
  // ============================================================================
  
  /**
   * Calculate daily rate from monthly salary
   * Using the 314-day divisor (most common)
   */
  static calculateDailyRate(monthlySalary: number, divisor: number = 314): number {
    // Daily Rate = (Monthly × 12) / Divisor
    // Common divisors: 314 (6 days/week), 261 (5 days/week), 365
    return Math.round(((monthlySalary * 12) / divisor) * 100) / 100;
  }

  /**
   * Calculate hourly rate from daily rate
   */
  static calculateHourlyRate(dailyRate: number, hoursPerDay: number = 8): number {
    return Math.round((dailyRate / hoursPerDay) * 100) / 100;
  }

  /**
   * Calculate hourly rate directly from monthly salary
   */
  static calculateHourlyRateFromMonthly(
    monthlySalary: number, 
    divisor: number = 314, 
    hoursPerDay: number = 8
  ): number {
    const dailyRate = this.calculateDailyRate(monthlySalary, divisor);
    return this.calculateHourlyRate(dailyRate, hoursPerDay);
  }

  /**
   * Get work days in a month (for salary calculation)
   */
  static getWorkDaysInMonth(year: number, month: number, workDaysPerWeek: number = 6): number {
    const date = new Date(year, month, 0); // Last day of month
    const daysInMonth = date.getDate();
    
    let workDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      const dayOfWeek = currentDate.getDay();
      
      // Check if it's a work day (not Sunday for 6-day week, not Sat/Sun for 5-day)
      if (workDaysPerWeek === 6 && dayOfWeek !== 0) {
        workDays++;
      } else if (workDaysPerWeek === 5 && dayOfWeek !== 0 && dayOfWeek !== 6) {
        workDays++;
      }
    }
    
    return workDays;
  }

  // ============================================================================
  // OVERTIME CALCULATIONS
  // ============================================================================

  /**
   * Get overtime rate multiplier
   */
  static getOvertimeMultiplier(
    overtimeType: OvertimeType, 
    customRates?: Record<OvertimeType, number>
  ): number {
    const rates = customRates || DOLE_OVERTIME_RATES;
    return rates[overtimeType] || 1;
  }

  /**
   * Calculate overtime pay
   */
  static calculateOvertimePay(
    hourlyRate: number,
    hours: number,
    overtimeType: OvertimeType,
    customRates?: Record<OvertimeType, number>
  ): { amount: number; multiplier: number } {
    const multiplier = this.getOvertimeMultiplier(overtimeType, customRates);
    const amount = Math.round((hourlyRate * hours * multiplier) * 100) / 100;
    
    return { amount, multiplier };
  }

  /**
   * Calculate night differential pay
   * Night diff is additional 10% of hourly rate for hours worked between 10pm-6am
   */
  static calculateNightDifferential(
    hourlyRate: number,
    nightDiffHours: number
  ): number {
    const nightDiffRate = DOLE_OVERTIME_RATES['NIGHT_DIFF'];
    return Math.round((hourlyRate * nightDiffHours * nightDiffRate) * 100) / 100;
  }

  /**
   * Calculate total overtime for multiple entries
   */
  static calculateTotalOvertime(
    entries: Pick<OvertimeEntry, 'hours' | 'overtimeType'>[],
    hourlyRate: number,
    customRates?: Record<OvertimeType, number>
  ): { 
    totalHours: number; 
    totalAmount: number; 
    breakdown: Record<OvertimeType, { hours: number; amount: number }> 
  } {
    const breakdown: Record<OvertimeType, { hours: number; amount: number }> = {} as any;
    let totalHours = 0;
    let totalAmount = 0;

    for (const entry of entries) {
      const { amount, multiplier } = this.calculateOvertimePay(
        hourlyRate, 
        entry.hours, 
        entry.overtimeType, 
        customRates
      );
      
      if (!breakdown[entry.overtimeType]) {
        breakdown[entry.overtimeType] = { hours: 0, amount: 0 };
      }
      
      breakdown[entry.overtimeType].hours += entry.hours;
      breakdown[entry.overtimeType].amount += amount;
      totalHours += entry.hours;
      totalAmount += amount;
    }

    return {
      totalHours,
      totalAmount: Math.round(totalAmount * 100) / 100,
      breakdown
    };
  }

  /**
   * Get default overtime rate table
   */
  static getDefaultOvertimeRates(): Record<OvertimeType, number> {
    return { ...DOLE_OVERTIME_RATES };
  }

  // ============================================================================
  // 13TH MONTH PAY CALCULATIONS
  // ============================================================================

  /**
   * Calculate 13th month pay
   * Formula: Total Basic Salary Earned During the Year / 12
   * 
   * @param monthlyBasicSalaries Array of monthly basic salaries for each month worked
   * @param separationDate Optional: if employee separated during the year
   */
  static calculateThirteenthMonthPay(
    monthlyBasicSalaries: number[],
    options?: {
      separationDate?: string;
      hireDate?: string;
      year?: number;
    }
  ): {
    totalBasicSalary: number;
    monthsWorked: number;
    thirteenthMonth: number;
    taxExemptPortion: number;
    taxablePortion: number;
    proRatedDays?: number;
  } {
    const totalBasicSalary = monthlyBasicSalaries.reduce((sum, salary) => sum + salary, 0);
    const monthsWorked = monthlyBasicSalaries.length;
    
    // 13th month = total basic / 12 (regardless of months worked)
    // If less than 12 months, it's automatically pro-rated
    const thirteenthMonth = Math.round((totalBasicSalary / 12) * 100) / 100;
    
    // Tax exemption: First ₱90,000 of 13th month and other bonuses is tax-exempt
    const TAX_EXEMPT_LIMIT = 90000;
    const taxExemptPortion = Math.min(thirteenthMonth, TAX_EXEMPT_LIMIT);
    const taxablePortion = Math.max(0, thirteenthMonth - TAX_EXEMPT_LIMIT);

    // Calculate pro-rated days for separated employees
    let proRatedDays: number | undefined;
    if (options?.separationDate && options?.year) {
      const sepDate = new Date(options.separationDate);
      const startOfYear = new Date(options.year, 0, 1);
      const hireDate = options.hireDate ? new Date(options.hireDate) : startOfYear;
      const effectiveStart = hireDate > startOfYear ? hireDate : startOfYear;
      
      // Calculate days worked
      const msPerDay = 24 * 60 * 60 * 1000;
      proRatedDays = Math.ceil((sepDate.getTime() - effectiveStart.getTime()) / msPerDay);
    }

    return {
      totalBasicSalary,
      monthsWorked,
      thirteenthMonth,
      taxExemptPortion,
      taxablePortion,
      proRatedDays
    };
  }

  /**
   * Calculate 13th month pay based on monthly salary and months worked
   * Simpler version for quick calculations
   */
  static calculateThirteenthMonthSimple(
    monthlyBasicSalary: number,
    monthsWorked: number
  ): number {
    const totalEarned = monthlyBasicSalary * monthsWorked;
    return Math.round((totalEarned / 12) * 100) / 100;
  }

  // ============================================================================
  // SEPARATION PAY CALCULATIONS
  // ============================================================================

  /**
   * Calculate separation pay based on type and years of service
   */
  static calculateSeparationPay(
    separationType: SeparationType,
    yearsOfService: number,
    monthsOfService: number,
    lastMonthlyBasic: number,
    lastDailyRate: number
  ): {
    separationPayAmount: number;
    rate: number;
    basis: 'MONTH' | 'HALF_MONTH';
    formula: string;
  } {
    const rateInfo = SEPARATION_PAY_RATES[separationType] || { rate: 0, basis: 'MONTH' as const };
    
    // Calculate total years including fractional
    const totalYears = yearsOfService + (monthsOfService / 12);
    
    // Round up to nearest whole year for separation pay calculation (DOLE practice)
    const roundedYears = Math.ceil(totalYears);
    
    let separationPayAmount: number;
    let formula: string;
    
    if (rateInfo.basis === 'HALF_MONTH') {
      // Half month salary per year of service
      separationPayAmount = (lastMonthlyBasic / 2) * roundedYears;
      formula = `(₱${lastMonthlyBasic.toLocaleString()} / 2) × ${roundedYears} years`;
    } else {
      // Full month salary per year of service × rate
      separationPayAmount = lastMonthlyBasic * rateInfo.rate * roundedYears;
      formula = `₱${lastMonthlyBasic.toLocaleString()} × ${rateInfo.rate} × ${roundedYears} years`;
    }
    
    // Special case: Retrenchment - higher of 1/2 month per year or 1 month pay
    if (separationType === 'RETRENCHMENT') {
      const oneMonthPay = lastMonthlyBasic;
      if (oneMonthPay > separationPayAmount) {
        separationPayAmount = oneMonthPay;
        formula = `₱${lastMonthlyBasic.toLocaleString()} (minimum 1 month)`;
      }
    }
    
    return {
      separationPayAmount: Math.round(separationPayAmount * 100) / 100,
      rate: rateInfo.rate,
      basis: rateInfo.basis,
      formula
    };
  }

  /**
   * Calculate complete final pay package for separated employee
   */
  static calculateFinalPay(params: {
    employee: Pick<Employee, 'basicSalary' | 'hireDate'>;
    separationType: SeparationType;
    separationDate: string;
    lastWorkingDay: string;
    
    // Leave conversion
    unusedVacationDays: number;
    unusedSickDays: number;
    
    // Current period earnings
    daysWorkedInFinalPeriod: number;
    overtimeInFinalPeriod: number;
    
    // 13th month
    monthsWorkedThisYear: number;
    
    // Other benefits
    otherBenefits?: number;
    
    // Deductions
    outstandingLoans?: number;
    otherDeductions?: number;
    
    // Rate configuration
    divisor?: number;
  }): {
    finalPay: Omit<SeparationPay, 'id' | 'orgId' | 'employeeId' | 'status' | 'processedBy' | 'approvedBy' | 'paidAt' | 'payrollRunId' | 'remarks'>;
    breakdown: {
      category: string;
      description: string;
      amount: number;
    }[];
  } {
    const { 
      employee, 
      separationType, 
      separationDate, 
      lastWorkingDay,
      unusedVacationDays,
      unusedSickDays,
      daysWorkedInFinalPeriod,
      overtimeInFinalPeriod,
      monthsWorkedThisYear,
      otherBenefits = 0,
      outstandingLoans = 0,
      otherDeductions = 0,
      divisor = 314
    } = params;

    const hireDate = new Date(employee.hireDate);
    const sepDate = new Date(separationDate);
    
    // Calculate years of service
    const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
    const totalServiceMs = sepDate.getTime() - hireDate.getTime();
    const yearsOfService = Math.floor(totalServiceMs / msPerYear);
    const monthsOfService = Math.floor((totalServiceMs % msPerYear) / (msPerYear / 12));
    
    const dailyRate = this.calculateDailyRate(employee.basicSalary, divisor);
    
    // Calculate separation pay
    const sepPay = this.calculateSeparationPay(
      separationType,
      yearsOfService,
      monthsOfService,
      employee.basicSalary,
      dailyRate
    );
    
    // Final basic pay (pro-rated for last period)
    const finalBasicPay = dailyRate * daysWorkedInFinalPeriod;
    
    // Leave conversion
    const totalUnusedLeaveDays = unusedVacationDays + unusedSickDays;
    const leaveConversion = dailyRate * totalUnusedLeaveDays;
    
    // 13th month pro-rated
    const thirteenthMonthProRated = this.calculateThirteenthMonthSimple(
      employee.basicSalary,
      monthsWorkedThisYear
    );
    
    // Gross final pay
    const grossFinalPay = 
      sepPay.separationPayAmount +
      finalBasicPay +
      leaveConversion +
      thirteenthMonthProRated +
      overtimeInFinalPeriod +
      otherBenefits;
    
    // Total deductions
    const totalDeductions = outstandingLoans + otherDeductions;
    
    // Net final pay
    const netFinalPay = grossFinalPay - totalDeductions;
    
    // Tax calculation (simplified - separation pay due to redundancy/retrenchment may be tax-exempt)
    const TAX_EXEMPT_SEPARATION_TYPES: SeparationType[] = [
      'REDUNDANCY', 'RETRENCHMENT', 'CLOSURE', 'DISEASE', 'RETIREMENT'
    ];
    const isSeparationPayTaxExempt = TAX_EXEMPT_SEPARATION_TYPES.includes(separationType);
    
    let taxableAmount = 0;
    if (!isSeparationPayTaxExempt) {
      taxableAmount = sepPay.separationPayAmount;
    }
    // 13th month is tax-exempt up to ₱90,000
    taxableAmount += Math.max(0, thirteenthMonthProRated - 90000);
    
    // Simplified withholding tax (actual computation depends on annualized income)
    const withholdingTax = taxableAmount > 0 ? taxableAmount * 0.15 : 0;

    const breakdown = [
      { category: 'Earnings', description: 'Final Basic Pay', amount: finalBasicPay },
      { category: 'Earnings', description: 'Overtime', amount: overtimeInFinalPeriod },
      { category: 'Earnings', description: 'Leave Conversion', amount: leaveConversion },
      { category: 'Earnings', description: '13th Month (Pro-rated)', amount: thirteenthMonthProRated },
      { category: 'Earnings', description: 'Separation Pay', amount: sepPay.separationPayAmount },
      { category: 'Earnings', description: 'Other Benefits', amount: otherBenefits },
      { category: 'Deductions', description: 'Outstanding Loans', amount: -outstandingLoans },
      { category: 'Deductions', description: 'Other Deductions', amount: -otherDeductions },
      { category: 'Deductions', description: 'Withholding Tax', amount: -withholdingTax }
    ].filter(item => item.amount !== 0);

    return {
      finalPay: {
        separationType,
        separationDate,
        lastWorkingDay,
        hireDate: employee.hireDate,
        yearsOfService,
        monthsOfService,
        lastMonthlyBasic: employee.basicSalary,
        lastDailyRate: dailyRate,
        separationPayRate: sepPay.rate,
        separationPayBase: sepPay.basis === 'HALF_MONTH' ? 'MONTHLY' : 'MONTHLY',
        separationPayAmount: sepPay.separationPayAmount,
        finalBasicPay,
        leaveConversion,
        thirteenthMonthProRated,
        otherBenefits,
        outstandingLoans,
        otherDeductions,
        grossFinalPay: Math.round(grossFinalPay * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        netFinalPay: Math.round(netFinalPay * 100) / 100,
        taxableAmount: Math.round(taxableAmount * 100) / 100,
        withholdingTax: Math.round(withholdingTax * 100) / 100
      },
      breakdown
    };
  }

  /**
   * Get separation pay rate info
   */
  static getSeparationPayRates(): typeof SEPARATION_PAY_RATES {
    return { ...SEPARATION_PAY_RATES };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

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
   * Get overtime type display name
   */
  static getOvertimeTypeName(type: OvertimeType): string {
    const names: Record<OvertimeType, string> = {
      'REGULAR_OT': 'Regular Overtime',
      'REST_DAY': 'Rest Day Work',
      'REST_DAY_OT': 'Rest Day Overtime',
      'SPECIAL_HOLIDAY': 'Special Holiday',
      'SPECIAL_HOLIDAY_OT': 'Special Holiday OT',
      'SPECIAL_HOLIDAY_REST': 'Special Holiday + Rest Day',
      'SPECIAL_HOLIDAY_REST_OT': 'Special Holiday + Rest Day OT',
      'REGULAR_HOLIDAY': 'Regular Holiday',
      'REGULAR_HOLIDAY_OT': 'Regular Holiday OT',
      'REGULAR_HOLIDAY_REST': 'Regular Holiday + Rest Day',
      'REGULAR_HOLIDAY_REST_OT': 'Regular Holiday + Rest Day OT',
      'DOUBLE_HOLIDAY': 'Double Holiday',
      'DOUBLE_HOLIDAY_OT': 'Double Holiday OT',
      'NIGHT_DIFF': 'Night Differential'
    };
    return names[type] || type;
  }

  /**
   * Get separation type display name
   */
  static getSeparationTypeName(type: SeparationType): string {
    const names: Record<SeparationType, string> = {
      'RESIGNATION': 'Voluntary Resignation',
      'RETIREMENT': 'Retirement',
      'REDUNDANCY': 'Redundancy',
      'RETRENCHMENT': 'Retrenchment',
      'CLOSURE': 'Business Closure',
      'DISEASE': 'Incurable Disease',
      'DEATH': 'Death',
      'AUTHORIZED_CAUSE': 'Authorized Cause',
      'JUST_CAUSE': 'Just Cause',
      'CONSTRUCTIVE_DISMISSAL': 'Constructive Dismissal',
      'END_OF_CONTRACT': 'End of Contract'
    };
    return names[type] || type;
  }
}
