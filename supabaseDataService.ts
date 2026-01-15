import { supabase, Database } from './supabase';
import { 
  Organization, 
  User, 
  ChartOfAccount, 
  JournalEntry, 
  JournalEntryLine,
  AccountClass,
  Student,
  Trainer,
  Qualification,
  Batch,
  BatchStatus,
  Vendor,
  FixedAsset,
  BankAccount,
  Location,
  TaxCategory,
  WHTCategory,
  NonStockItem,
  Sponsor,
  TrainerSchedule,
  AuditLog
} from './types';

export const COA_TEMPLATE = (orgId: string): ChartOfAccount[] => [
  { id: `1000-${orgId}`, orgId, code: '1000', name: 'ASSETS', class: AccountClass.ASSET, isHeader: true, isActive: true },
  { id: `1100-${orgId}`, orgId, code: '1100', name: 'BDO Checking Account', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: false, isActive: true },
  { id: `1101-${orgId}`, orgId, code: '1101', name: 'Petty Cash', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: false, isActive: true },
  { id: `1200-${orgId}`, orgId, code: '1200', name: 'Accounts Receivable', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: false, isActive: true },
  { id: `1210-${orgId}`, orgId, code: '1210', name: 'Input VAT', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: false, isActive: true },
  { id: `1500-${orgId}`, orgId, code: '1500', name: 'Property, Plant & Equipment', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: true, isActive: true },
  { id: `1510-${orgId}`, orgId, code: '1510', name: 'Building & Improvements (Cost)', class: AccountClass.ASSET, parentId: `1500-${orgId}`, isHeader: false, isActive: true },
  { id: `1520-${orgId}`, orgId, code: '1520', name: 'Furniture & Fixtures (Cost)', class: AccountClass.ASSET, parentId: `1500-${orgId}`, isHeader: false, isActive: true },
  { id: `1530-${orgId}`, orgId, code: '1530', name: 'Office & IT Equipment (Cost)', class: AccountClass.ASSET, parentId: `1500-${orgId}`, isHeader: false, isActive: true },
  { id: `1540-${orgId}`, orgId, code: '1540', name: 'Service Vehicles (Cost)', class: AccountClass.ASSET, parentId: `1500-${orgId}`, isHeader: false, isActive: true },
  { id: `1600-${orgId}`, orgId, code: '1600', name: 'Accumulated Depreciation', class: AccountClass.ASSET, parentId: `1000-${orgId}`, isHeader: true, isActive: true },
  { id: `1610-${orgId}`, orgId, code: '1610', name: 'Acc. Depr - Building', class: AccountClass.ASSET, parentId: `1600-${orgId}`, isHeader: false, isActive: true },
  { id: `1620-${orgId}`, orgId, code: '1620', name: 'Acc. Depr - Furniture', class: AccountClass.ASSET, parentId: `1600-${orgId}`, isHeader: false, isActive: true },
  { id: `1630-${orgId}`, orgId, code: '1630', name: 'Acc. Depr - Office/IT', class: AccountClass.ASSET, parentId: `1600-${orgId}`, isHeader: false, isActive: true },
  { id: `1640-${orgId}`, orgId, code: '1640', name: 'Acc. Depr - Vehicles', class: AccountClass.ASSET, parentId: `1600-${orgId}`, isHeader: false, isActive: true },
  { id: `2000-${orgId}`, orgId, code: '2000', name: 'LIABILITIES', class: AccountClass.LIABILITY, isHeader: true, isActive: true },
  { id: `2100-${orgId}`, orgId, code: '2100', name: 'Accounts Payable', class: AccountClass.LIABILITY, parentId: `2000-${orgId}`, isHeader: false, isActive: true },
  { id: `2200-${orgId}`, orgId, code: '2200', name: 'Output VAT Payable', class: AccountClass.LIABILITY, parentId: `2000-${orgId}`, isHeader: false, isActive: true },
  { id: `2300-${orgId}`, orgId, code: '2300', name: 'EWT Payable', class: AccountClass.LIABILITY, parentId: `2000-${orgId}`, isHeader: false, isActive: true },
  { id: `3000-${orgId}`, orgId, code: '3000', name: 'EQUITY', class: AccountClass.EQUITY, isHeader: true, isActive: true },
  { id: `3100-${orgId}`, orgId, code: '3100', name: 'Retained Earnings', class: AccountClass.EQUITY, parentId: `3000-${orgId}`, isHeader: false, isActive: true },
  { id: `3200-${orgId}`, orgId, code: '3200', name: "Owner's Capital", class: AccountClass.EQUITY, parentId: `3000-${orgId}`, isHeader: false, isActive: true },
  { id: `3300-${orgId}`, orgId, code: '3300', name: "Owner's Drawings", class: AccountClass.EQUITY, parentId: `3000-${orgId}`, isHeader: false, isActive: true },
  { id: `4000-${orgId}`, orgId, code: '4000', name: 'REVENUE', class: AccountClass.REVENUE, isHeader: true, isActive: true },
  { id: `4100-${orgId}`, orgId, code: '4100', name: 'Training Revenue', class: AccountClass.REVENUE, parentId: `4000-${orgId}`, isHeader: false, isActive: true },
  { id: `4200-${orgId}`, orgId, code: '4200', name: 'Books & Materials Revenue', class: AccountClass.REVENUE, parentId: `4000-${orgId}`, isHeader: false, isActive: true },
  { id: `5000-${orgId}`, orgId, code: '5000', name: 'EXPENSES', class: AccountClass.EXPENSE, isHeader: true, isActive: true },
  { id: `5100-${orgId}`, orgId, code: '5100', name: 'Depreciation Expense', class: AccountClass.EXPENSE, parentId: `5000-${orgId}`, isHeader: false, isActive: true },
  { id: `5200-${orgId}`, orgId, code: '5200', name: 'Office Supplies Expense', class: AccountClass.EXPENSE, parentId: `5000-${orgId}`, isHeader: false, isActive: true },
  { id: `5300-${orgId}`, orgId, code: '5300', name: 'Utilities Expense', class: AccountClass.EXPENSE, parentId: `5000-${orgId}`, isHeader: false, isActive: true },
  { id: `5400-${orgId}`, orgId, code: '5400', name: 'Professional Fees', class: AccountClass.EXPENSE, parentId: `5000-${orgId}`, isHeader: false, isActive: true },
];

