import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types based on our schema
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          currency: string;
          is_vat_registered: boolean;
          subscription_status: string;
          plan_type: string;
          license_expiry?: string;
          created_at: string;
          primary_color: string;
        };
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          email: string;
          password_hash: string;
          salt: string;
          role: string;
          last_login_at?: string;
          is_active: boolean;
          failed_login_attempts: number;
          locked_until?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      chart_of_accounts: {
        Row: {
          id: string;
          org_id: string;
          code: string;
          name: string;
          class: string;
          parent_id?: string;
          is_header: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chart_of_accounts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['chart_of_accounts']['Insert']>;
      };
      journal_entries: {
        Row: {
          id: string;
          org_id: string;
          date: string;
          description: string;
          reference?: string;
          created_at: string;
          created_by: string;
        };
        Insert: Omit<Database['public']['Tables']['journal_entries']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['journal_entries']['Insert']>;
      };
      journal_entry_lines: {
        Row: {
          id: string;
          entry_id: string;
          account_id: string;
          debit: number;
          credit: number;
          description?: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['journal_entry_lines']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['journal_entry_lines']['Insert']>;
      };
      students: {
        Row: {
          id: string;
          org_id: string;
          uli: string;
          last_name: string;
          first_name: string;
          middle_name?: string;
          extension?: string;
          sex: string;
          date_of_birth: string;
          age: number;
          birth_region: string;
          birth_province: string;
          birth_city: string;
          civil_status: string;
          educational_attainment: string;
          nationality: string;
          email: string;
          contact_number: string;
          street: string;
          barangay: string;
          city: string;
          district: string;
          province: string;
          guardian?: string;
          documents: string[];
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['students']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['students']['Insert']>;
      };
      trainers: {
        Row: {
          id: string;
          org_id: string;
          first_name: string;
          last_name: string;
          middle_name?: string;
          email: string;
          contact_number: string;
          specialization: string;
          qualification_ids: string[];
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['trainers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['trainers']['Insert']>;
      };
      qualifications: {
        Row: {
          id: string;
          org_id: string;
          code: string;
          name: string;
          duration_days: number;
          sector: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['qualifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['qualifications']['Insert']>;
      };
      batches: {
        Row: {
          id: string;
          org_id: string;
          qualification_id: string;
          trainer_id: string;
          batch_code: string;
          start_date: string;
          end_date: string;
          status: string;
          max_students: number;
          current_students: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['batches']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['batches']['Insert']>;
      };
    };
  };
}
