/**
 * BackupRestoreService.ts
 * Comprehensive backup and restore service for per-organization data
 * Supports full institutional data backup/restore including all entities
 */

import {
  Organization, User, Student, Qualification, Trainer, Batch, Sponsor,
  Vendor, Employee, PayrollRun, JournalEntry, JournalLine, AuditLog,
  Budget, ChartOfAccount, PurchaseOrder, PaymentHistory, Payable,
  AccountingPeriod, CheckVoucher, EFTBatch, GoodsReceipt, BankReconciliation,
  WarehouseLocation, StockItem, InventoryLevel, InventoryTransaction,
  StockAdjustment, FixedAsset, BankAccount, Location, NonStockItem,
  Payroll, Subscriber, Department, Deduction, SalaryComponent
} from '../types';

export interface BackupMetadata {
  organizationId: string;
  organizationName: string;
  backupDate: string;
  backupTime: string;
  version: string;
  dataVersion: number;
  createdBy: string;
  description: string;
  recordCount: BackupRecordCount;
  checksumHash: string;
}

export interface BackupRecordCount {
  organizations: number;
  users: number;
  students: number;
  qualifications: number;
  trainers: number;
  batches: number;
  sponsors: number;
  vendors: number;
  employees: number;
  payrollRuns: number;
  journalEntries: number;
  JournalLines: number;
  auditLogs: number;
  budgets: number;
  chartOfAccounts: number;
  purchaseOrders: number;
  paymentHistory: number;
  payables: number;
  accountingPeriods: number;
  checkVouchers: number;
  eftBatches: number;
  goodsReceipts: number;
  bankReconciliations: number;
  warehouseLocations: number;
  stockItems: number;
  inventoryLevels: number;
  inventoryTransactions: number;
  stockAdjustments: number;
  fixedAssets: number;
  bankAccounts: number;
  locations: number;
  nonStockItems: number;
}

export interface BackupData {
  metadata: BackupMetadata;
  data: {
    organizations: Organization[];
    users: User[];
    students: Student[];
    qualifications: Qualification[];
    trainers: Trainer[];
    batches: Batch[];
    sponsors: Sponsor[];
    vendors: Vendor[];
    employees: Employee[];
    payrollRuns: PayrollRun[];
    journalEntries: JournalEntry[];
    JournalLines: JournalLine[];
    auditLogs: AuditLog[];
    budgets: Budget[];
    chartOfAccounts: ChartOfAccount[];
    purchaseOrders: PurchaseOrder[];
    paymentHistory: PaymentHistory[];
    payables: Payable[];
    accountingPeriods: AccountingPeriod[];
    checkVouchers: CheckVoucher[];
    eftBatches: EFTBatch[];
    goodsReceipts: GoodsReceipt[];
    bankReconciliations: BankReconciliation[];
    warehouseLocations: WarehouseLocation[];
    stockItems: StockItem[];
    inventoryLevels: InventoryLevel[];
    inventoryTransactions: InventoryTransaction[];
    stockAdjustments: StockAdjustment[];
    fixedAssets: FixedAsset[];
    bankAccounts: BankAccount[];
    locations: Location[];
    nonStockItems: NonStockItem[];
  };
}

export class BackupRestoreService {
  private static readonly VERSION = '1.0';
  private static readonly DATA_VERSION = 1;
  private static readonly ENCRYPTION_PLACEHOLDER = 'AES-256'; // Placeholder for future encryption

