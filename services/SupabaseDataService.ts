
import { IDataService, InitialData } from './IDataService';
import { MockDataService } from './MockDataService';
import { config } from '../config/app';

/**
 * SupabaseDataService
 * 
 * Connects to Supabase for cloud-based data persistence.
 * Fetches data from Supabase tables matching entity names.
 * Falls back to MockDataService if credentials are missing.
 */
export class SupabaseDataService implements IDataService {
  private mockFallback = new MockDataService();
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = config.supabase.url;
    this.supabaseKey = config.supabase.anonKey;
  }

  /**
   * Generic fetch method for Supabase tables
   * Uses the REST API for simplicity without client library dependency
   */
  private async fetchFromSupabase<T>(table: string): Promise<T[]> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn(`[Supabase] Missing credentials for table '${table}', falling back to mock data`);
      return [] as T[];
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}?select=*`;
      const response = await fetch(url, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`[Supabase] Error fetching ${table}: ${response.status} ${response.statusText}`);
        return [] as T[];
      }

      return (await response.json()) as T[];
    } catch (error) {
      console.error(`[Supabase] Network error fetching ${table}:`, error);
      return [] as T[];
    }
  }

  async getInitialData(): Promise<InitialData> {
    console.info("[Supabase] ☁️ Fetching data from Supabase...");

    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn("[Supabase] Credentials not configured. Using mock data as fallback.");
      return this.mockFallback.getInitialData();
    }

    try {
      // Fetch all tables in parallel
      const [
        organizations,
        users,
        students,
        qualifications,
        trainers,
        batches,
        sponsors,
        items,
        vendors,
        locations,
        schedules,
        employees,
        bankAccounts,
        accounts,
        journalEntries,
        journalLines,
        payrollRuns,
        payrollLines,
        auditLogs,
        purchaseOrders,
      ] = await Promise.all([
        this.fetchFromSupabase('organizations'),
        this.fetchFromSupabase('users'),
        this.fetchFromSupabase('students'),
        this.fetchFromSupabase('qualifications'),
        this.fetchFromSupabase('trainers'),
        this.fetchFromSupabase('batches'),
        this.fetchFromSupabase('sponsors'),
        this.fetchFromSupabase('items'),
        this.fetchFromSupabase('vendors'),
        this.fetchFromSupabase('locations'),
        this.fetchFromSupabase('schedules'),
        this.fetchFromSupabase('employees'),
        this.fetchFromSupabase('bank_accounts'),
        this.fetchFromSupabase('chart_of_accounts'),
        this.fetchFromSupabase('journal_entries'),
        this.fetchFromSupabase('journal_entry_lines'),
        this.fetchFromSupabase('payroll_runs'),
        this.fetchFromSupabase('payroll_lines'),
        this.fetchFromSupabase('audit_logs'),
        this.fetchFromSupabase('purchase_orders'),
      ]);

      console.info("[Supabase] ✅ Data loaded successfully");

      return {
        organizations: (organizations as any) || [],
        users: (users as any) || [],
        students: (students as any) || [],
        qualifications: (qualifications as any) || [],
        trainers: (trainers as any) || [],
        batches: (batches as any) || [],
        sponsors: (sponsors as any) || [],
        items: (items as any) || [],
        vendors: (vendors as any) || [],
        locations: (locations as any) || [],
        schedules: (schedules as any) || [],
        employees: (employees as any) || [],
        bankAccounts: (bankAccounts as any) || [],
        accounts: (accounts as any) || [],
        journalEntries: (journalEntries as any) || [],
        journalLines: (journalLines as any) || [],
        payrollRuns: (payrollRuns as any) || [],
        payrollLines: (payrollLines as any) || [],
        auditLogs: (auditLogs as any) || [],
        purchaseOrders: (purchaseOrders as any) || [],
      };
    } catch (error) {
      console.error("[Supabase] Fatal error loading data:", error);
      console.info("[Supabase] Falling back to mock data");
      return this.mockFallback.getInitialData();
    }
  }
}
