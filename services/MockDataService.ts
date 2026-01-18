
import { IDataService, InitialData, TrainerUsageCheck, QualificationUsageCheck, LocationUsageCheck, ScheduleUsageCheck, SponsorUsageCheck } from './IDataService';
import { Organization, User, Student, Batch, Trainer, Qualification, Location, TrainerSchedule, Sponsor } from '../types';
import * as db from '../db';

export class MockDataService implements IDataService {
  async getInitialData(): Promise<InitialData> {
    // Simulate minor network delay for realism
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      organizations: db.INITIAL_ORGS,
      users: db.INITIAL_USERS,
      students: db.INITIAL_STUDENTS,
      qualifications: db.INITIAL_QUALIFICATIONS,
      trainers: db.INITIAL_TRAINERS,
      batches: db.INITIAL_BATCHES,
      sponsors: db.INITIAL_SPONSORS,
      items: db.INITIAL_ITEMS,
      vendors: db.INITIAL_VENDORS,
      locations: db.INITIAL_LOCATIONS,
      schedules: db.INITIAL_SCHEDULES,
      employees: db.INITIAL_EMPLOYEES,
      bankAccounts: db.INITIAL_BANK_ACCOUNTS,
      accounts: db.INITIAL_COA,
      journalEntries: [],
      journalLines: [],
      payrollRuns: [],
      payrollLines: [],
      auditLogs: [],
      purchaseOrders: [],
      paymentHistories: db.INITIAL_PAYMENTS,
      fixedAssets: db.INITIAL_FIXED_ASSETS,
      atcCategories: [],
      atcItems: [],
      atcRates: []
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
    return sponsor;
  }

  async updateSponsor(id: string, updates: Partial<Sponsor>): Promise<Sponsor> {
    console.warn('[MockDataService] Sponsors persist to memory only; changes lost on refresh');
    return { ...updates } as Sponsor;
  }

  async deleteSponsor(id: string): Promise<void> {
    console.warn('[MockDataService] Sponsors persist to memory only; changes lost on refresh');
  }

  async checkSponsorUsage(sponsorId: string): Promise<SponsorUsageCheck> {
    console.warn('[MockDataService] Checking sponsor usage in mock mode');
    return { isUsed: false, usedIn: [] };
  }

  async createEntity<T extends { id?: string; orgId?: string }>(table: string, entity: T): Promise<T> {
    console.warn(`[MockDataService] ${table} persist to memory only; changes lost on refresh`);
    return entity;
  }

  async updateEntity<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
    console.warn(`[MockDataService] ${table} persist to memory only; changes lost on refresh`);
    return { ...updates } as T;
  }

  async deleteEntity(table: string, id: string): Promise<void> {
    console.warn(`[MockDataService] ${table} persist to memory only; changes lost on refresh`);
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
}
