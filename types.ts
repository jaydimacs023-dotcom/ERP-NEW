
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
  role: 'SYSTEM_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'REGISTRAR' | 'STUDENT' | 'TRAINER' | 'AP_SPECIALIST' | 'AR_SPECIALIST' | 'FINANCE_MANAGER' | 'PRESIDENT' | 'TREASURY' | 'AUDITOR' | 'AP_CLERK' | 'AP_SUPERVISOR';
  orgId: string;
  studentId?: string; 
  trainerId?: string; 
  isEmailVerified?: boolean; // Added for email verification
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

export type VendorType = 'local' | 'foreign';
export type VendorStatus = 'active' | 'blocked' | 'archived';

export interface Vendor extends BaseEntity {
  id: string;
  orgId: string;
  name: string;
  category: string;
  email: string;
  contactNumber: string;
  address: string;
  apAccountId?: string;
  // Enhanced fields
  tin?: string;
  vendorType?: VendorType;
  currency?: string;
  status?: VendorStatus;
  paymentTermsDays?: number; // Net days for payment
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ATCCategory extends BaseEntity {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ATCItem extends BaseEntity {
  id: string;
  categoryId: string;
  atcCode: string;
  description: string;
  taxpayerType: 'Individual' | 'Corporation' | 'Both';
  createdAt?: string;
  updatedAt?: string;
}

export interface ATCRate extends BaseEntity {
  id: string;
  atcItemId: string;
  rate: number;
  rateLabel: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface Bill extends BaseEntity {
  id: string;
  orgId: string;
  vendorId: string;
  reference: string;
  billDate: string;
  dueDate?: string;
  currency?: string;
  lines: Array<{ itemId: string; description: string; qty: number; price: number; total: number }>;
  vatPurchases: number;
  inputVat: number;
  nonVatPurchases: number;
  totalEwt: number;
  grossAmount: number;
  netPayable: number;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
  journalEntryId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type PayableCategory = 'utilities' | 'supplies' | 'training_materials' | 'contractor_services' | 'assessments' | 'insurance' | 'government_obligations' | 'scholarship_advances' | 'employee_reimbursements' | 'general' | 'other';

export type PayableStatus = 'for_approval' | 'approved' | 'paid' | 'partially_paid' | 'cancelled';

export type InvoiceType = 'standard' | 'prepayment' | 'credit_memo' | 'debit_memo';

export type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'auto_debit' | 'ewallet';

export interface Payable extends BaseEntity {
  id: string;
  orgId: string;
  vendorId: string;
  payableNumber: string;
  category: PayableCategory;
  description: string;
  amount: number;
  billDate: string;
  dueDate: string;
  paymentDate?: string;
  currency?: string;
  status: PayableStatus;
  referenceDocument?: string;
  journalEntryId?: string;
  glAccountId?: string;
  notes?: string;
  withholdingType?: WithholdingType;
  atcItemId?: string;
  atcRateId?: string;
  appliedRatePercent?: number;
  withholdingAmount?: number;
  netPayable?: number;
  createdBy?: string;
  approvedBy?: string;
  paidBy?: string;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  // Enhanced fields
  invoiceType?: InvoiceType;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  expenseAccountId?: string;
  inputVatAmount?: number;
  inputVatAccountId?: string;
  departmentId?: string;
  costCenterId?: string;
  paidAmount?: number;
  // Payment tracking
  paymentMethod?: PaymentMethod;
  paymentBankAccountId?: string;
  checkNumber?: string;
  checkDate?: string;
  checkVoucherId?: string;
  eftBatchId?: string;
  // Enhanced audit fields
  postedBy?: string;
  postedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  reversalReason?: string;
  reversalJournalId?: string;
  // Period control
  periodId?: string;
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
  balance: number;
  createdAt?: string;
  updatedAt?: string;
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
  sourceType: 'MANUAL' | 'INVOICE' | 'BILL' | 'PAYMENT' | 'COLLECTION' | 'DEPRECIATION' | 'TRANSFER' | 'PURCHASE_ORDER' | 'PAYROLL' | 'CREDIT_MEMO' | 'GR_IR' | 'ACCRUAL' | 'REVERSAL';
  // Enhanced audit fields
  postedBy?: string;
  postedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  reversalReason?: string;
  originalEntryId?: string; // For reversal entries, link to original
  // Integration
  payableId?: string;
  receivableId?: string;
  goodsReceiptId?: string;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
  description?: string; // Alias for memo
  contactId?: string; 
  contactType?: 'STUDENT' | 'TRAINER' | 'SPONSOR' | 'VENDOR' | 'OTHER' | 'EMPLOYEE';
  batchId?: string; 
  itemId?: string;
  assetId?: string;
  isCleared?: boolean;
  // GR/IR Clearing support
  goodsReceiptId?: string;
  goodsReceiptLineId?: string;
  purchaseOrderId?: string;
  purchaseOrderLineId?: string;
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

// ============================================================================
// ACCOUNTING PERIOD & CLOSING
// ============================================================================

export type PeriodStatus = 'OPEN' | 'SOFT_CLOSE' | 'HARD_CLOSE' | 'LOCKED';

export interface AccountingPeriod extends BaseEntity {
  id: string;
  orgId: string;
  name: string; // e.g., "January 2026", "Q1 2026"
  periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  fiscalYear: number;
  periodNumber: number; // 1-12 for monthly, 1-4 for quarterly
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  // Closing workflow
  apClosed: boolean;
  apClosedBy?: string;
  apClosedAt?: string;
  arClosed: boolean;
  arClosedBy?: string;
  arClosedAt?: string;
  glClosed: boolean;
  glClosedBy?: string;
  glClosedAt?: string;
  // Lock controls
  lockedBy?: string;
  lockedAt?: string;
  // Metadata
  createdAt: string;
  updatedAt?: string;
}

export interface PeriodCloseChecklist {
  periodId: string;
  step: string;
  description: string;
  isComplete: boolean;
  completedBy?: string;
  completedAt?: string;
}

// ============================================================================
// GOODS RECEIPT & GR/IR CLEARING
// ============================================================================

export type GoodsReceiptStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface GoodsReceipt extends BaseEntity {
  id: string;
  orgId: string;
  grNumber: string;
  purchaseOrderId: string;
  vendorId: string;
  receiptDate: string;
  status: GoodsReceiptStatus;
  // GR/IR Clearing
  grirClearingAccountId?: string;
  inventoryAccountId?: string;
  journalEntryId?: string;
  // Amounts
  totalAmount: number;
  // Audit
  createdBy?: string;
  createdAt: string;
  postedBy?: string;
  postedAt?: string;
  updatedAt?: string;
  notes?: string;
}

export interface GoodsReceiptLine {
  id: string;
  goodsReceiptId: string;
  purchaseOrderLineId?: string;
  itemId?: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

// ============================================================================
// CHECK PRINTING & EFT
// ============================================================================

export type CheckStatus = 'DRAFT' | 'PRINTED' | 'RELEASED' | 'CLEARED' | 'VOIDED' | 'STALE';

export interface CheckVoucher extends BaseEntity {
  id: string;
  orgId: string;
  checkNumber: string;
  bankAccountId: string;
  payeeId: string;
  payeeType: 'VENDOR' | 'EMPLOYEE' | 'OTHER';
  payeeName: string;
  checkDate: string;
  amount: number;
  amountInWords?: string;
  status: CheckStatus;
  // Linked documents
  payableIds?: string[];
  journalEntryId?: string;
  // Audit
  preparedBy?: string;
  preparedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  printedBy?: string;
  printedAt?: string;
  releasedBy?: string;
  releasedAt?: string;
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EFTBatch extends BaseEntity {
  id: string;
  orgId: string;
  batchNumber: string;
  bankAccountId: string;
  fileFormat: 'ISO20022' | 'SEPA' | 'NACHA' | 'CUSTOM';
  status: 'DRAFT' | 'GENERATED' | 'UPLOADED' | 'PROCESSED' | 'REJECTED';
  totalAmount: number;
  transactionCount: number;
  // File info
  fileName?: string;
  fileContent?: string;
  generatedAt?: string;
  generatedBy?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  processedAt?: string;
  // Audit
  createdAt: string;
  updatedAt?: string;
}

export interface EFTTransaction {
  id: string;
  batchId: string;
  payableId?: string;
  payeeId: string;
  payeeType: 'VENDOR' | 'EMPLOYEE';
  payeeName: string;
  payeeBankName?: string;
  payeeBankAccount?: string;
  payeeBankRoutingCode?: string;
  amount: number;
  currency: string;
  reference: string;
  status: 'PENDING' | 'PROCESSED' | 'REJECTED';
  rejectionReason?: string;
}

// ============================================================================
// ENHANCED PERMISSIONS
// ============================================================================

export type Permission = 
  | 'ap:view' | 'ap:create' | 'ap:edit' | 'ap:delete' | 'ap:approve' | 'ap:pay' | 'ap:post'
  | 'ar:view' | 'ar:create' | 'ar:edit' | 'ar:delete' | 'ar:approve' | 'ar:receive'
  | 'gl:view' | 'gl:create' | 'gl:edit' | 'gl:post' | 'gl:reverse'
  | 'treasury:view' | 'treasury:transfer' | 'treasury:reconcile' | 'treasury:check_print'
  | 'period:view' | 'period:close' | 'period:lock' | 'period:unlock'
  | 'reports:view' | 'reports:export'
  | 'master:view' | 'master:create' | 'master:edit' | 'master:delete'
  | 'admin:users' | 'admin:settings' | 'admin:audit';

export interface RolePermissions {
  role: string;
  permissions: Permission[];
}

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions[] = [
  {
    role: 'AP_CLERK',
    permissions: ['ap:view', 'ap:create', 'ap:edit', 'master:view']
  },
  {
    role: 'AP_SUPERVISOR',
    permissions: ['ap:view', 'ap:create', 'ap:edit', 'ap:delete', 'ap:approve', 'ap:post', 'master:view', 'reports:view']
  },
  {
    role: 'TREASURY',
    permissions: ['treasury:view', 'treasury:transfer', 'treasury:reconcile', 'treasury:check_print', 'ap:pay', 'reports:view']
  },
  {
    role: 'AUDITOR',
    permissions: ['ap:view', 'ar:view', 'gl:view', 'treasury:view', 'reports:view', 'reports:export', 'admin:audit']
  },
  {
    role: 'FINANCE_MANAGER',
    permissions: [
      'ap:view', 'ap:create', 'ap:edit', 'ap:delete', 'ap:approve', 'ap:pay', 'ap:post',
      'ar:view', 'ar:create', 'ar:edit', 'ar:delete', 'ar:approve', 'ar:receive',
      'gl:view', 'gl:create', 'gl:edit', 'gl:post', 'gl:reverse',
      'treasury:view', 'treasury:transfer', 'treasury:reconcile', 'treasury:check_print',
      'period:view', 'period:close',
      'reports:view', 'reports:export',
      'master:view', 'master:create', 'master:edit'
    ]
  },
  {
    role: 'ADMIN',
    permissions: [
      'ap:view', 'ap:create', 'ap:edit', 'ap:delete', 'ap:approve', 'ap:pay', 'ap:post',
      'ar:view', 'ar:create', 'ar:edit', 'ar:delete', 'ar:approve', 'ar:receive',
      'gl:view', 'gl:create', 'gl:edit', 'gl:post', 'gl:reverse',
      'treasury:view', 'treasury:transfer', 'treasury:reconcile', 'treasury:check_print',
      'period:view', 'period:close', 'period:lock', 'period:unlock',
      'reports:view', 'reports:export',
      'master:view', 'master:create', 'master:edit', 'master:delete',
      'admin:users', 'admin:settings', 'admin:audit'
    ]
  }
];