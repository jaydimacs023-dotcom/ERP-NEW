
import { 
  Organization, User, Student, Qualification, Trainer, Batch, 
  Sponsor, NonStockItem, Vendor, BankAccount, Location, 
  TrainerSchedule, Employee, PayrollRun, PayrollLine,
  JournalEntry, JournalEntryLine, AuditLog, PurchaseOrder, PaymentHistory, FixedAsset, Payable, Bill,
  CheckVoucher, BankReconciliation, RecurringJournalEntry, AccountingPeriod,
  StockItem, InventoryTransaction, InventoryLevel, WarehouseLocation, StockAdjustment, ReorderPoint
} from '../types';

export interface TrainerUsageCheck {
  isUsed: boolean;
  usedIn: string[];
}

export interface QualificationUsageCheck {
  isUsed: boolean;
  usedIn: string[];
}

export interface LocationUsageCheck {
  isUsed: boolean;
  usedIn: string[];
}

export interface ScheduleUsageCheck {
  isUsed: boolean;
  usedIn: string[];
}

export interface SponsorUsageCheck {
  isUsed: boolean;
  usedIn: string[];
}

export interface InitialData {
  organizations: Organization[];
  users: User[];
  students: Student[];
  qualifications: Qualification[];
  trainers: Trainer[];
  batches: Batch[];
  sponsors: Sponsor[];
  items: NonStockItem[];
  vendors: Vendor[];
  locations: Location[];
  schedules: TrainerSchedule[];
  employees: Employee[];
  bankAccounts: BankAccount[];
  bankReconciliations: BankReconciliation[];
  recurringJournalEntries: RecurringJournalEntry[];
  accounts: any[]; // ChartOfAccount[]
  journalEntries: JournalEntry[];
  journalLines: JournalEntryLine[];
  bills: Bill[];
  payables: Payable[];
  payrollRuns: PayrollRun[];
  payrollLines: PayrollLine[];
  auditLogs: AuditLog[];
  purchaseOrders: PurchaseOrder[];
  paymentHistories: PaymentHistory[];
  fixedAssets: FixedAsset[];
  vendorTaxSettings?: any[];
  atcCategories?: any[];
  atcItems?: any[];
  atcRates?: any[];
  // Inventory system
  warehouseLocations: WarehouseLocation[];
  stockItems: StockItem[];
  inventoryLevels: InventoryLevel[];
  inventoryTransactions: InventoryTransaction[];
  stockAdjustments: StockAdjustment[];
  reorderPoints: ReorderPoint[];
}

export interface IDataService {
  getInitialData(): Promise<InitialData>;
  
  // Organization CRUD
  createOrganization(org: Organization): Promise<Organization>;
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization>;
  deleteOrganization(id: string): Promise<void>;
  
  // User CRUD
  createUser(user: User): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
  // Student CRUD
  createStudent(student: Student): Promise<Student>;
  updateStudent(id: string, updates: Partial<Student>): Promise<Student>;
  deleteStudent(id: string): Promise<void>;
  checkStudentUsage(studentId: string): Promise<{ isUsed: boolean; usedIn: string[] }>;
  
  // Trainer CRUD
  createTrainer(trainer: Trainer): Promise<Trainer>;
  updateTrainer(id: string, updates: Partial<Trainer>): Promise<Trainer>;
  deleteTrainer(id: string): Promise<void>;
  checkTrainerUsage(trainerId: string): Promise<TrainerUsageCheck>;
  
  // Qualification CRUD
  createQualification(qualification: Qualification): Promise<Qualification>;
  updateQualification(id: string, updates: Partial<Qualification>): Promise<Qualification>;
  deleteQualification(id: string): Promise<void>;
  checkQualificationUsage(qualificationId: string): Promise<QualificationUsageCheck>;
  
  // Batch CRUD
  createBatch(batch: Batch): Promise<Batch>;
  updateBatch(id: string, updates: Partial<Batch>): Promise<Batch>;
  deleteBatch(id: string): Promise<void>;
  
  // Location CRUD
  createLocation(location: Location): Promise<Location>;
  updateLocation(id: string, updates: Partial<Location>): Promise<Location>;
  deleteLocation(id: string): Promise<void>;
  checkLocationUsage(locationId: string): Promise<LocationUsageCheck>;
  
