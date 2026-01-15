// =====================================================
// AT-ERP MIGRATION AUTOMATION SCRIPT
// Node.js script to automate migration from in-memory to Supabase
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

// Configuration
const config_data = {
    supabaseUrl: process.env.VITE_SUPABASE_URL || 'your_supabase_url',
    supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || 'your_supabase_key',
    backupPath: './backups',
    migrationLogPath: './migration-logs'
};

// Initialize Supabase client
const supabase = createClient(config_data.supabaseUrl, config_data.supabaseKey);

// Migration Logger
class MigrationLogger {
    static log(step, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] STEP ${step}: ${message}${data ? ' | Data: ' + JSON.stringify(data, null, 2) : ''}`;
        console.log(logEntry);
        
        // Write to log file
        const logFileName = `migration-${new Date().toISOString().split('T')[0]}.log`;
        try {
            writeFileSync(join(config_data.migrationLogPath, logFileName), logEntry + '\n', { flag: 'a' });
        } catch (error) {
            console.error('Failed to write log:', error);
        }
    }

    static error(step, message, error) {
        this.log(step, `ERROR: ${message}`, { error: error.message });
    }

    static success(step, message) {
        this.log(step, `SUCCESS: ${message}`);
    }

    static warning(step, message) {
        this.log(step, `WARNING: ${message}`);
    }
}

// Data Backup Utility
class DataBackup {
    static async backupData(data, fileName) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${fileName}-${timestamp}.json`;
            const backupPath = join(config_data.backupPath, backupFileName);
            
            writeFileSync(backupPath, JSON.stringify(data, null, 2));
            MigrationLogger.success('BACKUP', `Backed up ${fileName} to ${backupPath}`);
            return backupPath;
        } catch (error) {
            MigrationLogger.error('BACKUP', `Failed to backup ${fileName}`, error);
            throw error;
        }
    }

    static async backupCurrentSystem() {
        MigrationLogger.log('BACKUP', 'Starting system backup...');
        
        // This would connect to your current data source
        // For now, simulating backup of existing data structure
        const systemData = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            data: {
                organizations: [], // Your current orgs
                users: [], // Your current users
                students: [], // Your current students
                chartOfAccounts: [], // Your current COA
                journalEntries: [], // Your current entries
                // ... other entities
            }
        };
        
        return await this.backupData(systemData, 'system-backup');
    }
}

// Migration Engine
class MigrationEngine {
    constructor() {
        this.migrationStats = {
            organizations: 0,
            users: 0,
            students: 0,
            chartOfAccounts: 0,
            journalEntries: 0,
            journalLines: 0,
            errors: 0,
            warnings: 0
        };
    }

