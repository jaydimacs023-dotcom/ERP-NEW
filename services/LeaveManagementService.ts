/**
 * LeaveManagementService
 * 
 * Handles Philippine leave management including:
 * - Leave policies and allocation
 * - Leave balance tracking
 * - Leave accrual calculations
 * - Leave request workflow
 * - Leave conversion to cash
 * 
 * Follows Philippine Labor Code and special leave laws.
 */

import { 
  LeaveType, 
  LeavePolicy, 
  LeaveBalance, 
  LeaveRequest, 
  LeaveAccrualConfig,
  LeaveStatus
} from '../types';

// ============================================================================
// DEFAULT LEAVE POLICIES (Philippine Labor Code)
// ============================================================================

/**
 * Default leave policies based on Philippine law
 */
const DEFAULT_LEAVE_POLICIES: Omit<LeavePolicy, 'id' | 'orgId'>[] = [
  {
    leaveType: 'SERVICE_INCENTIVE',
    name: 'Service Incentive Leave',
    description: 'Mandated 5-day SIL after 1 year of service (Art. 95, Labor Code)',
    annualAllocation: 5,
    maxCarryOver: 0, // Convertible to cash if unused
    isPaid: true,
    requiresDocumentation: false,
    minServiceMonths: 12,
    applicableGender: 'ALL',
    isActive: true
  },
  {
    leaveType: 'VACATION',
    name: 'Vacation Leave',
    description: 'Annual vacation leave (company policy)',
    annualAllocation: 15,
    maxCarryOver: 5,
    carryOverExpiry: 6, // Expires after 6 months
    isPaid: true,
    requiresDocumentation: false,
    advanceNoticeDays: 7,
    applicableGender: 'ALL',
    isActive: true
  },
  {
    leaveType: 'SICK',
    name: 'Sick Leave',
    description: 'Leave for illness or medical appointments',
    annualAllocation: 15,
    maxCarryOver: 0, // Typically non-cumulative
    isPaid: true,
    requiresDocumentation: true, // Medical certificate for 3+ days
    applicableGender: 'ALL',
    maxConsecutiveDays: 30,
    isActive: true
  },
  {
    leaveType: 'MATERNITY',
    name: 'Maternity Leave',
    description: '105 days (RA 11210 Expanded Maternity Leave Law)',
    annualAllocation: 105,
    maxCarryOver: 0,
    isPaid: true,
    requiresDocumentation: true,
    applicableGender: 'FEMALE',
    isActive: true
  },
  {
    leaveType: 'PATERNITY',
    name: 'Paternity Leave',
    description: '7 days for married male employees (RA 8187)',
    annualAllocation: 7,
    maxCarryOver: 0,
    isPaid: true,
    requiresDocumentation: true, // Birth certificate
    applicableGender: 'MALE',
    isActive: true
  },
  {
    leaveType: 'SOLO_PARENT',
    name: 'Solo Parent Leave',
    description: '7 days parental leave for solo parents (RA 8972)',
    annualAllocation: 7,
    maxCarryOver: 0,
    isPaid: true,
    requiresDocumentation: true, // Solo parent ID
    minServiceMonths: 12,
    applicableGender: 'ALL',
    isActive: true
  },
  {
    leaveType: 'BEREAVEMENT',
    name: 'Bereavement Leave',
    description: 'Leave for death of immediate family member',
    annualAllocation: 5,
    maxCarryOver: 0,
    isPaid: true,
    requiresDocumentation: true, // Death certificate
    applicableGender: 'ALL',
    isActive: true
  },
  {
    leaveType: 'EMERGENCY',
    name: 'Emergency Leave',
    description: 'Leave for personal emergencies',
    annualAllocation: 3,
    maxCarryOver: 0,
    isPaid: true,
    requiresDocumentation: false,
    applicableGender: 'ALL',
    isActive: true
  },
  {
    leaveType: 'UNPAID',
    name: 'Leave Without Pay',
    description: 'Unpaid leave when paid leaves are exhausted',
    annualAllocation: 30,
    maxCarryOver: 0,
    isPaid: false,
    requiresDocumentation: false,
    applicableGender: 'ALL',
    maxConsecutiveDays: 30,
    advanceNoticeDays: 3,
    isActive: true
  },
  {
    leaveType: 'SPECIAL_PRIVILEGE',
    name: 'Special Privilege Leave',
    description: 'Leave for personal milestones (birthday, anniversary, etc.)',
    annualAllocation: 3,
    maxCarryOver: 0,
    isPaid: true,
    requiresDocumentation: false,
    applicableGender: 'ALL',
    isActive: true
  },
  {
    leaveType: 'STUDY',
    name: 'Study Leave',
    description: 'Leave for educational purposes',
    annualAllocation: 10,
    maxCarryOver: 0,
    isPaid: false,
    requiresDocumentation: true,
    minServiceMonths: 24,
    applicableGender: 'ALL',
    isActive: true
  },
  {
    leaveType: 'COMPENSATORY',
    name: 'Compensatory Time Off',
    description: 'Time off in lieu of overtime pay',
    annualAllocation: 0, // Earned through overtime
    maxCarryOver: 0,
    isPaid: true,
    requiresDocumentation: false,
    applicableGender: 'ALL',
    isActive: true
  }
];