export class SupabaseDataService {
  // Organizations
  static async getOrganizations(): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return data.map(org => ({
      id: org.id,
      name: org.name,
      currency: org.currency,
      isVatRegistered: org.is_vat_registered,
      subscriptionStatus: org.subscription_status,
      planType: org.plan_type,
      licenseExpiry: org.license_expiry,
      createdAt: org.created_at,
      primaryColor: org.primary_color
    }));
  }

  static async createOrganization(org: Omit<Organization, 'id' | 'createdAt'>): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: org.name,
        currency: org.currency,
        is_vat_registered: org.isVatRegistered,
        subscription_status: org.subscriptionStatus,
        plan_type: org.planType,
        license_expiry: org.licenseExpiry,
        primary_color: org.primaryColor
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      currency: data.currency,
      isVatRegistered: data.is_vat_registered,
      subscriptionStatus: data.subscription_status,
      planType: data.plan_type,
      licenseExpiry: data.license_expiry,
      createdAt: data.created_at,
      primaryColor: data.primary_color
    };
  }

  // Users
  static async getUsers(orgId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return data.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role as any,
      orgId: user.org_id
    }));
  }

  static async createUser(user: Omit<User, 'id'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert({
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        org_id: user.orgId
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role as any,
      orgId: data.org_id
    };
  }

  // Chart of Accounts
  static async getChartOfAccounts(orgId: string): Promise<ChartOfAccount[]> {
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('org_id', orgId)
      .order('code', { ascending: true });
    
    if (error) throw error;
    
    return data.map(coa => ({
      id: coa.id,
      orgId: coa.org_id,
      code: coa.code,
      name: coa.name,
      class: coa.class as AccountClass,
      parentId: coa.parent_id,
      isHeader: coa.is_header,
      isActive: coa.is_active
    }));
  }

  static async createChartOfAccount(coa: Omit<ChartOfAccount, 'id'>): Promise<ChartOfAccount> {
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert({
        org_id: coa.orgId,
        code: coa.code,
        name: coa.name,
        class: coa.class,
        parent_id: coa.parentId,
        is_header: coa.isHeader,
        is_active: coa.isActive
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      orgId: data.org_id,
      code: data.code,
      name: data.name,
      class: data.class as AccountClass,
      parentId: data.parent_id,
      isHeader: data.is_header,
      isActive: data.is_active
    };
  }

  // Journal Entries
  static async getJournalEntries(orgId: string): Promise<JournalEntry[]> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('org_id', orgId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    return data.map(entry => ({
      id: entry.id,
      orgId: entry.org_id,
      periodId: entry.period_id,
      date: entry.date,
      description: entry.description,
      reference: entry.reference,
      status: entry.status as any,
      createdBy: entry.created_by,
      createdAt: entry.created_at,
      sourceType: entry.source_type as any
    }));
  }

  static async createJournalEntry(entry: Omit<JournalEntry, 'id' | 'createdAt'>): Promise<JournalEntry> {
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        org_id: entry.orgId,
        period_id: entry.periodId,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        status: entry.status,
        created_by: entry.createdBy,
        source_type: entry.sourceType
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      orgId: data.org_id,
      periodId: data.period_id,
      date: data.date,
      description: data.description,
      reference: data.reference,
      status: data.status as any,
      createdBy: data.created_by,
      createdAt: data.created_at,
      sourceType: data.source_type as any
    };
  }

  // Journal Entry Lines
  static async getJournalEntryLines(journalEntryId: string): Promise<JournalEntryLine[]> {
    const { data, error } = await supabase
      .from('journal_entry_lines')
      .select('*')
      .eq('journal_entry_id', journalEntryId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return data.map(line => ({
      id: line.id,
      journalEntryId: line.journal_entry_id,
      accountId: line.account_id,
      debit: line.debit,
      credit: line.credit,
      memo: line.memo
    }));
  }

  static async createJournalEntryLine(line: Omit<JournalEntryLine, 'id' | 'createdAt'>): Promise<JournalEntryLine> {
    const { data, error } = await supabase
      .from('journal_entry_lines')
      .insert({
        journal_entry_id: line.journalEntryId,
        account_id: line.accountId,
        debit: line.debit,
        credit: line.credit,
        memo: line.memo
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      journalEntryId: data.journal_entry_id,
      accountId: data.account_id,
      debit: data.debit,
      credit: data.credit,
      memo: data.memo
    };
  }

  // Students
  static async getStudents(orgId: string): Promise<Student[]> {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data.map(student => ({
      id: student.id,
      orgId: student.org_id,
      uli: student.uli,
      lastName: student.last_name,
      firstName: student.first_name,
      middleName: student.middle_name,
      extension: student.extension,
      sex: student.sex,
      dateOfBirth: student.date_of_birth,
      age: student.age,
      birthRegion: student.birth_region,
      birthProvince: student.birth_province,
      birthCity: student.birth_city,
      civilStatus: student.civil_status,
      educationalAttainment: student.educational_attainment,
      nationality: student.nationality,
      email: student.email,
      contactNumber: student.contact_number,
      street: student.street,
      barangay: student.barangay,
      city: student.city,
      district: student.district,
      province: student.province,
      guardian: student.guardian,
      documents: student.documents,
      createdAt: student.created_at
    }));
  }

  static async createStudent(student: Omit<Student, 'id' | 'createdAt'>): Promise<Student> {
    const { data, error } = await supabase
      .from('students')
      .insert({
        org_id: student.orgId,
        uli: student.uli,
        last_name: student.lastName,
        first_name: student.firstName,
        middle_name: student.middleName,
        extension: student.extension,
        sex: student.sex,
        date_of_birth: student.dateOfBirth,
        birth_region: student.birthRegion,
        birth_province: student.birthProvince,
        birth_city: student.birthCity,
        civil_status: student.civilStatus,
        educational_attainment: student.educationalAttainment,
        nationality: student.nationality,
        email: student.email,
        contact_number: student.contactNumber,
        street: student.street,
        barangay: student.barangay,
        city: student.city,
        district: student.district,
        province: student.province,
        guardian: student.guardian,
        documents: student.documents
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      orgId: data.org_id,
      uli: data.uli,
      lastName: data.last_name,
      firstName: data.first_name,
      middleName: data.middle_name,
      extension: data.extension,
      sex: data.sex,
      dateOfBirth: data.date_of_birth,
      age: data.age,
      birthRegion: data.birth_region,
      birthProvince: data.birth_province,
      birthCity: data.birth_city,
      civilStatus: data.civil_status,
      educationalAttainment: data.educational_attainment,
      nationality: data.nationality,
      email: data.email,
      contactNumber: data.contact_number,
      street: data.street,
      barangay: data.barangay,
      city: data.city,
      district: data.district,
      province: data.province,
      guardian: data.guardian,
      documents: data.documents,
      createdAt: data.created_at
    };
  }

  // Trainers
  static async getTrainers(orgId: string): Promise<Trainer[]> {
    const { data, error } = await supabase
      .from('trainers')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return data.map(trainer => ({
      id: trainer.id,
      orgId: trainer.org_id,
      firstName: trainer.first_name,
      lastName: trainer.last_name,
      middleName: trainer.middle_name,
      email: trainer.email,
      contactNumber: trainer.contact_number,
      specialization: trainer.specialization,
      qualificationIds: trainer.qualification_ids,
      createdAt: trainer.created_at
    }));
  }

  // Qualifications
  static async getQualifications(orgId: string): Promise<Qualification[]> {
    const { data, error } = await supabase
      .from('qualifications')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return data.map(qual => ({
      id: qual.id,
      orgId: qual.org_id,
      code: qual.code,
      name: qual.name,
      durationDays: qual.duration_days,
      sector: qual.sector,
      createdAt: qual.created_at
    }));
  }

  // Batches
  static async getBatches(orgId: string): Promise<Batch[]> {
    const { data, error } = await supabase
      .from('batches')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data.map(batch => ({
      id: batch.id,
      orgId: batch.org_id,
      name: batch.name,
      year: batch.year,
      qualificationId: batch.qualification_id,
      trainerId: batch.trainer_id,
      sponsorId: batch.sponsor_id,
      scheduleId: batch.schedule_id,
      locationId: batch.location_id,
      studentIds: batch.student_ids,
      status: batch.status as BatchStatus,
      startDate: batch.start_date,
      endDate: batch.end_date,
      createdAt: batch.created_at
    }));
  }

  // Helper method to seed initial data
  static async seedInitialData(): Promise<void> {
    // This would be used to populate the database with initial data
    // You can call this after setting up your Supabase project
    console.log('Seeding initial data...');
    // Implementation would go here
  }
}
