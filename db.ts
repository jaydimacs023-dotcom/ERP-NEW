
import { AccountClass, AssetCategory, ChartOfAccount, JournalEntry, JournalEntryLine, AuditLog, Organization, User, Student, Qualification, Trainer, Batch, BatchStatus, Sponsor, NonStockItem, Vendor, FixedAsset, BankAccount, Location, TaxCategory, WHTCategory, TrainerSchedule } from './types';

export const INITIAL_ORGS: Organization[] = [
  { 
    id: 'org-system', 
    name: 'AccounTech Platform Host', 
    currency: 'USD', 
    isVatRegistered: true,
    subscriptionStatus: 'ACTIVE',
    planType: 'ENTERPRISE',
    createdAt: '2023-01-01T00:00:00Z',
    primaryColor: '#e11d48' // Rose 600
  },
  { 
    id: 'org-3', 
    name: 'Manila Skills Academy', 
    currency: 'PHP', 
    isVatRegistered: true,
    subscriptionStatus: 'ACTIVE',
    planType: 'PROFESSIONAL',
    licenseExpiry: '2025-12-31',
    createdAt: '2024-01-01T00:00:00Z',
    primaryColor: '#4f46e5' // Indigo 600
  }
];

export const INITIAL_USERS: User[] = [
  { id: 'user-dev', name: 'Lead Architect', email: 'dev@accountech.io', password: 'admin', role: 'SYSTEM_ADMIN', orgId: 'org-system' },
  { id: 'user-4', name: 'Maria Santos', email: 'maria@manila.ph', password: 'admin', role: 'ADMIN', orgId: 'org-3' },
  { id: 'user-5', name: 'Ricardo Registrar', email: 'ricardo@manila.ph', password: 'registrar', role: 'REGISTRAR', orgId: 'org-3' }
];

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
];

export const INITIAL_COA: ChartOfAccount[] = [...COA_TEMPLATE('org-3')];
export const INITIAL_VENDORS: Vendor[] = [
  { id: 'ven-1', orgId: 'org-3', name: 'Meralco (Utilities)', category: 'Utilities', email: 'billing@meralco.com.ph', contactNumber: '16211', address: 'Ortigas Center, Pasig City', apAccountId: '2100-org-3', createdAt: '2024-01-10T00:00:00Z' }
];
export const INITIAL_BANK_ACCOUNTS: BankAccount[] = [
  { id: 'bank-1', orgId: 'org-3', bankName: 'BDO Unibank', accountNumber: '00123-4567-89', type: 'CHECKING', glAccountId: '1100-org-3', currency: 'PHP' }
];
export const INITIAL_FIXED_ASSETS: FixedAsset[] = [];
export const INITIAL_LOCATIONS: Location[] = [
  {
    id: 'loc-1',
    orgId: 'org-3',
    code: 'MAIN-MNL',
    name: 'Manila Central Campus',
    address: '123 Rizal Ave, Santa Cruz, Manila, 1003 Metro Manila',
    createdAt: '2024-01-01T00:00:00Z'
  }
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'stud-1', orgId: 'org-3', uli: '24-703-001-00001', lastName: 'Mercado', firstName: 'Jose', middleName: 'Protacio', extension: '',
    sex: 'Male', dateOfBirth: '1998-06-19', age: 26, birthRegion: 'Region IV-A', birthProvince: 'Laguna', birthCity: 'Calamba',
    civilStatus: 'Single', educationalAttainment: 'College Graduate', nationality: 'Filipino', email: 'jose.mercado@example.ph',
    contactNumber: '09171234567', street: 'Kalsada St.', barangay: 'Poblacion', city: 'Calamba', district: '2nd District',
    province: 'Laguna', guardian: 'Teodora Alonzo', documents: [], createdAt: '2024-01-01T08:00:00Z'
  }
];

export const INITIAL_SPONSORS: Sponsor[] = [
  { id: 'spon-1', orgId: 'org-3', name: 'City Government of Manila', type: 'GOVERNMENT', email: 'finance@manila.gov.ph', contactNumber: '+63 2 8527 0011', arAccountId: '1200-org-3', isActive: true, createdAt: '2024-01-01T00:00:00Z' }
];
export const INITIAL_ITEMS: NonStockItem[] = [
  { id: 'item-1', orgId: 'org-3', code: 'TUITION-NCII', name: 'NCII Assessment & Tuition Fee', defaultAccountId: '4100-org-3', unitPrice: 15000, type: 'FEE', taxCategory: TaxCategory.VAT, whtRate: WHTCategory.SERVICES, isActive: true, createdAt: '2024-01-01T00:00:00Z' }
];
export const INITIAL_QUALIFICATIONS: Qualification[] = [
  { id: 'qual-1', orgId: 'org-3', code: 'CSS-NCII', name: 'Computer Systems Servicing NC II', durationDays: 35, sector: 'ICT', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'qual-2', orgId: 'org-3', code: 'BKK-NCIII', name: 'Bookkeeping NC III', durationDays: 37, sector: 'Business', createdAt: '2024-01-05T00:00:00Z' },
  { id: 'qual-3', orgId: 'org-3', code: 'VGD-NCIII', name: 'Visual Graphic Design NC III', durationDays: 45, sector: 'ICT', createdAt: '2024-01-10T00:00:00Z' }
];
export const INITIAL_TRAINERS: Trainer[] = [
  { 
    id: 'train-1', orgId: 'org-3', firstName: 'Juan', lastName: 'Dela Cruz', middleName: 'Protacio', 
    email: 'juan.dc@academy.ph', contactNumber: '+63 917 123 4567', specialization: 'ICT', 
    qualificationIds: ['qual-1'], createdAt: '2024-01-01T00:00:00Z' 
  }
];
export const INITIAL_SCHEDULES: TrainerSchedule[] = [
  { 
    id: 'sch-1', 
    orgId: 'org-3', 
    trainerId: 'train-1', 
    slots: [
      { dayIndex: 1, startTime: '08:00', endTime: '12:00' },
      { dayIndex: 2, startTime: '13:00', endTime: '17:00' },
      { dayIndex: 3, startTime: '08:00', endTime: '16:00' },
      { dayIndex: 4, startTime: '08:00', endTime: '16:00' },
      { dayIndex: 5, startTime: '08:00', endTime: '16:00' }
    ], 
    description: 'Standard Varied Shift', 
    createdAt: '2024-01-01T00:00:00Z' 
  }
];
export const INITIAL_BATCHES: Batch[] = [];
export const INITIAL_ENTRIES: JournalEntry[] = [];
export const INITIAL_LINES: JournalEntryLine[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
