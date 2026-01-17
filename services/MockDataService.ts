
import { IDataService, InitialData } from './IDataService';
import { Organization, User, Student, Batch } from '../types';
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
      paymentHistories: db.INITIAL_PAYMENTS
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
}
