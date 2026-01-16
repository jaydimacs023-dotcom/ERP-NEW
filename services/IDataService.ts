
import { 
  Organization, User, Student, Qualification, Trainer, Batch, 
  Sponsor, NonStockItem, Vendor, BankAccount, Location, 
  TrainerSchedule, Employee, PayrollRun, PayrollLine, 
  JournalEntry, JournalEntryLine, AuditLog, PurchaseOrder
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
}

export interface IDataService {
  getInitialData(): Promise<InitialData>;
  // Future methods for CRUD will go here
}
