
import { IDataService, InitialData } from './IDataService';
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
      purchaseOrders: []
    };
  }
}
