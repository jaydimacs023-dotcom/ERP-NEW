/**
 * TimeAttendanceService
 * 
 * Handles Philippine time and attendance management including:
 * - Work schedule management
 * - Time entry processing
 * - Tardiness and undertime calculations
 * - Night differential tracking
 * - Attendance summary for payroll
 * - Holiday calendar management
 * 
 * Follows Philippine DOLE regulations.
 */

import { 
  WorkSchedule, 
  TimeEntry, 
  AttendanceSummary, 
  AttendanceStatus,
  HolidayCalendar
} from '../types';

// ============================================================================
// DEFAULT WORK SCHEDULES
// ============================================================================

const DEFAULT_WORK_SCHEDULES: Omit<WorkSchedule, 'id' | 'orgId'>[] = [
  {
    name: 'Regular 8-5 (Mon-Sat)',
    description: 'Standard 6-day work week, 8 hours per day',
    workDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
    startTime: '08:00',
    endTime: '17:00',
    breakStartTime: '12:00',
    breakEndTime: '13:00',
    breakDurationMinutes: 60,
    regularHoursPerDay: 8,
    regularHoursPerWeek: 48,
    gracePeriodMinutes: 15,
    nightDiffStart: '22:00',
    nightDiffEnd: '06:00',
    isDefault: true,
    isActive: true
  },
  {
    name: 'Regular 9-6 (Mon-Fri)',
    description: 'Standard 5-day work week, 8 hours per day',
    workDays: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: '09:00',
    endTime: '18:00',
    breakStartTime: '12:00',
    breakEndTime: '13:00',
    breakDurationMinutes: 60,
    regularHoursPerDay: 8,
    regularHoursPerWeek: 40,
    gracePeriodMinutes: 15,
    nightDiffStart: '22:00',
    nightDiffEnd: '06:00',
    isDefault: false,
    isActive: true
  },
  {
    name: 'Night Shift (10pm-7am)',
    description: 'Night shift schedule with night differential',
    workDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
    startTime: '22:00',
    endTime: '07:00',
    breakStartTime: '02:00',
    breakEndTime: '03:00',
    breakDurationMinutes: 60,
    regularHoursPerDay: 8,
    regularHoursPerWeek: 48,
    gracePeriodMinutes: 15,
    nightDiffStart: '22:00',
    nightDiffEnd: '06:00',
    isDefault: false,
    isActive: true
  },
  {
    name: 'Flexible (Core 10am-4pm)',
    description: 'Flexible schedule with core hours',
    workDays: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: '07:00', // Earliest start
    endTime: '19:00', // Latest end
    breakStartTime: '12:00',
    breakEndTime: '13:00',
    breakDurationMinutes: 60,
    regularHoursPerDay: 8,
    regularHoursPerWeek: 40,
    gracePeriodMinutes: 0, // Flexible
    nightDiffStart: '22:00',
    nightDiffEnd: '06:00',
    isDefault: false,
    isActive: true
  }
];

// ============================================================================
// PHILIPPINE REGULAR HOLIDAYS 2024-2025
// ============================================================================

const PH_REGULAR_HOLIDAYS_2024: Omit<HolidayCalendar, 'id' | 'orgId'>[] = [
  { date: '2024-01-01', name: "New Year's Day", type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-03-28', name: 'Maundy Thursday', type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-03-29', name: 'Good Friday', type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-04-09', name: 'Araw ng Kagitingan', type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-04-10', name: 'Eid al-Fitr', type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-05-01', name: 'Labor Day', type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-06-12', name: 'Independence Day', type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-06-17', name: 'Eid al-Adha', type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-08-26', name: 'National Heroes Day', type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-11-30', name: 'Bonifacio Day', type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-12-25', name: 'Christmas Day', type: 'REGULAR', isNationwide: true, year: 2024 },
  { date: '2024-12-30', name: 'Rizal Day', type: 'REGULAR', isNationwide: true, year: 2024 }
];

