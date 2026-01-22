
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
        this.fetchFromSupabase('payment_histories'),
        this.fetchFromSupabase('fixed_assets'),
        this.fetchFromSupabase('vendor_tax_settings'),
        this.fetchFromSupabase('atc_categories'),
        this.fetchFromSupabase('atc_items'),
        this.fetchFromSupabase('atc_rates'),
        this.fetchFromSupabase('payables'),
        this.fetchFromSupabase('bills'),
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
   */
  private snakeToCamel(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.snakeToCamel(item));

    const camelCaseObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Convert snake_case to camelCase: is_vat_registered → isVatRegistered
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        camelCaseObj[camelKey] = obj[key];
      }
    }
    return camelCaseObj;
  }

  /**
   * Convert camelCase object keys to snake_case
   * Used because Supabase tables use snake_case column names
   */
  private camelToSnake(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.camelToSnake(item));

    const snakeCaseObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Convert camelCase to snake_case: isVatRegistered → is_vat_registered
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snakeCaseObj[snakeKey] = obj[key];
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
      schedules: ['id', 'org_id', 'trainer_id', 'location_id', 'slots', 'is_deleted', 'deleted_at', 'deleted_by', 'created_at', 'updated_at'],
      sponsors: ['id', 'org_id', 'name', 'contact_person', 'email', 'phone', 'address', 'created_at', 'updated_at'],
      batches: ['id', 'org_id', 'batch_code', 'name', 'year', 'qualification_id', 'trainer_id', 'sponsor_id', 'location_id', 'student_ids', 'status', 'start_date', 'end_date', 'max_students', 'current_students', 'created_at', 'updated_at'],
      vendors: ['id', 'org_id', 'name', 'category', 'email', 'contact_number', 'address', 'ap_account_id', 'created_at', 'updated_at'],
      atc_categories: ['id', 'code', 'name', 'created_at', 'updated_at'],
      atc_items: ['id', 'category_id', 'atc_code', 'description', 'taxpayer_type', 'created_at', 'updated_at'],
      atc_rates: ['id', 'atc_item_id', 'rate', 'rate_label', 'created_at', 'updated_at'],
      bank_accounts: ['id', 'org_id', 'bank_name', 'account_number', 'type', 'gl_account_id', 'currency', 'balance', 'created_at', 'updated_at'],
      fixed_assets: ['id', 'org_id', 'code', 'name', 'description', 'category', 'purchase_date', 'purchase_cost', 'accumulated_depreciation', 'depreciation_method', 'useful_life_years', 'gl_account_id', 'created_at', 'updated_at'],
      items: ['id', 'org_id', 'code', 'name', 'description', 'unit_price', 'income_account_id', 'expense_account_id', 'created_at', 'updated_at'],
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
    if (snakeCaseStudent.documents && Array.isArray(snakeCaseStudent.documents)) {
      snakeCaseStudent.documents = snakeCaseStudent.documents
        .map((doc: any) => typeof doc === 'string' ? doc : doc.name || doc.id)
        .filter(Boolean);
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
    if (snakeCaseUpdates.documents && Array.isArray(snakeCaseUpdates.documents)) {
      snakeCaseUpdates.documents = snakeCaseUpdates.documents
        .map((doc: any) => typeof doc === 'string' ? doc : doc.name || doc.id)
        .filter(Boolean);
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
    // Use isInsert: true to exclude generated columns (created_at, updated_at)
    const filteredItem = this.filterToTableSchema('items', snakeCaseItem, true);
    if ((filteredItem as any).id && !this.isValidUUID((filteredItem as any).id)) {
      delete (filteredItem as any).id;
    }
    return this.insertToSupabaseRaw('items', filteredItem);
  }

  async updateItem(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
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
}