    async createOrganization(orgData) {
        try {
            const { data, error } = await supabase
                .from('organizations')
                .insert({
                    name: orgData.name,
                    currency: orgData.currency || 'PHP',
                    is_vat_registered: orgData.isVatRegistered || true,
                    subscription_status: orgData.subscriptionStatus || 'TRIAL',
                    plan_type: orgData.planType || 'BASIC',
                    primary_color: orgData.primaryColor || '#4f46e5',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            this.migrationStats.organizations++;
            MigrationLogger.success('ORG', `Created organization: ${orgData.name}`);
            return data;
        } catch (error) {
            this.migrationStats.errors++;
            MigrationLogger.error('ORG', `Failed to create organization: ${orgData.name}`, error);
            throw error;
        }
    }

    async createChartOfAccounts(orgId) {
        const coaTemplate = [
            { code: '1000', name: 'ASSETS', class: 'ASSET', is_header: true, is_active: true },
            { code: '1100', name: 'BDO Checking Account', class: 'ASSET', parent_code: '1000', is_header: false, is_active: true },
            { code: '1101', name: 'Petty Cash', class: 'ASSET', parent_code: '1000', is_header: false, is_active: true },
            { code: '1200', name: 'Accounts Receivable', class: 'ASSET', parent_code: '1000', is_header: false, is_active: true },
            { code: '2000', name: 'LIABILITIES', class: 'LIABILITY', is_header: true, is_active: true },
            { code: '2100', name: 'Accounts Payable', class: 'LIABILITY', parent_code: '2000', is_header: false, is_active: true },
            { code: '3000', name: 'EQUITY', class: 'EQUITY', is_header: true, is_active: true },
            { code: '3100', name: 'Retained Earnings', class: 'EQUITY', parent_code: '3000', is_header: false, is_active: true },
            { code: '3200', name: "Owner's Capital", class: 'EQUITY', parent_code: '3000', is_header: false, is_active: true },
            { code: '4000', name: 'REVENUE', class: 'REVENUE', is_header: true, is_active: true },
            { code: '4100', name: 'Training Revenue', class: 'REVENUE', parent_code: '4000', is_header: false, is_active: true },
            { code: '5000', name: 'EXPENSES', class: 'EXPENSE', is_header: true, is_active: true },
            { code: '5100', name: 'Depreciation Expense', class: 'EXPENSE', parent_code: '5000', is_header: false, is_active: true }
        ];

        const createdAccounts = [];
        const parentMap = new Map();

        // First pass: Create all accounts
        for (const account of coaTemplate) {
            try {
                const { data, error } = await supabase
                    .from('chart_of_accounts')
                    .insert({
                        org_id: orgId,
                        code: account.code,
                        name: account.name,
                        class: account.class,
                        is_header: account.is_header,
                        is_active: account.is_active,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) throw error;
                createdAccounts.push({ ...account, id: data.id, parent_id: null });
                MigrationLogger.success('COA', `Created account: ${account.code} - ${account.name}`);
                this.migrationStats.chartOfAccounts++;
            } catch (error) {
                this.migrationStats.errors++;
                MigrationLogger.error('COA', `Failed to create account: ${account.code}`, error);
            }
        }

        // Second pass: Update parent relationships
        for (const account of createdAccounts) {
            if (account.parent_code) {
                const parent = createdAccounts.find(a => a.code === account.parent_code);
                if (parent) {
                    try {
                        const { error } = await supabase
                            .from('chart_of_accounts')
                            .update({ parent_id: parent.id })
                            .eq('id', account.id);

                        if (error) throw error;
                        MigrationLogger.success('COA', `Linked parent: ${account.code} -> ${account.parent_code}`);
                    } catch (error) {
                        this.migrationStats.errors++;
                        MigrationLogger.error('COA', `Failed to link parent: ${account.code}`, error);
                    }
                }
            }
        }

        return createdAccounts;
    }

    async migrateStudents(students, orgId) {
        MigrationLogger.log('STUDENTS', `Starting migration of ${students.length} students`);
        
        for (const student of students) {
            try {
                // Transform student data to match new schema
                const transformedStudent = {
                    org_id: orgId,
                    uli: student.uli,
                    last_name: student.lastName,
                    first_name: student.firstName,
                    middle_name: student.middleName || '',
                    extension: student.extension || '',
                    sex: student.sex,
                    date_of_birth: student.dateOfBirth,
                    birth_region: student.birthRegion,
                    birth_province: student.birthProvince,
                    birth_city: student.birthCity,
                    civil_status: student.civilStatus,
                    educational_attainment: student.educationalAttainment,
                    nationality: student.nationality || 'Filipino',
                    email: student.email,
                    contact_number: student.contactNumber,
                    street: student.street,
                    barangay: student.barangay,
                    city: student.city,
                    district: student.district || '',
                    province: student.province,
                    guardian: student.guardian || '',
                    created_at: new Date().toISOString()
                };

                const { data, error } = await supabase
                    .from('students')
                    .insert(transformedStudent)
                    .select()
                    .single();

                if (error) throw error;
                
                // Migrate student documents if they exist
                if (student.documents && student.documents.length > 0) {
                    await this.migrateStudentDocuments(data.id, student.documents);
                }

                this.migrationStats.students++;
                MigrationLogger.success('STUDENT', `Migrated: ${student.firstName} ${student.lastName} (${student.uli})`);
            } catch (error) {
                this.migrationStats.errors++;
                MigrationLogger.error('STUDENT', `Failed to migrate student: ${student.uli}`, error);
            }
        }
    }

    async migrateStudentDocuments(studentId, documents) {
        for (const doc of documents) {
            try {
                const { error } = await supabase
                    .from('student_documents')
                    .insert({
                        student_id: studentId,
                        name: doc.name,
                        status: doc.status || 'PENDING',
                        file_url: doc.fileData || null,
                        is_other: doc.isOther || false,
                        created_at: new Date().toISOString()
                    });

                if (error) throw error;
                MigrationLogger.success('DOC', `Migrated document: ${doc.name}`);
            } catch (error) {
                this.migrationStats.errors++;
                MigrationLogger.error('DOC', `Failed to migrate document: ${doc.name}`, error);
            }
        }
    }

    async createAccountingPeriod(orgId) {
        try {
            const { data, error } = await supabase
                .from('accounting_periods')
                .insert({
                    org_id: orgId,
                    name: 'Current Period',
                    start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
                    end_date: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
                    is_current: true,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            MigrationLogger.success('PERIOD', 'Created current accounting period');
            return data;
        } catch (error) {
            MigrationLogger.error('PERIOD', 'Failed to create accounting period', error);
            throw error;
        }
    }

    async createSystemAdmin(orgId, adminData) {
        try {
            // In production, use proper password hashing
            const { data, error } = await supabase
                .from('users')
                .insert({
                    org_id: orgId,
                    name: adminData.name,
                    email: adminData.email,
                    password_hash: 'hashed_password_here', // Replace with actual hash
                    salt: 'salt_here', // Replace with actual salt
                    role: adminData.role,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            MigrationLogger.success('USER', `Created system admin: ${adminData.email}`);
            return data;
        } catch (error) {
            MigrationLogger.error('USER', `Failed to create system admin`, error);
            throw error;
        }
    }

    getMigrationReport() {
        return {
            startTime: this.startTime,
            endTime: new Date().toISOString(),
            duration: Date.now() - this.startTime,
            stats: this.migrationStats,
            success: this.migrationStats.errors === 0,
            summary: `Migration ${this.migrationStats.errors === 0 ? 'completed successfully' : 'completed with errors'}`
        };
    }
}

// Main Migration Orchestrator
class AT_ERPMigration {
    constructor() {
        this.engine = new MigrationEngine();
        this.startTime = Date.now();
    }

    async execute() {
        MigrationLogger.log('MIGRATION', 'Starting AT-ERP migration to Supabase...');
        
        try {
            // Step 1: Backup current system
            await DataBackup.backupCurrentSystem();
            
            // Step 2: Create organization
            const orgData = {
                name: 'AccounTech Platform Host',
                currency: 'PHP',
                isVatRegistered: true,
                subscriptionStatus: 'ACTIVE',
                planType: 'ENTERPRISE',
                primaryColor: '#e11d48'
            };
            
            const org = await this.engine.createOrganization(orgData);
            
            // Step 3: Create accounting period
            await this.engine.createAccountingPeriod(org.id);
            
            // Step 4: Create Chart of Accounts
            await this.engine.createChartOfAccounts(org.id);
            
            // Step 5: Create system admin
            const adminData = {
                name: 'System Administrator',
                email: 'admin@' + orgData.name.replace(/\s+/g, '').toLowerCase() + '.com',
                role: 'SYSTEM_ADMIN'
            };
            await this.engine.createSystemAdmin(org.id, adminData);
            
            // Step 6: Migrate students (if any exist)
            // const currentStudents = await this.getCurrentStudents(); // Implement this method
            // if (currentStudents.length > 0) {
            //     await this.engine.migrateStudents(currentStudents, org.id);
            // }
            
            // Step 7: Generate migration report
            const report = this.engine.getMigrationReport();
            MigrationLogger.log('MIGRATION', 'Migration completed', report);
            
            console.log('\\n=== MIGRATION SUMMARY ===');
            console.log(`Duration: ${report.duration}ms`);
            console.log(`Organizations: ${report.stats.organizations}`);
            console.log(`Chart of Accounts: ${report.stats.chartOfAccounts}`);
            console.log(`Students: ${report.stats.students}`);
            console.log(`Errors: ${report.stats.errors}`);
            console.log(`Status: ${report.summary}`);
            console.log('========================\\n');
            
            return report;
            
        } catch (error) {
            MigrationLogger.error('MIGRATION', 'Migration failed', error);
            throw error;
        }
    }
}

// Execution
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
    const migration = new AT_ERPMigration();
    migration.execute()
        .then(report => {
            if (report.success) {
                console.log('✅ Migration completed successfully!');
                console.log('📝 Check migration logs for details');
                console.log('🚀 Ready to start using Supabase backend!');
            } else {
                console.log('❌ Migration completed with errors');
                console.log('📝 Check logs and fix issues before proceeding');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Migration failed:', error.message);
            process.exit(1);
        });
}

export { AT_ERPMigration, DataBackup, MigrationEngine, MigrationLogger };
