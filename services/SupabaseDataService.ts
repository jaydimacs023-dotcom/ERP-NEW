
import { IDataService, InitialData } from './IDataService';
import { config } from '../config/app';

/**
 * SupabaseDataService
 * 
 * Connects to Supabase for cloud-based data persistence.
 * Fetches data from Supabase tables matching entity names.
 * Throws an error if credentials are not configured.
 */
export class SupabaseDataService implements IDataService {
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = config.supabase.url;
    this.supabaseKey = config.supabase.anonKey;
  }

  // Getter for baseUrl (alias for supabaseUrl REST endpoint)
  private get baseUrl(): string {
    return `${this.supabaseUrl}/rest/v1`;
  }

  // Helper method to get standard headers for Supabase requests
  private getHeaders(): Record<string, string> {
    return {
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Generic fetch method for Supabase tables
   * Uses the REST API for simplicity without client library dependency
   */
  private async fetchFromSupabase<T>(table: string): Promise<T[]> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn(`[Supabase] Missing credentials for table '${table}', returning empty array`);
      return [] as T[];
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}?select=*`;
      console.debug(`[Supabase] 📡 Fetching ${table}...`);
      
      const response = await fetch(url, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Handle 404 (table not found) gracefully
        if (response.status === 404) {
          console.warn(`[Supabase] ⚠️ Table not found: '${table}' (404) - using empty array`);
          return [] as T[];
        }
        console.error(`[Supabase] ❌ Error fetching ${table}: ${response.status} ${response.statusText}`);
        const errorBody = await response.text();
        console.error(`[Supabase] Response body:`, errorBody);
        return [] as T[];
      }

      const data = await response.json() as T[];
      console.debug(`[Supabase] ✅ ${table}: ${data.length} rows`);
      return data;
    } catch (error) {
      console.error(`[Supabase] ❌ Network error fetching ${table}:`, error);
      return [] as T[];
    }
  }

  async getInitialData(): Promise<InitialData> {
    console.info("[Supabase] ☁️ Fetching data from Supabase...");

    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error("[Supabase] ❌ Credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      throw new Error('Supabase credentials not configured');
    }

    try {
      console.info(`[Supabase] URL: ${this.supabaseUrl.substring(0, 50)}...`);
      
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
        bankReconciliations,
        recurringJournalEntries,
        accounts,
        journalEntries,
        journalLines,
        payrollRuns,
        payrollLines,
        auditLogs,
        purchaseOrders,
        paymentHistories,
        fixedAssets,
        vendorTaxSettings,
        atcCategories,
        atcItems,
        atcRates,
        payables,
        bills,
        warehouseLocations,
        stockItems,
        inventoryLevels,
        inventoryTransactions,
        stockAdjustments,
        reorderPoints,
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
        this.fetchFromSupabase('trainer_schedules'),
        this.fetchFromSupabase('employees'),
        this.fetchFromSupabase('bank_accounts'),
        this.fetchFromSupabase('bank_reconciliations'),
        this.fetchFromSupabase('recurring_journal_entries'),
        this.fetchFromSupabase('chart_of_accounts'),
        this.fetchFromSupabase('journal_entries'),
        this.fetchFromSupabase('journal_entry_lines'),
        this.fetchFromSupabase('payroll_runs'),
        this.fetchFromSupabase('payroll_lines'),
        this.fetchFromSupabase('audit_logs'),
        this.fetchFromSupabase('purchase_orders'),
        this.fetchFromSupabase('payment_histories'),
        this.fetchFromSupabase('fixed_assets'),
        this.fetchFromSupabase('vendor_tax_settings'),
        this.fetchFromSupabase('atc_categories'),
        this.fetchFromSupabase('atc_items'),
        this.fetchFromSupabase('atc_rates'),
        this.fetchFromSupabase('payables'),
        this.fetchFromSupabase('bills'),
        this.fetchFromSupabase('warehouse_locations'),
        this.fetchFromSupabase('stock_items'),
        this.fetchFromSupabase('inventory_levels'),
        this.fetchFromSupabase('inventory_transactions'),
        this.fetchFromSupabase('stock_adjustments'),
        this.fetchFromSupabase('reorder_points'),
      ]);

      // Log data status
      const hasData = organizations && organizations.length > 0;
      
      if (!hasData) {
        console.warn("[Supabase] ⚠️ No organizations found in Supabase. Database may be empty.");
      }

      console.info("[Supabase] ✅ Data loaded from Supabase");

      // Convert all snake_case data from Supabase to camelCase for the app
      return {
        organizations: this.snakeToCamel(organizations as any) || [],
        users: this.snakeToCamel(users as any) || [],
        students: this.snakeToCamel(students as any) || [],
        qualifications: this.snakeToCamel(qualifications as any) || [],
        trainers: this.snakeToCamel(trainers as any) || [],
        batches: this.snakeToCamel(batches as any) || [],
        sponsors: this.snakeToCamel(sponsors as any) || [],
        items: this.snakeToCamel(items as any) || [],
        vendors: this.snakeToCamel(vendors as any) || [],
        locations: this.snakeToCamel(locations as any) || [],
        schedules: this.snakeToCamel(schedules as any) || [],
        employees: this.snakeToCamel(employees as any) || [],
        bankAccounts: this.snakeToCamel(bankAccounts as any) || [],
        bankReconciliations: this.snakeToCamel(bankReconciliations as any) || [],
        recurringJournalEntries: this.snakeToCamel(recurringJournalEntries as any) || [],
        accounts: this.snakeToCamel(accounts as any) || [],
        journalEntries: this.snakeToCamel(journalEntries as any) || [],
        journalLines: this.snakeToCamel(journalLines as any) || [],
        payrollRuns: this.snakeToCamel(payrollRuns as any) || [],
        payrollLines: this.snakeToCamel(payrollLines as any) || [],
        auditLogs: this.snakeToCamel(auditLogs as any) || [],
        purchaseOrders: this.snakeToCamel(purchaseOrders as any) || [],
        paymentHistories: this.snakeToCamel(paymentHistories as any) || [],
        fixedAssets: this.snakeToCamel(fixedAssets as any) || [],
        vendorTaxSettings: this.snakeToCamel(vendorTaxSettings as any) || [],
        atcCategories: this.snakeToCamel(atcCategories as any) || [],
        atcItems: this.snakeToCamel(atcItems as any) || [],
        atcRates: this.snakeToCamel(atcRates as any) || [],
        payables: this.snakeToCamel(payables as any) || [],
        bills: this.snakeToCamel(bills as any) || [],
        warehouseLocations: this.snakeToCamel(warehouseLocations as any) || [],
        stockItems: this.snakeToCamel(stockItems as any) || [],
        inventoryLevels: this.snakeToCamel(inventoryLevels as any) || [],
        inventoryTransactions: this.snakeToCamel(inventoryTransactions as any) || [],
        stockAdjustments: this.snakeToCamel(stockAdjustments as any) || [],
        reorderPoints: this.snakeToCamel(reorderPoints as any) || [],
      };
    } catch (error) {
      console.error("[Supabase] ❌ Fatal error loading data:", error);
      console.error("[Supabase] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Convert snake_case object keys to camelCase
   * Used because Supabase tables use snake_case but app uses camelCase
   * Deeply recursive to handle JSONB columns
   */
  private snakeToCamel(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.snakeToCamel(item));
    if (obj instanceof Date) return obj;

    const camelCaseObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Convert snake_case to camelCase: is_vat_registered → isVatRegistered
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        // Recursively convert values for nested JSONB objects
        camelCaseObj[camelKey] = this.snakeToCamel(obj[key]);
      }
    }
    return camelCaseObj;
  }

  /**
   * Convert camelCase object keys to snake_case
   * Used because Supabase tables use snake_case column names
   * Deeply recursive to handle JSONB columns
   */
  private camelToSnake(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.camelToSnake(item));
    if (obj instanceof Date) return obj;

    const snakeCaseObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Convert camelCase to snake_case: isVatRegistered → is_vat_registered
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        // Recursively convert values for nested JSONB objects
        snakeCaseObj[snakeKey] = this.camelToSnake(obj[key]);
      }
    }
    return snakeCaseObj;
  }

  /**
   * Generic INSERT to Supabase table
   */
  private async insertToSupabase<T>(table: string, data: T): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error(`Supabase credentials not configured for table '${table}'`);
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}`;
      // Convert camelCase to snake_case for Supabase
      const snakeCaseData = this.camelToSnake(data);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(snakeCaseData),
      });

      if (!response.ok) {
        console.error(`[Supabase] Error inserting into ${table}: ${response.status} ${response.statusText}`);
        const error = await response.text();
        console.error(`[Supabase] Response: ${error}`);
        throw new Error(`Failed to insert into ${table}`);
      }

      const result = await response.json();
      console.info(`[Supabase] ✅ Inserted into ${table}:`, result);
      // Convert response back to camelCase
      const camelCaseResult = this.snakeToCamel(result[0] || result);
      return camelCaseResult;
    } catch (error) {
      console.error(`[Supabase] Network error inserting into ${table}:`, error);
      throw error;
    }
  }

  /**
   * Generic UPDATE to Supabase table
   */
  private async updateInSupabase<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error(`Supabase credentials not configured for table '${table}'`);
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}?id=eq.${id}`;
      // Convert camelCase to snake_case for Supabase
      const snakeCaseUpdates = this.camelToSnake(updates);
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(snakeCaseUpdates),
      });

      if (!response.ok) {
        console.error(`[Supabase] Error updating ${table}: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to update ${table}`);
      }

      const result = await response.json();
      console.info(`[Supabase] ✅ Updated ${table}:`, result);
      // Convert response back to camelCase
      const camelCaseResult = this.snakeToCamel(result[0] || result);
      return camelCaseResult;
    } catch (error) {
      console.error(`[Supabase] Network error updating ${table}:`, error);
      throw error;
    }
  }

  /**
   * Generic DELETE from Supabase table
   */
  private async deleteFromSupabase(table: string, id: string): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error(`Supabase credentials not configured for table '${table}'`);
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok && response.status !== 204) {
        console.error(`[Supabase] Error deleting from ${table}: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to delete from ${table}`);
      }

      console.info(`[Supabase] ✅ Deleted from ${table} (id: ${id})`);
    } catch (error) {
      console.error(`[Supabase] Network error deleting from ${table}:`, error);
      throw error;
    }
  }

  /**
   * Raw INSERT to Supabase - with schema filtering and conversion
   * Converts camelCase to snake_case, filters to valid columns, and returns camelCase result
   */
  private async insertToSupabaseRaw<T>(table: string, data: any): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn(`[Supabase] Missing credentials for table '${table}', falling back`);
      throw new Error(`Supabase not configured for ${table}`);
    }

    try {
      const url = `${this.baseUrl}/${table}`;
      console.debug(`[Supabase] 📝 Inserting into ${table}:`, data);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[Supabase] ❌ Insert failed: ${response.status} ${response.statusText}`, error);
        throw new Error(`Failed to insert into ${table}: ${error}`);
      }

      const result = await response.json();
      const camelResult = this.snakeToCamel(Array.isArray(result) ? result[0] : result);
      console.info(`[Supabase] ✅ Inserted into ${table}:`, camelResult);
      return camelResult as T;
    } catch (error) {
      console.error(`[Supabase] Network error inserting into ${table}:`, error);
      throw error;
    }
  }

  /**
   * Raw UPDATE to Supabase - with schema filtering and conversion
   * Converts camelCase to snake_case, filters to valid columns, and returns camelCase result
   */
  private async updateInSupabaseRaw<T>(table: string, id: string, data: any): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn(`[Supabase] Missing credentials for table '${table}', falling back`);
      throw new Error(`Supabase not configured for ${table}`);
    }

    try {
      const url = `${this.baseUrl}/${table}?id=eq.${id}`;
      console.debug(`[Supabase] ✏️ Updating ${table} (${id}):`, data);
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[Supabase] ❌ Update failed: ${response.status} ${response.statusText}`, error);
        throw new Error(`Failed to update ${table}: ${error}`);
      }

      const result = await response.json();
      const camelResult = this.snakeToCamel(Array.isArray(result) ? result[0] : result);
      console.info(`[Supabase] ✅ Updated ${table}:`, camelResult);
      return camelResult as T;
    } catch (error) {
      console.error(`[Supabase] Network error updating ${table}:`, error);
      throw error;
    }
  }

  /**
   * Filter object to only include valid columns for a given table
   * Removes fields that don't exist in Supabase schema
   * For inserts, excludes auto-generated columns (created_at, updated_at, net_book_value for fixed_assets)
   */
  private filterToTableSchema(table: string, data: any, isInsert: boolean = false): any {
    const validColumns: Record<string, string[]> = {
      students: [
        'id', 'org_id', 'uli', 'last_name', 'first_name', 'middle_name', 'extension',
        'sex', 'date_of_birth', 'birth_region', 'birth_province', 'birth_city',
        'civil_status', 'educational_attainment', 'nationality', 'email', 'contact_number',
        'street', 'barangay', 'city', 'district', 'province', 'guardian',
        'location_id', 'sponsor_id', 'documents', 'created_at', 'updated_at'
      ],
      organizations: ['id', 'name', 'currency', 'tax_id', 'is_vat_registered', 'subscription_status', 'plan_type', 'pending_plan_type', 'payment_reference', 'license_expiry', 'created_at', 'primary_color', 'logo_url'],
      users: ['id', 'name', 'email', 'password_hash', 'salt', 'role', 'org_id', 'student_id', 'trainer_id', 'is_active', 'auth_uid', 'created_at', 'updated_at'],
      trainers: ['id', 'org_id', 'first_name', 'last_name', 'middle_name', 'email', 'contact_number', 'specialization', 'qualification_ids', 'created_at', 'updated_at'],
      qualifications: ['id', 'org_id', 'code', 'name', 'duration_days', 'sector', 'created_at', 'updated_at'],
      employees: ['id', 'org_id', 'first_name', 'last_name', 'designation', 'tin', 'sss', 'philhealth', 'pagibig', 'basic_salary', 'bank_name', 'bank_account', 'is_active', 'created_at', 'updated_at'],
      locations: ['id', 'org_id', 'code', 'name', 'address', 'capacity', 'created_at', 'updated_at'],
      trainer_schedules: ['id', 'org_id', 'trainer_id', 'location_id', 'slots', 'is_deleted', 'deleted_at', 'deleted_by', 'created_at', 'updated_at'],
      sponsors: ['id', 'org_id', 'name', 'contact_person', 'email', 'phone', 'address', 'ar_account_id', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'deleted_by'],
      batches: ['id', 'org_id', 'batch_code', 'name', 'year', 'qualification_id', 'trainer_id', 'sponsor_id', 'location_id', 'student_ids', 'status', 'start_date', 'end_date', 'max_students', 'current_students', 'created_at', 'updated_at'],
      vendors: ['id', 'org_id', 'name', 'category', 'email', 'contact_number', 'address', 'ap_account_id', 'created_at', 'updated_at'],
      atc_categories: ['id', 'code', 'name', 'created_at', 'updated_at'],
      atc_items: ['id', 'category_id', 'atc_code', 'description', 'taxpayer_type', 'created_at', 'updated_at'],
      atc_rates: ['id', 'atc_item_id', 'rate', 'rate_label', 'created_at', 'updated_at'],
      bank_accounts: ['id', 'org_id', 'bank_name', 'account_number', 'type', 'gl_account_id', 'currency', 'balance', 'created_at', 'updated_at'],
      chart_of_accounts: ['id', 'org_id', 'code', 'name', 'class', 'description', 'is_header', 'parent_id', 'created_at', 'updated_at'],
      fixed_assets: ['id', 'org_id', 'code', 'name', 'description', 'category', 'purchase_date', 'purchase_cost', 'accumulated_depreciation', 'depreciation_method', 'useful_life_years', 'gl_account_id', 'created_at', 'updated_at'],
      items: ['id', 'org_id', 'code', 'name', 'description', 'unit_price', 'income_account_id', 'expense_account_id', 'tax_category_id', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'deleted_by'],
      payables: [
        'id', 'org_id', 'vendor_id', 'payable_number', 'category', 'description', 'amount',
        'bill_date', 'due_date', 'payment_date', 'currency', 'status', 'reference_document',
        'journal_entry_id', 'gl_account_id', 'notes', 'withholding_type', 'atc_item_id',
        'atc_rate_id', 'applied_rate_percent', 'withholding_amount', 'net_payable',
        'created_by', 'approved_by', 'paid_by', 'created_at', 'updated_at', 'approved_at',
        'paid_at', 'is_deleted', 'deleted_at', 'deleted_by'
      ],
      check_vouchers: [
        'id', 'org_id', 'check_number', 'bank_account_id', 'payee_id', 'payee_type', 'payee_name',
        'check_date', 'amount', 'amount_in_words', 'status', 'payable_ids', 'journal_entry_id',
        'prepared_by', 'prepared_at', 'approved_by', 'approved_at', 'printed_by', 'printed_at',
        'released_by', 'released_at', 'voided_by', 'voided_at', 'void_reason',
        'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'deleted_by'
      ],
    };

    // Columns that are auto-generated and should be excluded on INSERT
    const generatedColumns: Record<string, string[]> = {
      vendors: ['id', 'created_at', 'updated_at'],
      bank_accounts: ['id', 'created_at', 'updated_at'],
      fixed_assets: ['net_book_value', 'created_at', 'updated_at'],
      items: ['created_at', 'updated_at'],
      payables: ['id', 'created_at', 'updated_at', 'approved_at', 'paid_at'],
      check_vouchers: ['id', 'created_at', 'updated_at']
    };

    const allowedColumns = validColumns[table] || [];
    const excludeColumns = (isInsert && generatedColumns[table]) || [];
    const filtered: any = {};

    for (const col of allowedColumns) {
      if (!excludeColumns.includes(col) && data.hasOwnProperty(col)) {
        filtered[col] = data[col];
      }
    }

    return filtered;
  }

  /**
   * Validate if a string is a valid UUID format
   * Valid UUIDs: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // ============================================================================
  // ORGANIZATION CRUD
  // ============================================================================

  async createOrganization(org: any): Promise<any> {
    const snakeCaseOrg = this.camelToSnake(org);
    const filteredOrg = this.filterToTableSchema('organizations', snakeCaseOrg);
    if ((filteredOrg as any).id && !this.isValidUUID((filteredOrg as any).id)) {
      delete (filteredOrg as any).id;
    }
    return this.insertToSupabaseRaw('organizations', filteredOrg);
  }

  async updateOrganization(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('organizations', snakeCaseUpdates);
    return this.updateInSupabaseRaw('organizations', id, filteredUpdates);
  }

  async deleteOrganization(id: string): Promise<void> {
    return this.deleteFromSupabase('organizations', id);
  }

  // ============================================================================
  // USER CRUD - With bcrypt password hashing
  // ============================================================================

  async createUser(user: any): Promise<any> {
    console.debug('[Supabase] createUser() INPUT:', user);
    
    const snakeCaseUser = this.camelToSnake(user);
    console.debug('[Supabase] After camelToSnake():', snakeCaseUser);
    
    // Hash password BEFORE filtering (since password_hash is the valid column, not password)
    if (snakeCaseUser.password) {
      const plainPassword = snakeCaseUser.password;
      try {
        const { PasswordService } = await import('./PasswordService');
        const hashedPassword = await PasswordService.hashPassword(plainPassword);
        snakeCaseUser.password_hash = hashedPassword;
        console.info('[Supabase] ✅ Password hashed with bcrypt for new user');
      } catch (error) {
        console.error('[Supabase] ❌ Failed to hash password:', error);
        snakeCaseUser.password_hash = plainPassword;
      }
      delete snakeCaseUser.password;
    }
    
    // Set defaults
    if (!snakeCaseUser.is_active) {
      snakeCaseUser.is_active = true;
    }
    if (!snakeCaseUser.salt) {
      snakeCaseUser.salt = 'bcrypt'; // Indicator that bcrypt is used
    }
    
    // Now filter to schema (password_hash is in schema, password is not)
    const filteredUser = this.filterToTableSchema('users', snakeCaseUser);
    console.debug('[Supabase] After filterToTableSchema():', filteredUser);
    
    // Generate UUID if invalid or missing
    if ((filteredUser as any).id && !this.isValidUUID((filteredUser as any).id)) {
      console.debug('[Supabase] Removing invalid UUID, will auto-generate');
      delete (filteredUser as any).id;
    }
    
    return this.insertToSupabaseRaw('users', filteredUser);
  }

  async updateUser(id: string, updates: Partial<any>): Promise<any> {
    console.debug('[Supabase] updateUser() INPUT:', { id, updates });
    
    const snakeCaseUpdates = this.camelToSnake(updates);
    
    // Hash password BEFORE filtering if being updated
    if (snakeCaseUpdates.password) {
      const plainPassword = snakeCaseUpdates.password;
      try {
        const { PasswordService } = await import('./PasswordService');
        const hashedPassword = await PasswordService.hashPassword(plainPassword);
        snakeCaseUpdates.password_hash = hashedPassword;
        snakeCaseUpdates.salt = 'bcrypt';
        console.info('[Supabase] ✅ Password updated with bcrypt hash');
      } catch (error) {
        console.error('[Supabase] ❌ Failed to hash password on update:', error);
        snakeCaseUpdates.password_hash = plainPassword;
      }
      delete snakeCaseUpdates.password;
    }
    
    const filteredUpdates = this.filterToTableSchema('users', snakeCaseUpdates);
    console.debug('[Supabase] After filterToTableSchema():', filteredUpdates);
    
    return this.updateInSupabaseRaw('users', id, filteredUpdates);
  }

  async deleteUser(id: string): Promise<void> {
    return this.deleteFromSupabase('users', id);
  }

  // ============================================================================
  // STUDENT CRUD
  // ============================================================================

  async createStudent(student: any): Promise<any> {
    console.debug('[Supabase] createStudent() INPUT:', student);
    
    // Convert camelCase input to snake_case FIRST so filtering works correctly
    const snakeCaseStudent = this.camelToSnake(student);
    console.debug('[Supabase] After camelToSnake():', snakeCaseStudent);
    
    // Ensure org_id is present
    if (!snakeCaseStudent.org_id) {
      console.warn('[Supabase] Warning: student missing org_id, using empty string');
    }

    // Convert documents array (StudentDocument[] to text[])
    // NOTE: In the current schema, students.documents is jsonb, so we should KEEP the full objects.
    // The previous logic was stripping fileData and other fields.
    if (snakeCaseStudent.documents && Array.isArray(snakeCaseStudent.documents)) {
      // camelToSnake has already processed this since it's now deeply recursive
      console.debug('[Supabase] Preserving documents array:', snakeCaseStudent.documents.length, 'items');
    }

    // Filter to only valid columns AFTER converting to snake_case
    let filteredStudent = this.filterToTableSchema('students', snakeCaseStudent);
    console.debug('[Supabase] After filterToTableSchema():', {
      beforeKeys: Object.keys(snakeCaseStudent),
      afterKeys: Object.keys(filteredStudent),
      removed: Object.keys(snakeCaseStudent).filter(k => !Object.keys(filteredStudent).includes(k))
    });
    
    // Remove id if it's not a valid UUID (let Supabase generate it)
    if (filteredStudent.id && !this.isValidUUID(filteredStudent.id)) {
      console.debug('[Supabase] Removing invalid UUID:', filteredStudent.id);
      delete filteredStudent.id;
    }

    // Add timestamps for audit trail (AFTER filtering to ensure they're included)
    const now = new Date().toISOString();
    filteredStudent.created_at = now;
    filteredStudent.updated_at = now;
    
    console.debug('[Supabase] FINAL data ready for POST:', {
      keys: Object.keys(filteredStudent),
      hasAge: 'age' in filteredStudent,
      hasAgeOfBirth: 'age_of_birth' in filteredStudent,
      fullData: JSON.stringify(filteredStudent)
    });
    
    // Note: insertToSupabase will NOT apply camelToSnake again since data is already in snake_case
    // We need to call the API directly to avoid double-conversion
    return this.insertToSupabaseRaw('students', filteredStudent);
  }

  async updateStudent(id: string, updates: Partial<any>): Promise<any> {
    // Convert updates to snake_case first so filtering works correctly
    let snakeCaseUpdates = this.camelToSnake(updates);
    
    // Always update the updated_at timestamp
    snakeCaseUpdates.updated_at = new Date().toISOString();
    
    // Convert StudentDocument[] to text[] for Supabase
    // NOTE: In the current schema, students.documents is jsonb, so we should KEEP the full objects.
    if (snakeCaseUpdates.documents && Array.isArray(snakeCaseUpdates.documents)) {
      // camelToSnake has already processed this since it's now deeply recursive
      console.debug('[Supabase] Preserving documents array for update');
    }

    // Filter to only valid columns for students table
    const filteredUpdates = this.filterToTableSchema('students', snakeCaseUpdates);
    
    console.debug('[Supabase] Filtered student updates ready for PATCH:', {
      keys: Object.keys(filteredUpdates),
      hasAge: 'age' in filteredUpdates,
      data: filteredUpdates
    });
    
    return this.updateInSupabaseRaw('students', id, filteredUpdates);
  }

  async deleteStudent(id: string): Promise<void> {
    // Hard delete (no is_deleted column in Supabase)
    await this.deleteFromSupabase('students', id);
  }

  async checkStudentUsage(studentId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    // Check if student is referenced in other tables (batches, etc.)
    const usedIn: string[] = [];
    
    try {
      // Check if student is enrolled in any batches
      const batchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/batch_students?student_id=eq.${studentId}&select=id`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
          },
        }
      );
      const batchStudents = await batchResponse.json();
      if (Array.isArray(batchStudents) && batchStudents.length > 0) {
        usedIn.push('Batch Enrollments');
      }

      // Check if student has any documents
      const docsResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/student_documents?student_id=eq.${studentId}&select=id`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
          },
        }
      );
      const docs = await docsResponse.json();
      if (Array.isArray(docs) && docs.length > 0) {
        usedIn.push('Student Documents');
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check student usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // TRAINER CRUD
  // ============================================================================

  async createTrainer(trainer: any): Promise<any> {
    console.debug('[Supabase] createTrainer() INPUT:', trainer);
    
    // Convert camelCase input to snake_case FIRST so filtering works correctly
    const snakeCaseTrainer = this.camelToSnake(trainer);
    console.debug('[Supabase] After camelToSnake():', snakeCaseTrainer);
    
    // Ensure org_id is present
    if (!snakeCaseTrainer.org_id) {
      console.warn('[Supabase] Warning: trainer missing org_id');
    }

    // Filter to only valid columns AFTER converting to snake_case
    let filteredTrainer = this.filterToTableSchema('trainers', snakeCaseTrainer);
    console.debug('[Supabase] After filterToTableSchema():', {
      beforeKeys: Object.keys(snakeCaseTrainer),
      afterKeys: Object.keys(filteredTrainer),
      removed: Object.keys(snakeCaseTrainer).filter(k => !Object.keys(filteredTrainer).includes(k))
    });
    
    // Remove id if it's not a valid UUID (let Supabase generate it)
    if (filteredTrainer.id && !this.isValidUUID(filteredTrainer.id)) {
      console.debug('[Supabase] Removing invalid UUID:', filteredTrainer.id);
      delete filteredTrainer.id;
    }

    // Add timestamps for audit trail
    const now = new Date().toISOString();
    filteredTrainer.created_at = now;
    filteredTrainer.updated_at = now;
    
    console.debug('[Supabase] FINAL trainer data ready for POST:', {
      keys: Object.keys(filteredTrainer),
      fullData: JSON.stringify(filteredTrainer)
    });
    
    return this.insertToSupabaseRaw('trainers', filteredTrainer);
  }

  async updateTrainer(id: string, updates: Partial<any>): Promise<any> {
    // Convert updates to snake_case first so filtering works correctly
    let snakeCaseUpdates = this.camelToSnake(updates);
    
    // Always update the updated_at timestamp
    snakeCaseUpdates.updated_at = new Date().toISOString();

    // Filter to only valid columns for trainers table
    const filteredUpdates = this.filterToTableSchema('trainers', snakeCaseUpdates);
    
    console.debug('[Supabase] Filtered trainer updates ready for PATCH:', {
      keys: Object.keys(filteredUpdates),
      data: filteredUpdates
    });
    
    return this.updateInSupabaseRaw('trainers', id, filteredUpdates);
  }

  async deleteTrainer(id: string): Promise<void> {
    // Hard delete
    await this.deleteFromSupabase('trainers', id);
  }

  async checkTrainerUsage(trainerId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    // Check if trainer is referenced in other tables (batches, schedules, users, etc.)
    const usedIn: string[] = [];
    
    try {
      // Check if trainer is assigned to any batches
      const batchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/batches?trainer_id=eq.${trainerId}&select=id`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
          },
        }
      );
      const batches = await batchResponse.json();
      if (Array.isArray(batches) && batches.length > 0) {
        usedIn.push('Batches');
      }

      // Check if trainer has any schedules
      const scheduleResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/schedules?trainer_id=eq.${trainerId}&select=id`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
          },
        }
      );
      const schedules = await scheduleResponse.json();
      if (Array.isArray(schedules) && schedules.length > 0) {
        usedIn.push('Trainer Schedules');
      }

      // Check if trainer has a linked user account
      const userResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/users?trainer_id=eq.${trainerId}&select=id`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
          },
        }
      );
      const users = await userResponse.json();
      if (Array.isArray(users) && users.length > 0) {
        usedIn.push('User Accounts');
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check trainer usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // QUALIFICATION CRUD
  // ============================================================================

  async createQualification(qualification: any): Promise<any> {
    console.debug('[Supabase] createQualification() INPUT:', qualification);
    
    // Convert camelCase input to snake_case FIRST so filtering works correctly
    const snakeCaseQual = this.camelToSnake(qualification);
    console.debug('[Supabase] After camelToSnake():', snakeCaseQual);
    
    // Ensure org_id is present
    if (!snakeCaseQual.org_id) {
      console.warn('[Supabase] Warning: qualification missing org_id');
    }

    // Filter to only valid columns AFTER converting to snake_case
    let filteredQual = this.filterToTableSchema('qualifications', snakeCaseQual);
    console.debug('[Supabase] After filterToTableSchema():', {
      beforeKeys: Object.keys(snakeCaseQual),
      afterKeys: Object.keys(filteredQual),
      removed: Object.keys(snakeCaseQual).filter(k => !Object.keys(filteredQual).includes(k))
    });
    
    // Remove id if it's not a valid UUID (let Supabase generate it)
    if (filteredQual.id && !this.isValidUUID(filteredQual.id)) {
      console.debug('[Supabase] Removing invalid UUID:', filteredQual.id);
      delete filteredQual.id;
    }

    // Add timestamps for audit trail
    const now = new Date().toISOString();
    filteredQual.created_at = now;
    filteredQual.updated_at = now;
    
    console.debug('[Supabase] FINAL qualification data ready for POST:', {
      keys: Object.keys(filteredQual),
      fullData: JSON.stringify(filteredQual)
    });
    
    return this.insertToSupabaseRaw('qualifications', filteredQual);
  }

  async updateQualification(id: string, updates: Partial<any>): Promise<any> {
    // Convert updates to snake_case first so filtering works correctly
    let snakeCaseUpdates = this.camelToSnake(updates);
    
    // Always update the updated_at timestamp
    snakeCaseUpdates.updated_at = new Date().toISOString();

    // Filter to only valid columns for qualifications table
    const filteredUpdates = this.filterToTableSchema('qualifications', snakeCaseUpdates);
    
    console.debug('[Supabase] Filtered qualification updates ready for PATCH:', {
      keys: Object.keys(filteredUpdates),
      data: filteredUpdates
    });
    
    return this.updateInSupabaseRaw('qualifications', id, filteredUpdates);
  }

  async deleteQualification(id: string): Promise<void> {
    // Hard delete
    await this.deleteFromSupabase('qualifications', id);
  }

  async checkQualificationUsage(qualificationId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    // Check if qualification is referenced in other tables (batches, trainers, etc.)
    const usedIn: string[] = [];
    
    try {
      // Check if qualification is used in any batches
      const batchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/batches?qualification_id=eq.${qualificationId}&select=id`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
          },
        }
      );
      const batches = await batchResponse.json();
      if (Array.isArray(batches) && batches.length > 0) {
        usedIn.push('Training Batches');
      }

      // Check if qualification is assigned to any trainers (in qualification_ids array)
      // Note: This requires checking if qualificationId is in any trainer's qualification_ids array
      const trainerResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/trainers?qualification_ids=cs.{${qualificationId}}&select=id`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
          },
        }
      );
      const trainers = await trainerResponse.json();
      if (Array.isArray(trainers) && trainers.length > 0) {
        usedIn.push('Trainer Certifications');
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check qualification usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // BATCH CRUD
  // ============================================================================

  async createBatch(batch: any): Promise<any> {
    // Preserve student_ids array
    const studentIdsBackup = batch.studentIds;
    
    const snakeCaseBatch = this.camelToSnake(batch);
    let filteredBatch = this.filterToTableSchema('batches', snakeCaseBatch);
    
    // Restore student_ids as PostgreSQL array format
    if (studentIdsBackup && Array.isArray(studentIdsBackup)) {
      filteredBatch.student_ids = studentIdsBackup;
    }
    
    // Handle empty optional foreign keys - convert empty string to null
    if (filteredBatch.sponsor_id === '' || filteredBatch.sponsor_id === undefined) {
      filteredBatch.sponsor_id = null;
    }
    if (filteredBatch.location_id === '' || filteredBatch.location_id === undefined) {
      filteredBatch.location_id = null;
    }
    
    // Remove invalid UUID
    if (filteredBatch.id && !this.isValidUUID(filteredBatch.id)) {
      delete filteredBatch.id;
    }
    
    console.debug('[Supabase] createBatch - Final payload:', filteredBatch);
    
    return this.insertToSupabaseRaw('batches', filteredBatch);
  }

  async updateBatch(id: string, updates: Partial<any>): Promise<any> {
    // Preserve student_ids array
    const studentIdsBackup = updates.studentIds;
    
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('batches', snakeCaseUpdates);
    
    // Restore student_ids as PostgreSQL array format
    if (studentIdsBackup && Array.isArray(studentIdsBackup)) {
      filteredUpdates.student_ids = studentIdsBackup;
    }
    
    // Handle empty optional foreign keys - convert empty string to null
    if (filteredUpdates.sponsor_id === '' || filteredUpdates.sponsor_id === undefined) {
      filteredUpdates.sponsor_id = null;
    }
    if (filteredUpdates.location_id === '' || filteredUpdates.location_id === undefined) {
      filteredUpdates.location_id = null;
    }
    
    return this.updateInSupabaseRaw('batches', id, filteredUpdates);
  }

  async deleteBatch(id: string): Promise<void> {
    return this.deleteFromSupabase('batches', id);
  }

  // ============================================================================
  // LOCATION CRUD
  // ============================================================================

  async createLocation(location: any): Promise<any> {
    const snakeCaseLocation = this.camelToSnake(location);
    let filteredLocation = this.filterToTableSchema('locations', snakeCaseLocation);
    console.debug('[Supabase] After filterToTableSchema():', {
      original: location,
      snakeCase: snakeCaseLocation,
      filtered: filteredLocation
    });

    // Remove ID if not a valid UUID (will be auto-generated by Supabase)
    if (filteredLocation.id && !this.isValidUUID(filteredLocation.id)) {
      console.debug(`[Supabase] Removing invalid UUID: ${filteredLocation.id}`);
      delete filteredLocation.id;
    }

    return this.insertToSupabaseRaw('locations', filteredLocation);
  }

  async updateLocation(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('locations', snakeCaseUpdates);
    return this.updateInSupabaseRaw('locations', id, filteredUpdates);
  }

  async deleteLocation(id: string): Promise<void> {
    return this.deleteFromSupabase('locations', id);
  }

  async checkLocationUsage(locationId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    try {
      const usedIn: string[] = [];

      // Check if location is used in batches
      const batchesResponse = await fetch(
        `${this.baseUrl}/batches?location_id=eq.${locationId}&select=id,name`,
        { headers: this.getHeaders() }
      );
      if (batchesResponse.ok) {
        const batches = await batchesResponse.json();
        if (batches.length > 0) {
          usedIn.push(`${batches.length} batch(es)`);
        }
      }

      // Check if location is used in schedules
      const schedulesResponse = await fetch(
        `${this.baseUrl}/schedules?location_id=eq.${locationId}&select=id`,
        { headers: this.getHeaders() }
      );
      if (schedulesResponse.ok) {
        const schedules = await schedulesResponse.json();
        if (schedules.length > 0) {
          usedIn.push(`${schedules.length} schedule(s)`);
        }
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check location usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // SCHEDULE CRUD
  // ============================================================================

  async createSchedule(schedule: any): Promise<any> {
    // Preserve the slots array as-is (JSONB should keep camelCase keys)
    const slotsBackup = schedule.slots;
    
    const snakeCaseSchedule = this.camelToSnake(schedule);
    let filteredSchedule = this.filterToTableSchema('schedules', snakeCaseSchedule);
    
    // Restore the original slots array (JSONB content should not be snake_cased)
    if (slotsBackup) {
      filteredSchedule.slots = slotsBackup;
    }
    
    // Handle empty location_id - convert empty string to null for FK constraint
    if (filteredSchedule.location_id === '' || filteredSchedule.location_id === undefined) {
      filteredSchedule.location_id = null;
    }
    
    console.debug('[Supabase] createSchedule - Final payload:', {
      original: schedule,
      filtered: filteredSchedule
    });

    // Remove ID if not a valid UUID (will be auto-generated by Supabase)
    if (filteredSchedule.id && !this.isValidUUID(filteredSchedule.id)) {
      console.debug(`[Supabase] Removing invalid UUID: ${filteredSchedule.id}`);
      delete filteredSchedule.id;
    }

    return this.insertToSupabaseRaw('schedules', filteredSchedule);
  }

  async updateSchedule(id: string, updates: Partial<any>): Promise<any> {
    // Preserve the slots array as-is (JSONB should keep camelCase keys)
    const slotsBackup = updates.slots;
    
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('schedules', snakeCaseUpdates);
    
    // Restore the original slots array (JSONB content should not be snake_cased)
    if (slotsBackup) {
      filteredUpdates.slots = slotsBackup;
    }
    
    // Handle empty location_id - convert empty string to null for FK constraint
    if (filteredUpdates.location_id === '' || filteredUpdates.location_id === undefined) {
      filteredUpdates.location_id = null;
    }
    
    return this.updateInSupabaseRaw('schedules', id, filteredUpdates);
  }

  async deleteSchedule(id: string): Promise<void> {
    return this.deleteFromSupabase('schedules', id);
  }

  async checkScheduleUsage(scheduleId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    try {
      const usedIn: string[] = [];

      // Check if schedule is referenced in batches (if there's a schedule_id field)
      const batchesResponse = await fetch(
        `${this.baseUrl}/batches?schedule_id=eq.${scheduleId}&select=id,name`,
        { headers: this.getHeaders() }
      );
      if (batchesResponse.ok) {
        const batches = await batchesResponse.json();
        if (batches.length > 0) {
          usedIn.push(`${batches.length} batch(es)`);
        }
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check schedule usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // SPONSOR CRUD
  // ============================================================================

  async createSponsor(sponsor: any): Promise<any> {
    console.debug('[Supabase] createSponsor called with:', sponsor);
    
    // Convert to snake_case
    const snakeCaseSponsor = this.camelToSnake(sponsor);
    
    // Filter to valid columns
    let filteredSponsor = this.filterToTableSchema('sponsors', snakeCaseSponsor);
    console.debug('[Supabase] After filterToTableSchema():', {
      snakeCaseSponsor,
      filteredSponsor
    });
    
    // Validate or remove invalid ID
    if (filteredSponsor.id && !this.isValidUUID(filteredSponsor.id)) {
      console.warn(`[Supabase] Removing invalid UUID: ${filteredSponsor.id}`);
      delete filteredSponsor.id;
    }

    // Insert to Supabase
    return this.insertToSupabaseRaw('sponsors', filteredSponsor);
  }

  async updateSponsor(id: string, updates: Partial<any>): Promise<any> {
    console.debug('[Supabase] updateSponsor called with:', { id, updates });

    // Convert to snake_case
    const snakeCaseUpdates = this.camelToSnake(updates);
    
    // Filter to valid columns
    const filteredUpdates = this.filterToTableSchema('sponsors', snakeCaseUpdates);

    // Update in Supabase
    return this.updateInSupabaseRaw('sponsors', id, filteredUpdates);
  }

  async deleteSponsor(id: string): Promise<void> {
    console.debug('[Supabase] deleteSponsor called with:', id);
    return this.deleteFromSupabase('sponsors', id);
  }

  async checkSponsorUsage(sponsorId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    console.debug('[Supabase] checkSponsorUsage called with:', sponsorId);
    
    try {
      const usedIn: string[] = [];

      // Check if sponsor is referenced in students
      const studentsResponse = await fetch(
        `${this.baseUrl}/students?sponsor_id=eq.${sponsorId}&select=id,first_name,last_name`,
        { headers: this.getHeaders() }
      );
      if (studentsResponse.ok) {
        const students = await studentsResponse.json();
        if (students.length > 0) {
          usedIn.push(`${students.length} student(s)`);
        }
      }

      // Check if sponsor is referenced in batches (if there's a sponsor_id field)
      const batchesResponse = await fetch(
        `${this.baseUrl}/batches?sponsor_id=eq.${sponsorId}&select=id,name`,
        { headers: this.getHeaders() }
      );
      if (batchesResponse.ok) {
        const batches = await batchesResponse.json();
        if (batches.length > 0) {
          usedIn.push(`${batches.length} batch(es)`);
        }
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check sponsor usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // ============================================================================
  // ============================================================================

  async createEntity<T extends { id?: string; orgId?: string }>(table: string, entity: T): Promise<T> {
    // Convert to snake_case and filter
    const snakeCaseEntity = this.camelToSnake(entity);
    const filteredEntity = this.filterToTableSchema(table, snakeCaseEntity);
    
    // Remove invalid IDs
    if ((filteredEntity as any).id && !this.isValidUUID((filteredEntity as any).id)) {
      delete (filteredEntity as any).id;
    }
    
    return this.insertToSupabaseRaw(table, filteredEntity);
  }

  async updateEntity<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
    // Convert to snake_case and filter
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema(table, snakeCaseUpdates);
    
    return this.updateInSupabaseRaw(table, id, filteredUpdates);
  }

  async deleteEntity(table: string, id: string): Promise<void> {
    return this.deleteFromSupabase(table, id);
  }

  async archiveEntity(table: string, id: string, userId: string): Promise<void> {
    return this.updateInSupabaseRaw(table, id, { 
      is_deleted: true, 
      deleted_at: new Date().toISOString(),
      deleted_by: userId
    });
  }

  async restoreEntity(table: string, id: string): Promise<void> {
    return this.updateInSupabaseRaw(table, id, { 
      is_deleted: false, 
      deleted_at: null,
      deleted_by: null
    });
  }

  async permanentDeleteEntity(table: string, id: string): Promise<void> {
    return this.deleteFromSupabase(table, id);
  }

  async checkUsage(table: string, id: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    // Map of internal table names to their check functions
    const checkMap: Record<string, (id: string) => Promise<{ isUsed: boolean; usedIn: string[] }>> = {
      'students': this.checkStudentUsage.bind(this),
      'trainers': this.checkTrainerUsage.bind(this),
      'qualifications': this.checkQualificationUsage.bind(this),
      'locations': this.checkLocationUsage.bind(this),
      'schedules': this.checkScheduleUsage.bind(this),
      'sponsors': this.checkSponsorUsage.bind(this),
      // Add more as needed
    };

    if (checkMap[table]) {
      return checkMap[table](id);
    }

    // Default: no usage check implemented
    return { isUsed: false, usedIn: [] };
  }

  /**
   * Fixed Asset CRUD Operations
   */
  async createFixedAsset(asset: any): Promise<any> {
    const snakeCaseAsset = this.camelToSnake(asset);
    // Use isInsert: true to exclude generated columns (net_book_value, created_at, updated_at)
    const filteredAsset = this.filterToTableSchema('fixed_assets', snakeCaseAsset, true);
    if ((filteredAsset as any).id && !this.isValidUUID((filteredAsset as any).id)) {
      delete (filteredAsset as any).id;
    }
    return this.insertToSupabaseRaw('fixed_assets', filteredAsset);
  }

  async updateFixedAsset(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('fixed_assets', snakeCaseUpdates);
    return this.updateInSupabaseRaw('fixed_assets', id, filteredUpdates);
  }

  async deleteFixedAsset(id: string): Promise<void> {
    return this.deleteFromSupabase('fixed_assets', id);
  }

  /**
   * Item Catalog CRUD Operations
   */
  async createItem(item: any): Promise<any> {
    const snakeCaseItem = this.camelToSnake(item);
    
    // Convert empty strings to null for UUID columns
    if (snakeCaseItem.income_account_id === '') snakeCaseItem.income_account_id = null;
    if (snakeCaseItem.expense_account_id === '') snakeCaseItem.expense_account_id = null;
    if (snakeCaseItem.tax_category_id === '') snakeCaseItem.tax_category_id = null;

    // Use isInsert: true to exclude generated columns (created_at, updated_at)
    const filteredItem = this.filterToTableSchema('items', snakeCaseItem, true);
    if ((filteredItem as any).id && !this.isValidUUID((filteredItem as any).id)) {
      delete (filteredItem as any).id;
    }
    return this.insertToSupabaseRaw('items', filteredItem);
  }

  async updateItem(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
    
    // Convert empty strings to null for UUID columns
    if (snakeCaseUpdates.income_account_id === '') snakeCaseUpdates.income_account_id = null;
    if (snakeCaseUpdates.expense_account_id === '') snakeCaseUpdates.expense_account_id = null;
    if (snakeCaseUpdates.tax_category_id === '') snakeCaseUpdates.tax_category_id = null;

    const filteredUpdates = this.filterToTableSchema('items', snakeCaseUpdates);
    return this.updateInSupabaseRaw('items', id, filteredUpdates);
  }

  async deleteItem(id: string): Promise<void> {
    return this.deleteFromSupabase('items', id);
  }

  /**
   * Payables CRUD Operations
   */
  async createPayable(payable: any): Promise<any> {
    const snake = this.camelToSnake(payable);
    // Exclude generated columns on insert
    const filtered = this.filterToTableSchema('payables', snake, true);
    if ((filtered as any).id && !this.isValidUUID((filtered as any).id)) {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('payables', filtered);
  }

  async updatePayable(id: string, updates: Partial<any>): Promise<any> {
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('payables', snake);
    return this.updateInSupabaseRaw('payables', id, filtered);
  }

  async deletePayable(id: string): Promise<void> {
    return this.deleteFromSupabase('payables', id);
  }

  // ============================================================================
  // BILL CRUD
  // ============================================================================
  async createBill(bill: any): Promise<any> {
    console.debug('[Supabase] createBill called with:', bill);
    const snake = this.camelToSnake(bill);
    const filtered = this.filterToTableSchema('bills', snake);
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('bills', filtered);
  }

  async updateBill(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateBill called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('bills', snake);
    return this.updateInSupabaseRaw('bills', id, filtered);
  }

  async deleteBill(id: string): Promise<void> {
    console.debug('[Supabase] deleteBill called with:', id);
    return this.deleteFromSupabase('bills', id);
  }

  // ============================================================================
  // BANK ACCOUNT CRUD
  // ============================================================================
  async createBankAccount(account: any): Promise<any> {
    console.debug('[Supabase] createBankAccount called with:', account);
    const snake = this.camelToSnake(account);
    const filtered = this.filterToTableSchema('bank_accounts', snake);
    // Remove id if it's undefined or empty string - let Supabase auto-generate UUID
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('bank_accounts', filtered);
  }

  async updateBankAccount(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateBankAccount called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('bank_accounts', snake);
    return this.updateInSupabaseRaw('bank_accounts', id, filtered);
  }

  async deleteBankAccount(id: string): Promise<void> {
    console.debug('[Supabase] deleteBankAccount called with:', id);
    return this.deleteFromSupabase('bank_accounts', id);
  }

  // ============================================================================
  // BANK RECONCILIATION CRUD
  // ============================================================================
  async createBankReconciliation(reconciliation: any): Promise<any> {
    console.debug('[Supabase] createBankReconciliation called with:', reconciliation);
    const snake = this.camelToSnake(reconciliation);
    const filtered = this.filterToTableSchema('bank_reconciliations', snake);
    // Remove id if it's undefined or empty string - let Supabase auto-generate UUID
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('bank_reconciliations', filtered);
  }

  async updateBankReconciliation(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateBankReconciliation called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('bank_reconciliations', snake);
    return this.updateInSupabaseRaw('bank_reconciliations', id, filtered);
  }

  async deleteBankReconciliation(id: string): Promise<void> {
    console.debug('[Supabase] deleteBankReconciliation called with:', id);
    return this.deleteFromSupabase('bank_reconciliations', id);
  }

  async getBankReconciliationsByAccount(bankAccountId: string): Promise<any[]> {
    console.debug('[Supabase] getBankReconciliationsByAccount called with:', bankAccountId);
    try {
      const url = `${this.baseUrl}/bank_reconciliations?bank_account_id=eq.${bankAccountId}&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch reconciliations');
      }
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching reconciliations:', error);
      return [];
    }
  }

  async getLatestBankReconciliation(bankAccountId: string): Promise<any | null> {
    console.debug('[Supabase] getLatestBankReconciliation called with:', bankAccountId);
    try {
      const url = `${this.baseUrl}/bank_reconciliations?bank_account_id=eq.${bankAccountId}&order=created_at.desc&limit=1`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch latest reconciliation');
      }
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching latest reconciliation:', error);
      return null;
    }
  }

  // ============================================================================
  // RECURRING JOURNAL ENTRY CRUD
  // ============================================================================
  async createRecurringJournalEntry(entry: any): Promise<any> {
    console.debug('[Supabase] createRecurringJournalEntry called with:', entry);
    const snake = this.camelToSnake(entry);
    const filtered = this.filterToTableSchema('recurring_journal_entries', snake);
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('recurring_journal_entries', filtered);
  }

  async updateRecurringJournalEntry(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateRecurringJournalEntry called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('recurring_journal_entries', snake);
    return this.updateInSupabaseRaw('recurring_journal_entries', id, filtered);
  }

  async deleteRecurringJournalEntry(id: string): Promise<void> {
    console.debug('[Supabase] deleteRecurringJournalEntry called with:', id);
    return this.deleteFromSupabase('recurring_journal_entries', id);
  }

  async getRecurringJournalEntriesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getRecurringJournalEntriesByOrg called with:', orgId);
    try {
      const url = `${this.baseUrl}/recurring_journal_entries?org_id=eq.${orgId}&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch recurring entries');
      }
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching recurring entries:', error);
      return [];
    }
  }

  async getRecurringJournalEntryById(id: string): Promise<any | null> {
    console.debug('[Supabase] getRecurringJournalEntryById called with:', id);
    try {
      const url = `${this.baseUrl}/recurring_journal_entries?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch recurring entry');
      }
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching recurring entry:', error);
      return null;
    }
  }

    // ============================================================================
    // RECURRING INVOICE CRUD
    // ============================================================================
    async createRecurringInvoice(invoice: any): Promise<any> {
      console.debug('[Supabase] createRecurringInvoice called with:', invoice);
      const snake = this.camelToSnake(invoice);
      const filtered = this.filterToTableSchema('recurring_invoices', snake);
      if (!filtered.id || filtered.id === '') {
        delete (filtered as any).id;
      }
      return this.insertToSupabaseRaw('recurring_invoices', filtered);
    }

    async updateRecurringInvoice(id: string, updates: any): Promise<any> {
      console.debug('[Supabase] updateRecurringInvoice called with:', id, updates);
      const snake = this.camelToSnake(updates);
      const filtered = this.filterToTableSchema('recurring_invoices', snake);
      return this.updateInSupabaseRaw('recurring_invoices', id, filtered);
    }

    async deleteRecurringInvoice(id: string): Promise<void> {
      console.debug('[Supabase] deleteRecurringInvoice called with:', id);
      return this.deleteFromSupabase('recurring_invoices', id);
    }

    async getRecurringInvoicesByOrg(orgId: string): Promise<any[]> {
      console.debug('[Supabase] getRecurringInvoicesByOrg called with:', orgId);
      try {
        const url = `${this.baseUrl}/recurring_invoices?org_id=eq.${orgId}&order=created_at.desc`;
        const response = await fetch(url, { headers: this.getHeaders() });
        if (!response.ok) {
          if (response.status === 404) {
            return [];
          }
          throw new Error('Failed to fetch recurring invoices');
        }
        const data = await response.json();
        return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
      } catch (error) {
        console.error('[Supabase] Error fetching recurring invoices:', error);
        return [];
      }
    }

    async getRecurringInvoiceById(id: string): Promise<any | null> {
      console.debug('[Supabase] getRecurringInvoiceById called with:', id);
      try {
        const url = `${this.baseUrl}/recurring_invoices?id=eq.${id}`;
        const response = await fetch(url, { headers: this.getHeaders() });
        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error('Failed to fetch recurring invoice');
        }
        const data = await response.json();
        return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
      } catch (error) {
        console.error('[Supabase] Error fetching recurring invoice:', error);
        return null;
      }
    }

  /**
   * Vendor CRUD Operations
   */
  async createVendor(vendor: any): Promise<any> {
    console.debug('[Supabase] createVendor called with:', vendor);
    const snakeCaseVendor = this.camelToSnake(vendor);
    const filtered = this.filterToTableSchema('vendors', snakeCaseVendor, true);
    // Remove id if it's undefined, null, or empty string
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('vendors', filtered);
  }

  async updateVendor(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateVendor called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('vendors', snake);
    return this.updateInSupabaseRaw('vendors', id, filtered);
  }

  async deleteVendor(id: string): Promise<void> {
    console.debug('[Supabase] deleteVendor called with:', id);
    return this.deleteFromSupabase('vendors', id);
  }

  // ============================================================================
  // CHECK VOUCHER CRUD
  // ============================================================================
  async createCheckVoucher(check: any): Promise<any> {
    console.debug('[Supabase] createCheckVoucher called with:', check);
    const snake = this.camelToSnake(check);
    const filtered = this.filterToTableSchema('check_vouchers', snake, true);
    // Remove id if empty - let Supabase auto-generate UUID
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('check_vouchers', filtered);
  }

  async updateCheckVoucher(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateCheckVoucher called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('check_vouchers', snake);
    return this.updateInSupabaseRaw('check_vouchers', id, filtered);
  }

  async deleteCheckVoucher(id: string): Promise<void> {
    console.debug('[Supabase] deleteCheckVoucher called with:', id);
    return this.deleteFromSupabase('check_vouchers', id);
  }

  async getNextCheckNumber(orgId: string, bankAccountId: string): Promise<string> {
    console.debug('[Supabase] getNextCheckNumber called for bank:', bankAccountId);
    try {
      // Get the max check number for this bank account
      const url = `${this.baseUrl}/check_vouchers?org_id=eq.${orgId}&bank_account_id=eq.${bankAccountId}&select=check_number&order=check_number.desc&limit=1`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch check numbers');
      
      const data = await response.json();
      if (data.length === 0) {
        return '000001'; // Start from 1 if no checks exist
      }
      
      const lastNumber = data[0].check_number;
      const numericPart = parseInt(lastNumber.replace(/\D/g, '')) || 0;
      return String(numericPart + 1).padStart(6, '0');
    } catch (error) {
      console.error('[Supabase] Error getting next check number:', error);
      return '000001';
    }
  }

  /**
   * ATC Tax Category Lookups
   */
  async getATCCategories(): Promise<any[]> {
    console.debug('[Supabase] getATCCategories called');
    const url = `${this.baseUrl}/atc_categories?order=code.asc`;
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch ATC categories');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching ATC categories:', error);
      return [];
    }
  }

  async getATCItems(categoryId?: string): Promise<any[]> {
    console.debug('[Supabase] getATCItems called with categoryId:', categoryId);
    const query = categoryId 
      ? `?category_id=eq.${categoryId}&order=atc_code.asc`
      : '?order=atc_code.asc';
    const url = `${this.baseUrl}/atc_items${query}`;
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch ATC items');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching ATC items:', error);
      return [];
    }
  }

  async getATCRates(atcItemId: string): Promise<any[]> {
    console.debug('[Supabase] getATCRates called with atcItemId:', atcItemId);
    const url = `${this.baseUrl}/atc_rates?atc_item_id=eq.${atcItemId}`;
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch ATC rates');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching ATC rates:', error);
      return [];
    }
  }

  /**
   * Exchange Rate CRUD Operations
   */
  async createExchangeRate(rate: any): Promise<any> {
    console.debug('[Supabase] createExchangeRate called with:', rate);
    const snakeCaseRate = this.camelToSnake(rate);
    const filtered = this.filterToTableSchema('exchange_rates', snakeCaseRate, true);
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('exchange_rates', filtered);
  }

  async updateExchangeRate(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateExchangeRate called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('exchange_rates', snake);
    return this.updateInSupabaseRaw('exchange_rates', id, filtered);
  }

  async deleteExchangeRate(id: string): Promise<void> {
    console.debug('[Supabase] deleteExchangeRate called with:', id);
    await this.deleteInSupabaseRaw('exchange_rates', id);
  }

  async getExchangeRatesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getExchangeRatesByOrg called with orgId:', orgId);
    const url = `${this.baseUrl}/exchange_rates?org_id=eq.${orgId}&is_deleted=eq.false&order=effective_date.desc`;
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch exchange rates');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching exchange rates:', error);
      return [];
    }
  }

  async getExchangeRateById(id: string): Promise<any | null> {
    console.debug('[Supabase] getExchangeRateById called with:', id);
    try {
      const url = `${this.baseUrl}/exchange_rates?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch exchange rate');
      }
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching exchange rate:', error);
      return null;
    }
  }

  // Accounting Period CRUD
  async createAccountingPeriod(period: any): Promise<any> {
    console.debug('[Supabase] createAccountingPeriod called with:', period);
    try {
      const payload = this.camelToSnake(period);
      // Remove id field - let Supabase generate it as UUID
      delete payload.id;
      console.debug('[Supabase] Converted payload (id removed):', payload);
      const url = `${this.baseUrl}/accounting_periods`;
      const headers = {
        ...this.getHeaders(),
        'Prefer': 'return=representation'
      };
      console.debug('[Supabase] Posting to:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Supabase] Create failed with status:', response.status, 'Error:', errorText);
        throw new Error(`Failed to create accounting period: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.debug('[Supabase] Create response:', data);
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating accounting period:', error);
      throw error;
    }
  }

  async updateAccountingPeriod(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateAccountingPeriod called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      console.debug('[Supabase] Converted payload:', payload);
      const url = `${this.baseUrl}/accounting_periods?id=eq.${id}`;
      const headers = {
        ...this.getHeaders(),
        'Prefer': 'return=representation'
      };
      const response = await fetch(url, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Supabase] Update failed with status:', response.status, 'Error:', errorText);
        throw new Error(`Failed to update accounting period: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.debug('[Supabase] Update response:', data);
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating accounting period:', error);
      throw error;
    }
  }

  async deleteAccountingPeriod(id: string): Promise<void> {
    console.debug('[Supabase] deleteAccountingPeriod called with id:', id);
    try {
      const url = `${this.baseUrl}/accounting_periods?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete accounting period');
    } catch (error) {
      console.error('[Supabase] Error deleting accounting period:', error);
      throw error;
    }
  }

  async getAccountingPeriodsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getAccountingPeriodsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/accounting_periods?org_id=eq.${orgId}&is_deleted=eq.false&order=start_date.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch accounting periods');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching accounting periods:', error);
      return [];
    }
  }

  async getAccountingPeriodById(id: string): Promise<any | null> {
    console.debug('[Supabase] getAccountingPeriodById called with:', id);
    try {
      const url = `${this.baseUrl}/accounting_periods?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch accounting period');
      }
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching accounting period:', error);
      return null;
    }
  }

  async getAccountingPeriodsByYear(orgId: string, fiscalYear: number): Promise<any[]> {
    console.debug('[Supabase] getAccountingPeriodsByYear called with orgId:', orgId, 'year:', fiscalYear);
    try {
      const url = `${this.baseUrl}/accounting_periods?org_id=eq.${orgId}&fiscal_year=eq.${fiscalYear}&is_deleted=eq.false&order=period_number.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch accounting periods by year');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching accounting periods by year:', error);
      return [];
    }
  }

  // ============================================================================
  // INVENTORY MANAGEMENT CRUD
  // ============================================================================

  // Warehouse Location CRUD
  async createWarehouseLocation(location: any): Promise<any> {
    console.debug('[Supabase] createWarehouseLocation called with:', location);
    try {
      const payload = this.camelToSnake(location);
      delete payload.id;
      const url = `${this.baseUrl}/warehouse_locations`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create warehouse location: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating warehouse location:', error);
      throw error;
    }
  }

  async updateWarehouseLocation(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateWarehouseLocation called with id:', id);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/warehouse_locations?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update warehouse location');
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating warehouse location:', error);
      throw error;
    }
  }

  async deleteWarehouseLocation(id: string): Promise<void> {
    console.debug('[Supabase] deleteWarehouseLocation called with id:', id);
    try {
      const url = `${this.baseUrl}/warehouse_locations?id=eq.${id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
    } catch (error) {
      console.error('[Supabase] Error deleting warehouse location:', error);
      throw error;
    }
  }

  async getWarehouseLocationsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getWarehouseLocationsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/warehouse_locations?org_id=eq.${orgId}&is_deleted=eq.false&order=name.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching warehouse locations:', error);
      return [];
    }
  }

  async getWarehouseLocationById(id: string): Promise<any | null> {
    console.debug('[Supabase] getWarehouseLocationById called with id:', id);
    try {
      const url = `${this.baseUrl}/warehouse_locations?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching warehouse location:', error);
      return null;
    }
  }

  // Stock Item CRUD
  async createStockItem(item: any): Promise<any> {
    console.debug('[Supabase] createStockItem called with:', item);
    try {
      const payload = this.camelToSnake(item);
      delete payload.id;
      const url = `${this.baseUrl}/stock_items`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create stock item: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating stock item:', error);
      throw error;
    }
  }

  async updateStockItem(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateStockItem called with id:', id);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/stock_items?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update stock item');
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating stock item:', error);
      throw error;
    }
  }

  async deleteStockItem(id: string): Promise<void> {
    console.debug('[Supabase] deleteStockItem called with id:', id);
    try {
      const url = `${this.baseUrl}/stock_items?id=eq.${id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
    } catch (error) {
      console.error('[Supabase] Error deleting stock item:', error);
      throw error;
    }
  }

  async getStockItemsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getStockItemsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/stock_items?org_id=eq.${orgId}&is_deleted=eq.false&order=code.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching stock items:', error);
      return [];
    }
  }

  async getStockItemById(id: string): Promise<any | null> {
    console.debug('[Supabase] getStockItemById called with id:', id);
    try {
      const url = `${this.baseUrl}/stock_items?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching stock item:', error);
      return null;
    }
  }

  async getStockItemsByLocation(orgId: string, locationId: string): Promise<any[]> {
    console.debug('[Supabase] getStockItemsByLocation called with orgId:', orgId, 'locationId:', locationId);
    try {
      const url = `${this.baseUrl}/stock_items?org_id=eq.${orgId}&warehouse_location_id=eq.${locationId}&is_deleted=eq.false&order=code.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching stock items by location:', error);
      return [];
    }
  }

  // Inventory Level CRUD
  async createInventoryLevel(level: any): Promise<any> {
    console.debug('[Supabase] createInventoryLevel called with:', level);
    try {
      const payload = this.camelToSnake(level);
      delete payload.id;
      const url = `${this.baseUrl}/inventory_levels`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create inventory level: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating inventory level:', error);
      throw error;
    }
  }

  async updateInventoryLevel(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateInventoryLevel called with id:', id);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/inventory_levels?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update inventory level');
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating inventory level:', error);
      throw error;
    }
  }

  async deleteInventoryLevel(id: string): Promise<void> {
    console.debug('[Supabase] deleteInventoryLevel called with id:', id);
    try {
      const url = `${this.baseUrl}/inventory_levels?id=eq.${id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true })
      });
    } catch (error) {
      console.error('[Supabase] Error deleting inventory level:', error);
      throw error;
    }
  }

  async getInventoryLevelsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getInventoryLevelsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/inventory_levels?org_id=eq.${orgId}&is_deleted=eq.false&order=updated_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching inventory levels:', error);
      return [];
    }
  }

  async getInventoryLevelByItemAndLocation(orgId: string, stockItemId: string, locationId: string): Promise<any | null> {
    console.debug('[Supabase] getInventoryLevelByItemAndLocation called');
    try {
      const url = `${this.baseUrl}/inventory_levels?org_id=eq.${orgId}&stock_item_id=eq.${stockItemId}&warehouse_location_id=eq.${locationId}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching inventory level:', error);
      return null;
    }
  }

  async getStockStatusView(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getStockStatusView called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/v_inventory_status?org_id=eq.${orgId}&order=stock_status.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching stock status view:', error);
      return [];
    }
  }

  // Inventory Transaction CRUD
  async createInventoryTransaction(transaction: any): Promise<any> {
    console.debug('[Supabase] createInventoryTransaction called with:', transaction);
    try {
      const payload = this.camelToSnake(transaction);
      delete payload.id;
      const url = `${this.baseUrl}/inventory_transactions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create inventory transaction: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating inventory transaction:', error);
      throw error;
    }
  }

  async updateInventoryTransaction(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateInventoryTransaction called with id:', id);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/inventory_transactions?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update inventory transaction');
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating inventory transaction:', error);
      throw error;
    }
  }

  async deleteInventoryTransaction(id: string): Promise<void> {
    console.debug('[Supabase] deleteInventoryTransaction called with id:', id);
    try {
      const url = `${this.baseUrl}/inventory_transactions?id=eq.${id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
    } catch (error) {
      console.error('[Supabase] Error deleting inventory transaction:', error);
      throw error;
    }
  }

  async getInventoryTransactionsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getInventoryTransactionsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/inventory_transactions?org_id=eq.${orgId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching inventory transactions:', error);
      return [];
    }
  }

  async getInventoryTransactionById(id: string): Promise<any | null> {
    console.debug('[Supabase] getInventoryTransactionById called with id:', id);
    try {
      const url = `${this.baseUrl}/inventory_transactions?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching inventory transaction:', error);
      return null;
    }
  }

  async getInventoryTransactionsByItem(orgId: string, stockItemId: string): Promise<any[]> {
    console.debug('[Supabase] getInventoryTransactionsByItem called with stockItemId:', stockItemId);
    try {
      const url = `${this.baseUrl}/inventory_transactions?org_id=eq.${orgId}&stock_item_id=eq.${stockItemId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching inventory transactions by item:', error);
      return [];
    }
  }

  // Stock Adjustment CRUD
  async createStockAdjustment(adjustment: any): Promise<any> {
    console.debug('[Supabase] createStockAdjustment called with:', adjustment);
    try {
      const payload = this.camelToSnake(adjustment);
      delete payload.id;
      const url = `${this.baseUrl}/stock_adjustments`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create stock adjustment: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating stock adjustment:', error);
      throw error;
    }
  }

  async updateStockAdjustment(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateStockAdjustment called with id:', id);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/stock_adjustments?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update stock adjustment');
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating stock adjustment:', error);
      throw error;
    }
  }

  async deleteStockAdjustment(id: string): Promise<void> {
    console.debug('[Supabase] deleteStockAdjustment called with id:', id);
    try {
      const url = `${this.baseUrl}/stock_adjustments?id=eq.${id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
    } catch (error) {
      console.error('[Supabase] Error deleting stock adjustment:', error);
      throw error;
    }
  }

  async getStockAdjustmentsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getStockAdjustmentsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/stock_adjustments?org_id=eq.${orgId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching stock adjustments:', error);
      return [];
    }
  }

  async getStockAdjustmentById(id: string): Promise<any | null> {
    console.debug('[Supabase] getStockAdjustmentById called with id:', id);
    try {
      const url = `${this.baseUrl}/stock_adjustments?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching stock adjustment:', error);
      return null;
    }
  }

  async getStockAdjustmentsByItem(orgId: string, stockItemId: string): Promise<any[]> {
    console.debug('[Supabase] getStockAdjustmentsByItem called with stockItemId:', stockItemId);
    try {
      const url = `${this.baseUrl}/stock_adjustments?org_id=eq.${orgId}&stock_item_id=eq.${stockItemId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching stock adjustments by item:', error);
      return [];
    }
  }

  // Reorder Point CRUD
  async createReorderPoint(reorder: any): Promise<any> {
    console.debug('[Supabase] createReorderPoint called with:', reorder);
    try {
      const payload = this.camelToSnake(reorder);
      delete payload.id;
      const url = `${this.baseUrl}/reorder_points`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create reorder point: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating reorder point:', error);
      throw error;
    }
  }

  async updateReorderPoint(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateReorderPoint called with id:', id);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/reorder_points?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update reorder point');
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating reorder point:', error);
      throw error;
    }
  }

  async deleteReorderPoint(id: string): Promise<void> {
    console.debug('[Supabase] deleteReorderPoint called with id:', id);
    try {
      const url = `${this.baseUrl}/reorder_points?id=eq.${id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
    } catch (error) {
      console.error('[Supabase] Error deleting reorder point:', error);
      throw error;
    }
  }

  async getReorderPointsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getReorderPointsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/reorder_points?org_id=eq.${orgId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching reorder points:', error);
      return [];
    }
  }

  async getReorderPointByItem(orgId: string, stockItemId: string): Promise<any | null> {
    console.debug('[Supabase] getReorderPointByItem called with stockItemId:', stockItemId);
    try {
      const url = `${this.baseUrl}/reorder_points?org_id=eq.${orgId}&stock_item_id=eq.${stockItemId}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching reorder point:', error);
      return null;
    }
  }

  async getItemsNeedingReorder(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getItemsNeedingReorder called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/stock_items?org_id=eq.${orgId}&is_deleted=eq.false&order=code.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      // Note: Actual filtering logic should be in the service layer
      // This returns stock items; filter by comparing inventory vs reorder points in code
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching items needing reorder:', error);
      return [];
    }
  }

  // ============================================
  // Revenue Schedule CRUD (Deferred Revenue)
  // ============================================

  async createRevenueSchedule(schedule: any): Promise<any> {
    console.debug('[Supabase] createRevenueSchedule called');
    try {
      const snakeSchedule = this.camelToSnake(schedule);
      const url = `${this.baseUrl}/revenue_schedules`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(snakeSchedule)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create revenue schedule: ${errorText}`);
      }
      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data);
    } catch (error) {
      console.error('[Supabase] Error creating revenue schedule:', error);
      throw error;
    }
  }

  async updateRevenueSchedule(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateRevenueSchedule called with id:', id);
    try {
      const snakeUpdates = this.camelToSnake(updates);
      const url = `${this.baseUrl}/revenue_schedules?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(snakeUpdates)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update revenue schedule: ${errorText}`);
      }
      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data);
    } catch (error) {
      console.error('[Supabase] Error updating revenue schedule:', error);
      throw error;
    }
  }

  async deleteRevenueSchedule(id: string): Promise<void> {
    console.debug('[Supabase] deleteRevenueSchedule called with id:', id);
    try {
      const url = `${this.baseUrl}/revenue_schedules?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete revenue schedule: ${errorText}`);
      }
    } catch (error) {
      console.error('[Supabase] Error deleting revenue schedule:', error);
      throw error;
    }
  }

  async getRevenueSchedulesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getRevenueSchedulesByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/revenue_schedules?org_id=eq.${orgId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching revenue schedules:', error);
      return [];
    }
  }

  async getRevenueScheduleById(id: string): Promise<any | null> {
    console.debug('[Supabase] getRevenueScheduleById called with id:', id);
    try {
      const url = `${this.baseUrl}/revenue_schedules?id=eq.${id}&is_deleted=eq.false`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching revenue schedule by id:', error);
      return null;
    }
  }

  async getRevenueSchedulesByCustomer(orgId: string, customerId: string): Promise<any[]> {
    console.debug('[Supabase] getRevenueSchedulesByCustomer called');
    try {
      const url = `${this.baseUrl}/revenue_schedules?org_id=eq.${orgId}&customer_id=eq.${customerId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching revenue schedules by customer:', error);
      return [];
    }
  }

  // ============================================
  // Revenue Recognition Entry CRUD
  // ============================================

  async createRevenueRecognitionEntry(entry: any): Promise<any> {
    console.debug('[Supabase] createRevenueRecognitionEntry called');
    try {
      const snakeEntry = this.camelToSnake(entry);
      const url = `${this.baseUrl}/revenue_recognition_entries`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(snakeEntry)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create revenue recognition entry: ${errorText}`);
      }
      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data);
    } catch (error) {
      console.error('[Supabase] Error creating revenue recognition entry:', error);
      throw error;
    }
  }

  async updateRevenueRecognitionEntry(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateRevenueRecognitionEntry called with id:', id);
    try {
      const snakeUpdates = this.camelToSnake(updates);
      const url = `${this.baseUrl}/revenue_recognition_entries?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(snakeUpdates)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update revenue recognition entry: ${errorText}`);
      }
      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data);
    } catch (error) {
      console.error('[Supabase] Error updating revenue recognition entry:', error);
      throw error;
    }
  }

  async deleteRevenueRecognitionEntry(id: string): Promise<void> {
    console.debug('[Supabase] deleteRevenueRecognitionEntry called with id:', id);
    try {
      const url = `${this.baseUrl}/revenue_recognition_entries?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete revenue recognition entry: ${errorText}`);
      }
    } catch (error) {
      console.error('[Supabase] Error deleting revenue recognition entry:', error);
      throw error;
    }
  }

  async getRevenueRecognitionEntriesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getRevenueRecognitionEntriesByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/revenue_recognition_entries?org_id=eq.${orgId}&order=recognition_date.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching revenue recognition entries:', error);
      return [];
    }
  }

  async getRevenueRecognitionEntriesBySchedule(scheduleId: string): Promise<any[]> {
    console.debug('[Supabase] getRevenueRecognitionEntriesBySchedule called with scheduleId:', scheduleId);
    try {
      const url = `${this.baseUrl}/revenue_recognition_entries?schedule_id=eq.${scheduleId}&order=recognition_date.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching revenue recognition entries by schedule:', error);
      return [];
    }
  }

  // ============================================================================
  // PAYROLL RUN CRUD
  // ============================================================================

  async createPayrollRun(run: any): Promise<any> {
    console.debug('[Supabase] createPayrollRun called with:', run);
    try {
      const payload = this.camelToSnake(run);
      delete payload.id;
      const url = `${this.baseUrl}/payroll_runs`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create payroll run: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating payroll run:', error);
      throw error;
    }
  }

  async updatePayrollRun(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updatePayrollRun called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/payroll_runs?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update payroll run: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating payroll run:', error);
      throw error;
    }
  }

  async deletePayrollRun(id: string): Promise<void> {
    console.debug('[Supabase] deletePayrollRun called with id:', id);
    try {
      const url = `${this.baseUrl}/payroll_runs?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete payroll run');
    } catch (error) {
      console.error('[Supabase] Error deleting payroll run:', error);
      throw error;
    }
  }

  async getPayrollRunsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getPayrollRunsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/payroll_runs?org_id=eq.${orgId}&is_deleted=eq.false&order=run_date.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching payroll runs:', error);
      return [];
    }
  }

  async getPayrollRunById(id: string): Promise<any | null> {
    console.debug('[Supabase] getPayrollRunById called with id:', id);
    try {
      const url = `${this.baseUrl}/payroll_runs?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching payroll run:', error);
      return null;
    }
  }

  // ============================================================================
  // PAYROLL LINE CRUD
  // ============================================================================

  async createPayrollLine(line: any): Promise<any> {
    console.debug('[Supabase] createPayrollLine called with:', line);
    try {
      const payload = this.camelToSnake(line);
      delete payload.id;
      const url = `${this.baseUrl}/payroll_lines`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create payroll line: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating payroll line:', error);
      throw error;
    }
  }

  async updatePayrollLine(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updatePayrollLine called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/payroll_lines?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update payroll line: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating payroll line:', error);
      throw error;
    }
  }

  async deletePayrollLine(id: string): Promise<void> {
    console.debug('[Supabase] deletePayrollLine called with id:', id);
    try {
      const url = `${this.baseUrl}/payroll_lines?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete payroll line');
    } catch (error) {
      console.error('[Supabase] Error deleting payroll line:', error);
      throw error;
    }
  }

  async getPayrollLinesByRun(runId: string): Promise<any[]> {
    console.debug('[Supabase] getPayrollLinesByRun called with runId:', runId);
    try {
      const url = `${this.baseUrl}/payroll_lines?run_id=eq.${runId}&order=employee_id.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching payroll lines:', error);
      return [];
    }
  }

  async getPayrollLinesByEmployee(employeeId: string): Promise<any[]> {
    console.debug('[Supabase] getPayrollLinesByEmployee called with employeeId:', employeeId);
    try {
      const url = `${this.baseUrl}/payroll_lines?employee_id=eq.${employeeId}&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching payroll lines by employee:', error);
      return [];
    }
  }

  // ============================================================================
  // EMPLOYEE CRUD
  // ============================================================================

  async createEmployee(employee: any): Promise<any> {
    console.debug('[Supabase] createEmployee called with:', employee);
    try {
      const payload = this.camelToSnake(employee);
      delete payload.id;
      const url = `${this.baseUrl}/employees`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create employee: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating employee:', error);
      throw error;
    }
  }

  async updateEmployee(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateEmployee called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/employees?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update employee: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating employee:', error);
      throw error;
    }
  }

  async deleteEmployee(id: string): Promise<void> {
    console.debug('[Supabase] deleteEmployee called with id:', id);
    try {
      const url = `${this.baseUrl}/employees?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete employee');
    } catch (error) {
      console.error('[Supabase] Error deleting employee:', error);
      throw error;
    }
  }

  async getEmployeesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getEmployeesByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/employees?org_id=eq.${orgId}&is_deleted=eq.false&order=last_name.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching employees:', error);
      return [];
    }
  }

  async getEmployeeById(id: string): Promise<any | null> {
    console.debug('[Supabase] getEmployeeById called with id:', id);
    try {
      const url = `${this.baseUrl}/employees?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching employee:', error);
      return null;
    }
  }

  // ============================================================================
  // CHART OF ACCOUNT CRUD
  // ============================================================================

  async createAccount(account: any): Promise<any> {
    console.debug('[Supabase] createAccount called with:', account);
    try {
      const payload = this.camelToSnake(account);
      delete payload.id;
      const url = `${this.baseUrl}/chart_of_accounts`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create account: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating account:', error);
      throw error;
    }
  }

  async updateAccount(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateAccount called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/chart_of_accounts?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update account: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating account:', error);
      throw error;
    }
  }

  async deleteAccount(id: string): Promise<void> {
    console.debug('[Supabase] deleteAccount called with id:', id);
    try {
      const url = `${this.baseUrl}/chart_of_accounts?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete account');
    } catch (error) {
      console.error('[Supabase] Error deleting account:', error);
      throw error;
    }
  }

  async getAccountsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getAccountsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/chart_of_accounts?org_id=eq.${orgId}&is_deleted=eq.false&order=code.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching accounts:', error);
      return [];
    }
  }

  async getAccountById(id: string): Promise<any | null> {
    console.debug('[Supabase] getAccountById called with id:', id);
    try {
      const url = `${this.baseUrl}/chart_of_accounts?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching account:', error);
      return null;
    }
  }

  // ============================================================================
  // JOURNAL ENTRY CRUD
  // ============================================================================

  async createJournalEntry(entry: any): Promise<any> {
    console.debug('[Supabase] createJournalEntry called with:', entry);
    try {
      const payload = this.camelToSnake(entry);
      delete payload.id;
      const url = `${this.baseUrl}/journal_entries`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create journal entry: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating journal entry:', error);
      throw error;
    }
  }

  async updateJournalEntry(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateJournalEntry called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/journal_entries?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update journal entry: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating journal entry:', error);
      throw error;
    }
  }

  async deleteJournalEntry(id: string): Promise<void> {
    console.debug('[Supabase] deleteJournalEntry called with id:', id);
    try {
      const url = `${this.baseUrl}/journal_entries?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete journal entry');
    } catch (error) {
      console.error('[Supabase] Error deleting journal entry:', error);
      throw error;
    }
  }

  async getJournalEntriesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getJournalEntriesByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/journal_entries?org_id=eq.${orgId}&is_deleted=eq.false&order=date.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching journal entries:', error);
      return [];
    }
  }

  async getJournalEntryById(id: string): Promise<any | null> {
    console.debug('[Supabase] getJournalEntryById called with id:', id);
    try {
      const url = `${this.baseUrl}/journal_entries?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching journal entry:', error);
      return null;
    }
  }

  // ============================================================================
  // JOURNAL ENTRY LINE CRUD
  // ============================================================================

  async createJournalLine(line: any): Promise<any> {
    console.debug('[Supabase] createJournalLine called with:', line);
    try {
      const payload = this.camelToSnake(line);
      delete payload.id;
      const url = `${this.baseUrl}/journal_entry_lines`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create journal line: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating journal line:', error);
      throw error;
    }
  }

  async createJournalLines(lines: any[]): Promise<any[]> {
    console.debug('[Supabase] createJournalLines called with:', lines.length, 'lines');
    try {
      const payloads = lines.map(line => {
        const payload = this.camelToSnake(line);
        delete payload.id;
        return payload;
      });
      const url = `${this.baseUrl}/journal_entry_lines`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payloads)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create journal lines: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [this.snakeToCamel(data)];
    } catch (error) {
      console.error('[Supabase] Error creating journal lines:', error);
      throw error;
    }
  }

  async updateJournalLine(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateJournalLine called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/journal_entry_lines?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update journal line: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating journal line:', error);
      throw error;
    }
  }

  async deleteJournalLine(id: string): Promise<void> {
    console.debug('[Supabase] deleteJournalLine called with id:', id);
    try {
      const url = `${this.baseUrl}/journal_entry_lines?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete journal line');
    } catch (error) {
      console.error('[Supabase] Error deleting journal line:', error);
      throw error;
    }
  }

  async getJournalLinesByEntry(entryId: string): Promise<any[]> {
    console.debug('[Supabase] getJournalLinesByEntry called with entryId:', entryId);
    try {
      const url = `${this.baseUrl}/journal_entry_lines?journal_entry_id=eq.${entryId}&order=id.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching journal lines:', error);
      return [];
    }
  }

  // ============================================================================
  // AUDIT LOG CRUD
  // ============================================================================

  async createAuditLog(log: any): Promise<any> {
    console.debug('[Supabase] createAuditLog called with:', log);
    try {
      const payload = this.camelToSnake(log);
      delete payload.id;
      const url = `${this.baseUrl}/audit_logs`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create audit log: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating audit log:', error);
      throw error;
    }
  }

  async getAuditLogsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getAuditLogsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/audit_logs?org_id=eq.${orgId}&order=timestamp.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching audit logs:', error);
      return [];
    }
  }

  // ============================================================================
  // PURCHASE ORDER CRUD
  // ============================================================================

  async createPurchaseOrder(order: any): Promise<any> {
    console.debug('[Supabase] createPurchaseOrder called with:', order);
    try {
      const payload = this.camelToSnake(order);
      delete payload.id;
      const url = `${this.baseUrl}/purchase_orders`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create purchase order: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating purchase order:', error);
      throw error;
    }
  }

  async updatePurchaseOrder(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updatePurchaseOrder called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/purchase_orders?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update purchase order: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating purchase order:', error);
      throw error;
    }
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    console.debug('[Supabase] deletePurchaseOrder called with id:', id);
    try {
      const url = `${this.baseUrl}/purchase_orders?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete purchase order');
    } catch (error) {
      console.error('[Supabase] Error deleting purchase order:', error);
      throw error;
    }
  }

  async getPurchaseOrdersByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getPurchaseOrdersByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/purchase_orders?org_id=eq.${orgId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching purchase orders:', error);
      return [];
    }
  }

  async getPurchaseOrderById(id: string): Promise<any | null> {
    console.debug('[Supabase] getPurchaseOrderById called with id:', id);
    try {
      const url = `${this.baseUrl}/purchase_orders?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching purchase order:', error);
      return null;
    }
  }

  // ============================================================================
  // GOODS RECEIPT CRUD
  // ============================================================================

  async createGoodsReceipt(receipt: any): Promise<any> {
    console.debug('[Supabase] createGoodsReceipt called with:', receipt);
    try {
      const payload = this.camelToSnake(receipt);
      delete payload.id;
      const url = `${this.baseUrl}/goods_receipts`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create goods receipt: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating goods receipt:', error);
      throw error;
    }
  }

  async updateGoodsReceipt(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateGoodsReceipt called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/goods_receipts?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update goods receipt: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating goods receipt:', error);
      throw error;
    }
  }

  async deleteGoodsReceipt(id: string): Promise<void> {
    console.debug('[Supabase] deleteGoodsReceipt called with id:', id);
    try {
      const url = `${this.baseUrl}/goods_receipts?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete goods receipt');
    } catch (error) {
      console.error('[Supabase] Error deleting goods receipt:', error);
      throw error;
    }
  }

  async getGoodsReceiptsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getGoodsReceiptsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/goods_receipts?org_id=eq.${orgId}&is_deleted=eq.false&order=receipt_date.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching goods receipts:', error);
      return [];
    }
  }

  async getGoodsReceiptById(id: string): Promise<any | null> {
    console.debug('[Supabase] getGoodsReceiptById called with id:', id);
    try {
      const url = `${this.baseUrl}/goods_receipts?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching goods receipt:', error);
      return null;
    }
  }

  // ============================================================================
  // RECURRING BILL CRUD
  // ============================================================================

  async createRecurringBill(bill: any): Promise<any> {
    console.debug('[Supabase] createRecurringBill called with:', bill);
    try {
      const payload = this.camelToSnake(bill);
      delete payload.id;
      const url = `${this.baseUrl}/recurring_bills`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create recurring bill: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating recurring bill:', error);
      throw error;
    }
  }

  async updateRecurringBill(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateRecurringBill called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/recurring_bills?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update recurring bill: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating recurring bill:', error);
      throw error;
    }
  }

  async deleteRecurringBill(id: string): Promise<void> {
    console.debug('[Supabase] deleteRecurringBill called with id:', id);
    try {
      const url = `${this.baseUrl}/recurring_bills?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete recurring bill');
    } catch (error) {
      console.error('[Supabase] Error deleting recurring bill:', error);
      throw error;
    }
  }

  async getRecurringBillsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getRecurringBillsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/recurring_bills?org_id=eq.${orgId}&order=next_due_date.asc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching recurring bills:', error);
      return [];
    }
  }

  async getRecurringBillById(id: string): Promise<any | null> {
    console.debug('[Supabase] getRecurringBillById called with id:', id);
    try {
      const url = `${this.baseUrl}/recurring_bills?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching recurring bill:', error);
      return null;
    }
  }

  // ============================================================================
  // EFT BATCH CRUD
  // ============================================================================

  async createEFTBatch(batch: any): Promise<any> {
    console.debug('[Supabase] createEFTBatch called with:', batch);
    try {
      const payload = this.camelToSnake(batch);
      delete payload.id;
      const url = `${this.baseUrl}/eft_batches`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create EFT batch: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating EFT batch:', error);
      throw error;
    }
  }

  async updateEFTBatch(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateEFTBatch called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/eft_batches?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update EFT batch: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating EFT batch:', error);
      throw error;
    }
  }

  async deleteEFTBatch(id: string): Promise<void> {
    console.debug('[Supabase] deleteEFTBatch called with id:', id);
    try {
      const url = `${this.baseUrl}/eft_batches?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete EFT batch');
    } catch (error) {
      console.error('[Supabase] Error deleting EFT batch:', error);
      throw error;
    }
  }

  async getEFTBatchesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getEFTBatchesByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/eft_batches?org_id=eq.${orgId}&order=created_at.desc`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching EFT batches:', error);
      return [];
    }
  }

  async getEFTBatchById(id: string): Promise<any | null> {
    console.debug('[Supabase] getEFTBatchById called with id:', id);
    try {
      const url = `${this.baseUrl}/eft_batches?id=eq.${id}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching EFT batch:', error);
      return null;
    }
  }
}

