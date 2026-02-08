
import { IDataService, InitialData, TrainerUsageCheck, QualificationUsageCheck, LocationUsageCheck, ScheduleUsageCheck, SponsorUsageCheck } from './IDataService';
import { Organization, User, Student, Batch, Trainer, Qualification, Location, TrainerSchedule, Sponsor, NonStockItem } from '../types';

/**
 * MockDataService - Empty Data Service
 * Returns empty arrays for all data types.
 * Use Supabase for actual data persistence.
 */
export class MockDataService implements IDataService {
  async getInitialData(): Promise<InitialData> {
    // Return empty data - use Supabase for actual data
    return {
      organizations: [],
      users: [],
      students: [],
      qualifications: [],
      trainers: [],
      batches: [],
      sponsors: [],
      items: [],
      vendors: [],
      locations: [],
      schedules: [],
      employees: [],
      bankAccounts: [],
      bankReconciliations: [],
      recurringJournalEntries: [],
      accounts: [],
      journalEntries: [],
      journalLines: [],
      bills: [],
      payables: [],
      payrollRuns: [],
      payrollLines: [],
      auditLogs: [],
      purchaseOrders: [],
      paymentHistories: [],
      fixedAssets: [],
      atcCategories: [],
      atcItems: [],
      atcRates: [],
      // Inventory system
      warehouseLocations: [],
      stockItems: [],
      inventoryLevels: [],
      inventoryTransactions: [],
      stockAdjustments: [],
      reorderPoints: []
    };
  }

  async createOrganization(org: Organization): Promise<Organization> {
    console.warn('[MockDataService] Organizations persist to memory only; changes lost on refresh');
    return org;
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    console.warn('[MockDataService] Organizations persist to memory only; changes lost on refresh');
    return { ...updates } as Organization;
  }

  async deleteOrganization(id: string): Promise<void> {
    console.warn('[MockDataService] Organizations persist to memory only; changes lost on refresh');
  }

  async createUser(user: User): Promise<User> {
    console.warn('[MockDataService] Users persist to memory only; changes lost on refresh');
    
    // Hash password if provided (for consistency with SupabaseDataService)
    if ((user as any).password) {
      try {
        const { PasswordService } = await import('./PasswordService');
        const hashedPassword = await PasswordService.hashPassword((user as any).password);
        console.info('[MockDataService] ✅ Password hashed with bcrypt');
        // Store hash but keep original structure for mock
        return { ...user, password: hashedPassword };
      } catch (error) {
        console.warn('[MockDataService] Password hashing skipped in mock mode');
      }
    }
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    console.warn('[MockDataService] Users persist to memory only; changes lost on refresh');
    return { ...updates } as User;
  }

  async deleteUser(id: string): Promise<void> {
    console.warn('[MockDataService] Users persist to memory only; changes lost on refresh');
  }

