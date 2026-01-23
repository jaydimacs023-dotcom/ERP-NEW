/**
 * ContributionService
 * 
 * Handles Philippine statutory contribution calculations:
 * - SSS (Social Security System)
 * - PhilHealth (Philippine Health Insurance Corporation)
 * - Pag-IBIG / HDMF (Home Development Mutual Fund)
 * 
 * All tables follow 2024 Philippine government regulations.
 */

import { 
  SSSBracket, 
  SSSContributionTable, 
  PhilHealthTable, 
  PagIBIGTable, 
  ContributionCalculationResult 
} from '../types';

/**
 * SSS 2024 Contribution Table
 * Effective January 2024
 * Employee Rate: 4.5%, Employer Rate: 9.5%, Total: 14%
 * Reference: SSS Circular No. 2023-033
 */
const SSS_2024_BRACKETS: SSSBracket[] = [
  { bracketNumber: 1, minCompensation: 0, maxCompensation: 4249.99, monthlySalaryCredit: 4000, employeeShare: 180, employerShare: 380, totalContribution: 560 },
  { bracketNumber: 2, minCompensation: 4250, maxCompensation: 4749.99, monthlySalaryCredit: 4500, employeeShare: 202.50, employerShare: 427.50, totalContribution: 630 },
  { bracketNumber: 3, minCompensation: 4750, maxCompensation: 5249.99, monthlySalaryCredit: 5000, employeeShare: 225, employerShare: 475, totalContribution: 700 },
  { bracketNumber: 4, minCompensation: 5250, maxCompensation: 5749.99, monthlySalaryCredit: 5500, employeeShare: 247.50, employerShare: 522.50, totalContribution: 770 },
  { bracketNumber: 5, minCompensation: 5750, maxCompensation: 6249.99, monthlySalaryCredit: 6000, employeeShare: 270, employerShare: 570, totalContribution: 840 },
  { bracketNumber: 6, minCompensation: 6250, maxCompensation: 6749.99, monthlySalaryCredit: 6500, employeeShare: 292.50, employerShare: 617.50, totalContribution: 910 },
  { bracketNumber: 7, minCompensation: 6750, maxCompensation: 7249.99, monthlySalaryCredit: 7000, employeeShare: 315, employerShare: 665, totalContribution: 980 },
  { bracketNumber: 8, minCompensation: 7250, maxCompensation: 7749.99, monthlySalaryCredit: 7500, employeeShare: 337.50, employerShare: 712.50, totalContribution: 1050 },
  { bracketNumber: 9, minCompensation: 7750, maxCompensation: 8249.99, monthlySalaryCredit: 8000, employeeShare: 360, employerShare: 760, totalContribution: 1120 },
  { bracketNumber: 10, minCompensation: 8250, maxCompensation: 8749.99, monthlySalaryCredit: 8500, employeeShare: 382.50, employerShare: 807.50, totalContribution: 1190 },
  { bracketNumber: 11, minCompensation: 8750, maxCompensation: 9249.99, monthlySalaryCredit: 9000, employeeShare: 405, employerShare: 855, totalContribution: 1260 },
  { bracketNumber: 12, minCompensation: 9250, maxCompensation: 9749.99, monthlySalaryCredit: 9500, employeeShare: 427.50, employerShare: 902.50, totalContribution: 1330 },
  { bracketNumber: 13, minCompensation: 9750, maxCompensation: 10249.99, monthlySalaryCredit: 10000, employeeShare: 450, employerShare: 950, totalContribution: 1400 },
  { bracketNumber: 14, minCompensation: 10250, maxCompensation: 10749.99, monthlySalaryCredit: 10500, employeeShare: 472.50, employerShare: 997.50, totalContribution: 1470 },
  { bracketNumber: 15, minCompensation: 10750, maxCompensation: 11249.99, monthlySalaryCredit: 11000, employeeShare: 495, employerShare: 1045, totalContribution: 1540 },
  { bracketNumber: 16, minCompensation: 11250, maxCompensation: 11749.99, monthlySalaryCredit: 11500, employeeShare: 517.50, employerShare: 1092.50, totalContribution: 1610 },
  { bracketNumber: 17, minCompensation: 11750, maxCompensation: 12249.99, monthlySalaryCredit: 12000, employeeShare: 540, employerShare: 1140, totalContribution: 1680 },
  { bracketNumber: 18, minCompensation: 12250, maxCompensation: 12749.99, monthlySalaryCredit: 12500, employeeShare: 562.50, employerShare: 1187.50, totalContribution: 1750 },
  { bracketNumber: 19, minCompensation: 12750, maxCompensation: 13249.99, monthlySalaryCredit: 13000, employeeShare: 585, employerShare: 1235, totalContribution: 1820 },
  { bracketNumber: 20, minCompensation: 13250, maxCompensation: 13749.99, monthlySalaryCredit: 13500, employeeShare: 607.50, employerShare: 1282.50, totalContribution: 1890 },
  { bracketNumber: 21, minCompensation: 13750, maxCompensation: 14249.99, monthlySalaryCredit: 14000, employeeShare: 630, employerShare: 1330, totalContribution: 1960 },
  { bracketNumber: 22, minCompensation: 14250, maxCompensation: 14749.99, monthlySalaryCredit: 14500, employeeShare: 652.50, employerShare: 1377.50, totalContribution: 2030 },
  { bracketNumber: 23, minCompensation: 14750, maxCompensation: 15249.99, monthlySalaryCredit: 15000, employeeShare: 675, employerShare: 1425, totalContribution: 2100 },
  { bracketNumber: 24, minCompensation: 15250, maxCompensation: 15749.99, monthlySalaryCredit: 15500, employeeShare: 697.50, employerShare: 1472.50, totalContribution: 2170 },
  { bracketNumber: 25, minCompensation: 15750, maxCompensation: 16249.99, monthlySalaryCredit: 16000, employeeShare: 720, employerShare: 1520, totalContribution: 2240 },
  { bracketNumber: 26, minCompensation: 16250, maxCompensation: 16749.99, monthlySalaryCredit: 16500, employeeShare: 742.50, employerShare: 1567.50, totalContribution: 2310 },
  { bracketNumber: 27, minCompensation: 16750, maxCompensation: 17249.99, monthlySalaryCredit: 17000, employeeShare: 765, employerShare: 1615, totalContribution: 2380 },
  { bracketNumber: 28, minCompensation: 17250, maxCompensation: 17749.99, monthlySalaryCredit: 17500, employeeShare: 787.50, employerShare: 1662.50, totalContribution: 2450 },
  { bracketNumber: 29, minCompensation: 17750, maxCompensation: 18249.99, monthlySalaryCredit: 18000, employeeShare: 810, employerShare: 1710, totalContribution: 2520 },
  { bracketNumber: 30, minCompensation: 18250, maxCompensation: 18749.99, monthlySalaryCredit: 18500, employeeShare: 832.50, employerShare: 1757.50, totalContribution: 2590 },
  { bracketNumber: 31, minCompensation: 18750, maxCompensation: 19249.99, monthlySalaryCredit: 19000, employeeShare: 855, employerShare: 1805, totalContribution: 2660 },
  { bracketNumber: 32, minCompensation: 19250, maxCompensation: 19749.99, monthlySalaryCredit: 19500, employeeShare: 877.50, employerShare: 1852.50, totalContribution: 2730 },
  { bracketNumber: 33, minCompensation: 19750, maxCompensation: 20249.99, monthlySalaryCredit: 20000, employeeShare: 900, employerShare: 1900, totalContribution: 2800 },
  { bracketNumber: 34, minCompensation: 20250, maxCompensation: 20749.99, monthlySalaryCredit: 20500, employeeShare: 922.50, employerShare: 1947.50, totalContribution: 2870 },
  { bracketNumber: 35, minCompensation: 20750, maxCompensation: 21249.99, monthlySalaryCredit: 21000, employeeShare: 945, employerShare: 1995, totalContribution: 2940 },
  { bracketNumber: 36, minCompensation: 21250, maxCompensation: 21749.99, monthlySalaryCredit: 21500, employeeShare: 967.50, employerShare: 2042.50, totalContribution: 3010 },
  { bracketNumber: 37, minCompensation: 21750, maxCompensation: 22249.99, monthlySalaryCredit: 22000, employeeShare: 990, employerShare: 2090, totalContribution: 3080 },
  { bracketNumber: 38, minCompensation: 22250, maxCompensation: 22749.99, monthlySalaryCredit: 22500, employeeShare: 1012.50, employerShare: 2137.50, totalContribution: 3150 },
  { bracketNumber: 39, minCompensation: 22750, maxCompensation: 23249.99, monthlySalaryCredit: 23000, employeeShare: 1035, employerShare: 2185, totalContribution: 3220 },
  { bracketNumber: 40, minCompensation: 23250, maxCompensation: 23749.99, monthlySalaryCredit: 23500, employeeShare: 1057.50, employerShare: 2232.50, totalContribution: 3290 },
  { bracketNumber: 41, minCompensation: 23750, maxCompensation: 24249.99, monthlySalaryCredit: 24000, employeeShare: 1080, employerShare: 2280, totalContribution: 3360 },
  { bracketNumber: 42, minCompensation: 24250, maxCompensation: 24749.99, monthlySalaryCredit: 24500, employeeShare: 1102.50, employerShare: 2327.50, totalContribution: 3430 },
  { bracketNumber: 43, minCompensation: 24750, maxCompensation: 25249.99, monthlySalaryCredit: 25000, employeeShare: 1125, employerShare: 2375, totalContribution: 3500 },
  { bracketNumber: 44, minCompensation: 25250, maxCompensation: 25749.99, monthlySalaryCredit: 25500, employeeShare: 1147.50, employerShare: 2422.50, totalContribution: 3570 },
  { bracketNumber: 45, minCompensation: 25750, maxCompensation: 26249.99, monthlySalaryCredit: 26000, employeeShare: 1170, employerShare: 2470, totalContribution: 3640 },
  { bracketNumber: 46, minCompensation: 26250, maxCompensation: 26749.99, monthlySalaryCredit: 26500, employeeShare: 1192.50, employerShare: 2517.50, totalContribution: 3710 },
  { bracketNumber: 47, minCompensation: 26750, maxCompensation: 27249.99, monthlySalaryCredit: 27000, employeeShare: 1215, employerShare: 2565, totalContribution: 3780 },
  { bracketNumber: 48, minCompensation: 27250, maxCompensation: 27749.99, monthlySalaryCredit: 27500, employeeShare: 1237.50, employerShare: 2612.50, totalContribution: 3850 },
  { bracketNumber: 49, minCompensation: 27750, maxCompensation: 28249.99, monthlySalaryCredit: 28000, employeeShare: 1260, employerShare: 2660, totalContribution: 3920 },
  { bracketNumber: 50, minCompensation: 28250, maxCompensation: 28749.99, monthlySalaryCredit: 28500, employeeShare: 1282.50, employerShare: 2707.50, totalContribution: 3990 },
  { bracketNumber: 51, minCompensation: 28750, maxCompensation: 29249.99, monthlySalaryCredit: 29000, employeeShare: 1305, employerShare: 2755, totalContribution: 4060 },
  { bracketNumber: 52, minCompensation: 29250, maxCompensation: 29749.99, monthlySalaryCredit: 29500, employeeShare: 1327.50, employerShare: 2802.50, totalContribution: 4130 },
  { bracketNumber: 53, minCompensation: 29750, maxCompensation: null, monthlySalaryCredit: 30000, employeeShare: 1350, employerShare: 2850, totalContribution: 4200 }
];