const PH_SPECIAL_HOLIDAYS_2024: Omit<HolidayCalendar, 'id' | 'orgId'>[] = [
  { date: '2024-02-10', name: 'Chinese New Year', type: 'SPECIAL_NON_WORKING', isNationwide: true, year: 2024 },
  { date: '2024-02-25', name: 'EDSA People Power Revolution Anniversary', type: 'SPECIAL_NON_WORKING', isNationwide: true, year: 2024 },
  { date: '2024-03-30', name: 'Black Saturday', type: 'SPECIAL_NON_WORKING', isNationwide: true, year: 2024 },
  { date: '2024-08-21', name: 'Ninoy Aquino Day', type: 'SPECIAL_NON_WORKING', isNationwide: true, year: 2024 },
  { date: '2024-11-01', name: "All Saints' Day", type: 'SPECIAL_NON_WORKING', isNationwide: true, year: 2024 },
  { date: '2024-11-02', name: "All Souls' Day", type: 'SPECIAL_NON_WORKING', isNationwide: true, year: 2024 },
  { date: '2024-12-08', name: 'Feast of the Immaculate Conception', type: 'SPECIAL_NON_WORKING', isNationwide: true, year: 2024 },
  { date: '2024-12-24', name: 'Christmas Eve', type: 'SPECIAL_NON_WORKING', isNationwide: true, year: 2024 },
  { date: '2024-12-31', name: "New Year's Eve", type: 'SPECIAL_NON_WORKING', isNationwide: true, year: 2024 }
];

export class TimeAttendanceService {

  // ============================================================================
  // WORK SCHEDULE METHODS
  // ============================================================================

  /**
   * Get default work schedules
   */
  static getDefaultSchedules(): Omit<WorkSchedule, 'id' | 'orgId'>[] {
    return [...DEFAULT_WORK_SCHEDULES];
  }

  /**
   * Check if date is a work day
   */
  static isWorkDay(date: Date, schedule: WorkSchedule): boolean {
    return schedule.workDays.includes(date.getDay());
  }

  /**
   * Get expected work hours for a date
   */
  static getExpectedHours(date: Date, schedule: WorkSchedule): number {
    return this.isWorkDay(date, schedule) ? schedule.regularHoursPerDay : 0;
  }

  /**
   * Parse time string to minutes from midnight
   */
  static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes to time string
   */
  static minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  // ============================================================================
  // TIME ENTRY PROCESSING
  // ============================================================================

  /**
   * Process a time entry and calculate hours
   */
  static processTimeEntry(
    clockIn: string,
    clockOut: string,
    schedule: WorkSchedule,
    date: Date
  ): {
    regularHours: number;
    overtimeHours: number;
    nightDiffHours: number;
    undertimeMinutes: number;
    tardyMinutes: number;
    status: AttendanceStatus;
  } {
    const clockInMinutes = this.timeToMinutes(clockIn);
    const clockOutMinutes = this.timeToMinutes(clockOut);
    const scheduleStartMinutes = this.timeToMinutes(schedule.startTime);
    const scheduleEndMinutes = this.timeToMinutes(schedule.endTime);
    const nightDiffStartMinutes = this.timeToMinutes(schedule.nightDiffStart);
    const nightDiffEndMinutes = this.timeToMinutes(schedule.nightDiffEnd);

    // Handle overnight shift (clock out next day)
    let actualClockOut = clockOutMinutes;
    if (actualClockOut < clockInMinutes) {
      actualClockOut += 24 * 60; // Add 24 hours
    }

    // Calculate total minutes worked (excluding break)
    let totalMinutesWorked = actualClockOut - clockInMinutes - schedule.breakDurationMinutes;
    totalMinutesWorked = Math.max(0, totalMinutesWorked);

    // Calculate tardiness
    let tardyMinutes = 0;
    if (clockInMinutes > scheduleStartMinutes + schedule.gracePeriodMinutes) {
      tardyMinutes = clockInMinutes - scheduleStartMinutes;
    }

    // Calculate undertime
    let undertimeMinutes = 0;
    if (clockOutMinutes < scheduleEndMinutes) {
      undertimeMinutes = scheduleEndMinutes - clockOutMinutes;
    }

    // Calculate regular and overtime hours
    const regularMinutes = Math.min(totalMinutesWorked, schedule.regularHoursPerDay * 60);
    const overtimeMinutes = Math.max(0, totalMinutesWorked - schedule.regularHoursPerDay * 60);

    const regularHours = Math.round((regularMinutes / 60) * 100) / 100;
    const overtimeHours = Math.round((overtimeMinutes / 60) * 100) / 100;

    // Calculate night differential hours
    let nightDiffMinutes = 0;
    
    // Check if any work time falls within night diff window
    // Night diff: 10pm (22:00) to 6am (06:00)
    for (let minute = clockInMinutes; minute < actualClockOut; minute++) {
      const normalizedMinute = minute % (24 * 60);
      if (normalizedMinute >= nightDiffStartMinutes || normalizedMinute < nightDiffEndMinutes) {
        // Skip break time
        const breakStart = this.timeToMinutes(schedule.breakStartTime || '12:00');
        const breakEnd = this.timeToMinutes(schedule.breakEndTime || '13:00');
        if (normalizedMinute < breakStart || normalizedMinute >= breakEnd) {
          nightDiffMinutes++;
        }
      }
    }

    const nightDiffHours = Math.round((nightDiffMinutes / 60) * 100) / 100;

    // Determine status
    let status: AttendanceStatus = 'PRESENT';
    if (tardyMinutes > schedule.gracePeriodMinutes * 2 || undertimeMinutes > 120) {
      status = 'HALF_DAY';
    }

    return {
      regularHours,
      overtimeHours,
      nightDiffHours,
      undertimeMinutes,
      tardyMinutes,
      status
    };
  }

