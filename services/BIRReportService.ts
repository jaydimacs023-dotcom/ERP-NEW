/**
 * BIRReportService
 * 
 * Handles generation of Philippine BIR tax reports including:
 * - Alphalist (Annual Information Return)
 * - BIR Form 2316 (Certificate of Compensation)
 * - BIR Form 1601-C (Monthly Remittance)
 * - BIR Form 2307 (Certificate of Creditable Tax Withheld)
 * 
 * All forms follow BIR regulations and formats.
 */

import { 
  AlphalistEntry, 
  BIR2316Data, 
  BIR1601CData,
  BIRFormType,
  Employee,
  PayrollRun,
  PayrollLine
} from '../types';

import { TaxBracketService } from './TaxBracketService';

// ============================================================================
// BIR CONSTANTS
// ============================================================================

/**
 * De minimis benefits threshold (tax-exempt benefits)
 * Per BIR Revenue Regulations No. 11-2018
 */
const DE_MINIMIS_LIMITS = {
  riceSubsidy: 2000, // Per month
  uniformAllowance: 6000, // Per year
  medicalAllowance: 10000, // Per year
  laundryAllowance: 300, // Per month
  achievementAwards: 10000, // Per year
  christmasGift: 5000, // Per year
  productivityIncentive: 10000, // Per year
  mealAllowance: 2000 // Per month during overtime
};

/**
 * Tax-exempt compensation threshold
 */
const TAX_EXEMPT_THRESHOLDS = {
  thirteenthMonth: 90000, // 13th month and other benefits
  sssContributions: Infinity, // Fully exempt
  philHealthContributions: Infinity, // Fully exempt
  pagIBIGContributions: Infinity, // Fully exempt
  unionDues: Infinity // Fully exempt
};

/**
 * BIR RDO Codes (sample)
 */
const RDO_CODES: Record<string, string> = {
  'MANILA': '029',
  'QUEZON_CITY': '038',
  'MAKATI': '047',
  'PASIG': '043',
  'TAGUIG': '044',
  'CEBU': '083',
  'DAVAO': '112'
};

export class BIRReportService {

  // ============================================================================
  // ALPHALIST GENERATION
  // ============================================================================

  /**
   * Generate Alphalist entry for an employee
   */
  static generateAlphalistEntry(
    orgId: string,
    year: number,
    employee: Employee & { tin: string },
    payrollData: {
      grossCompensation: number;
      thirteenthMonth: number;
      deMinimis: number;
      otherNonTaxable: number;
      sssContributions: number;
      philHealthContributions: number;
      pagIBIGContributions: number;
      unionDues: number;
      taxWithheld: number;
    },
    options?: {
      quarter?: 1 | 2 | 3 | 4;
      terminationDate?: string;
      reasonForTermination?: string;
    }
  ): Omit<AlphalistEntry, 'id'> {
    // Calculate non-taxable income
    const totalNonTaxable = 
      Math.min(payrollData.thirteenthMonth, TAX_EXEMPT_THRESHOLDS.thirteenthMonth) +
      payrollData.deMinimis +
      payrollData.otherNonTaxable;

    // Calculate total statutory contributions (employee share only)
    const totalContributions = 
      payrollData.sssContributions +
      payrollData.philHealthContributions +
      payrollData.pagIBIGContributions +
      payrollData.unionDues;

    // Calculate taxable compensation
    const taxableCompensation = payrollData.grossCompensation - totalNonTaxable - totalContributions;

    // Calculate tax due using BIR table
    const taxResult = TaxBracketService.calculateWithDefault(taxableCompensation / 12, 'MONTHLY');
    const annualTaxDue = taxResult.totalWithholdingTax * 12;

    // Calculate adjustment (over/under withholding)
    const adjustment = payrollData.taxWithheld - annualTaxDue;

    // Determine employment status
    let employmentStatus: 'R' | 'C' | 'S' = 'R'; // Regular
    if (options?.terminationDate) {
      employmentStatus = 'C'; // Contractual/Terminated
    }

    // Check substituted filing eligibility
    // Qualifies if: single employer, no other income, not MWE
    const qualifiesForSubstitutedFiling = 
      payrollData.grossCompensation <= 250000 && // Within threshold
      !options?.terminationDate;

    return {
      orgId,
      year,
      quarter: options?.quarter,
      employeeId: employee.id,
      tin: employee.tin,
      lastName: employee.lastName || '',
      firstName: employee.firstName,
      middleName: employee.middleName,
      employmentStatus,
      startDate: employee.hireDate,
      terminationDate: options?.terminationDate,
      reasonForTermination: options?.reasonForTermination,
      grossCompensation: payrollData.grossCompensation,
      thirteenthMonthPay: payrollData.thirteenthMonth,
      deMinimis: payrollData.deMinimis,
      otherNonTaxable: payrollData.otherNonTaxable,
      totalNonTaxable,
      taxableCompensation: Math.max(0, taxableCompensation),
      sssContributions: payrollData.sssContributions,
      philHealthContributions: payrollData.philHealthContributions,
      pagIBIGContributions: payrollData.pagIBIGContributions,
      unionDues: payrollData.unionDues,
      totalContributions,
      taxWithheld: payrollData.taxWithheld,
      taxDue: Math.round(annualTaxDue * 100) / 100,
      adjustment: Math.round(adjustment * 100) / 100,
      qualifiesForSubstitutedFiling
    };
  }