  // Schedule CRUD
  createSchedule(schedule: TrainerSchedule): Promise<TrainerSchedule>;
  updateSchedule(id: string, updates: Partial<TrainerSchedule>): Promise<TrainerSchedule>;
  deleteSchedule(id: string): Promise<void>;
  checkScheduleUsage(scheduleId: string): Promise<ScheduleUsageCheck>;
  
  // Sponsor CRUD
  createSponsor(sponsor: Sponsor): Promise<Sponsor>;
  updateSponsor(id: string, updates: Partial<Sponsor>): Promise<Sponsor>;
  deleteSponsor(id: string): Promise<void>;
  checkSponsorUsage(sponsorId: string): Promise<SponsorUsageCheck>;

  // Bank Account CRUD
  createBankAccount(account: BankAccount): Promise<BankAccount>;
  updateBankAccount(id: string, updates: Partial<BankAccount>): Promise<BankAccount>;
  deleteBankAccount(id: string): Promise<void>;

  // Bank Reconciliation CRUD
  createBankReconciliation(reconciliation: BankReconciliation): Promise<BankReconciliation>;
  updateBankReconciliation(id: string, updates: Partial<BankReconciliation>): Promise<BankReconciliation>;
  deleteBankReconciliation(id: string): Promise<void>;
  getBankReconciliationsByAccount(bankAccountId: string): Promise<BankReconciliation[]>;
  getLatestBankReconciliation(bankAccountId: string): Promise<BankReconciliation | null>;

  // Recurring Journal Entry CRUD
  createRecurringJournalEntry(entry: RecurringJournalEntry): Promise<RecurringJournalEntry>;
  updateRecurringJournalEntry(id: string, updates: Partial<RecurringJournalEntry>): Promise<RecurringJournalEntry>;
  deleteRecurringJournalEntry(id: string): Promise<void>;
  getRecurringJournalEntriesByOrg(orgId: string): Promise<RecurringJournalEntry[]>;
  getRecurringJournalEntryById(id: string): Promise<RecurringJournalEntry | null>;
  
  // Fixed Asset CRUD
  createFixedAsset(asset: FixedAsset): Promise<FixedAsset>;
  updateFixedAsset(id: string, updates: Partial<FixedAsset>): Promise<FixedAsset>;
  deleteFixedAsset(id: string): Promise<void>;

  // Item Catalog CRUD
  createItem(item: NonStockItem): Promise<NonStockItem>;
  updateItem(id: string, updates: Partial<NonStockItem>): Promise<NonStockItem>;
  deleteItem(id: string): Promise<void>;

  // Vendor CRUD
  createVendor(vendor: Vendor): Promise<Vendor>;
  updateVendor(id: string, updates: Partial<Vendor>): Promise<Vendor>;
  deleteVendor(id: string): Promise<void>;

  // Bills CRUD
  createBill(bill: Bill): Promise<Bill>;
  updateBill(id: string, updates: Partial<Bill>): Promise<Bill>;
  deleteBill(id: string): Promise<void>;

  // Payables CRUD
  createPayable(payable: Payable): Promise<Payable>;
  updatePayable(id: string, updates: Partial<Payable>): Promise<Payable>;
  deletePayable(id: string): Promise<void>;

  // Check Voucher CRUD
  createCheckVoucher(check: CheckVoucher): Promise<CheckVoucher>;
  updateCheckVoucher(id: string, updates: Partial<CheckVoucher>): Promise<CheckVoucher>;
  deleteCheckVoucher(id: string): Promise<void>;
  getNextCheckNumber(orgId: string, bankAccountId: string): Promise<string>;
  
  // Exchange Rate CRUD
  createExchangeRate(rate: ExchangeRate): Promise<ExchangeRate>;
  updateExchangeRate(id: string, updates: Partial<ExchangeRate>): Promise<ExchangeRate>;
  deleteExchangeRate(id: string): Promise<void>;
  getExchangeRatesByOrg(orgId: string): Promise<ExchangeRate[]>;
  getExchangeRateById(id: string): Promise<ExchangeRate | null>;