  /**
   * Calculate deductions for tardiness and undertime
   */
  static calculateTimeDeductions(
    tardyMinutes: number,
    undertimeMinutes: number,
    dailyRate: number,
    hoursPerDay: number = 8
  ): {
    tardinessDeduction: number;
    undertimeDeduction: number;
    totalDeduction: number;
  } {
    const minuteRate = dailyRate / (hoursPerDay * 60);
    
    const tardinessDeduction = Math.round(tardyMinutes * minuteRate * 100) / 100;
    const undertimeDeduction = Math.round(undertimeMinutes * minuteRate * 100) / 100;
    
    return {
      tardinessDeduction,
      undertimeDeduction,
      totalDeduction: tardinessDeduction + undertimeDeduction
    };
  }

  /**
   * Create time entry
   */
  static createTimeEntry(
    orgId: string,
    employeeId: string,
    date: string,
    clockIn: string,
    clockOut: string,
    schedule: WorkSchedule,
    options?: {
      breakStart?: string;
      breakEnd?: string;
      isManualEntry?: boolean;
    }
  ): Omit<TimeEntry, 'id'> {
    const dateObj = new Date(date);
    const processed = this.processTimeEntry(clockIn, clockOut, schedule, dateObj);

    return {
      orgId,
      employeeId,
      scheduleId: schedule.id,
      date,
      clockIn,
      clockOut,
      breakStart: options?.breakStart,
      breakEnd: options?.breakEnd,
      ...processed,
      isManualEntry: options?.isManualEntry ?? false,
      approvalStatus: 'PENDING'
    };
  }

  // ============================================================================
  // ATTENDANCE SUMMARY
  // ============================================================================

  /**
   * Generate attendance summary for payroll period
   */
  static generateAttendanceSummary(
    employeeId: string,
    periodStart: string,
    periodEnd: string,
    timeEntries: TimeEntry[],
    schedule: WorkSchedule,
    holidays: HolidayCalendar[],
    dailyRate: number
  ): AttendanceSummary {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    
    let workDays = 0;
    let daysPresent = 0;
    let daysAbsent = 0;
    let daysOnLeave = 0;
    let daysHoliday = 0;
    
    let totalRegularHours = 0;
    let totalOvertimeHours = 0;
    let totalNightDiffHours = 0;
    let totalTardyMinutes = 0;
    let totalUndertimeMinutes = 0;

    // Iterate through each day in the period
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      
      // Check if it's a scheduled work day
      if (schedule.workDays.includes(dayOfWeek)) {
        workDays++;
        
        // Check if it's a holiday
        const holiday = holidays.find(h => h.date === dateStr);
        if (holiday) {
          daysHoliday++;
        } else {
          // Find time entry for this date
          const entry = timeEntries.find(e => e.date === dateStr);
          
          if (entry) {
            switch (entry.status) {
              case 'PRESENT':
                daysPresent++;
                break;
              case 'HALF_DAY':
                daysPresent += 0.5;
                daysAbsent += 0.5;
                break;
              case 'ON_LEAVE':
                daysOnLeave++;
                break;
              case 'ABSENT':
                daysAbsent++;
                break;
            }
            
            totalRegularHours += entry.regularHours;
            totalOvertimeHours += entry.overtimeHours;
            totalNightDiffHours += entry.nightDiffHours;
            totalTardyMinutes += entry.tardyMinutes;
            totalUndertimeMinutes += entry.undertimeMinutes;
          } else {
            // No entry = absent
            daysAbsent++;
          }
        }
      }
      
      current.setDate(current.getDate() + 1);
    }

