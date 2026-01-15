
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
  DRAFT = 'DRAFT',
  OPEN = 'OPEN_FOR_ENROLLMENT',
  ONGOING = 'ON_GOING',
  COMPLETED = 'COMPLETED'
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

export interface Organization {
  id: string;
  name: string;
  currency: string;
  taxId?: string;
  isVatRegistered: boolean;
  // Subscription management
  subscriptionStatus: SubscriptionStatus;
  planType: PlanType;
  pendingPlanType?: PlanType;
  paymentReference?: string;
  licenseExpiry?: string;
  createdAt: string;
  // Branding/Motif
  primaryColor?: string; // Hex code
  logoUrl?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'SYSTEM_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'REGISTRAR' | 'VIEWER';
  orgId: string;
}

export interface StudentDocument {
  id: string;
  name: string;
  status: 'PENDING' | 'UPLOADED' | 'VERIFIED';
  fileData?: string;
  isOther?: boolean;
}

export interface Student {
  id: string;
  orgId: string;
  uli: string;
  lastName: string;
  firstName: string;
  middleName: string;
  extension: string;
  sex: 'Male' | 'Female';
  dateOfBirth: string;
  age: number;
  birthRegion: string;
  birthProvince: string;
  birthCity: string;
  civilStatus: string;
  educationalAttainment: string;
  nationality: string;
  email: string;
  contactNumber: string;
  street: string;
  barangay: string;
  city: string;
  district: string;
  province: string;
  guardian: string;
  documents: StudentDocument[];
  createdAt: string;
}

export interface Trainer {
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
}

export interface DaySlot {
  dayIndex: number; // 0-6 (Sun-Sat)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface TrainerSchedule {
  id: string;
  orgId: string;
  trainerId: string;
  locationId?: string;
  slots: DaySlot[];
  description: string;
  createdAt: string;
}

export interface Sponsor {
  id: string;
  orgId: string;
  name: string;
  type: 'CORPORATE' | 'INDIVIDUAL' | 'GOVERNMENT' | 'NGO';
  representative?: string;
  email: string;
  contactNumber: string;
  arAccountId?: string; 
  isActive: boolean;
  createdAt: string;
}

export interface Vendor {
  id: string;
  orgId: string;
  name: string;
  category: string;
  tin?: string;
  email: string;
  contactNumber: string;
  address: string;
  apAccountId?: string;
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

export interface PurchaseOrder {
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

export interface FixedAsset {
  id: string;
  orgId: string;
  name: string;
  code: string;
  category: AssetCategory;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  assetAccountId: string; 
  depreciationAccountId: string; 
  expenseAccountId: string; 
  status: 'ACTIVE' | 'DISPOSED' | 'FULLY_DEPRECIATED';
}

export interface BankAccount {
  id: string;
  orgId: string;
  bankName: string;
  accountNumber: string;
  type: 'SAVINGS' | 'CHECKING' | 'CREDIT' | 'CASH';
  glAccountId: string; 
  currency: string;
}

export interface NonStockItem {
  id: string;
  orgId: string;
  code: string;
  name: string;
  description?: string;
  defaultAccountId: string; 
  unitPrice: number;
  type: 'SERVICE' | 'FEE' | 'MATERIAL' | 'OTHER';
  taxCategory: TaxCategory;
  whtRate: WHTCategory;
  isActive: boolean;
  createdAt: string;
}

export interface Qualification {
  id: string;
  orgId: string;
  code: string;
  name: string;
  durationDays: number; // 1 day = 8 hours rule
  sector?: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  orgId: string;
  name: string;
  year: number;
  qualificationId: string;
  trainerId: string;
  sponsorId?: string;
  scheduleId?: string; 
  locationId?: string;
  studentIds: string[];
  status: BatchStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface ChartOfAccount {
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

export interface Location {
  id: string;
  orgId: string;
  code: string;
  name: string;
  address: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  orgId: string;
  periodId: string;
  date: string;
  description: string;
  reference: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  createdBy: string;
  createdAt: string;
  sourceType: 'MANUAL' | 'INVOICE' | 'BILL' | 'PAYMENT' | 'COLLECTION' | 'DEPRECIATION' | 'TRANSFER' | 'PURCHASE_ORDER';
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
  contactId?: string; 
  contactType?: 'STUDENT' | 'TRAINER' | 'SPONSOR' | 'VENDOR' | 'OTHER';
  batchId?: string; 
  itemId?: string;
  assetId?: string;
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
  timestamp: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  previousState?: any;
  newState?: any;
}