export class LeaveManagementService {
  
  // ============================================================================
  // LEAVE POLICY METHODS
  // ============================================================================

  /**
   * Get default leave policies
   */
  static getDefaultPolicies(): Omit<LeavePolicy, 'id' | 'orgId'>[] {
    return [...DEFAULT_LEAVE_POLICIES];
  }

  /**
   * Get policy by leave type
   */
  static getPolicyByType(
    policies: LeavePolicy[],
    leaveType: LeaveType
  ): LeavePolicy | undefined {
    return policies.find(p => p.leaveType === leaveType && p.isActive);
  }

  /**
   * Check if employee is eligible for leave type
   */
  static isEligibleForLeave(
    policy: LeavePolicy,
    employeeGender: 'MALE' | 'FEMALE',
    monthsOfService: number,
    isSoloParent: boolean = false
  ): { eligible: boolean; reason?: string } {
    // Check gender eligibility
    if (policy.applicableGender !== 'ALL' && policy.applicableGender !== employeeGender) {
      return { 
        eligible: false, 
        reason: `${policy.name} is only available for ${policy.applicableGender.toLowerCase()} employees` 
      };
    }

    // Check service requirement
    if (policy.minServiceMonths && monthsOfService < policy.minServiceMonths) {
      return { 
        eligible: false, 
        reason: `${policy.name} requires ${policy.minServiceMonths} months of service (you have ${monthsOfService})` 
      };
    }

    // Special check for solo parent leave
    if (policy.leaveType === 'SOLO_PARENT' && !isSoloParent) {
      return { 
        eligible: false, 
        reason: 'Solo Parent Leave requires valid Solo Parent ID' 
      };
    }

    return { eligible: true };
  }

  // ============================================================================
  // LEAVE BALANCE METHODS
  // ============================================================================

  /**
   * Initialize leave balances for a new year
   */
  static initializeYearBalances(
    orgId: string,
    employeeId: string,
    year: number,
    policies: LeavePolicy[],
    previousBalances?: LeaveBalance[]
  ): Omit<LeaveBalance, 'id'>[] {
    const balances: Omit<LeaveBalance, 'id'>[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const policy of policies.filter(p => p.isActive)) {
      // Find previous year balance for carry-over calculation
      const prevBalance = previousBalances?.find(
        b => b.leaveType === policy.leaveType && b.year === year - 1
      );

      // Calculate carry-over
      let carriedOver = 0;
      if (prevBalance && policy.maxCarryOver > 0) {
        carriedOver = Math.min(prevBalance.balance, policy.maxCarryOver);
      }

      balances.push({
        orgId,
        employeeId,
        leaveType: policy.leaveType,
        year,
        allocated: policy.annualAllocation,
        used: 0,
        pending: 0,
        carriedOver,
        forfeited: prevBalance ? Math.max(0, prevBalance.balance - carriedOver) : 0,
        balance: policy.annualAllocation + carriedOver,
        asOfDate: today
      });
    }

    return balances;
  }

  /**
   * Calculate current leave balance
   */
  static calculateBalance(balance: LeaveBalance): number {
    return balance.allocated + balance.carriedOver - balance.used - balance.pending - balance.forfeited;
  }

  /**
   * Update balance after leave request status change
   */
  static updateBalanceForRequest(
    balance: LeaveBalance,
    request: LeaveRequest,
    previousStatus: LeaveStatus,
    newStatus: LeaveStatus
  ): LeaveBalance {
    const updated = { ...balance };
    const days = request.totalDays;

    // Remove from previous status bucket
    if (previousStatus === 'PENDING') {
      updated.pending = Math.max(0, updated.pending - days);
    } else if (previousStatus === 'APPROVED' || previousStatus === 'TAKEN') {
      updated.used = Math.max(0, updated.used - days);
    }

    // Add to new status bucket
    if (newStatus === 'PENDING') {
      updated.pending += days;
    } else if (newStatus === 'APPROVED' || newStatus === 'TAKEN') {
      updated.used += days;
    }

    // Recalculate balance
    updated.balance = this.calculateBalance(updated);
    updated.asOfDate = new Date().toISOString().split('T')[0];

    return updated;
  }