  /**
   * Generate Alphalist for all employees
   */
  static generateAlphalist(
    orgId: string,
    year: number,
    employees: (Employee & { tin: string })[],
    payrollDataByEmployee: Map<string, {
      grossCompensation: number;
      thirteenthMonth: number;
      deMinimis: number;
      otherNonTaxable: number;
      sssContributions: number;
      philHealthContributions: number;
      pagIBIGContributions: number;
      unionDues: number;
      taxWithheld: number;
    }>
  ): Omit<AlphalistEntry, 'id'>[] {
    const entries: Omit<AlphalistEntry, 'id'>[] = [];

    for (const employee of employees) {
      const payrollData = payrollDataByEmployee.get(employee.id);
      if (!payrollData) continue;

      entries.push(this.generateAlphalistEntry(orgId, year, employee, payrollData));
    }

    // Sort alphabetically by last name, first name
    return entries.sort((a, b) => {
      const nameA = `${a.lastName}, ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName}, ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  // ============================================================================
  // BIR 2316 GENERATION
  // ============================================================================

  /**
   * Generate BIR Form 2316 for an employee
   * Certificate of Compensation Payment/Tax Withheld
   */
  static generateBIR2316(
    orgId: string,
    year: number,
    employee: Employee & { 
      tin: string; 
      address?: string; 
      birthDate?: string; 
      zipCode?: string 
    },
    employer: {
      tin: string;
      name: string;
      address: string;
    },
    compensationData: {
      // Gross compensation
      grossCompensationPresent: number;
      grossCompensationPrevious?: number;
      
      // Non-taxable items
      basicSMW?: number;
      holidayOT?: number;
      nightDiff?: number;
      hazardPay?: number;
      thirteenthMonth: number;
      deMinimis: number;
      sssPhilPag: number;
      otherNonTaxable?: number;
      
      // Tax withheld
      taxWithheldPresent: number;
      taxWithheldPrevious?: number;
    },
    options?: {
      periodFrom?: string;
      periodTo?: string;
    }
  ): Omit<BIR2316Data, 'id'> {
    const grossPrevious = compensationData.grossCompensationPrevious || 0;
    const grossTotal = compensationData.grossCompensationPresent + grossPrevious;

    // Calculate non-taxable
    const totalNonTaxable = 
      (compensationData.basicSMW || 0) +
      (compensationData.holidayOT || 0) +
      (compensationData.nightDiff || 0) +
      (compensationData.hazardPay || 0) +
      Math.min(compensationData.thirteenthMonth, TAX_EXEMPT_THRESHOLDS.thirteenthMonth) +
      compensationData.deMinimis +
      compensationData.sssPhilPag +
      (compensationData.otherNonTaxable || 0);

    // Calculate taxable compensation
    const taxablePresent = Math.max(0, compensationData.grossCompensationPresent - totalNonTaxable);
    const taxablePrevious = grossPrevious > 0 ? Math.max(0, grossPrevious - (totalNonTaxable * (grossPrevious / grossTotal))) : 0;
    const taxableTotal = taxablePresent + taxablePrevious;

    // Calculate tax due
    const monthlyTaxable = taxableTotal / 12;
    const taxResult = TaxBracketService.calculateWithDefault(monthlyTaxable, 'MONTHLY');
    const taxDue = Math.round(taxResult.totalWithholdingTax * 12 * 100) / 100;

    // Tax withheld
    const taxWithheldPrevious = compensationData.taxWithheldPrevious || 0;
    const taxWithheldTotal = compensationData.taxWithheldPresent + taxWithheldPrevious;
    const taxWithheldAdjusted = taxDue; // For year-end adjustment

    return {
      orgId,
      year,
      employeeId: employee.id,
      employerTIN: employer.tin,
      employerName: employer.name,
      employerAddress: employer.address,
      employeeTIN: employee.tin,
      employeeName: `${employee.lastName || ''}, ${employee.firstName} ${employee.middleName || ''}`.trim(),
      employeeAddress: employee.address || '',
      birthDate: employee.birthDate || '',
      zipCode: employee.zipCode || '',
      periodFrom: options?.periodFrom || `${year}-01-01`,
      periodTo: options?.periodTo || `${year}-12-31`,
      grossCompensationPresent: compensationData.grossCompensationPresent,
      grossCompensationPrevious: grossPrevious,
      grossCompensationTotal: grossTotal,
      basicSMW: compensationData.basicSMW || 0,
      holidayOT: compensationData.holidayOT || 0,
      nightDiff: compensationData.nightDiff || 0,
      hazardPay: compensationData.hazardPay || 0,
      thirteenthMonth: compensationData.thirteenthMonth,
      deMinimis: compensationData.deMinimis,
      sssPhilPag: compensationData.sssPhilPag,
      otherNonTaxable: compensationData.otherNonTaxable || 0,
      totalNonTaxable,
      taxableCompensationPresent: taxablePresent,
      taxableCompensationPrevious: taxablePrevious,
      taxableCompensationTotal: taxableTotal,
      taxWithheldPresent: compensationData.taxWithheldPresent,
      taxWithheldPrevious: taxWithheldPrevious,
      taxWithheldTotal,
      taxDue,
      taxWithheldAdjusted,
      status: 'DRAFT'
    };
  }

  // ============================================================================
  // BIR 1601-C GENERATION
  // ============================================================================

  /**
   * Generate BIR Form 1601-C (Monthly Remittance Return)
   */
  static generateBIR1601C(
    orgId: string,
    year: number,
    month: number,
    employer: {
      tin: string;
      rdoCode: string;
      name: string;
      registeredAddress: string;
    },
    payrollSummary: {
      totalEmployees: number;
      totalCompensation: number;
      sssTotal: number;
      philHealthTotal: number;
      pagIBIGTotal: number;
      taxWithheld: number;
    },
    adjustments?: {
      previousOverRemittance?: number;
      currentAdjustment?: number;
    }
  ): Omit<BIR1601CData, 'id'> {
    // Calculate taxable compensation (gross minus contributions)
    const taxableCompensation = payrollSummary.totalCompensation - 
      payrollSummary.sssTotal - 
      payrollSummary.philHealthTotal - 
      payrollSummary.pagIBIGTotal;

    // Calculate adjustments
    const totalAdjustments = (adjustments?.previousOverRemittance || 0) + (adjustments?.currentAdjustment || 0);
    
    // Tax remittable
    const taxRemittable = Math.max(0, payrollSummary.taxWithheld - totalAdjustments);

    return {
      orgId,
      year,
      month,
      tin: employer.tin,
      rdoCode: employer.rdoCode,
      employerName: employer.name,
      registeredAddress: employer.registeredAddress,
      totalEmployees: payrollSummary.totalEmployees,
      totalCompensation: payrollSummary.totalCompensation,
      sssTotal: payrollSummary.sssTotal,
      philHealthTotal: payrollSummary.philHealthTotal,
      pagIBIGTotal: payrollSummary.pagIBIGTotal,
      taxableCompensation: Math.max(0, taxableCompensation),
      taxWithheld: payrollSummary.taxWithheld,
      adjustments: totalAdjustments,
      taxRemittable,
      totalAmountDue: taxRemittable,
      status: 'DRAFT'
    };
  }

  /**
   * Calculate penalties for late filing/payment
   */
  static calculatePenalties(
    taxDue: number,
    dueDate: string,
    filingDate: string
  ): { surcharge: number; interest: number; compromise: number; total: number } {
    const due = new Date(dueDate);
    const filed = new Date(filingDate);
    
    // Check if late
    if (filed <= due) {
      return { surcharge: 0, interest: 0, compromise: 0, total: 0 };
    }

    // Calculate days late
    const daysLate = Math.ceil((filed.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
    const monthsLate = Math.ceil(daysLate / 30);

    // Surcharge: 25% if filed within 30 days, 50% thereafter
    const surchargeRate = daysLate <= 30 ? 0.25 : 0.50;
    const surcharge = Math.round(taxDue * surchargeRate * 100) / 100;

    // Interest: 12% per annum (1% per month or fraction)
    const interestRate = 0.01; // 1% per month
    const interest = Math.round(taxDue * interestRate * monthsLate * 100) / 100;

    // Compromise penalty (based on BIR schedule, simplified)
    const compromiseBase = 200; // Minimum
    const compromise = Math.min(25000, Math.max(compromiseBase, taxDue * 0.01));

    return {
      surcharge,
      interest,
      compromise,
      total: surcharge + interest + compromise
    };
  }

  // ============================================================================
  // REPORT AGGREGATION
  // ============================================================================

  /**
   * Aggregate payroll data for BIR reporting
   */
  static aggregatePayrollData(
    payrollRuns: PayrollRun[],
    payrollLines: PayrollLine[],
    year: number
  ): Map<string, {
    grossCompensation: number;
    thirteenthMonth: number;
    deMinimis: number;
    otherNonTaxable: number;
    sssContributions: number;
    philHealthContributions: number;
    pagIBIGContributions: number;
    unionDues: number;
    taxWithheld: number;
  }> {
    const result = new Map();

    // Filter runs for the year
    const yearRuns = payrollRuns.filter(run => {
      const runYear = new Date(run.periodEnd).getFullYear();
      return runYear === year && run.status === 'POSTED';
    });

    // Aggregate by employee
    for (const run of yearRuns) {
      const runLines = payrollLines.filter(l => l.payrollRunId === run.id);
      
      for (const line of runLines) {
        const existing = result.get(line.employeeId) || {
          grossCompensation: 0,
          thirteenthMonth: 0,
          deMinimis: 0,
          otherNonTaxable: 0,
          sssContributions: 0,
          philHealthContributions: 0,
          pagIBIGContributions: 0,
          unionDues: 0,
          taxWithheld: 0
        };

        existing.grossCompensation += line.grossPay;
        existing.taxWithheld += line.deductions?.tax || 0;
        existing.sssContributions += line.deductions?.sss || 0;
        existing.philHealthContributions += line.deductions?.philhealth || 0;
        existing.pagIBIGContributions += line.deductions?.pagibig || 0;

        result.set(line.employeeId, existing);
      }
    }

    return result;
  }

  /**
   * Generate monthly summary for 1601-C
   */
  static generateMonthlySummary(
    payrollRuns: PayrollRun[],
    payrollLines: PayrollLine[],
    year: number,
    month: number
  ): {
    totalEmployees: number;
    totalCompensation: number;
    sssTotal: number;
    philHealthTotal: number;
    pagIBIGTotal: number;
    taxWithheld: number;
  } {
    // Filter runs for the month
    const monthRuns = payrollRuns.filter(run => {
      const runDate = new Date(run.periodEnd);
      return runDate.getFullYear() === year && 
             runDate.getMonth() + 1 === month && 
             run.status === 'POSTED';
    });

    const employeeIds = new Set<string>();
    let totalCompensation = 0;
    let sssTotal = 0;
    let philHealthTotal = 0;
    let pagIBIGTotal = 0;
    let taxWithheld = 0;

    for (const run of monthRuns) {
      const runLines = payrollLines.filter(l => l.payrollRunId === run.id);
      
      for (const line of runLines) {
        employeeIds.add(line.employeeId);
        totalCompensation += line.grossPay;
        taxWithheld += line.deductions?.tax || 0;
        sssTotal += line.deductions?.sss || 0;
        philHealthTotal += line.deductions?.philhealth || 0;
        pagIBIGTotal += line.deductions?.pagibig || 0;
      }
    }

    return {
      totalEmployees: employeeIds.size,
      totalCompensation,
      sssTotal,
      philHealthTotal,
      pagIBIGTotal,
      taxWithheld
    };
  }

  // ============================================================================
  // EXPORT UTILITIES
  // ============================================================================

  /**
   * Generate Alphalist CSV export
   */
  static generateAlphalistCSV(entries: AlphalistEntry[]): string {
    const headers = [
      'TIN',
      'Last Name',
      'First Name',
      'Middle Name',
      'Status',
      'Start Date',
      'Term Date',
      'Gross Compensation',
      '13th Month',
      'De Minimis',
      'Other Non-Taxable',
      'Total Non-Taxable',
      'SSS',
      'PhilHealth',
      'Pag-IBIG',
      'Union Dues',
      'Total Contributions',
      'Taxable Compensation',
      'Tax Withheld',
      'Tax Due',
      'Adjustment',
      'Substituted Filing'
    ].join(',');

    const rows = entries.map(e => [
      e.tin,
      `"${e.lastName}"`,
      `"${e.firstName}"`,
      `"${e.middleName || ''}"`,
      e.employmentStatus,
      e.startDate,
      e.terminationDate || '',
      e.grossCompensation.toFixed(2),
      e.thirteenthMonthPay.toFixed(2),
      e.deMinimis.toFixed(2),
      e.otherNonTaxable.toFixed(2),
      e.totalNonTaxable.toFixed(2),
      e.sssContributions.toFixed(2),
      e.philHealthContributions.toFixed(2),
      e.pagIBIGContributions.toFixed(2),
      e.unionDues.toFixed(2),
      e.totalContributions.toFixed(2),
      e.taxableCompensation.toFixed(2),
      e.taxWithheld.toFixed(2),
      e.taxDue.toFixed(2),
      e.adjustment.toFixed(2),
      e.qualifiesForSubstitutedFiling ? 'Y' : 'N'
    ].join(','));

    return [headers, ...rows].join('\n');
  }

  /**
   * Get BIR form due date
   */
  static getFormDueDate(formType: BIRFormType, year: number, month?: number): string {
    switch (formType) {
      case 'BIR_1601_C':
        // Monthly: 10th of following month
        if (month) {
          const nextMonth = month === 12 ? 1 : month + 1;
          const nextYear = month === 12 ? year + 1 : year;
          return `${nextYear}-${nextMonth.toString().padStart(2, '0')}-10`;
        }
        return '';
      
      case 'ALPHALIST':
      case 'BIR_1604_C':
        // Annual: January 31 of following year
        return `${year + 1}-01-31`;
      
      case 'BIR_2316':
        // Annual: On or before January 31 (give to employees)
        return `${year + 1}-01-31`;
      
      default:
        return '';
    }
  }

  /**
   * Format currency
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  /**
   * Get RDO code for location
   */
  static getRDOCode(location: string): string {
    const normalized = location.toUpperCase().replace(/\s+/g, '_');
    return RDO_CODES[normalized] || '000';
  }

  /**
   * Validate TIN format
   */
  static validateTIN(tin: string): { valid: boolean; formatted?: string; error?: string } {
    // Remove dashes and spaces
    const cleaned = tin.replace(/[-\s]/g, '');
    
    // TIN should be 9 or 12 digits
    if (!/^\d{9}$/.test(cleaned) && !/^\d{12}$/.test(cleaned)) {
      return { 
        valid: false, 
        error: 'TIN must be 9 or 12 digits' 
      };
    }

    // Format: XXX-XXX-XXX or XXX-XXX-XXX-XXX
    const formatted = cleaned.length === 9
      ? `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}`
      : `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}-${cleaned.slice(9, 12)}`;

    return { valid: true, formatted };
  }
}
