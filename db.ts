/**
 * AT-ERP Database Types and Empty Data Exports
 * All actual data is sourced from Supabase - no mock data.
 * Empty arrays provided for type compatibility only.
 */

import { AccountClass, AssetCategory, ChartOfAccount, JournalEntry, JournalEntryLine, AuditLog, Organization, User, Student, Qualification, Trainer, Batch, BatchStatus, Sponsor, NonStockItem, Vendor, FixedAsset, BankAccount, Location, TaxCategory, WHTCategory, TrainerSchedule, Employee, PaymentHistory } from './types';

// All data sourced from Supabase - empty arrays for compatibility
export const INITIAL_ORGS: Organization[] = [];
export const INITIAL_USERS: User[] = [];
export const INITIAL_COA: ChartOfAccount[] = [];
export const INITIAL_VENDORS: Vendor[] = [];
export const INITIAL_BANK_ACCOUNTS: BankAccount[] = [];
export const INITIAL_FIXED_ASSETS: FixedAsset[] = [];
export const INITIAL_LOCATIONS: Location[] = [];
export const INITIAL_STUDENTS: Student[] = [];
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_SPONSORS: Sponsor[] = [];
export const INITIAL_ITEMS: NonStockItem[] = [];
export const INITIAL_QUALIFICATIONS: Qualification[] = [];
export const INITIAL_TRAINERS: Trainer[] = [];
export const INITIAL_SCHEDULES: TrainerSchedule[] = [];
export const INITIAL_BATCHES: Batch[] = [];
export const INITIAL_ENTRIES: JournalEntry[] = [];
export const INITIAL_LINES: JournalEntryLine[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
export const INITIAL_PAYMENTS: PaymentHistory[] = [];

/**
 * COA_TEMPLATE - Chart of Accounts Template Generator
 * Used when creating a new organization to populate default accounts
 */
export const COA_TEMPLATE = (orgId: string): ChartOfAccount[] => [
  { id: `1000-${orgId}`, orgId, code: '1000', name: 'ASSETS', class: AccountClass.ASSET, isHeader: true, isActive: true },
  { id: `1100-${orgId}`, orgId, code: '1100', name: 'BDO Checking Account', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: false, isActive: true },
  { id: `1101-${orgId}`, orgId, code: '1101', name: 'Petty Cash', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: false, isActive: true },
  { id: `1200-${orgId}`, orgId, code: '1200', name: 'Accounts Receivable', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: false, isActive: true },
  { id: `1210-${orgId}`, orgId, code: '1210', name: 'Input VAT', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: false, isActive: true },
  { id: `1500-${orgId}`, orgId, code: '1500', name: 'Property, Plant & Equipment', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: true, isActive: true },
  { id: `1510-${orgId}`, orgId, code: '1510', name: 'Building & Improvements (Cost)', class: AccountClass.ASSET, parentId: `1500-${orgId}`, isHeader: false, isActive: true },
  { id: `1520-${orgId}`, orgId, code: '1520', name: 'Furniture & Fixtures (Cost)', class: AccountClass.ASSET, parentId: `1500-${orgId}`, isHeader: false, isActive: true },
  { id: `1530-${orgId}`, orgId, code: '1530', name: 'Office & IT Equipment (Cost)', class: AccountClass.ASSET, parentId: `1500-${orgId}`, isHeader: false, isActive: true },
  { id: `1540-${orgId}`, orgId, code: '1540', name: 'Service Vehicles (Cost)', class: AccountClass.ASSET, parentId: `1500-${orgId}`, isHeader: false, isActive: true },
  { id: `1600-${orgId}`, orgId, code: '1600', name: 'Accumulated Depreciation', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: true, isActive: true },
  { id: `1610-${orgId}`, orgId, code: '1610', name: 'Acc. Depr - Building', class: AccountClass.ASSET, parentId: `1600-${orgId}`, isHeader: false, isActive: true },
  { id: `1620-${orgId}`, orgId, code: '1620', name: 'Acc. Depr - Furniture', class: AccountClass.ASSET, parentId: `1600-${orgId}`, isHeader: false, isActive: true },
  { id: `1630-${orgId}`, orgId, code: '1630', name: 'Acc. Depr - Office/IT', class: AccountClass.ASSET, parentId: `1600-${orgId}`, isHeader: false, isActive: true },
  { id: `1640-${orgId}`, orgId, code: '1640', name: 'Acc. Depr - Vehicles', class: AccountClass.ASSET, parentId: `1600-${orgId}`, isHeader: false, isActive: true },
  { id: `2000-${orgId}`, orgId, code: '2000', name: 'LIABILITIES', class: AccountClass.LIABILITY, isHeader: true, isActive: true },
  { id: `2100-${orgId}`, orgId, code: '2100', name: 'Accounts Payable', class: AccountClass.LIABILITY, parentId: `2000-${orgId}`, isHeader: false, isActive: true },
  { id: `2200-${orgId}`, orgId, code: '2200', name: 'Output VAT Payable', class: AccountClass.LIABILITY, parentId: `2000-${orgId}`, isHeader: false, isActive: true },
  { id: `2300-${orgId}`, orgId, code: '2300', name: 'EWT Payable', class: AccountClass.LIABILITY, parentId: `2000-${orgId}`, isHeader: false, isActive: true },
  { id: `2400-${orgId}`, orgId, code: '2400', name: 'Accrued Payroll & Benefits', class: AccountClass.LIABILITY, parentId: `2000-${orgId}`, isHeader: false, isActive: true },
  { id: `3000-${orgId}`, orgId, code: '3000', name: 'EQUITY', class: AccountClass.EQUITY, isHeader: true, isActive: true },
  { id: `3100-${orgId}`, orgId, code: '3100', name: 'Retained Earnings', class: AccountClass.EQUITY, parentId: `3000-${orgId}`, isHeader: false, isActive: true },
  { id: `3200-${orgId}`, orgId, code: '3200', name: "Owner's Capital", class: AccountClass.EQUITY, parentId: `3000-${orgId}`, isHeader: false, isActive: true },
  { id: `3300-${orgId}`, orgId, code: '3300', name: "Owner's Drawings", class: AccountClass.EQUITY, parentId: `3000-${orgId}`, isHeader: false, isActive: true },
  { id: `4000-${orgId}`, orgId, code: '4000', name: 'REVENUE', class: AccountClass.REVENUE, isHeader: true, isActive: true },
  { id: `4100-${orgId}`, orgId, code: '4100', name: 'Training Revenue', class: AccountClass.REVENUE, parentId: `4000-${orgId}`, isHeader: false, isActive: true },
  { id: `4200-${orgId}`, orgId, code: '4200', name: 'Books & Materials Revenue', class: AccountClass.REVENUE, parentId: `4000-${orgId}`, isHeader: false, isActive: true },
  { id: `5000-${orgId}`, orgId, code: '5000', name: 'EXPENSES', class: AccountClass.EXPENSE, isHeader: true, isActive: true },
  { id: `5100-${orgId}`, orgId, code: '5100', name: 'Depreciation Expense', class: AccountClass.EXPENSE, parentId: `5000-${orgId}`, isHeader: false, isActive: true },
  { id: `5200-${orgId}`, orgId, code: '5200', name: 'Office Supplies Expense', class: AccountClass.EXPENSE, parentId: `5000-${orgId}`, isHeader: false, isActive: true },
  { id: `5300-${orgId}`, orgId, code: '5300', name: 'Utilities Expense', class: AccountClass.EXPENSE, parentId: `5000-${orgId}`, isHeader: false, isActive: true },
  { id: `5400-${orgId}`, orgId, code: '5400', name: 'Professional Fees', class: AccountClass.EXPENSE, parentId: `5000-${orgId}`, isHeader: false, isActive: true },
  { id: `5500-${orgId}`, orgId, code: '5500', name: 'Salaries & Wages', class: AccountClass.EXPENSE, parentId: `5000-${orgId}`, isHeader: false, isActive: true },
];