  // Accounting Period CRUD
  createAccountingPeriod(period: AccountingPeriod): Promise<AccountingPeriod>;
  updateAccountingPeriod(id: string, updates: Partial<AccountingPeriod>): Promise<AccountingPeriod>;
  deleteAccountingPeriod(id: string): Promise<void>;
  getAccountingPeriodsByOrg(orgId: string): Promise<AccountingPeriod[]>;
  getAccountingPeriodById(id: string): Promise<AccountingPeriod | null>;
  getAccountingPeriodsByYear(orgId: string, fiscalYear: number): Promise<AccountingPeriod[]>;

  // Warehouse Location CRUD
  createWarehouseLocation(location: WarehouseLocation): Promise<WarehouseLocation>;
  updateWarehouseLocation(id: string, updates: Partial<WarehouseLocation>): Promise<WarehouseLocation>;
  deleteWarehouseLocation(id: string): Promise<void>;
  getWarehouseLocationsByOrg(orgId: string): Promise<WarehouseLocation[]>;
  getWarehouseLocationById(id: string): Promise<WarehouseLocation | null>;

  // Stock Item CRUD
  createStockItem(item: StockItem): Promise<StockItem>;
  updateStockItem(id: string, updates: Partial<StockItem>): Promise<StockItem>;
  deleteStockItem(id: string): Promise<void>;
  getStockItemsByOrg(orgId: string): Promise<StockItem[]>;
  getStockItemById(id: string): Promise<StockItem | null>;
  getStockItemsByLocation(orgId: string, locationId: string): Promise<StockItem[]>;

  // Inventory Level CRUD
  createInventoryLevel(level: InventoryLevel): Promise<InventoryLevel>;
  updateInventoryLevel(id: string, updates: Partial<InventoryLevel>): Promise<InventoryLevel>;
  deleteInventoryLevel(id: string): Promise<void>;
  getInventoryLevelsByOrg(orgId: string): Promise<InventoryLevel[]>;
  getInventoryLevelByItemAndLocation(orgId: string, stockItemId: string, locationId: string): Promise<InventoryLevel | null>;
  getStockStatusView(orgId: string): Promise<any[]>;  // Returns v_inventory_status view

  // Inventory Transaction CRUD
  createInventoryTransaction(transaction: InventoryTransaction): Promise<InventoryTransaction>;
  updateInventoryTransaction(id: string, updates: Partial<InventoryTransaction>): Promise<InventoryTransaction>;
  deleteInventoryTransaction(id: string): Promise<void>;
  getInventoryTransactionsByOrg(orgId: string): Promise<InventoryTransaction[]>;
  getInventoryTransactionById(id: string): Promise<InventoryTransaction | null>;
  getInventoryTransactionsByItem(orgId: string, stockItemId: string): Promise<InventoryTransaction[]>;

  // Stock Adjustment CRUD
  createStockAdjustment(adjustment: StockAdjustment): Promise<StockAdjustment>;
  updateStockAdjustment(id: string, updates: Partial<StockAdjustment>): Promise<StockAdjustment>;
  deleteStockAdjustment(id: string): Promise<void>;
  getStockAdjustmentsByOrg(orgId: string): Promise<StockAdjustment[]>;
  getStockAdjustmentById(id: string): Promise<StockAdjustment | null>;
  getStockAdjustmentsByItem(orgId: string, stockItemId: string): Promise<StockAdjustment[]>;

  // Reorder Point CRUD
  createReorderPoint(reorder: ReorderPoint): Promise<ReorderPoint>;
  updateReorderPoint(id: string, updates: Partial<ReorderPoint>): Promise<ReorderPoint>;
  deleteReorderPoint(id: string): Promise<void>;
  getReorderPointsByOrg(orgId: string): Promise<ReorderPoint[]>;
  getReorderPointByItem(orgId: string, stockItemId: string): Promise<ReorderPoint | null>;
  getItemsNeedingReorder(orgId: string): Promise<StockItem[]>;

  // Generic create for other entities
  createEntity<T extends { id?: string; orgId?: string }>(table: string, entity: T): Promise<T>;
  updateEntity<T>(table: string, id: string, updates: Partial<T>): Promise<T>;
  deleteEntity(table: string, id: string): Promise<void>;
}