  /**
   * Check if employee has sufficient balance
   */
  static hasEnoughBalance(
    balance: LeaveBalance,
    requestedDays: number,
    isPaid: boolean = true
  ): { sufficient: boolean; available: number; shortfall?: number } {
    // Unpaid leave doesn't require balance
    if (!isPaid) {
      return { sufficient: true, available: balance.balance };
    }

    const available = balance.balance - balance.pending;
    const sufficient = available >= requestedDays;

    return {
      sufficient,
      available,
      shortfall: sufficient ? undefined : requestedDays - available
    };
  }

  // ============================================================================
  // LEAVE REQUEST METHODS
  // ============================================================================

  /**
   * Calculate number of leave days between dates
   */
  static calculateLeaveDays(
    startDate: string,
    endDate: string,
    halfDay?: 'AM' | 'PM',
    excludeWeekends: boolean = true,
    excludeHolidays: string[] = []
  ): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let days = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];

      // Skip weekends if configured
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = excludeHolidays.includes(dateStr);

      if ((!excludeWeekends || !isWeekend) && !isHoliday) {
        days++;
      }

      current.setDate(current.getDate() + 1);
    }

    // Adjust for half day
    if (halfDay && days > 0) {
      days -= 0.5;
    }

    return days;
  }

  /**
   * Validate leave request
   */
  static validateLeaveRequest(
    request: Partial<LeaveRequest>,
    policy: LeavePolicy,
    balance: LeaveBalance,
    existingRequests: LeaveRequest[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!request.startDate) errors.push('Start date is required');
    if (!request.endDate) errors.push('End date is required');
    if (!request.reason) errors.push('Reason is required');

    // Check dates
    if (request.startDate && request.endDate) {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      
      if (end < start) {
        errors.push('End date cannot be before start date');
      }

      // Check advance notice
      if (policy.advanceNoticeDays) {
        const today = new Date();
        const noticeDays = Math.ceil((start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        if (noticeDays < policy.advanceNoticeDays) {
          errors.push(`${policy.name} requires ${policy.advanceNoticeDays} days advance notice`);
        }
      }

      // Check max consecutive days
      if (policy.maxConsecutiveDays && request.totalDays) {
        if (request.totalDays > policy.maxConsecutiveDays) {
          errors.push(`Maximum consecutive days for ${policy.name} is ${policy.maxConsecutiveDays}`);
        }
      }

      // Check for overlapping requests
      const overlapping = existingRequests.filter(r => {
        if (r.status === 'REJECTED' || r.status === 'CANCELLED') return false;
        const rStart = new Date(r.startDate);
        const rEnd = new Date(r.endDate);
        return !(end < rStart || start > rEnd);
      });

      if (overlapping.length > 0) {
        errors.push('Request overlaps with existing leave requests');
      }
    }

    // Check documentation requirement
    if (policy.requiresDocumentation && !request.attachmentUrl) {
      // Warning, not error - can be submitted later
      // errors.push(`${policy.name} requires supporting documentation`);
    }

    // Check balance
    if (policy.isPaid && request.totalDays) {
      const balanceCheck = this.hasEnoughBalance(balance, request.totalDays, policy.isPaid);
      if (!balanceCheck.sufficient) {
        errors.push(`Insufficient ${policy.name} balance. Available: ${balanceCheck.available}, Requested: ${request.totalDays}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create leave request
   */
  static createLeaveRequest(
    orgId: string,
    employeeId: string,
    leaveType: LeaveType,
    startDate: string,
    endDate: string,
    reason: string,
    options?: {
      halfDay?: 'AM' | 'PM';
      attachmentUrl?: string;
    }
  ): Omit<LeaveRequest, 'id'> {
    const totalDays = this.calculateLeaveDays(startDate, endDate, options?.halfDay);

    return {
      orgId,
      employeeId,
      leaveType,
      startDate,
      endDate,
      totalDays,
      halfDay: options?.halfDay,
      reason,
      attachmentUrl: options?.attachmentUrl,
      status: 'PENDING',
      appliedAt: new Date().toISOString()
    };
  }

  // ============================================================================
  // LEAVE ACCRUAL METHODS
  // ============================================================================

  /**
   * Calculate accrued leave based on configuration
   */
  static calculateAccrual(
    config: LeaveAccrualConfig,
    monthsWorked: number,
    policy: LeavePolicy
  ): number {
    switch (config.accrualMethod) {
      case 'ANNUAL':
        // Full allocation at start of year (or after vesting)
        if (config.vestingPeriodMonths && monthsWorked < config.vestingPeriodMonths) {
          return 0;
        }
        return policy.annualAllocation;

      case 'MONTHLY':
        // Accrue each month
        return Math.floor(monthsWorked * config.accrualRate * 100) / 100;

      case 'SEMI_MONTHLY':
        // Accrue twice per month
        const halfMonths = monthsWorked * 2;
        return Math.floor(halfMonths * (config.accrualRate / 2) * 100) / 100;

      case 'PRORATED':
        // Pro-rate based on months in year
        const monthsInYear = 12;
        const proportion = Math.min(monthsWorked, monthsInYear) / monthsInYear;
        return Math.floor(policy.annualAllocation * proportion * 100) / 100;

      default:
        return 0;
    }
  }

  /**
   * Get default accrual configurations
   */
  static getDefaultAccrualConfigs(): Omit<LeaveAccrualConfig, 'id' | 'orgId'>[] {
    return [
      { leaveType: 'VACATION', accrualMethod: 'MONTHLY', accrualRate: 1.25, isActive: true },
      { leaveType: 'SICK', accrualMethod: 'MONTHLY', accrualRate: 1.25, isActive: true },
      { leaveType: 'SERVICE_INCENTIVE', accrualMethod: 'ANNUAL', accrualRate: 5, vestingPeriodMonths: 12, isActive: true }
    ];
  }

  // ============================================================================
  // LEAVE CONVERSION METHODS
  // ============================================================================

  /**
   * Calculate leave conversion to cash
   * Typically done at year-end or upon separation
   */
  static calculateLeaveConversion(
    unusedDays: number,
    dailyRate: number,
    leaveType: LeaveType,
    policy?: LeavePolicy
  ): { 
    convertibleDays: number; 
    amount: number; 
    reason?: string 
  } {
    // Service Incentive Leave must be converted to cash if unused
    if (leaveType === 'SERVICE_INCENTIVE') {
      return {
        convertibleDays: unusedDays,
        amount: Math.round(unusedDays * dailyRate * 100) / 100,
        reason: 'Mandatory conversion per Labor Code'
      };
    }

    // Vacation leave - typically convertible based on company policy
    if (leaveType === 'VACATION') {
      return {
        convertibleDays: unusedDays,
        amount: Math.round(unusedDays * dailyRate * 100) / 100
      };
    }

    // Sick leave - depends on company policy
    if (leaveType === 'SICK') {
      // Many companies don't convert sick leave
      return {
        convertibleDays: 0,
        amount: 0,
        reason: 'Sick leave typically not convertible'
      };
    }

    // Default: not convertible
    return {
      convertibleDays: 0,
      amount: 0,
      reason: 'This leave type is not convertible to cash'
    };
  }

  /**
   * Calculate total leave conversion for separation
   */
  static calculateSeparationLeaveConversion(
    balances: LeaveBalance[],
    dailyRate: number
  ): { totalDays: number; totalAmount: number; details: { type: LeaveType; days: number; amount: number }[] } {
    const details: { type: LeaveType; days: number; amount: number }[] = [];
    let totalDays = 0;
    let totalAmount = 0;

    // Convertible leave types
    const convertibleTypes: LeaveType[] = ['VACATION', 'SERVICE_INCENTIVE'];

    for (const balance of balances) {
      if (convertibleTypes.includes(balance.leaveType) && balance.balance > 0) {
        const conversion = this.calculateLeaveConversion(
          balance.balance,
          dailyRate,
          balance.leaveType
        );

        if (conversion.convertibleDays > 0) {
          details.push({
            type: balance.leaveType,
            days: conversion.convertibleDays,
            amount: conversion.amount
          });
          totalDays += conversion.convertibleDays;
          totalAmount += conversion.amount;
        }
      }
    }

    return {
      totalDays,
      totalAmount: Math.round(totalAmount * 100) / 100,
      details
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get leave type display name
   */
  static getLeaveTypeName(type: LeaveType): string {
    const names: Record<LeaveType, string> = {
      'VACATION': 'Vacation Leave',
      'SICK': 'Sick Leave',
      'MATERNITY': 'Maternity Leave',
      'PATERNITY': 'Paternity Leave',
      'SOLO_PARENT': 'Solo Parent Leave',
      'BEREAVEMENT': 'Bereavement Leave',
      'EMERGENCY': 'Emergency Leave',
      'UNPAID': 'Leave Without Pay',
      'SERVICE_INCENTIVE': 'Service Incentive Leave',
      'SPECIAL_PRIVILEGE': 'Special Privilege Leave',
      'STUDY': 'Study Leave',
      'COMPENSATORY': 'Compensatory Time Off'
    };
    return names[type] || type;
  }

  /**
   * Get leave status display
   */
  static getLeaveStatusBadge(status: LeaveStatus): { text: string; color: string } {
    const badges: Record<LeaveStatus, { text: string; color: string }> = {
      'PENDING': { text: 'Pending', color: 'yellow' },
      'APPROVED': { text: 'Approved', color: 'green' },
      'REJECTED': { text: 'Rejected', color: 'red' },
      'CANCELLED': { text: 'Cancelled', color: 'gray' },
      'TAKEN': { text: 'Taken', color: 'blue' }
    };
    return badges[status] || { text: status, color: 'gray' };
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
}
