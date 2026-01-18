
export enum AccountClass {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE'
}

export enum AssetCategory {
  LAND = 'LAND',
  BUILDING_IMPROVEMENTS = 'BUILDING_IMPROVEMENTS',
  FURNITURE_FIXTURES = 'FURNITURE_FIXTURES',
  OFFICE_EQUIPMENT = 'OFFICE_EQUIPMENT',
  IT_EQUIPMENT = 'IT_EQUIPMENT',
  SERVICE_VEHICLES = 'SERVICE_VEHICLES',
  OTHER_ASSETS = 'OTHER_ASSETS'
}

export enum TaxCategory {
  VAT = 'VAT',
  NON_VAT = 'NON_VAT',
  VAT_EXEMPT = 'VAT_EXEMPT',
  ZERO_RATED = 'ZERO_RATED'
}

export enum WHTCategory {
  NONE = 0,
  GOODS = 0.01,
  SERVICES = 0.02,
  RENTAL = 0.05,
  PROFESSIONAL = 0.10
}

export enum NormalBalance {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT'
}

export enum BatchStatus {
  PLANNED = 'PLANNED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BILLED = 'FULLY_BILLED',
  CLOSED = 'CLOSED'
}

export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'EXPIRED' | 'PENDING';
export type PlanType = 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface BaseEntity {
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Organization extends BaseEntity {
  id: string;
  name: string;
  currency: string;
  taxId?: string;
  isVatRegistered: boolean;
  subscriptionStatus: SubscriptionStatus;
  planType: PlanType;
  pendingPlanType?: PlanType;
  paymentReference?: string;
  licenseExpiry?: string;
  createdAt: string;
  primaryColor?: string;
  logoUrl?: string;
}

export interface PaymentHistory extends BaseEntity {
  orgId: string;
  amount: number;
  currency: string;
  dueDate: string;
  paidDate?: string;
  status: 'PAID' | 'OVERDUE' | 'PENDING' | 'CANCELLED';
  planType: PlanType;
  description: string;
  invoiceNumber?: string;
  paymentMethod?: string;
}
export interface User extends BaseEntity {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'SYSTEM_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'REGISTRAR' | 'STUDENT' | 'TRAINER' | 'AP_SPECIALIST' | 'AR_SPECIALIST' | 'FINANCE_MANAGER' | 'PRESIDENT';
  orgId: string;
  studentId?: string; 
  trainerId?: string; 
}

export interface StudentDocument {
  id: string;
  name: string;
  status: 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'REJECTED';
  fileData?: string;
  isOther?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  remarks?: string;
}

export interface Student extends BaseEntity {
  id: string;
  orgId: string;
  uli: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  extension?: string;
  sex?: string;
  dateOfBirth?: string;
  birthRegion?: string;
  birthProvince?: string;
  birthCity?: string;
  civilStatus?: string;
  educationalAttainment?: string;
  nationality?: string;
  email?: string;
  contactNumber?: string;
  street?: string;
  barangay?: string;
  city?: string;
  district?: string;
  province?: string;
  guardian?: string;
  locationId?: string;
  sponsorId?: string;
  documents?: string[];                    // Array of document names/IDs
  createdAt?: string;
  updatedAt?: string;
}

export interface Trainer extends BaseEntity {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  contactNumber: string;
  specialization: string;
  qualificationIds: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface DaySlot {
  dayIndex: number;
  startTime: string;
  endTime: string;
}

export interface TrainerSchedule extends BaseEntity {
  id: string;
  orgId: string;
  trainerId: string;
  locationId?: string;
  slots: DaySlot[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Sponsor extends BaseEntity {
  id: string;
  orgId: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vendor extends BaseEntity {
  id: string;
  orgId: string;
  name: string;
  category: string;
  tin?: string;
  email: string;
  contactNumber: string;
  address: string;
  apAccountId?: string;
  // Tax configuration
  taxpayerType?: 'INDIVIDUAL' | 'CORPORATE';
  isTaxable?: boolean;
  createdAt: string;
}

export interface PurchaseOrderLine {
  id: string;
  itemId: string;
  description: string;
  qty: number;
  unitPrice: number;
  taxAmount: number;
}

export interface PurchaseOrder extends BaseEntity {
  id: string;
  orgId: string;
  vendorId: string;
  date: string;
  reference: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  totalAmount: number;
  memo?: string;
  createdAt: string;
}

export type WithholdingType = 'EXPANDED' | 'FINAL';

export interface Payable extends BaseEntity {
  id: string;
  orgId: string;
  vendorId: string;
  refNo?: string;
  billDate: string;
  dueDate?: string;
  currency?: string;
  grossAmount: number;
  withholdingType?: WithholdingType;
  atcItemId?: string;
  atcRateId?: string;
  appliedRatePercent?: number;
  withholdingAmount: number;
  netPayable: number;
  status?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FixedAsset extends BaseEntity {
  id: string;
  orgId: string;
  code: string;
  name: string;
  description?: string;
  category: string; // Flexible category (can be AssetCategory or other values)
  purchaseDate: string; // date YYYY-MM-DD
  purchaseCost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  depreciationMethod: string; // e.g., 'STRAIGHT_LINE', 'DECLINING_BALANCE'
  usefulLifeYears: number;
  glAccountId: string; // GL account for asset
  createdAt: string;
  updatedAt?: string;
}

export interface BankAccount extends BaseEntity {
  id: string;
  orgId: string;
  bankName: string;
  accountNumber: string;
  type: 'SAVINGS' | 'CHECKING' | 'CREDIT' | 'CASH';
  glAccountId: string; 
  currency: string;
}

export interface NonStockItem extends BaseEntity {
  id: string;
  orgId: string;
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  incomeAccountId: string;  // Maps to income_account_id
  expenseAccountId: string; // Maps to expense_account_id
  createdAt: string;
}

export interface Qualification extends BaseEntity {
  id: string;
  orgId: string;
  code: string;
  name: string;
  durationDays: number;
  sector?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Batch extends BaseEntity {
  id: string;
  orgId: string;
  batchCode?: string;
  name: string;
  year: number;
  qualificationId: string;
  trainerId: string;
  sponsorId?: string;
  locationId?: string;
  studentIds: string[];
  status: BatchStatus;
  startDate: string;
  endDate: string;
  maxStudents?: number;
  currentStudents?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChartOfAccount extends BaseEntity {
  id: string;
  orgId: string;
  code: string;
  name: string;
  class: AccountClass;
  parentId?: string;
  qualificationId?: string; 
  isActive: boolean;
  isHeader: boolean;
}

export interface Location extends BaseEntity {
  id: string;
  orgId: string;
  code?: string;
  name: string;
  address: string;
  capacity?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface JournalEntry extends BaseEntity {
  id: string;
  orgId: string;
  periodId: string;
  date: string;
  description: string;
  reference: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  createdBy: string;
  createdAt: string;
  sourceType: 'MANUAL' | 'INVOICE' | 'BILL' | 'PAYMENT' | 'COLLECTION' | 'DEPRECIATION' | 'TRANSFER' | 'PURCHASE_ORDER' | 'PAYROLL';
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
  contactId?: string; 
  contactType?: 'STUDENT' | 'TRAINER' | 'SPONSOR' | 'VENDOR' | 'OTHER' | 'EMPLOYEE';
  batchId?: string; 
  itemId?: string;
  assetId?: string;
  isCleared?: boolean; 
}

export interface TransactionSummary {
  accountId: string;
  accountName: string;
  accountClass: AccountClass;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export interface AuditLog {
  id: string;
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface Budget extends BaseEntity {
  id: string;
  orgId: string;
  fiscalYear: number;
  name: string;
  status: 'ACTIVE' | 'DRAFT' | 'CLOSED';
  createdAt: string;
}

export interface BudgetLine {
  id: string;
  budgetId: string;
  accountId: string;
  budgetedAmount: number;
}

export interface Employee extends BaseEntity {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  designation: string;
  tin?: string;
  sss?: string;
  philhealth?: string;
  pagibig?: string;
  basicSalary: number;
  bankName?: string;
  bankAccount?: string;
  isActive: boolean;
  createdAt: string;
}

export interface PayrollRun extends BaseEntity {
  id: string;
  orgId: string;
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'POSTED';
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  createdAt: string;
}

export interface PayrollLine {
  id: string;
  orgId: string;
  payrollRunId: string;
  employeeId: string;
  grossPay: number;
  deductionsTax: number;
  deductionsSss: number;
  deductionsPhilhealth: number;
  deductionsPagibig: number;
  deductionsOther: number;
  netPay: number;
}

export interface VendorTaxSetting extends BaseEntity {
  id: string;
  orgId: string;
  vendorId: string;
  atcItemId?: string;
  atcRateId?: string;
  withholdingType?: WithholdingType;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ATCCategory extends BaseEntity {
  id: string;
  code: string; // 'A', 'B', 'C'
  name: string; // Category name
  createdAt?: string;
  updatedAt?: string;
}

export interface ATCItem extends BaseEntity {
  id: string;
  categoryId: string | number; // References atc_categories.id
  atcCode: string; // e.g., 'WI010'
  description: string;
  taxpayerType?: 'Individual' | 'Corporation' | 'Both';
  createdAt?: string;
  updatedAt?: string;
}

export interface ATCRate extends BaseEntity {
  id: string;
  atcItemId: string | number; // References atc_items.id
  rate: number; // e.g., 5.00 for 5%
  rateLabel?: string; // e.g., '5%'
  createdAt?: string;
  updatedAt?: string;
}