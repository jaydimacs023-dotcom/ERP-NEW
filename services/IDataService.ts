
import { 
  Organization, User, Student, Qualification, Trainer, Batch, 
  Sponsor, NonStockItem, Vendor, BankAccount, Location, 
  TrainerSchedule, Employee, PayrollRun, PayrollLine,
  JournalEntry, JournalEntryLine, AuditLog, PurchaseOrder, PaymentHistory
} from '../types';

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
  
  // Batch CRUD
  createBatch(batch: Batch): Promise<Batch>;
  updateBatch(id: string, updates: Partial<Batch>): Promise<Batch>;
  deleteBatch(id: string): Promise<void>;
  
  // Generic create for other entities
  createEntity<T extends { id?: string; orgId?: string }>(table: string, entity: T): Promise<T>;
  updateEntity<T>(table: string, id: string, updates: Partial<T>): Promise<T>;
  deleteEntity(table: string, id: string): Promise<void>;
}