  async createStudent(student: Student): Promise<Student> {
    console.warn('[MockDataService] Students persist to memory only; changes lost on refresh');
    return student;
  }

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    console.warn('[MockDataService] Students persist to memory only; changes lost on refresh');
    return { ...updates } as Student;
  }

  async deleteStudent(id: string): Promise<void> {
    console.warn('[MockDataService] Students persist to memory only; changes lost on refresh');
  }

  async checkStudentUsage(studentId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    console.warn('[MockDataService] Checking student usage in mock mode');
    return { isUsed: false, usedIn: [] };
  }

  async createTrainer(trainer: Trainer): Promise<Trainer> {
    console.warn('[MockDataService] Trainers persist to memory only; changes lost on refresh');
    return trainer;
  }

  async updateTrainer(id: string, updates: Partial<Trainer>): Promise<Trainer> {
    console.warn('[MockDataService] Trainers persist to memory only; changes lost on refresh');
    return { ...updates } as Trainer;
  }

  async deleteTrainer(id: string): Promise<void> {
    console.warn('[MockDataService] Trainers persist to memory only; changes lost on refresh');
  }

  async checkTrainerUsage(trainerId: string): Promise<TrainerUsageCheck> {
    console.warn('[MockDataService] Checking trainer usage in mock mode');
    return { isUsed: false, usedIn: [] };
  }

  async createQualification(qualification: Qualification): Promise<Qualification> {
    console.warn('[MockDataService] Qualifications persist to memory only; changes lost on refresh');
    return qualification;
  }

  async updateQualification(id: string, updates: Partial<Qualification>): Promise<Qualification> {
    console.warn('[MockDataService] Qualifications persist to memory only; changes lost on refresh');
    return { ...updates } as Qualification;
  }

  async deleteQualification(id: string): Promise<void> {
    console.warn('[MockDataService] Qualifications persist to memory only; changes lost on refresh');
  }

  async checkQualificationUsage(qualificationId: string): Promise<QualificationUsageCheck> {
    console.warn('[MockDataService] Checking qualification usage in mock mode');
    return { isUsed: false, usedIn: [] };
  }

  async createBatch(batch: Batch): Promise<Batch> {
    console.warn('[MockDataService] Batches persist to memory only; changes lost on refresh');
    return batch;
  }

  async updateBatch(id: string, updates: Partial<Batch>): Promise<Batch> {
    console.warn('[MockDataService] Batches persist to memory only; changes lost on refresh');
    return { ...updates } as Batch;
  }

  async deleteBatch(id: string): Promise<void> {
    console.warn('[MockDataService] Batches persist to memory only; changes lost on refresh');
  }

  async createLocation(location: Location): Promise<Location> {
    console.warn('[MockDataService] Locations persist to memory only; changes lost on refresh');
    return location;
  }

  async updateLocation(id: string, updates: Partial<Location>): Promise<Location> {
    console.warn('[MockDataService] Locations persist to memory only; changes lost on refresh');
    return { ...updates } as Location;
  }

  async deleteLocation(id: string): Promise<void> {
    console.warn('[MockDataService] Locations persist to memory only; changes lost on refresh');
  }

  async checkLocationUsage(locationId: string): Promise<LocationUsageCheck> {
    console.warn('[MockDataService] Checking location usage in mock mode');
    return { isUsed: false, usedIn: [] };
  }

  async createSchedule(schedule: TrainerSchedule): Promise<TrainerSchedule> {
    console.warn('[MockDataService] Schedules persist to memory only; changes lost on refresh');
    return schedule;
  }

  async updateSchedule(id: string, updates: Partial<TrainerSchedule>): Promise<TrainerSchedule> {
    console.warn('[MockDataService] Schedules persist to memory only; changes lost on refresh');
    return { ...updates } as TrainerSchedule;
  }

  async deleteSchedule(id: string): Promise<void> {
    console.warn('[MockDataService] Schedules persist to memory only; changes lost on refresh');
  }

  async checkScheduleUsage(scheduleId: string): Promise<ScheduleUsageCheck> {
    console.warn('[MockDataService] Checking schedule usage in mock mode');
    return { isUsed: false, usedIn: [] };
  }

  async createSponsor(sponsor: Sponsor): Promise<Sponsor> {
    console.warn('[MockDataService] Sponsors persist to memory only; changes lost on refresh');
    return {
      ...sponsor,
      id: sponsor.id || `sponsor-${Date.now()}`,
      arAccountId: sponsor.arAccountId || ''
    };
  }

  async updateSponsor(id: string, updates: Partial<Sponsor>): Promise<Sponsor> {
    console.warn('[MockDataService] Sponsors persist to memory only; changes lost on refresh');
    return { id, ...updates } as Sponsor;
  }

  async deleteSponsor(id: string): Promise<void> {
    console.warn('[MockDataService] Sponsors persist to memory only; changes lost on refresh');
  }

  async checkSponsorUsage(sponsorId: string): Promise<SponsorUsageCheck> {
    console.warn('[MockDataService] Checking sponsor usage in mock mode');
    return { isUsed: false, usedIn: [] };
  }

  // Vendor CRUD
  async createVendor(vendor: any): Promise<any> {
    console.warn('[MockDataService] createVendor - data not persisted.');
    return { ...vendor, id: vendor.id || `vendor-${Date.now()}` };
  }
  async updateVendor(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateVendor - data not persisted.');
    return { id, ...updates };
  }
  async deleteVendor(id: string): Promise<void> {
    console.warn('[MockDataService] deleteVendor - data not persisted.');
  }

  // Bill CRUD
  async createBill(bill: any): Promise<any> {
    console.warn('[MockDataService] createBill - data not persisted.');
    return { ...bill, id: bill.id || `bill-${Date.now()}` };
  }
  async updateBill(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateBill - data not persisted.');
    return { id, ...updates };
  }
  async deleteBill(id: string): Promise<void> {
    console.warn('[MockDataService] deleteBill - data not persisted.');
  }

  async createFixedAsset(asset: any): Promise<any> {
    console.warn('[MockDataService] Fixed assets persist to memory only; changes lost on refresh');
    return asset;
  }

  async updateFixedAsset(id: string, updates: Partial<any>): Promise<any> {
    console.warn('[MockDataService] Fixed assets persist to memory only; changes lost on refresh');
    return { ...updates } as any;
  }

  async deleteFixedAsset(id: string): Promise<void> {
    console.warn('[MockDataService] Fixed assets persist to memory only; changes lost on refresh');
  }

  // Item Catalog CRUD
  async createItem(item: NonStockItem): Promise<NonStockItem> {
    console.warn('[MockDataService] Items persist to memory only; changes lost on refresh');
    return item;
  }

  async updateItem(id: string, updates: Partial<NonStockItem>): Promise<NonStockItem> {
    console.warn('[MockDataService] Items persist to memory only; changes lost on refresh');
    return { id, ...updates } as NonStockItem;
  }

  async deleteItem(id: string): Promise<void> {
    console.warn('[MockDataService] Items persist to memory only; changes lost on refresh');
  }

  // Payables CRUD (mock)
  async createPayable(payable: any): Promise<any> {
    console.warn('[MockDataService] createPayable is memory-only.');
    return { ...payable };
  }
  async updatePayable(id: string, updates: Partial<any>): Promise<any> {
    console.warn('[MockDataService] updatePayable is memory-only.');
    return { id, ...updates };
  }
  async deletePayable(id: string): Promise<void> {
    console.warn('[MockDataService] deletePayable is memory-only.');
  }

  // Bank Account CRUD (mock)
  async createBankAccount(account: any): Promise<any> {
    console.warn('[MockDataService] createBankAccount is memory-only.');
    return { ...account };
  }
  async updateBankAccount(id: string, updates: Partial<any>): Promise<any> {
    console.warn('[MockDataService] updateBankAccount is memory-only.');
    return { id, ...updates };
  }
  async deleteBankAccount(id: string): Promise<void> {
    console.warn('[MockDataService] deleteBankAccount is memory-only.');
  }

  // Bank Reconciliation CRUD (mock)
  async createBankReconciliation(reconciliation: any): Promise<any> {
    console.warn('[MockDataService] createBankReconciliation is memory-only; changes lost on refresh.');
    return { ...reconciliation };
  }
  async updateBankReconciliation(id: string, updates: Partial<any>): Promise<any> {
    console.warn('[MockDataService] updateBankReconciliation is memory-only; changes lost on refresh.');
    return { id, ...updates };
  }
  async deleteBankReconciliation(id: string): Promise<void> {
    console.warn('[MockDataService] deleteBankReconciliation is memory-only; changes lost on refresh.');
  }
  async getBankReconciliationsByAccount(bankAccountId: string): Promise<any[]> {
    console.warn('[MockDataService] getBankReconciliationsByAccount returning empty array.');
    return [];
  }
  async getLatestBankReconciliation(bankAccountId: string): Promise<any | null> {
    console.warn('[MockDataService] getLatestBankReconciliation returning null.');
    return null;
  }

  // Recurring Journal Entry CRUD (mock)
  async createRecurringJournalEntry(entry: any): Promise<any> {
    console.warn('[MockDataService] createRecurringJournalEntry is memory-only; changes lost on refresh.');
    return { ...entry };
  }
  async updateRecurringJournalEntry(id: string, updates: Partial<any>): Promise<any> {
    console.warn('[MockDataService] updateRecurringJournalEntry is memory-only; changes lost on refresh.');
    return { id, ...updates };
  }
  async deleteRecurringJournalEntry(id: string): Promise<void> {
    console.warn('[MockDataService] deleteRecurringJournalEntry is memory-only; changes lost on refresh.');
  }
  async getRecurringJournalEntriesByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getRecurringJournalEntriesByOrg returning empty array.');
    return [];
  }
  async getRecurringJournalEntryById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getRecurringJournalEntryById returning null.');
    return null;
  }

    // Recurring Invoice CRUD (mock)
    async createRecurringInvoice(invoice: any): Promise<any> {
      console.warn('[MockDataService] createRecurringInvoice is memory-only; changes lost on refresh.');
      return { ...invoice };
    }
    async updateRecurringInvoice(id: string, updates: Partial<any>): Promise<any> {
      console.warn('[MockDataService] updateRecurringInvoice is memory-only; changes lost on refresh.');
      return { id, ...updates };
    }
    async deleteRecurringInvoice(id: string): Promise<void> {
      console.warn('[MockDataService] deleteRecurringInvoice is memory-only; changes lost on refresh.');
    }
    async getRecurringInvoicesByOrg(orgId: string): Promise<any[]> {
      console.warn('[MockDataService] getRecurringInvoicesByOrg returning empty array.');
      return [];
    }
    async getRecurringInvoiceById(id: string): Promise<any | null> {
      console.warn('[MockDataService] getRecurringInvoiceById returning null.');
      return null;
    }

  // Check Voucher CRUD (mock)
  async createCheckVoucher(check: any): Promise<any> {
    console.warn('[MockDataService] createCheckVoucher is memory-only.');
    return { ...check, id: `chk-${Date.now()}` };
  }
  async updateCheckVoucher(id: string, updates: Partial<any>): Promise<any> {
    console.warn('[MockDataService] updateCheckVoucher is memory-only.');
    return { id, ...updates };
  }
  async deleteCheckVoucher(id: string): Promise<void> {
    console.warn('[MockDataService] deleteCheckVoucher is memory-only.');
  }
  async getNextCheckNumber(orgId: string, bankAccountId: string): Promise<string> {
    return '000001';
  }

  // Exchange Rate CRUD (mock)
  async createExchangeRate(rate: any): Promise<any> {
    console.warn('[MockDataService] createExchangeRate is memory-only; changes lost on refresh.');
    return { ...rate, id: `rate-${Date.now()}` };
  }
  async updateExchangeRate(id: string, updates: Partial<any>): Promise<any> {
    console.warn('[MockDataService] updateExchangeRate is memory-only; changes lost on refresh.');
    return { id, ...updates };
  }
  async deleteExchangeRate(id: string): Promise<void> {
    console.warn('[MockDataService] deleteExchangeRate is memory-only; changes lost on refresh.');
  }
  async getExchangeRatesByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getExchangeRatesByOrg returning empty array.');
    return [];
  }
  async getExchangeRateById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getExchangeRateById returning null.');
    return null;
  }

  // Accounting Period CRUD
  async createAccountingPeriod(period: any): Promise<any> {
    console.warn('[MockDataService] createAccountingPeriod is memory-only; changes lost on refresh.');
    return { id: `period-${Date.now()}`, ...period };
  }
  async updateAccountingPeriod(id: string, updates: Partial<any>): Promise<any> {
    console.warn('[MockDataService] updateAccountingPeriod is memory-only; changes lost on refresh.');
    return { id, ...updates };
  }
  async deleteAccountingPeriod(id: string): Promise<void> {
    console.warn('[MockDataService] deleteAccountingPeriod is memory-only; changes lost on refresh.');
  }
  async getAccountingPeriodsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getAccountingPeriodsByOrg returning empty array.');
    return [];
  }
  async getAccountingPeriodById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getAccountingPeriodById returning null.');
    return null;
  }
  async getAccountingPeriodsByYear(orgId: string, fiscalYear: number): Promise<any[]> {
    console.warn('[MockDataService] getAccountingPeriodsByYear returning empty array.');
    return [];
  }

  // ==================== INVENTORY MANAGEMENT ====================
  
  async createWarehouseLocation(location: any): Promise<any> {
    console.warn('[MockDataService] createWarehouseLocation - data not persisted.');
    return { ...location, id: `loc-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateWarehouseLocation(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateWarehouseLocation - data not persisted.');
    return { id, ...updates };
  }
  async deleteWarehouseLocation(id: string): Promise<void> {
    console.warn('[MockDataService] deleteWarehouseLocation - data not persisted.');
  }
  async getWarehouseLocationsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getWarehouseLocationsByOrg returning empty array.');
    return [];
  }
  async getWarehouseLocationById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getWarehouseLocationById returning null.');
    return null;
  }

  async createStockItem(item: any): Promise<any> {
    console.warn('[MockDataService] createStockItem - data not persisted.');
    return { ...item, id: `si-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateStockItem(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateStockItem - data not persisted.');
    return { id, ...updates };
  }
  async deleteStockItem(id: string): Promise<void> {
    console.warn('[MockDataService] deleteStockItem - data not persisted.');
  }
  async getStockItemsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getStockItemsByOrg returning empty array.');
    return [];
  }
  async getStockItemById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getStockItemById returning null.');
    return null;
  }
  async getStockItemsByLocation(orgId: string, locationId: string): Promise<any[]> {
    console.warn('[MockDataService] getStockItemsByLocation returning empty array.');
    return [];
  }

  async createInventoryLevel(level: any): Promise<any> {
    console.warn('[MockDataService] createInventoryLevel - data not persisted.');
    return { ...level, id: `il-${Date.now()}` };
  }
  async updateInventoryLevel(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateInventoryLevel - data not persisted.');
    return { id, ...updates };
  }
  async deleteInventoryLevel(id: string): Promise<void> {
    console.warn('[MockDataService] deleteInventoryLevel - data not persisted.');
  }
  async getInventoryLevelsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getInventoryLevelsByOrg returning empty array.');
    return [];
  }
  async getInventoryLevelByItemAndLocation(orgId: string, stockItemId: string, locationId: string): Promise<any | null> {
    console.warn('[MockDataService] getInventoryLevelByItemAndLocation returning null.');
    return null;
  }
  async getStockStatusView(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getStockStatusView returning empty array.');
    return [];
  }

  async createInventoryTransaction(transaction: any): Promise<any> {
    console.warn('[MockDataService] createInventoryTransaction - data not persisted.');
    return { ...transaction, id: `it-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateInventoryTransaction(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateInventoryTransaction - data not persisted.');
    return { id, ...updates };
  }
  async deleteInventoryTransaction(id: string): Promise<void> {
    console.warn('[MockDataService] deleteInventoryTransaction - data not persisted.');
  }
  async getInventoryTransactionsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getInventoryTransactionsByOrg returning empty array.');
    return [];
  }
  async getInventoryTransactionById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getInventoryTransactionById returning null.');
    return null;
  }
  async getInventoryTransactionsByItem(orgId: string, stockItemId: string): Promise<any[]> {
    console.warn('[MockDataService] getInventoryTransactionsByItem returning empty array.');
    return [];
  }

  async createStockAdjustment(adjustment: any): Promise<any> {
    console.warn('[MockDataService] createStockAdjustment - data not persisted.');
    return { ...adjustment, id: `sa-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateStockAdjustment(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateStockAdjustment - data not persisted.');
    return { id, ...updates };
  }
  async deleteStockAdjustment(id: string): Promise<void> {
    console.warn('[MockDataService] deleteStockAdjustment - data not persisted.');
  }
  async getStockAdjustmentsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getStockAdjustmentsByOrg returning empty array.');
    return [];
  }
  async getStockAdjustmentById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getStockAdjustmentById returning null.');
    return null;
  }
  async getStockAdjustmentsByItem(orgId: string, stockItemId: string): Promise<any[]> {
    console.warn('[MockDataService] getStockAdjustmentsByItem returning empty array.');
    return [];
  }

  async createReorderPoint(reorder: any): Promise<any> {
    console.warn('[MockDataService] createReorderPoint - data not persisted.');
    return { ...reorder, id: `rp-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateReorderPoint(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateReorderPoint - data not persisted.');
    return { id, ...updates };
  }
  async deleteReorderPoint(id: string): Promise<void> {
    console.warn('[MockDataService] deleteReorderPoint - data not persisted.');
  }
  async getReorderPointsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getReorderPointsByOrg returning empty array.');
    return [];
  }
  async getReorderPointByItem(orgId: string, stockItemId: string): Promise<any | null> {
    console.warn('[MockDataService] getReorderPointByItem returning null.');
    return null;
  }
  async getItemsNeedingReorder(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getItemsNeedingReorder returning empty array.');
    return [];
  }

  // Revenue Schedule CRUD (Deferred Revenue)
  async createRevenueSchedule(schedule: any): Promise<any> {
    console.warn('[MockDataService] createRevenueSchedule - data not persisted.');
    return { ...schedule, id: schedule.id || `rev-sched-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateRevenueSchedule(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateRevenueSchedule - data not persisted.');
    return { id, ...updates, updatedAt: new Date().toISOString() };
  }
  async deleteRevenueSchedule(id: string): Promise<void> {
    console.warn('[MockDataService] deleteRevenueSchedule - data not persisted.');
  }
  async getRevenueSchedulesByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getRevenueSchedulesByOrg returning empty array.');
    return [];
  }
  async getRevenueScheduleById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getRevenueScheduleById returning null.');
    return null;
  }
  async getRevenueSchedulesByCustomer(orgId: string, customerId: string): Promise<any[]> {
    console.warn('[MockDataService] getRevenueSchedulesByCustomer returning empty array.');
    return [];
  }

  // Revenue Recognition Entry CRUD
  async createRevenueRecognitionEntry(entry: any): Promise<any> {
    console.warn('[MockDataService] createRevenueRecognitionEntry - data not persisted.');
    return { ...entry, id: entry.id || `rev-entry-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateRevenueRecognitionEntry(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateRevenueRecognitionEntry - data not persisted.');
    return { id, ...updates };
  }
  async deleteRevenueRecognitionEntry(id: string): Promise<void> {
    console.warn('[MockDataService] deleteRevenueRecognitionEntry - data not persisted.');
  }
  async getRevenueRecognitionEntriesByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getRevenueRecognitionEntriesByOrg returning empty array.');
    return [];
  }
  async getRevenueRecognitionEntriesBySchedule(scheduleId: string): Promise<any[]> {
    console.warn('[MockDataService] getRevenueRecognitionEntriesBySchedule returning empty array.');
    return [];
  }

  // Payroll Run CRUD
  async createPayrollRun(run: any): Promise<any> {
    console.warn('[MockDataService] createPayrollRun - data not persisted.');
    return { ...run, id: run.id || `payroll-run-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updatePayrollRun(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updatePayrollRun - data not persisted.');
    return { id, ...updates, updatedAt: new Date().toISOString() };
  }
  async deletePayrollRun(id: string): Promise<void> {
    console.warn('[MockDataService] deletePayrollRun - data not persisted.');
  }
  async getPayrollRunsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getPayrollRunsByOrg returning empty array.');
    return [];
  }
  async getPayrollRunById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getPayrollRunById returning null.');
    return null;
  }

  // Payroll Line CRUD
  async createPayrollLine(line: any): Promise<any> {
    console.warn('[MockDataService] createPayrollLine - data not persisted.');
    return { ...line, id: line.id || `payroll-line-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updatePayrollLine(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updatePayrollLine - data not persisted.');
    return { id, ...updates };
  }
  async deletePayrollLine(id: string): Promise<void> {
    console.warn('[MockDataService] deletePayrollLine - data not persisted.');
  }
  async getPayrollLinesByRun(runId: string): Promise<any[]> {
    console.warn('[MockDataService] getPayrollLinesByRun returning empty array.');
    return [];
  }
  async getPayrollLinesByEmployee(employeeId: string): Promise<any[]> {
    console.warn('[MockDataService] getPayrollLinesByEmployee returning empty array.');
    return [];
  }

  // Employee CRUD
  async createEmployee(employee: any): Promise<any> {
    console.warn('[MockDataService] createEmployee - data not persisted.');
    return { ...employee, id: employee.id || `emp-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateEmployee(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateEmployee - data not persisted.');
    return { id, ...updates, updatedAt: new Date().toISOString() };
  }
  async deleteEmployee(id: string): Promise<void> {
    console.warn('[MockDataService] deleteEmployee - data not persisted.');
  }
  async getEmployeesByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getEmployeesByOrg returning empty array.');
    return [];
  }
  async getEmployeeById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getEmployeeById returning null.');
    return null;
  }

  // Chart of Account CRUD
  async createAccount(account: any): Promise<any> {
    console.warn('[MockDataService] createAccount - data not persisted.');
    return { ...account, id: account.id || `acct-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateAccount(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateAccount - data not persisted.');
    return { id, ...updates, updatedAt: new Date().toISOString() };
  }
  async deleteAccount(id: string): Promise<void> {
    console.warn('[MockDataService] deleteAccount - data not persisted.');
  }
  async getAccountsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getAccountsByOrg returning empty array.');
    return [];
  }
  async getAccountById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getAccountById returning null.');
    return null;
  }

  // Journal Entry CRUD
  async createJournalEntry(entry: any): Promise<any> {
    console.warn('[MockDataService] createJournalEntry - data not persisted.');
    return { ...entry, id: entry.id || `je-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateJournalEntry(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateJournalEntry - data not persisted.');
    return { id, ...updates, updatedAt: new Date().toISOString() };
  }
  async deleteJournalEntry(id: string): Promise<void> {
    console.warn('[MockDataService] deleteJournalEntry - data not persisted.');
  }
  async getJournalEntriesByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getJournalEntriesByOrg returning empty array.');
    return [];
  }
  async getJournalEntryById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getJournalEntryById returning null.');
    return null;
  }

  // Journal Entry Line CRUD
  async createJournalLine(line: any): Promise<any> {
    console.warn('[MockDataService] createJournalLine - data not persisted.');
    return { ...line, id: line.id || `jel-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async createJournalLines(lines: any[]): Promise<any[]> {
    console.warn('[MockDataService] createJournalLines - data not persisted.');
    return lines.map((line, i) => ({ ...line, id: line.id || `jel-${Date.now()}-${i}` }));
  }
  async updateJournalLine(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateJournalLine - data not persisted.');
    return { id, ...updates };
  }
  async deleteJournalLine(id: string): Promise<void> {
    console.warn('[MockDataService] deleteJournalLine - data not persisted.');
  }
  async getJournalLinesByEntry(entryId: string): Promise<any[]> {
    console.warn('[MockDataService] getJournalLinesByEntry returning empty array.');
    return [];
  }

  // Audit Log CRUD
  async createAuditLog(log: any): Promise<any> {
    console.warn('[MockDataService] createAuditLog - data not persisted.');
    return { ...log, id: log.id || `audit-${Date.now()}`, timestamp: new Date().toISOString() };
  }
  async getAuditLogsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getAuditLogsByOrg returning empty array.');
    return [];
  }

  // Purchase Order CRUD
  async createPurchaseOrder(order: any): Promise<any> {
    console.warn('[MockDataService] createPurchaseOrder - data not persisted.');
    return { ...order, id: order.id || `po-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updatePurchaseOrder(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updatePurchaseOrder - data not persisted.');
    return { id, ...updates, updatedAt: new Date().toISOString() };
  }
  async deletePurchaseOrder(id: string): Promise<void> {
    console.warn('[MockDataService] deletePurchaseOrder - data not persisted.');
  }
  async getPurchaseOrdersByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getPurchaseOrdersByOrg returning empty array.');
    return [];
  }
  async getPurchaseOrderById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getPurchaseOrderById returning null.');
    return null;
  }

  // Goods Receipt CRUD
  async createGoodsReceipt(receipt: any): Promise<any> {
    console.warn('[MockDataService] createGoodsReceipt - data not persisted.');
    return { ...receipt, id: receipt.id || `gr-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateGoodsReceipt(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateGoodsReceipt - data not persisted.');
    return { id, ...updates, updatedAt: new Date().toISOString() };
  }
  async deleteGoodsReceipt(id: string): Promise<void> {
    console.warn('[MockDataService] deleteGoodsReceipt - data not persisted.');
  }
  async getGoodsReceiptsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getGoodsReceiptsByOrg returning empty array.');
    return [];
  }
  async getGoodsReceiptById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getGoodsReceiptById returning null.');
    return null;
  }

  // Recurring Bill CRUD
  async createRecurringBill(bill: any): Promise<any> {
    console.warn('[MockDataService] createRecurringBill - data not persisted.');
    return { ...bill, id: bill.id || `rb-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateRecurringBill(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateRecurringBill - data not persisted.');
    return { id, ...updates, updatedAt: new Date().toISOString() };
  }
  async deleteRecurringBill(id: string): Promise<void> {
    console.warn('[MockDataService] deleteRecurringBill - data not persisted.');
  }
  async getRecurringBillsByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getRecurringBillsByOrg returning empty array.');
    return [];
  }
  async getRecurringBillById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getRecurringBillById returning null.');
    return null;
  }

  // EFT Batch CRUD
  async createEFTBatch(batch: any): Promise<any> {
    console.warn('[MockDataService] createEFTBatch - data not persisted.');
    return { ...batch, id: batch.id || `eft-${Date.now()}`, createdAt: new Date().toISOString() };
  }
  async updateEFTBatch(id: string, updates: any): Promise<any> {
    console.warn('[MockDataService] updateEFTBatch - data not persisted.');
    return { id, ...updates, updatedAt: new Date().toISOString() };
  }
  async deleteEFTBatch(id: string): Promise<void> {
    console.warn('[MockDataService] deleteEFTBatch - data not persisted.');
  }
  async getEFTBatchesByOrg(orgId: string): Promise<any[]> {
    console.warn('[MockDataService] getEFTBatchesByOrg returning empty array.');
    return [];
  }
  async getEFTBatchById(id: string): Promise<any | null> {
    console.warn('[MockDataService] getEFTBatchById returning null.');
    return null;
  }

  // Generic Entity CRUD
  async createEntity<T extends { id?: string; orgId?: string }>(table: string, entity: T): Promise<T> {
    console.warn(`[MockDataService] createEntity for ${table} is memory-only.`);
    return { ...entity, id: `${table}-${Date.now()}` };
  }
  async updateEntity<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
    console.warn(`[MockDataService] updateEntity for ${table} is memory-only.`);
    return { id, ...updates } as T;
  }
  async deleteEntity(table: string, id: string): Promise<void> {
    console.warn(`[MockDataService] deleteEntity for ${table} is memory-only.`);
  }

  async archiveEntity(table: string, id: string, userId: string): Promise<void> {
    console.warn(`[MockDataService] archiveEntity for ${table} (id: ${id})`);
  }

  async restoreEntity(table: string, id: string): Promise<void> {
    console.warn(`[MockDataService] restoreEntity for ${table} (id: ${id})`);
  }

  async permanentDeleteEntity(table: string, id: string): Promise<void> {
    console.warn(`[MockDataService] permanentDeleteEntity for ${table} (id: ${id})`);
  }

  async checkUsage(table: string, id: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    return { isUsed: false, usedIn: [] };
  }
}