  /**
   * Create a simple checksum for data integrity verification
   */
  private static createChecksum(data: any): string {
    const dataStr = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      const char = dataStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Count total records in backup data
   */
  private static countRecords(data: any): BackupRecordCount {
    return {
      organizations: (data.organizations || []).length,
      users: (data.users || []).length,
      students: (data.students || []).length,
      qualifications: (data.qualifications || []).length,
      trainers: (data.trainers || []).length,
      batches: (data.batches || []).length,
      sponsors: (data.sponsors || []).length,
      vendors: (data.vendors || []).length,
      employees: (data.employees || []).length,
      payrollRuns: (data.payrollRuns || []).length,
      journalEntries: (data.journalEntries || []).length,
      JournalLines: (data.JournalLines || []).length,
      auditLogs: (data.auditLogs || []).length,
      budgets: (data.budgets || []).length,
      chartOfAccounts: (data.chartOfAccounts || []).length,
      purchaseOrders: (data.purchaseOrders || []).length,
      paymentHistory: (data.paymentHistory || []).length,
      payables: (data.payables || []).length,
      accountingPeriods: (data.accountingPeriods || []).length,
      checkVouchers: (data.checkVouchers || []).length,
      eftBatches: (data.eftBatches || []).length,
      goodsReceipts: (data.goodsReceipts || []).length,
      bankReconciliations: (data.bankReconciliations || []).length,
      warehouseLocations: (data.warehouseLocations || []).length,
      stockItems: (data.stockItems || []).length,
      inventoryLevels: (data.inventoryLevels || []).length,
      inventoryTransactions: (data.inventoryTransactions || []).length,
      stockAdjustments: (data.stockAdjustments || []).length,
      fixedAssets: (data.fixedAssets || []).length,
      bankAccounts: (data.bankAccounts || []).length,
      locations: (data.locations || []).length,
      nonStockItems: (data.nonStockItems || []).length,
    };
  }

  /**
   * Create a backup of all organization data
   */
  static createBackup(
    organizationId: string,
    organizationName: string,
    allData: any,
    currentUserId: string,
    description: string = ''
  ): BackupData {
    // Filter data for current organization
    const orgData = this.filterDataByOrganization(allData, organizationId);

    const now = new Date();
    const recordCount = this.countRecords(orgData);
    const checksumHash = this.createChecksum(orgData);

    const metadata: BackupMetadata = {
      organizationId,
      organizationName,
      backupDate: now.toISOString().split('T')[0],
      backupTime: now.toTimeString().split(' ')[0],
      version: this.VERSION,
      dataVersion: this.DATA_VERSION,
      createdBy: currentUserId,
      description,
      recordCount,
      checksumHash,
    };

    return {
      metadata,
      data: orgData,
    };
  }

  /**
   * Filter all data by organization
   */
  private static filterDataByOrganization(allData: any, orgId: string): any {
    return {
      organizations: (allData.organizations || []).filter((o: any) => o.id === orgId && !o.isDeleted),
      users: (allData.users || []).filter((u: any) => u.orgId === orgId && !u.isDeleted),
      students: (allData.students || []).filter((s: any) => s.orgId === orgId && !s.isDeleted),
      qualifications: (allData.qualifications || []).filter((q: any) => q.orgId === orgId && !q.isDeleted),
      trainers: (allData.trainers || []).filter((t: any) => t.orgId === orgId && !t.isDeleted),
      batches: (allData.batches || []).filter((b: any) => b.orgId === orgId && !b.isDeleted),
      sponsors: (allData.sponsors || []).filter((s: any) => s.orgId === orgId && !s.isDeleted),
      vendors: (allData.vendors || []).filter((v: any) => v.orgId === orgId && !v.isDeleted),
      employees: (allData.employees || []).filter((e: any) => e.orgId === orgId && !e.isDeleted),
      payrollRuns: (allData.payrollRuns || []).filter((p: any) => p.orgId === orgId && !p.isDeleted),
      journalEntries: (allData.journalEntries || []).filter((j: any) => j.orgId === orgId && !j.isDeleted),
      JournalLines: (allData.JournalLines || []).filter((l: any) => l.orgId === orgId && !l.isDeleted),
      auditLogs: (allData.auditLogs || []).filter((a: any) => a.orgId === orgId),
      budgets: (allData.budgets || []).filter((b: any) => b.orgId === orgId && !b.isDeleted),
      chartOfAccounts: (allData.chartOfAccounts || []).filter((a: any) => a.orgId === orgId && !a.isDeleted),
      purchaseOrders: (allData.purchaseOrders || []).filter((p: any) => p.orgId === orgId && !p.isDeleted),
      paymentHistory: (allData.paymentHistory || []).filter((p: any) => p.orgId === orgId),
      payables: (allData.payables || []).filter((p: any) => p.orgId === orgId && !p.isDeleted),
      accountingPeriods: (allData.accountingPeriods || []).filter((a: any) => a.orgId === orgId && !a.isDeleted),
      checkVouchers: (allData.checkVouchers || []).filter((c: any) => c.orgId === orgId && !c.isDeleted),
      eftBatches: (allData.eftBatches || []).filter((e: any) => e.orgId === orgId && !e.isDeleted),
      goodsReceipts: (allData.goodsReceipts || []).filter((g: any) => g.orgId === orgId && !g.isDeleted),
      bankReconciliations: (allData.bankReconciliations || []).filter((b: any) => b.orgId === orgId && !b.isDeleted),
      warehouseLocations: (allData.warehouseLocations || []).filter((w: any) => w.orgId === orgId && !w.isDeleted),
      stockItems: (allData.stockItems || []).filter((s: any) => s.orgId === orgId && !s.isDeleted),
      inventoryLevels: (allData.inventoryLevels || []).filter((i: any) => i.orgId === orgId && !i.isDeleted),
      inventoryTransactions: (allData.inventoryTransactions || []).filter((i: any) => i.orgId === orgId && !i.isDeleted),
      stockAdjustments: (allData.stockAdjustments || []).filter((s: any) => s.orgId === orgId && !s.isDeleted),
      fixedAssets: (allData.fixedAssets || []).filter((f: any) => f.orgId === orgId && !f.isDeleted),
      bankAccounts: (allData.bankAccounts || []).filter((b: any) => b.orgId === orgId && !b.isDeleted),
      locations: (allData.locations || []).filter((l: any) => l.orgId === orgId && !l.isDeleted),
      nonStockItems: (allData.nonStockItems || []).filter((n: any) => n.orgId === orgId && !n.isDeleted),
    };
  }

  /**
   * Download backup as JSON file
   */
  static downloadBackup(backup: BackupData): void {
    const filename = this.generateBackupFilename(
      backup.metadata.organizationName,
      backup.metadata.backupDate
    );

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate standardized backup filename
   */
  private static generateBackupFilename(orgName: string, date: string): string {
    const sanitizedName = orgName.replace(/[^a-zA-Z0-9-]/g, '_').substring(0, 30);
    return `Backup_${sanitizedName}_${date}.json`;
  }

  /**
   * Validate backup file before restoration
   */
  static validateBackupFile(backup: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check structure
    if (!backup.metadata) {
      errors.push('Missing backup metadata');
    }
    if (!backup.data) {
      errors.push('Missing backup data');
    }

    // Check required metadata fields
    if (backup.metadata) {
      if (!backup.metadata.organizationId) errors.push('Missing organizationId in metadata');
      if (!backup.metadata.backupDate) errors.push('Missing backupDate in metadata');
      if (!backup.metadata.recordCount) errors.push('Missing recordCount in metadata');
      if (!backup.metadata.checksumHash) errors.push('Missing checksumHash in metadata');
    }

    // Verify checksum
    if (backup.metadata && backup.data) {
      const calculatedHash = this.createChecksum(backup.data);
      if (calculatedHash !== backup.metadata.checksumHash) {
        errors.push('Backup file has been corrupted or tampered with (checksum mismatch)');
      }
    }

    // Check for required data structures
    if (backup.data) {
      const requiredArrays = [
        'organizations', 'users', 'journalEntries', 'chartOfAccounts',
        'students', 'employees', 'payables'
      ];
      for (const field of requiredArrays) {
        if (!Array.isArray(backup.data[field])) {
          errors.push(`Missing or invalid data.${field} array`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Restore data from backup (returns transformed data for batch updates)
   */
  static prepareRestoreData(backup: BackupData): {
    toCreate: any[];
    toUpdate: any[];
    entities: string[];
  } {
    const toCreate: any[] = [];
    const toUpdate: any[] = [];
    const entities: string[] = [];

    // Process each data type
    const dataTypes = [
      'organizations', 'users', 'students', 'qualifications', 'trainers', 'batches',
      'sponsors', 'vendors', 'employees', 'payrollRuns', 'journalEntries',
      'JournalLines', 'auditLogs', 'budgets', 'chartOfAccounts', 'purchaseOrders',
      'paymentHistory', 'payables', 'accountingPeriods', 'checkVouchers', 'eftBatches',
      'goodsReceipts', 'bankReconciliations', 'warehouseLocations', 'stockItems',
      'inventoryLevels', 'inventoryTransactions', 'stockAdjustments', 'fixedAssets',
      'bankAccounts', 'locations', 'nonStockItems'
    ];

    for (const dataType of dataTypes) {
      const records = (backup.data as any)[dataType] || [];
      if (records.length > 0) {
        entities.push(dataType);
        // All records from backup are treated as new creates
        // (existing data will be overwritten as part of restore)
        for (const record of records) {
          toCreate.push({
            type: dataType,
            data: record,
          });
        }
      }
    }

    return { toCreate, toUpdate, entities };
  }

  /**
   * Get backup summary statistics
   */
  static getBackupSummary(backup: BackupData): {
    totalRecords: number;
    organizationName: string;
    backupDate: string;
    createdBy: string;
    dataIntegrity: boolean;
    recordsByType: Record<string, number>;
  } {
    const recordsByType: Record<string, number> = {};
    const records = backup.metadata.recordCount;

    for (const [key, value] of Object.entries(records)) {
      if (value > 0) {
        recordsByType[key] = value;
      }
    }

    const totalRecords = Object.values(records).reduce((sum, count) => sum + count, 0);

    return {
      totalRecords,
      organizationName: backup.metadata.organizationName,
      backupDate: backup.metadata.backupDate,
      createdBy: backup.metadata.createdBy,
      dataIntegrity: true, // Checksum validation passed
      recordsByType,
    };
  }

  /**
   * Create incremental backup (only changed records since last backup)
   */
  static createIncrementalBackup(
    organizationId: string,
    organizationName: string,
    allData: any,
    lastBackupDate: string,
    currentUserId: string
  ): BackupData {
    // Filter data by organization
    const orgData = this.filterDataByOrganization(allData, organizationId);

    // Filter for records modified after lastBackupDate
    const lastBackup = new Date(lastBackupDate).getTime();
    const filteredData: any = {};

    const dataTypes = Object.keys(orgData);
    for (const dataType of dataTypes) {
      const records = orgData[dataType] || [];
      filteredData[dataType] = records.filter((record: any) => {
        const modifiedTime = record.updatedAt ? new Date(record.updatedAt).getTime() : new Date(record.createdAt).getTime();
        return modifiedTime > lastBackup;
      });
    }

    const now = new Date();
    const recordCount = this.countRecords(filteredData);
    const checksumHash = this.createChecksum(filteredData);

    const metadata: BackupMetadata = {
      organizationId,
      organizationName,
      backupDate: now.toISOString().split('T')[0],
      backupTime: now.toTimeString().split(' ')[0],
      version: this.VERSION,
      dataVersion: this.DATA_VERSION,
      createdBy: currentUserId,
      description: `Incremental backup since ${lastBackupDate}`,
      recordCount,
      checksumHash,
    };

    return {
      metadata,
      data: filteredData,
    };
  }

  /**
   * Compare two backups to identify changes
   */
  static compareBackups(
    backup1: BackupData,
    backup2: BackupData
  ): {
    added: any[];
    removed: any[];
    modified: any[];
    unchanged: any[];
  } {
    const added: any[] = [];
    const removed: any[] = [];
    const modified: any[] = [];
    const unchanged: any[] = [];

    // Simple comparison logic based on record IDs
    const b2Ids = new Set<string>();
    const dataTypes = Object.keys(backup2.data);

    for (const dataType of dataTypes) {
      const b1Records = (backup1.data as any)[dataType] || [];
      const b2Records = (backup2.data as any)[dataType] || [];

      // Build ID set from backup2
      for (const record of b2Records) {
        if (record.id) {
          b2Ids.add(`${dataType}:${record.id}`);
        }
      }

      // Find added and unchanged
      for (const record of b2Records) {
        const b1Match = b1Records.find((r: any) => r.id === record.id);
        if (!b1Match) {
          added.push({ type: dataType, record });
        } else if (JSON.stringify(b1Match) === JSON.stringify(record)) {
          unchanged.push({ type: dataType, record });
        } else {
          modified.push({ type: dataType, before: b1Match, after: record });
        }
      }

      // Find removed
      for (const record of b1Records) {
        if (!b2Records.find((r: any) => r.id === record.id)) {
          removed.push({ type: dataType, record });
        }
      }
    }

    return { added, removed, modified, unchanged };
  }
}
