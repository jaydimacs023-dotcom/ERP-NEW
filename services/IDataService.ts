
import { 
  Organization, User, Student, Qualification, Trainer, Batch, 
  Sponsor, NonStockItem, Vendor, BankAccount, Location, 
  TrainerSchedule, Employee, PayrollRun, PayrollLine,
  JournalEntry, JournalEntryLine, AuditLog, PurchaseOrder, PaymentHistory, FixedAsset, Payable
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
  accounts: any[]; // ChartOfAccount[]
  journalEntries: JournalEntry[];
  journalLines: JournalEntryLine[];
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
  
  // Fixed Asset CRUD
  createFixedAsset(asset: FixedAsset): Promise<FixedAsset>;
  updateFixedAsset(id: string, updates: Partial<FixedAsset>): Promise<FixedAsset>;
  deleteFixedAsset(id: string): Promise<void>;

  // Item Catalog CRUD
  createItem(item: NonStockItem): Promise<NonStockItem>;
  updateItem(id: string, updates: Partial<NonStockItem>): Promise<NonStockItem>;
  deleteItem(id: string): Promise<void>;

  // Payables CRUD
  createPayable(payable: Payable): Promise<Payable>;
  updatePayable(id: string, updates: Partial<Payable>): Promise<Payable>;
  deletePayable(id: string): Promise<void>;
  
  // Generic create for other entities
  createEntity<T extends { id?: string; orgId?: string }>(table: string, entity: T): Promise<T>;
  updateEntity<T>(table: string, id: string, updates: Partial<T>): Promise<T>;
  deleteEntity(table: string, id: string): Promise<void>;
}
