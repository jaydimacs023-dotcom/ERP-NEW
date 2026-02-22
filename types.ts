
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

export enum AlumniEmploymentStatus {
  EMPLOYED = 'Employed',
  SELF_EMPLOYED = 'Self-Employed',
  UNEMPLOYED = 'Unemployed',
  FURTHER_STUDIES = 'Further Studies'
}

export enum AlumniEmploymentType {
  REGULAR = 'Regular',
  CONTRACTUAL = 'Contractual',
  PART_TIME = 'Part-time',
  FREELANCE = 'Freelance'
}

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BILLED = 'FULLY_BILLED',
  CLOSED = 'CLOSED'
}

export enum InventoryTransactionType {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
  RETURN = 'RETURN',
  DAMAGE = 'DAMAGE',
  WRITEOFF = 'WRITEOFF'
}

export enum InventoryValuationMethod {
  FIFO = 'FIFO',
  LIFO = 'LIFO',
  WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
  STANDARD_COST = 'STANDARD_COST'
}

export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'EXPIRED' | 'PENDING';
export type PlanType = 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface BaseEntity {
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

// Subsidiary Ledger for Students (AR)
export interface StudentLedger extends BaseEntity {
  id: string;
  orgId: string;
  studentId: string; // FK to Student
  invoiceId?: string; // FK to Invoice (if AR)
  date: string;
  description: string;
  debit: number; // Amount owed by student
  credit: number; // Amount paid/covered
  balance: number; // Running balance after this entry
  sponsorId?: string; // If covered by sponsor
  createdAt: string;
  updatedAt?: string;
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

export type TaxType = 'VAT' | 'NON_VAT' | 'ZERO_RATED';

export interface Sponsor extends BaseEntity {
  id: string;
  orgId: string;
  sponsorCode?: string; // Unique sponsor identifier
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  tin?: string; // Tax Identification Number
  taxType?: TaxType; // VAT, Non-VAT, Zero-Rated
  ewtRate?: number; // Expanded Withholding Tax Rate (e.g., 0.02 for 2%)
  arAccountId?: string;
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
  glEntryNumber?: string; // Generated when APPROVED - GL transaction reference (e.g., GL-2026-00001)
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  totalAmount: number;
  memo?: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
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

export type PayablePaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'auto_debit' | 'ewallet';

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
  paymentMethod?: PayablePaymentMethod;
  paymentBankAccountId?: string;
  checkNumber?: string;
  checkDate?: string;
  checkVoucherId?: string;
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

export interface BankReconciliation extends BaseEntity {
  id: string;
  orgId: string;
  bankAccountId: string;
  asOfDate: string;
  statementBalance: number;
  bookBalance: number;
  clearedBalance: number;
  difference: number;
  status: 'IN_PROGRESS' | 'RECONCILED' | 'LOCKED';
  reconciliationDetails?: string;
  // Audit
  reconciliationDetails_?: string;
  reconciliedBy?: string;
  reconciliedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  createdAt: string;
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
  taxCategoryId?: string;   // Maps to atc_categories(id) - optional tax classification
  createdAt: string;
}

// Course Fee - links fees to qualifications/courses with tax tracking
export type CourseFeeCategory = 'TUITION' | 'REGISTRATION' | 'CERTIFICATION' | 'ASSESSMENT' | 'MATERIALS' | 'MISCELLANEOUS';

export interface CourseFee extends BaseEntity {
  id: string;
  orgId: string;
  feeCode: string;               // Unique fee identifier (Fee_ID)
  qualificationId: string;       // Links to Qualification (Course_ID)
  feeName: string;               // Fee_Name
  amount: number;                // Amount
  glAccountId: string;           // GL_Account_Code - links to ChartOfAccount
  taxCategoryId?: string;        // Tax_Category - links to ATC categories
  isSubjectToEwt: boolean;       // Is_Subject_to_EWT (Boolean)
  ewtRate?: number;              // EWT rate if applicable (e.g., 0.02 for 2%)
  category?: CourseFeeCategory;  // Optional categorization
  description?: string;          // Optional description
  isActive: boolean;             // Whether fee is currently active
  createdAt: string;
  updatedAt?: string;
}

// Item Group / Billing Package - a predefined set of items for quick invoice creation
export interface ItemGroupItem {
  itemId: string;
  qty: number;
  priceOverride?: number; // Optional override of item's default price
}

export interface ItemGroup extends BaseEntity {
  id: string;
  orgId: string;
  code: string;
  name: string;
  description?: string;
  items: ItemGroupItem[];
  totalAmount?: number; // Cached total (computed from items)
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface WarehouseLocation extends BaseEntity {
  id: string;
  orgId: string;
  code: string;
  name: string;
  description?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
}

export interface StockItem extends BaseEntity {
  id: string;
  orgId: string;
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  costPrice: number;
  warehouseLocationId: string;  // Physical location
  incomeAccountId?: string;  // Revenue account
  cogsAccountId?: string;    // Cost of goods sold account
  expenseAccountId?: string; // Expense account
  taxCategoryId?: string;    // Tax classification (like NonStockItem)
  valuationMethod: InventoryValuationMethod;
  minStockLevel: number;
  maxStockLevel: number;
  reorderQuantity: number;
  createdAt: string;
  updatedAt?: string;
}

export interface InventoryLevel extends BaseEntity {
  id: string;
  orgId: string;
  stockItemId: string;
  warehouseLocationId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;  // onHand - reserved
  lastCounted: string;
  updatedAt: string;
}

export interface InventoryTransaction extends BaseEntity {
  id: string;
  orgId: string;
  referenceNumber: string;
  stockItemId: string;
  transactionType: InventoryTransactionType;
  fromLocationId?: string;
  toLocationId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface StockAdjustment extends BaseEntity {
  id: string;
  orgId: string;
  adjustmentNumber: string;
  stockItemId: string;
  warehouseLocationId: string;
  quantityChange: number;  // Positive or negative
  reason: string;  // Variance, Damage, Count Difference, etc.
  approvedBy?: string;
  approvalDate?: string;
  journalEntryId?: string;  // Links to GL entry
  createdBy?: string;
  createdAt: string;
}

export interface ReorderPoint extends BaseEntity {
  id: string;
  orgId: string;
  stockItemId: string;
  minLevel: number;
  maxLevel: number;
  reorderQuantity: number;
  leadTimeDays: number;
  lastReorderDate?: string;
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

// Enrollment - links students to batches with billing tracking
export type BillingStatus = 'UNBILLED' | 'BILLED' | 'PARTIALLY_BILLED';
export type EnrollmentStatus = 'ACTIVE' | 'DROPPED' | 'COMPLETED' | 'ON_HOLD';

export interface Enrollment extends BaseEntity {
  id: string;
  orgId: string;
  enrollmentCode?: string;      // Human-readable enrollment ID
  studentId: string;            // FK to Student
  batchId: string;              // FK to Batch
  sponsorId?: string;           // FK to Sponsor (can override batch/student sponsor)
  billingStatus: BillingStatus; // Unbilled, Billed, Partially Billed
  enrollmentStatus: EnrollmentStatus; // ACTIVE, DROPPED, COMPLETED, ON_HOLD
  enrollmentDate: string;       // When student enrolled
  completionDate?: string;      // When student completed/dropped
  totalFees?: number;           // Total fees for this enrollment
  billedAmount?: number;        // Amount already billed
  notes?: string;               // Optional notes
  createdAt: string;
  updatedAt?: string;
}

// Invoice - AR Invoice for sponsors/students with EWT tracking
export type InvoiceStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'VOIDED';


export interface InvoiceLine extends BaseEntity {
  id: string;
  invoiceId: string;
  lineNumber: number;
  description: string;
  courseFeeId?: string;        // FK to CourseFee (optional)
  enrollmentId?: string;       // FK to Enrollment (optional)
  quantity: number;
  unitPrice: number;
  amount: number;              // quantity * unitPrice
  taxCategoryId?: string;      // FK to TaxCategory
  vatAmount?: number;          // VAT amount for this line
  glAccountId?: string;        // Revenue G/L account
}

export interface Invoice extends BaseEntity {
  id: string;
  orgId: string;
  invoiceNo: string;           // Human-readable invoice number (e.g., INV-2025-00001)
  sponsorId?: string;          // FK to Sponsor (primary billing party)
  studentId?: string;          // FK to Student (if individual billing)
  enrollmentId?: string;       // FK to Enrollment (optional link)
  batchId?: string;            // FK to Batch (optional link)
  invoiceDate: string;         // Invoice date
  dueDate: string;             // Payment due date
  status: InvoiceStatus;       // DRAFT, OPEN, CLOSED, VOIDED

  // Amounts
  subtotal: number;            // Sum of line amounts before tax
  vatAmount: number;           // Total VAT amount
  grandTotal: number;          // Subtotal + VAT
  totalEwtAmount?: number;     // Total EWT withheld by sponsor
  netAmountDue?: number;       // Grand Total - EWT
  amountPaid: number;          // Payments received
  balanceDue: number;          // Net Amount Due - Amount Paid

  // EWT Configuration
  ewtRate?: number;            // EWT rate applied (e.g., 0.02 for 2%)
  isSubjectToEwt?: boolean;    // Whether invoice is subject to EWT

  // Reference fields
  reference?: string;          // External reference number
  terms?: string;              // Payment terms
  notes?: string;              // Invoice notes/memo
  journalEntryId?: string;     // FK to JournalEntry when posted

  // Audit
  postedBy?: string;
  postedAt?: string;
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;

  // Lines
  lines?: InvoiceLine[];

  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
}

// Payment - AR Payment/Collection from sponsors/students
export type PaymentStatus = 'DRAFT' | 'POSTED' | 'VOIDED';
export type PaymentMethod = 'CASH' | 'CHECK' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'EWALLET' | 'OFFSET';

export interface PaymentApplication extends BaseEntity {
  id: string;
  paymentId: string;            // FK to Payment
  invoiceId: string;            // FK to Invoice
  amountApplied: number;        // Amount applied to this invoice
  isReversed: boolean;          // Whether application was reversed
  reversalReason?: string;      // Reason for reversal
  reversedAt?: string;          // When reversed
  reversedBy?: string;          // Who reversed
  createdAt: string;
  updatedAt?: string;
}

export interface Payment extends BaseEntity {
  id: string;
  orgId: string;
  paymentNo: string;            // Human-readable payment number (e.g., PAY-2025-00001)
  sponsorId?: string;           // FK to Sponsor (primary payer)
  studentId?: string;           // FK to Student (if individual payment)
  paymentDate: string;          // Date payment received
  status: PaymentStatus;        // DRAFT, POSTED, VOIDED
  paymentMethod: PaymentMethod; // CASH, CHECK, BANK_TRANSFER, etc.

  // Reference fields
  refNo?: string;               // External reference (check #, transfer ref, etc.)
  bankAccountId?: string;       // FK to BankAccount (where deposited)
  checkNumber?: string;         // Check number if payment by check
  checkDate?: string;           // Check date

  // Amounts
  amountReceived: number;       // Total amount received from payer
  ewtAmountCertified: number;   // EWT amount certified by sponsor (reduces receivable)
  totalApplied: number;         // Amount applied to invoices
  customerDepositBalance: number; // Remaining unapplied balance (prepayment pool)

  // Applications
  applications?: PaymentApplication[];

  // Audit
  notes?: string;
  journalEntryId?: string;      // FK to JournalEntry when posted
  postedBy?: string;
  postedAt?: string;
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;

  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
}

// ===== Bank Deposits =====
export type BankDepositStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

export interface BankDepositLine {
  id: string;
  depositId: string;
  paymentId?: string;        // FK to Payment if from AR collection
  description: string;       // Description of deposit item
  amount: number;            // Amount for this line
  checkNumber?: string;      // Check number if applicable
  checkDate?: string;        // Check date
  payerName?: string;        // Name of payer
  createdAt?: string;
}

export interface BankDeposit extends BaseEntity {
  id: string;
  orgId: string;
  depositNo: string;         // Human-readable deposit number (e.g., DEP-2025-00001)
  bankAccountId: string;     // FK to BankAccount where deposited
  referenceNo?: string;      // Bank reference / deposit slip number
  depositDate: string;       // Date of deposit
  status: BankDepositStatus; // DRAFT, POSTED, VOIDED

  // Amounts
  totalAmount: number;       // Total deposit amount (sum of lines)
  cashAmount: number;        // Cash portion
  checkAmount: number;       // Check portion

  // Lines
  lines?: BankDepositLine[];

  // Journal entry linkage
  journalEntryId?: string;   // FK to JournalEntry when posted

  // Posting info
  postedBy?: string;
  postedAt?: string;

  // Void info
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;

  // Audit
  notes?: string;
  createdAt: string;
  createdBy?: string;
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
  glEntryNumber?: string; // Generated when POSTED - GL transaction reference (e.g., GL-2026-00001)
  status: 'DRAFT' | 'POSTED' | 'REVERSED' | 'REVISION_REQUESTED';
  createdBy: string;
  createdAt: string;
  sourceType: 'MANUAL' | 'INVOICE' | 'BILL' | 'PAYMENT' | 'COLLECTION' | 'DEPRECIATION' | 'TRANSFER' | 'PURCHASE_ORDER' | 'PAYROLL' | 'CREDIT_MEMO' | 'GR_IR' | 'ACCRUAL' | 'REVERSAL' | 'APPLICATION' | 'VOID' | 'DEPOSIT';
  sourceRef?: string; // Unified reference to source document ID (Invoice ID, Payment ID, Deposit ID, etc.)
  // Enhanced audit fields
  postedBy?: string;
  postedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  reversalReason?: string;
  originalEntryId?: string; // For reversal entries, link to original
  // Review/approval comments
  reviewComments?: ReviewComment[];
  // Integration
  payableId?: string;
  receivableId?: string;
  goodsReceiptId?: string;
  depositId?: string;       // FK to BankDeposit
  recurringEntryId?: string; // Links to recurring template
}

// Review comment for invoice approval workflow
export interface ReviewComment {
  id: string;
  userId: string;
  userName: string;
  comment: string;
  action: 'COMMENT' | 'REQUEST_REVISION' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

// RecurrenceFrequency removed

export interface RecurringJournalEntry extends BaseEntity {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  frequency: RecurrenceFrequency;
  customDayInterval?: number; // For CUSTOM frequency (e.g., every 7 days)
  startDate: string;
  endDate?: string; // Optional end date for recurring series
  nextRunDate: string;
  lastRunDate?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'INACTIVE';
  templateEntry: Omit<JournalEntry, 'id' | 'orgId' | 'createdAt' | 'createdBy' | 'date' | 'reference'> & {
    lineTemplate: Omit<JournalLine, 'id' | 'journalEntryId'>[]
  };

  // Execution tracking
  timesRun: number;
  maxRuns?: number; // Maximum number of executions
  runCount?: number; // Alias for timesRun

  // Configuration
  autoPost: boolean; // Auto-post generated entries
  description_?: string; // Duplicate for description
  createdBy: string;
  createdAt: string;
  updatedAt?: string;

  // Audit
  lastGeneratedEntryId?: string;
  nextScheduledRun?: string;
}

export interface JournalLine {
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

// Duplicate ATC items removed - using definitions from lines 254-279

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

export type EFTStatus = 'DRAFT' | 'GENERATED' | 'SUBMITTED' | 'PROCESSED' | 'PARTIALLY_PROCESSED' | 'FAILED';

export interface EFTBatch extends BaseEntity {
  id: string;
  orgId: string;
  batchNumber: string;
  bankAccountId: string;
  batchDate: string;
  status: EFTStatus;
  totalAmount: number;
  paymentCount: number;
  payableIds?: string[];
  // File generation
  fileFormat?: 'NACHA' | 'ISO20022' | 'CUSTOM';
  generatedFileName?: string;
  generatedAt?: string;
  // Audit
  createdBy?: string;
  createdAt: string;
  submittedBy?: string;
  submittedAt?: string;
  processedAt?: string;
  notes?: string;
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

// ============================================================================
// FOREIGN CURRENCY & EXCHANGE RATES
// ============================================================================

export interface ExchangeRate extends BaseEntity {
  id: string;
  orgId: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  source: string;
  isManual: boolean;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface CurrencyConversion {
  originalAmount: number;
  originalCurrency: string;
  targetCurrency: string;
  rate: number;
  convertedAmount: number;
  rateDate: string;
}

export interface MulticurrencyBalance {
  accountId: string;
  accountName: string;
  balances: {
    [currency: string]: number;
  };
  functionalBalance: number;
  functionalCurrency: string;
}

export type RecurrenceFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
export type RecurringBillStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface RecurringBill extends BaseEntity {
  id: string;
  orgId: string;
  vendorId: string;
  billName: string;
  description: string;
  amount: number;
  currency?: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string;
  nextBillDate: string;
  lastBillDate?: string;
  billDaysAfterMonth?: number; // Day of month to generate bill (1-31)
  status: RecurringBillStatus;
  // Account mapping
  glAccountId?: string;
  expenseAccountId?: string;
  departmentId?: string;
  costCenterId?: string;
  // Bill configuration
  category?: PayableCategory;
  paymentTermsDays?: number;
  withholdingType?: WithholdingType;
  atcItemId?: string;
  atcRateId?: string;
  appliedRatePercent?: number;
  includeWithholding?: boolean;
  // Tracking
  totalBillsGenerated: number;
  autoCreatePayable: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  lastModifiedBy?: string;
  notes?: string;
}

export interface RecurringBillHistory extends BaseEntity {
  id: string;
  orgId: string;
  recurringBillId: string;
  payableId?: string;
  billDate: string;
  amount: number;
  status: 'GENERATED' | 'CREATED' | 'SKIPPED' | 'FAILED';
  notes?: string;
  createdAt: string;
}

export type RecurringInvoiceStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface RecurringInvoiceLineItem {
  id?: string;
  itemId: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxAmount?: number;
}

export interface RecurringInvoice extends BaseEntity {
  id: string;
  orgId: string;
  customerId: string;
  invoiceName: string;
  description?: string;
  amount: number;
  currency?: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string;
  nextInvoiceDate: string;
  lastInvoiceDate?: string;
  paymentTermsDays: number;
  status: RecurringInvoiceStatus;
  // Account mapping
  arAccountId?: string;
  revenueAccountId?: string;
  // Configuration
  autoCreateReceivable: boolean;
  notes?: string;
  // Tracking
  totalInvoicesGenerated?: number;
  lineItems?: RecurringInvoiceLineItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface RecurringInvoiceHistory extends BaseEntity {
  id: string;
  orgId: string;
  recurringInvoiceId: string;
  invoiceId?: string;
  invoiceDate: string;
  amount: number;
  status: 'PENDING' | 'CREATED' | 'FAILED' | 'SKIPPED';
  notes?: string;
  createdAt: string;
}

// ============================================
// Revenue Recognition & Deferred Revenue Types
// ============================================

/**
 * Recognition Method defines how revenue is recognized over time
 * - STRAIGHT_LINE: Equal amounts over the recognition period
 * - PERCENTAGE_OF_COMPLETION: Based on milestones or % complete
 * - POINT_IN_TIME: Recognized at a specific point (delivery/completion)
 */
export type RecognitionMethod = 'STRAIGHT_LINE' | 'PERCENTAGE_OF_COMPLETION' | 'POINT_IN_TIME';

/**
 * Recognition Period defines the time interval for straight-line recognition
 */
export type RecognitionPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

/**
 * Status of a revenue schedule
 */
export type RevenueScheduleStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

/**
 * Revenue Schedule - Template for recognizing deferred revenue over time
 * When payment is received upfront (e.g., tuition), create a schedule to
 * recognize it as earned revenue over the service delivery period.
 */
export interface RevenueSchedule extends BaseEntity {
  id: string;
  orgId: string;

  // Source reference (what generated this deferred revenue)
  sourceType: 'INVOICE' | 'RECEIVABLE' | 'MANUAL';
  sourceId?: string; // Link to AR invoice/receivable
  sourceReference?: string; // Invoice number or manual reference

  // Customer/Student
  customerId: string;
  customerName?: string;

  // Revenue details
  description: string;
  totalAmount: number; // Total amount to be recognized
  currency?: string;

  // Recognition settings
  recognitionMethod: RecognitionMethod;
  recognitionPeriod?: RecognitionPeriod; // For straight-line

  // Schedule dates
  startDate: string; // When recognition begins
  endDate: string; // When recognition ends

  // Tracking
  recognizedAmount: number; // Amount recognized so far
  deferredBalance: number; // Remaining unrecognized amount

  // GL Account mapping
  deferredRevenueAccountId: string; // Liability account (Deferred Revenue)
  revenueAccountId: string; // Revenue account (Earned Revenue)

  // Status
  status: RevenueScheduleStatus;
  lastRecognitionDate?: string;
  nextRecognitionDate?: string;

  // Audit
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
}

/**
 * Recognition Entry - Individual recognition transaction record
 * Each entry represents a portion of deferred revenue being recognized as earned
 */
export interface RevenueRecognitionEntry extends BaseEntity {
  id: string;
  orgId: string;
  scheduleId: string;

  // Recognition details
  recognitionDate: string;
  periodStart: string;
  periodEnd: string;
  amount: number;

  // GL posting
  journalEntryId?: string; // Link to posted journal entry

  // Status
  status: 'PENDING' | 'POSTED' | 'REVERSED';
  postedDate?: string;
  postedBy?: string;

  // For percentage-of-completion method
  percentageComplete?: number;
  milestone?: string;

  // Audit
  createdAt: string;
  notes?: string;
}

/**
 * Deferred Revenue Summary - Aggregated view for reporting
 */
export interface DeferredRevenueSummary {
  customerId: string;
  customerName: string;
  totalDeferred: number;
  totalRecognized: number;
  totalRemaining: number;
  scheduleCount: number;
  oldestScheduleDate: string;
  newestScheduleDate: string;
}

// ============================================
// Tax Bracket & Withholding Tax Types
// ============================================

/**
 * Pay frequency for tax calculation
 */
export type PayFrequency = 'MONTHLY' | 'SEMI_MONTHLY' | 'WEEKLY' | 'DAILY';

/**
 * Individual tax bracket configuration
 */
export interface TaxBracket extends BaseEntity {
  id: string;
  orgId: string;
  tableId: string; // Reference to parent TaxTable
  bracketNumber: number; // Order/sequence (1, 2, 3...)
  minAmount: number; // Minimum compensation for this bracket
  maxAmount: number | null; // Maximum compensation (null = no upper limit)
  baseTax: number; // Fixed tax amount at bracket start
  rate: number; // Percentage rate (e.g., 0.15 for 15%)
  overAmount: number; // Tax rate applies to amount over this threshold
  description?: string;
}

/**
 * Tax table containing multiple brackets
 */
export interface TaxTable extends BaseEntity {
  id: string;
  orgId: string;
  name: string; // e.g., "BIR 2024 Monthly Withholding Tax"
  description?: string;
  frequency: PayFrequency;
  effectiveFrom: string; // Date when this table becomes effective
  effectiveTo?: string; // Date when this table expires (null = current)
  isDefault: boolean; // Is this the default table for the frequency
  country?: string; // e.g., "PH" for Philippines
  version?: string; // e.g., "2024", "TRAIN Law"
  brackets?: TaxBracket[]; // Loaded brackets
}

/**
 * Result of tax calculation
 */
export interface TaxCalculationResult {
  grossCompensation: number;
  taxableIncome: number;
  bracketNumber: number;
  bracketDescription?: string;
  baseTax: number;
  excessAmount: number;
  taxOnExcess: number;
  totalWithholdingTax: number;
}

// ============================================================================
// STATUTORY CONTRIBUTION TYPES (SSS, PhilHealth, PAGIBIG)
// ============================================================================

/**
 * SSS Contribution bracket based on Monthly Salary Credit (MSC)
 * Reference: SSS Contribution Table effective 2024
 */
export interface SSSBracket {
  id?: string;
  bracketNumber: number;
  minCompensation: number; // Minimum monthly salary compensation
  maxCompensation: number | null; // Maximum compensation (null = no upper limit)
  monthlySalaryCredit: number; // MSC - basis for contribution
  employeeShare: number; // Employee's contribution amount
  employerShare: number; // Employer's contribution amount
  totalContribution: number; // Total monthly contribution
  ecEmployer?: number; // Employer EC contribution (if applicable)
}

/**
 * SSS Contribution Table
 */
export interface SSSContributionTable extends BaseEntity {
  id: string;
  orgId: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string;
  employeeRate: number; // e.g., 0.045 (4.5%)
  employerRate: number; // e.g., 0.095 (9.5%)
  minMSC: number; // Minimum Monthly Salary Credit
  maxMSC: number; // Maximum Monthly Salary Credit
  isDefault: boolean;
  brackets: SSSBracket[];
}

/**
 * PhilHealth contribution parameters
 * Reference: PhilHealth Circular 2024
 */
export interface PhilHealthTable extends BaseEntity {
  id: string;
  orgId: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string;
  premiumRate: number; // Total rate (e.g., 0.05 = 5%)
  employeeShareRate: number; // Employee's share of premium (e.g., 0.025 = 2.5%)
  employerShareRate: number; // Employer's share (e.g., 0.025 = 2.5%)
  monthlyFloor: number; // Minimum monthly basic salary for contribution
  monthlyCeiling: number; // Maximum monthly basic salary for contribution
  minContribution: number; // Minimum monthly contribution
  maxContribution: number; // Maximum monthly contribution
  isDefault: boolean;
}

/**
 * Pag-IBIG (HDMF) contribution parameters
 * Reference: Pag-IBIG Circular 2024
 */
export interface PagIBIGTable extends BaseEntity {
  id: string;
  orgId: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string;
  tier1MaxCompensation: number; // Threshold for tier 1 (e.g., 1500)
  tier1EmployeeRate: number; // Rate for tier 1 (e.g., 0.01 = 1%)
  tier1EmployerRate: number;
  tier2EmployeeRate: number; // Rate for tier 2 (e.g., 0.02 = 2%)
  tier2EmployerRate: number;
  maxMonthlyCompensation: number; // Maximum compensation for contribution (e.g., 5000)
  maxEmployeeContribution: number; // Maximum monthly employee contribution
  maxEmployerContribution: number; // Maximum monthly employer contribution
  isDefault: boolean;
}

/**
 * Result of statutory contribution calculation
 */
export interface ContributionCalculationResult {
  grossCompensation: number;

  // SSS
  sssEmployeeShare: number;
  sssEmployerShare: number;
  sssMonthlySalaryCredit: number;
  sssBracketNumber?: number;

  // PhilHealth
  philHealthEmployeeShare: number;
  philHealthEmployerShare: number;
  philHealthBasis: number; // Actual salary used for computation

  // Pag-IBIG
  pagIBIGEmployeeShare: number;
  pagIBIGEmployerShare: number;
  pagIBIGTier: 1 | 2;

  // Totals
  totalEmployeeContributions: number;
  totalEmployerContributions: number;
  totalContributions: number;
}

// ============================================================================
// OVERTIME TYPES
// ============================================================================

/**
 * Philippine DOLE Overtime Types with multipliers
 */
export type OvertimeType =
  | 'REGULAR_OT'           // Regular day overtime (after 8 hrs)
  | 'REST_DAY'             // Rest day work
  | 'REST_DAY_OT'          // Rest day overtime
  | 'SPECIAL_HOLIDAY'      // Special non-working holiday
  | 'SPECIAL_HOLIDAY_OT'   // Special holiday overtime
  | 'SPECIAL_HOLIDAY_REST' // Special holiday falling on rest day
  | 'SPECIAL_HOLIDAY_REST_OT'
  | 'REGULAR_HOLIDAY'      // Regular holiday
  | 'REGULAR_HOLIDAY_OT'   // Regular holiday overtime
  | 'REGULAR_HOLIDAY_REST' // Regular holiday on rest day
  | 'REGULAR_HOLIDAY_REST_OT'
  | 'DOUBLE_HOLIDAY'       // Two holidays on same day
  | 'DOUBLE_HOLIDAY_OT'
  | 'NIGHT_DIFF';          // Night differential (10pm-6am)

/**
 * Overtime rate multipliers per DOLE regulations
 */
export interface OvertimeRateTable extends BaseEntity {
  id: string;
  orgId: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isDefault: boolean;
  rates: Record<OvertimeType, number>; // Multiplier for each OT type
}

/**
 * Overtime entry for an employee
 */
export interface OvertimeEntry extends BaseEntity {
  id: string;
  orgId: string;
  employeeId: string;
  payrollRunId?: string;
  date: string;
  overtimeType: OvertimeType;
  hours: number;
  hourlyRate: number; // Base hourly rate
  multiplier: number;
  amount: number;
  approvedBy?: string;
  approvedAt?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  remarks?: string;
}

// ============================================================================
// LEAVE MANAGEMENT TYPES
// ============================================================================

export type LeaveType =
  | 'VACATION'
  | 'SICK'
  | 'MATERNITY'
  | 'PATERNITY'
  | 'SOLO_PARENT'
  | 'BEREAVEMENT'
  | 'EMERGENCY'
  | 'UNPAID'
  | 'SERVICE_INCENTIVE'
  | 'SPECIAL_PRIVILEGE'
  | 'STUDY'
  | 'COMPENSATORY';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'TAKEN';

/**
 * Leave type configuration
 */
export interface LeavePolicy extends BaseEntity {
  id: string;
  orgId: string;
  leaveType: LeaveType;
  name: string;
  description?: string;
  annualAllocation: number; // Days per year
  maxCarryOver: number; // Max days that can be carried to next year
  carryOverExpiry?: number; // Months after which carry-over expires
  isPaid: boolean;
  requiresDocumentation: boolean; // e.g., medical certificate for sick leave
  minServiceMonths?: number; // Minimum months of service to be eligible
  applicableGender?: 'MALE' | 'FEMALE' | 'ALL';
  maxConsecutiveDays?: number;
  advanceNoticeDays?: number; // Required days of advance notice
  isActive: boolean;
}

/**
 * Employee leave balance
 */
export interface LeaveBalance extends BaseEntity {
  id: string;
  orgId: string;
  employeeId: string;
  leaveType: LeaveType;
  year: number;
  allocated: number; // Total days allocated for the year
  used: number; // Days already used
  pending: number; // Days in pending requests
  carriedOver: number; // Days carried from previous year
  forfeited: number; // Days forfeited (expired carry-over)
  balance: number; // Remaining available days
  asOfDate: string;
}

/**
 * Leave request
 */
export interface LeaveRequest extends BaseEntity {
  id: string;
  orgId: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  halfDay?: 'AM' | 'PM'; // For half-day leaves
  reason: string;
  attachmentUrl?: string;
  status: LeaveStatus;
  appliedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerRemarks?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

/**
 * Leave accrual configuration
 */
export interface LeaveAccrualConfig extends BaseEntity {
  id: string;
  orgId: string;
  leaveType: LeaveType;
  accrualMethod: 'ANNUAL' | 'MONTHLY' | 'SEMI_MONTHLY' | 'PRORATED';
  accrualRate: number; // Days per period
  startMonth?: number; // 1-12, when annual accrual happens
  vestingPeriodMonths?: number; // Months before accrual is vested
  isActive: boolean;
}

// ============================================================================
// 13TH MONTH PAY TYPES
// ============================================================================

/**
 * 13th month pay calculation record
 */
export interface ThirteenthMonthPay extends BaseEntity {
  id: string;
  orgId: string;
  employeeId: string;
  year: number;

  // Calculation details
  totalBasicSalaryEarned: number; // Total basic pay for the year
  monthsWorked: number;
  averageMonthlyBasic: number;
  thirteenthMonthAmount: number;

  // Payment details
  paymentDate?: string;
  payrollRunId?: string;
  status: 'CALCULATED' | 'APPROVED' | 'PAID';

  // For separated employees
  isSeparated: boolean;
  separationDate?: string;
  proRatedDays?: number;

  // Tax treatment
  taxExemptPortion: number; // First ₱90,000 is tax-exempt
  taxablePortion: number;
  withholdingTax: number;
  netAmount: number;
}

// ============================================================================
// SEPARATION PAY TYPES
// ============================================================================

export type SeparationType =
  | 'RESIGNATION'          // Voluntary resignation
  | 'RETIREMENT'           // Retirement (age or years of service)
  | 'REDUNDANCY'           // Position abolished
  | 'RETRENCHMENT'        // Cost-cutting layoff
  | 'CLOSURE'              // Business closure
  | 'DISEASE'              // Incurable disease
  | 'DEATH'                // Death of employee
  | 'AUTHORIZED_CAUSE'     // Other authorized causes
  | 'JUST_CAUSE'           // Termination for just cause (no separation pay)
  | 'CONSTRUCTIVE_DISMISSAL'
  | 'END_OF_CONTRACT';     // Fixed-term contract end

/**
 * Separation pay calculation
 */
export interface SeparationPay extends BaseEntity {
  id: string;
  orgId: string;
  employeeId: string;

  // Separation details
  separationType: SeparationType;
  separationDate: string;
  lastWorkingDay: string;

  // Service computation
  hireDate: string;
  yearsOfService: number;
  monthsOfService: number;

  // Pay components
  lastMonthlyBasic: number;
  lastDailyRate: number;

  // Separation pay calculation
  separationPayRate: number; // e.g., 0.5 for half month per year
  separationPayBase: 'MONTHLY' | 'DAILY';
  separationPayAmount: number;

  // Other final pay components
  finalBasicPay: number; // Pro-rated pay for last period
  leaveConversion: number; // Unused leave converted to cash
  thirteenthMonthProRated: number;
  otherBenefits: number;

  // Deductions
  outstandingLoans: number;
  otherDeductions: number;

  // Totals
  grossFinalPay: number;
  totalDeductions: number;
  netFinalPay: number;

  // Tax
  taxableAmount: number;
  withholdingTax: number;

  // Processing
  status: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID';
  processedBy?: string;
  approvedBy?: string;
  paidAt?: string;
  payrollRunId?: string;
  remarks?: string;
}

// ============================================================================
// TIME & ATTENDANCE TYPES
// ============================================================================

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY' | 'REST_DAY';

/**
 * Work schedule definition
 */
export interface WorkSchedule extends BaseEntity {
  id: string;
  orgId: string;
  name: string; // e.g., "Regular 8-5", "Night Shift"
  description?: string;

  // Daily schedule
  workDays: number[]; // 0=Sunday, 1=Monday, etc.
  startTime: string; // HH:mm format
  endTime: string;
  breakStartTime?: string;
  breakEndTime?: string;
  breakDurationMinutes: number;

  // Calculations
  regularHoursPerDay: number;
  regularHoursPerWeek: number;

  // Grace period
  gracePeriodMinutes: number;

  // Night differential window
  nightDiffStart: string; // Default: "22:00"
  nightDiffEnd: string;   // Default: "06:00"

  isDefault: boolean;
  isActive: boolean;
}

/**
 * Time entry record
 */
export interface TimeEntry extends BaseEntity {
  id: string;
  orgId: string;
  employeeId: string;
  scheduleId?: string;
  date: string;

  // Clock times
  clockIn?: string;
  clockOut?: string;
  breakStart?: string;
  breakEnd?: string;

  // Computed hours
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
  undertimeMinutes: number;
  tardyMinutes: number;

  // Status
  status: AttendanceStatus;
  isManualEntry: boolean;
  adjustedBy?: string;
  adjustmentReason?: string;

  // Location (for field employees)
  clockInLocation?: { lat: number; lng: number; address?: string };
  clockOutLocation?: { lat: number; lng: number; address?: string };

  // Approval
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
}

/**
 * Attendance summary for payroll
 */
export interface AttendanceSummary {
  employeeId: string;
  periodStart: string;
  periodEnd: string;

  // Days
  workDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysOnLeave: number;
  daysHoliday: number;

  // Hours
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalNightDiffHours: number;
  totalUndertimeMinutes: number;
  totalTardyMinutes: number;

  // Deductions
  undertimeDeduction: number;
  tardinessDeduction: number;
  absenceDeduction: number;
}

/**
 * Philippine holiday record
 */
export interface HolidayCalendar extends BaseEntity {
  id: string;
  orgId: string;
  date: string;
  name: string;
  type: 'REGULAR' | 'SPECIAL_NON_WORKING' | 'SPECIAL_WORKING';
  isNationwide: boolean;
  locations?: string[]; // Specific locations if not nationwide
  year: number;
}

// ============================================================================
// BIR REPORT TYPES
// ============================================================================

export type BIRFormType =
  | 'ALPHALIST'        // Annual list of employees and compensation
  | 'BIR_2316'         // Certificate of Compensation Payment/Tax Withheld
  | 'BIR_1601_C'       // Monthly Remittance Return of Income Taxes Withheld
  | 'BIR_1604_C'       // Annual Information Return of Income Tax Withheld
  | 'BIR_2307'         // Certificate of Creditable Tax Withheld at Source
  | 'BIR_1700'         // Annual Income Tax Return (Individuals)
  | 'BIR_2306';        // Certificate of Final Tax Withheld at Source

/**
 * BIR Alphalist entry per employee
 */
export interface AlphalistEntry extends BaseEntity {
  id: string;
  orgId: string;
  year: number;
  quarter?: 1 | 2 | 3 | 4;
  employeeId: string;

  // Employee info
  tin: string;
  lastName: string;
  firstName: string;
  middleName?: string;

  // Employment info
  employmentStatus: 'R' | 'C' | 'S'; // Regular, Contractual, Seasonal
  startDate: string;
  terminationDate?: string;
  reasonForTermination?: string;

  // Compensation
  grossCompensation: number;

  // Non-taxable income
  thirteenthMonthPay: number;
  deMinimis: number;
  otherNonTaxable: number;
  totalNonTaxable: number;

  // Taxable income
  taxableCompensation: number;

  // Statutory contributions (employee share)
  sssContributions: number;
  philHealthContributions: number;
  pagIBIGContributions: number;
  unionDues: number;
  totalContributions: number;

  // Tax withheld
  taxWithheld: number;
  taxDue: number;
  adjustment: number; // Over/under withholding adjustment

  // Substituted filing
  qualifiesForSubstitutedFiling: boolean;
}

/**
 * BIR 2316 form data (Certificate of Compensation)
 */
export interface BIR2316Data extends BaseEntity {
  id: string;
  orgId: string;
  year: number;
  employeeId: string;

  // Employer info
  employerTIN: string;
  employerName: string;
  employerAddress: string;

  // Employee info
  employeeTIN: string;
  employeeName: string;
  employeeAddress: string;
  birthDate: string;
  zipCode: string;

  // Employment period
  periodFrom: string;
  periodTo: string;

  // Gross compensation
  grossCompensationPresent: number;
  grossCompensationPrevious: number;
  grossCompensationTotal: number;

  // Non-taxable compensation
  basicSMW: number; // Statutory Minimum Wage
  holidayOT: number;
  nightDiff: number;
  hazardPay: number;
  thirteenthMonth: number;
  deMinimis: number;
  sssPhilPag: number;
  otherNonTaxable: number;
  totalNonTaxable: number;

  // Taxable compensation
  taxableCompensationPresent: number;
  taxableCompensationPrevious: number;
  taxableCompensationTotal: number;

  // Tax withheld
  taxWithheldPresent: number;
  taxWithheldPrevious: number;
  taxWithheldTotal: number;

  // Tax computation
  taxDue: number;
  taxWithheldAdjusted: number;

  status: 'DRAFT' | 'GENERATED' | 'SIGNED' | 'SUBMITTED';
  generatedAt?: string;
  signedAt?: string;
}

/**
 * BIR 1601-C Monthly Remittance
 */
export interface BIR1601CData extends BaseEntity {
  id: string;
  orgId: string;
  year: number;
  month: number; // 1-12

  // Employer info
  tin: string;
  rdoCode: string;
  employerName: string;
  registeredAddress: string;

  // Compensation summary
  totalEmployees: number;
  totalCompensation: number;

  // Statutory contributions
  sssTotal: number;
  philHealthTotal: number;
  pagIBIGTotal: number;

  // Tax computation
  taxableCompensation: number;
  taxWithheld: number;
  adjustments: number;
  taxRemittable: number;

  // Payment
  surcharge?: number;
  interest?: number;
  compromise?: number;
  totalAmountDue: number;

  status: 'DRAFT' | 'GENERATED' | 'FILED' | 'PAID';
  filedAt?: string;
  paidAt?: string;
  confirmationNumber?: string;
}
export interface AlumniEmploymentReport extends BaseEntity {
  id: string;
  orgId: string;
  studentId: string; // FK -> Student
  employmentStatus: AlumniEmploymentStatus;
  employerName?: string;
  employerAddress?: string;
  position?: string;
  employmentType?: AlumniEmploymentType;
  dateHired?: string;
  salaryRange?: string;
  isRelatedToCourse: boolean;
  createdAt: string;
  updatedAt?: string;
}