/**
 * PhilHealth 2024 Parameters
 * Premium Rate: 5% of basic monthly salary
 * Equally shared by employee and employer (2.5% each)
 * Monthly Floor: ₱10,000
 * Monthly Ceiling: ₱100,000
 */
const PHILHEALTH_2024: Omit<PhilHealthTable, 'id' | 'orgId'> = {
  name: 'PhilHealth 2024 Premium Table',
  effectiveFrom: '2024-01-01',
  premiumRate: 0.05,
  employeeShareRate: 0.025,
  employerShareRate: 0.025,
  monthlyFloor: 10000,
  monthlyCeiling: 100000,
  minContribution: 500, // 5% of 10,000 = 500
  maxContribution: 5000, // 5% of 100,000 = 5,000
  isDefault: true
};

/**
 * Pag-IBIG (HDMF) 2024 Parameters
 * Tier 1: ≤₱1,500 compensation = 1% employee, 2% employer
 * Tier 2: >₱1,500 compensation = 2% employee, 2% employer
 * Maximum Monthly Compensation: ₱5,000
 * Maximum Employee Contribution: ₱100
 * Maximum Employer Contribution: ₱100
 */
const PAGIBIG_2024: Omit<PagIBIGTable, 'id' | 'orgId'> = {
  name: 'Pag-IBIG 2024 Contribution Table',
  effectiveFrom: '2024-01-01',
  tier1MaxCompensation: 1500,
  tier1EmployeeRate: 0.01,
  tier1EmployerRate: 0.02,
  tier2EmployeeRate: 0.02,
  tier2EmployerRate: 0.02,
  maxMonthlyCompensation: 5000,
  maxEmployeeContribution: 100,
  maxEmployerContribution: 100,
  isDefault: true
};