    // Calculate deductions
    const deductions = this.calculateTimeDeductions(
      totalTardyMinutes,
      totalUndertimeMinutes,
      dailyRate,
      schedule.regularHoursPerDay
    );

    const absenceDeduction = Math.round(daysAbsent * dailyRate * 100) / 100;

    return {
      employeeId,
      periodStart,
      periodEnd,
      workDays,
      daysPresent: Math.round(daysPresent * 100) / 100,
      daysAbsent: Math.round(daysAbsent * 100) / 100,
      daysOnLeave,
      daysHoliday,
      totalRegularHours: Math.round(totalRegularHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      totalNightDiffHours: Math.round(totalNightDiffHours * 100) / 100,
      totalUndertimeMinutes,
      totalTardyMinutes,
      undertimeDeduction: deductions.undertimeDeduction,
      tardinessDeduction: deductions.tardinessDeduction,
      absenceDeduction
    };
  }

  // ============================================================================
  // HOLIDAY CALENDAR
  // ============================================================================

  /**
   * Get default Philippine holidays
   */
  static getDefaultHolidays(year: number): Omit<HolidayCalendar, 'id' | 'orgId'>[] {
    // Return 2024 holidays (can be extended for other years)
    if (year === 2024) {
      return [...PH_REGULAR_HOLIDAYS_2024, ...PH_SPECIAL_HOLIDAYS_2024];
    }
    // For other years, return empty (should be configured)
    return [];
  }

  /**
   * Check if date is a holiday
   */
  static isHoliday(
    date: string,
    holidays: HolidayCalendar[]
  ): { isHoliday: boolean; holiday?: HolidayCalendar } {
    const holiday = holidays.find(h => h.date === date);
    return {
      isHoliday: !!holiday,
      holiday
    };
  }

  /**
   * Check if date is a regular holiday (200% pay)
   */
  static isRegularHoliday(date: string, holidays: HolidayCalendar[]): boolean {
    return holidays.some(h => h.date === date && h.type === 'REGULAR');
  }

  /**
   * Check if date is a special non-working holiday (130% pay)
   */
  static isSpecialHoliday(date: string, holidays: HolidayCalendar[]): boolean {
    return holidays.some(h => h.date === date && h.type === 'SPECIAL_NON_WORKING');
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format hours for display
   */
  static formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }

  /**
   * Format minutes for display
   */
  static formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${m}m`;
  }

  /**
   * Get attendance status display
   */
  static getStatusBadge(status: AttendanceStatus): { text: string; color: string } {
    const badges: Record<AttendanceStatus, { text: string; color: string }> = {
      'PRESENT': { text: 'Present', color: 'green' },
      'ABSENT': { text: 'Absent', color: 'red' },
      'HALF_DAY': { text: 'Half Day', color: 'yellow' },
      'ON_LEAVE': { text: 'On Leave', color: 'blue' },
      'HOLIDAY': { text: 'Holiday', color: 'purple' },
      'REST_DAY': { text: 'Rest Day', color: 'gray' }
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

  /**
   * Get work days in period
   */
  static getWorkDaysInPeriod(
    startDate: string,
    endDate: string,
    schedule: WorkSchedule,
    holidays: HolidayCalendar[]
  ): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workDays = 0;

    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      
      // Check if work day and not a holiday
      if (this.isWorkDay(current, schedule) && !this.isHoliday(dateStr, holidays).isHoliday) {
        workDays++;
      }
      
      current.setDate(current.getDate() + 1);
    }

    return workDays;
  }
}
