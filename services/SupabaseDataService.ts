
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
      console.warn("[Supabase] ⚠️ Credentials not configured. Using mock data as fallback.");
      return this.mockFallback.getInitialData();
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
      ]);

      // Check if we got any real data
      const hasData = organizations && organizations.length > 0;
      
      if (!hasData) {
        console.warn("[Supabase] ⚠️ No data received from Supabase, using mock data as fallback");
        return this.mockFallback.getInitialData();
      }

      console.info("[Supabase] ✅ Data loaded successfully from Supabase");

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
      };
    } catch (error) {
      console.error("[Supabase] ❌ Fatal error loading data:", error);
      console.error("[Supabase] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.info("[Supabase] 🔄 Falling back to mock data");
      return this.mockFallback.getInitialData();
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
      console.warn(`[Supabase] Missing credentials for table '${table}', delegating to mock`);
      return data;
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
      console.warn(`[Supabase] Missing credentials for table '${table}', delegating to mock`);
      return updates as T;
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
      console.warn(`[Supabase] Missing credentials for table '${table}', delegating to mock`);
      return;
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
   * Filter object to only include valid columns for a given table
   * Removes fields that don't exist in Supabase schema
   */
  private filterToTableSchema(table: string, data: any): any {
    const validColumns: Record<string, string[]> = {
      students: [
        'id', 'org_id', 'uli', 'last_name', 'first_name', 'middle_name', 'extension',
        'sex', 'date_of_birth', 'birth_region', 'birth_province', 'birth_city',
        'civil_status', 'educational_attainment', 'nationality', 'email', 'contact_number',
        'street', 'barangay', 'city', 'district', 'province', 'guardian',
        'location_id', 'sponsor_id', 'documents', 'created_at', 'updated_at'
      ],
      organizations: ['id', 'name', 'currency', 'tax_id', 'is_vat_registered', 'subscription_status', 'plan_type', 'pending_plan_type', 'payment_reference', 'license_expiry', 'created_at', 'primary_color', 'logo_url'],
      users: ['id', 'name', 'email', 'password', 'role', 'org_id', 'student_id', 'trainer_id', 'created_at'],
      trainers: ['id', 'org_id', 'first_name', 'last_name', 'email', 'contact_number', 'created_at', 'updated_at'],
      employees: ['id', 'org_id', 'first_name', 'last_name', 'designation', 'tin', 'sss', 'philhealth', 'pagibig', 'basic_salary', 'bank_name', 'bank_account', 'is_active', 'created_at', 'updated_at'],
    };

    const allowedColumns = validColumns[table] || [];
    const filtered: any = {};

    for (const col of allowedColumns) {
      if (data.hasOwnProperty(col)) {
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
  // USER CRUD
  // ============================================================================

  async createUser(user: any): Promise<any> {
    const snakeCaseUser = this.camelToSnake(user);
    const filteredUser = this.filterToTableSchema('users', snakeCaseUser);
    if ((filteredUser as any).id && !this.isValidUUID((filteredUser as any).id)) {
      delete (filteredUser as any).id;
    }
    return this.insertToSupabaseRaw('users', filteredUser);
  }

  async updateUser(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('users', snakeCaseUpdates);
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
  
  /**
   * Insert data that's already in snake_case (no conversion applied)
   */
  private async insertToSupabaseRaw<T>(table: string, data: T): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn(`[Supabase] Missing credentials for table '${table}', delegating to mock`);
      return data;
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}`;
      const jsonBody = JSON.stringify(data);
      
      console.debug(`[Supabase] POST to ${url}`, {
        bodyLength: jsonBody.length,
        bodyPreview: jsonBody.substring(0, 200),
        keys: Object.keys(data as any),
        hasAge: 'age' in (data as any),
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: jsonBody,  // Data is already snake_case, no conversion needed
      });

      if (!response.ok) {
        console.error(`[Supabase] Error inserting into ${table}: ${response.status} ${response.statusText}`);
        const error = await response.text();
        console.error(`[Supabase] Full Request Body:`, jsonBody);
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
  
  /**
   * Update data that's already in snake_case (no conversion applied)
   */
  private async updateInSupabaseRaw<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn(`[Supabase] Missing credentials for table '${table}', delegating to mock`);
      return updates as T;
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}?id=eq.${id}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(updates),  // Data is already snake_case, no conversion needed
      });

      if (!response.ok) {
        console.error(`[Supabase] Error updating ${table}: ${response.status} ${response.statusText}`);
        const error = await response.text();
        console.error(`[Supabase] Response: ${error}`);
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
  // BATCH CRUD
  // ============================================================================

  async createBatch(batch: any): Promise<any> {
    const snakeCaseBatch = this.camelToSnake(batch);
    const filteredBatch = this.filterToTableSchema('batches', snakeCaseBatch);
    if ((filteredBatch as any).id && !this.isValidUUID((filteredBatch as any).id)) {
      delete (filteredBatch as any).id;
    }
    return this.insertToSupabaseRaw('batches', filteredBatch);
  }

  async updateBatch(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('batches', snakeCaseUpdates);
    return this.updateInSupabaseRaw('batches', id, filteredUpdates);
  }

  async deleteBatch(id: string): Promise<void> {
    return this.deleteFromSupabase('batches', id);
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
}