export class ContributionService {
  
  // ============================================================================
  // SSS CALCULATIONS
  // ============================================================================
  
  /**
   * Get SSS contribution based on monthly compensation
   */
  static calculateSSS(
    monthlyCompensation: number,
    brackets: SSSBracket[] = SSS_2024_BRACKETS
  ): { employeeShare: number; employerShare: number; msc: number; bracketNumber: number } {
    // Find applicable bracket
    const bracket = brackets.find(b => 
      monthlyCompensation >= b.minCompensation && 
      (b.maxCompensation === null || monthlyCompensation <= b.maxCompensation)
    ) || brackets[brackets.length - 1]; // Default to highest bracket if above max

    return {
      employeeShare: bracket.employeeShare,
      employerShare: bracket.employerShare,
      msc: bracket.monthlySalaryCredit,
      bracketNumber: bracket.bracketNumber
    };
  }

  /**
   * Get default SSS brackets
   */
  static getDefaultSSSBrackets(): SSSBracket[] {
    return SSS_2024_BRACKETS;
  }

  // ============================================================================
  // PHILHEALTH CALCULATIONS
  // ============================================================================

  /**
   * Calculate PhilHealth contribution based on monthly basic salary
   */
  static calculatePhilHealth(
    monthlyBasicSalary: number,
    table: Omit<PhilHealthTable, 'id' | 'orgId'> = PHILHEALTH_2024
  ): { employeeShare: number; employerShare: number; basis: number } {
    // Apply floor and ceiling
    const adjustedSalary = Math.max(
      table.monthlyFloor,
      Math.min(table.monthlyCeiling, monthlyBasicSalary)
    );

    // Calculate total premium
    const totalPremium = adjustedSalary * table.premiumRate;
    
    // Split between employee and employer
    const employeeShare = Math.round((totalPremium / 2) * 100) / 100;
    const employerShare = Math.round((totalPremium / 2) * 100) / 100;

    return {
      employeeShare,
      employerShare,
      basis: adjustedSalary
    };
  }

  /**
   * Get default PhilHealth parameters
   */
  static getDefaultPhilHealthTable(): Omit<PhilHealthTable, 'id' | 'orgId'> {
    return PHILHEALTH_2024;
  }

  // ============================================================================
  // PAG-IBIG CALCULATIONS
  // ============================================================================

  /**
   * Calculate Pag-IBIG contribution based on monthly compensation
   */
  static calculatePagIBIG(
    monthlyCompensation: number,
    table: Omit<PagIBIGTable, 'id' | 'orgId'> = PAGIBIG_2024
  ): { employeeShare: number; employerShare: number; tier: 1 | 2 } {
    // Cap compensation for contribution calculation
    const cappedCompensation = Math.min(monthlyCompensation, table.maxMonthlyCompensation);

    // Determine tier
    const tier: 1 | 2 = monthlyCompensation <= table.tier1MaxCompensation ? 1 : 2;

    // Calculate based on tier
    let employeeShare: number;
    let employerShare: number;

    if (tier === 1) {
      employeeShare = cappedCompensation * table.tier1EmployeeRate;
      employerShare = cappedCompensation * table.tier1EmployerRate;
    } else {
      employeeShare = cappedCompensation * table.tier2EmployeeRate;
      employerShare = cappedCompensation * table.tier2EmployerRate;
    }

    // Apply maximum caps
    employeeShare = Math.min(employeeShare, table.maxEmployeeContribution);
    employerShare = Math.min(employerShare, table.maxEmployerContribution);

    // Round to 2 decimal places
    employeeShare = Math.round(employeeShare * 100) / 100;
    employerShare = Math.round(employerShare * 100) / 100;

    return {
      employeeShare,
      employerShare,
      tier
    };
  }

  /**
   * Get default Pag-IBIG parameters
   */
  static getDefaultPagIBIGTable(): Omit<PagIBIGTable, 'id' | 'orgId'> {
    return PAGIBIG_2024;
  }

  // ============================================================================
  // COMBINED CALCULATIONS
  // ============================================================================

  /**
   * Calculate all statutory contributions for an employee
   */
  static calculateAllContributions(
    grossCompensation: number,
    options?: {
      sssBrackets?: SSSBracket[];
      philHealthTable?: Omit<PhilHealthTable, 'id' | 'orgId'>;
      pagIBIGTable?: Omit<PagIBIGTable, 'id' | 'orgId'>;
    }
  ): ContributionCalculationResult {
    const sss = this.calculateSSS(grossCompensation, options?.sssBrackets);
    const philHealth = this.calculatePhilHealth(grossCompensation, options?.philHealthTable);
    const pagIBIG = this.calculatePagIBIG(grossCompensation, options?.pagIBIGTable);

    const totalEmployeeContributions = sss.employeeShare + philHealth.employeeShare + pagIBIG.employeeShare;
    const totalEmployerContributions = sss.employerShare + philHealth.employerShare + pagIBIG.employerShare;

    return {
      grossCompensation,
      
      // SSS
      sssEmployeeShare: sss.employeeShare,
      sssEmployerShare: sss.employerShare,
      sssMonthlySalaryCredit: sss.msc,
      sssBracketNumber: sss.bracketNumber,
      
      // PhilHealth
      philHealthEmployeeShare: philHealth.employeeShare,
      philHealthEmployerShare: philHealth.employerShare,
      philHealthBasis: philHealth.basis,
      
      // Pag-IBIG
      pagIBIGEmployeeShare: pagIBIG.employeeShare,
      pagIBIGEmployerShare: pagIBIG.employerShare,
      pagIBIGTier: pagIBIG.tier,
      
      // Totals
      totalEmployeeContributions: Math.round(totalEmployeeContributions * 100) / 100,
      totalEmployerContributions: Math.round(totalEmployerContributions * 100) / 100,
      totalContributions: Math.round((totalEmployeeContributions + totalEmployerContributions) * 100) / 100
    };
  }

  /**
   * Get contribution summary for display on paystub
   */
  static getContributionSummary(result: ContributionCalculationResult): string[] {
    return [
      `SSS: ₱${result.sssEmployeeShare.toLocaleString()} (MSC: ₱${result.sssMonthlySalaryCredit.toLocaleString()})`,
      `PhilHealth: ₱${result.philHealthEmployeeShare.toLocaleString()} (2.5% of ₱${result.philHealthBasis.toLocaleString()})`,
      `Pag-IBIG: ₱${result.pagIBIGEmployeeShare.toLocaleString()} (Tier ${result.pagIBIGTier})`,
      `Total Deductions: ₱${result.totalEmployeeContributions.toLocaleString()}`
    ];
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
   * Get SSS bracket summary for display
   */
  static getSSSBracketSummary(brackets: SSSBracket[] = SSS_2024_BRACKETS): string[] {
    return brackets.map(b => {
      const maxStr = b.maxCompensation === null ? 'above' : `₱${b.maxCompensation.toLocaleString()}`;
      return `Bracket ${b.bracketNumber}: ₱${b.minCompensation.toLocaleString()} - ${maxStr} → MSC ₱${b.monthlySalaryCredit.toLocaleString()} (EE: ₱${b.employeeShare}, ER: ₱${b.employerShare})`;
    });
  }
}
