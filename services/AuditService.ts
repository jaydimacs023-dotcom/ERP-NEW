/**
 * AuditService - Centralized audit trail logging for all ERP operations
 * 
 * Usage:
 *   AuditService.log({
 *     orgId: currentOrgId,
 *     userId: currentUser?.id,
 *     userName: currentUser?.name,
 *     action: 'CREATE',
 *     entityType: 'STUDENT',
 *     entityId: student.id,
 *     entityName: `${student.firstName} ${student.lastName}`,
 *     details: 'Created new student record'
 *   });
 */

import { AuditLog } from '../types';
import { generateUUID } from '../utils/uuid';

export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'SOFT_DELETE'
  | 'RESTORE'
  | 'POST' 
  | 'REVERSE' 
  | 'APPROVE' 
  | 'REJECT'
  | 'VOID'
  | 'PRINT'
  | 'RELEASE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT';

export type EntityType =
  | 'ORGANIZATION'
  | 'USER'
  | 'STUDENT'
  | 'TRAINER'
  | 'QUALIFICATION'
  | 'BATCH'
  | 'LOCATION'
  | 'SCHEDULE'
  | 'SPONSOR'
  | 'VENDOR'
  | 'EMPLOYEE'
  | 'PAYROLL'
  | 'JOURNAL_ENTRY'
  | 'RECURRING_JOURNAL_ENTRY'
  | 'CHART_OF_ACCOUNT'
  | 'PAYABLE'
  | 'RECEIVABLE'
  | 'PURCHASE_ORDER'
  | 'BANK_ACCOUNT'
  | 'BANK_RECONCILIATION'
  | 'CHECK_VOUCHER'
  | 'EFT_BATCH'
  | 'FIXED_ASSET'
  | 'ITEM'
  | 'GOODS_RECEIPT'
  | 'BUDGET'
  | 'WAREHOUSE_LOCATION'
  | 'STOCK_ITEM'
  | 'INVENTORY_LEVEL'
  | 'STOCK_ADJUSTMENT'
  | 'REORDER_POINT'
  | 'INVENTORY_TRANSACTION'
  | 'SYSTEM';

export interface AuditLogInput {
  orgId: string;
  userId?: string;
  userName?: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  details?: string;
  previousValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
}

type AuditCallback = (log: AuditLog) => void;

class AuditServiceClass {
  private callback: AuditCallback | null = null;

  /**
   * Set the callback function to be called when a log is created
   * This should be set in App.tsx to update the auditLogs state
   */
  setCallback(cb: AuditCallback): void {
    this.callback = cb;
  }

  /**
   * Create an audit log entry
   */
  log(input: AuditLogInput): AuditLog {
    const timestamp = new Date().toISOString();
    
    // Build details string
    let details = input.details || this.buildDefaultDetails(input);
    
    // Add change tracking if previous/new values provided
    if (input.previousValue !== undefined && input.newValue !== undefined) {
      const changes = this.detectChanges(input.previousValue, input.newValue);
      if (changes.length > 0) {
        details += ` | Changes: ${changes.join(', ')}`;
      }
    }

    const log: AuditLog = {
      id: generateUUID(),
      orgId: input.orgId,
      userId: input.userName || input.userId || 'SYSTEM',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details,
      createdAt: timestamp,
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent()
    };

    // Call the registered callback to add to state
    if (this.callback) {
      this.callback(log);
    }

    // Also log to console for debugging
    console.info(`[Audit] ${log.action} ${log.entityType} (${log.entityId}): ${details}`);

    return log;
  }

  /**
   * Build default details string based on action and entity
   */
  private buildDefaultDetails(input: AuditLogInput): string {
    const entityName = input.entityName ? ` "${input.entityName}"` : '';
    const entityRef = `${input.entityType}${entityName}`;
    
    switch (input.action) {
      case 'CREATE':
        return `Created new ${entityRef}`;
      case 'UPDATE':
        return `Updated ${entityRef}`;
      case 'DELETE':
        return `Permanently deleted ${entityRef}`;
      case 'SOFT_DELETE':
        return `Soft deleted ${entityRef}`;
      case 'RESTORE':
        return `Restored ${entityRef}`;
      case 'POST':
        return `Posted ${entityRef}`;
      case 'REVERSE':
        return `Reversed ${entityRef}`;
      case 'APPROVE':
        return `Approved ${entityRef}`;
      case 'REJECT':
        return `Rejected ${entityRef}`;
      case 'VOID':
        return `Voided ${entityRef}`;
      case 'PRINT':
        return `Printed ${entityRef}`;
      case 'RELEASE':
        return `Released ${entityRef}`;
      case 'LOGIN':
        return `User logged in`;
      case 'LOGOUT':
        return `User logged out`;
      case 'EXPORT':
        return `Exported ${entityRef}`;
      case 'IMPORT':
        return `Imported ${entityRef}`;
      default:
        return `${input.action} on ${entityRef}`;
    }
  }

  /**
   * Detect changes between two objects and return a list of changed fields
   */
  private detectChanges(prev: any, next: any): string[] {
    if (!prev || !next) return [];
    
    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    
    for (const key of allKeys) {
      // Skip internal/meta fields
      if (['id', 'orgId', 'createdAt', 'updatedAt', 'isDeleted', 'deletedAt', 'deletedBy'].includes(key)) {
        continue;
      }
      
      const prevVal = prev[key];
      const nextVal = next[key];
      
      if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
        // Format the change nicely
        const fieldName = this.formatFieldName(key);
        if (prevVal === undefined || prevVal === null || prevVal === '') {
          changes.push(`${fieldName} set to "${this.formatValue(nextVal)}"`);
        } else if (nextVal === undefined || nextVal === null || nextVal === '') {
          changes.push(`${fieldName} cleared`);
        } else {
          changes.push(`${fieldName}: "${this.formatValue(prevVal)}" → "${this.formatValue(nextVal)}"`);
        }
      }
    }
    
    return changes.slice(0, 5); // Limit to 5 changes to avoid huge logs
  }

  /**
   * Format field name from camelCase to Title Case
   */
  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Format a value for display in audit log
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 50);
    return String(value).slice(0, 50);
  }

  /**
   * Get client IP (placeholder - in real app would come from server)
   */
  private getClientIP(): string {
    return '127.0.0.1'; // In production, this would come from the server
  }

  /**
   * Get user agent
   */
  private getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR COMMON OPERATIONS
  // ============================================================================

  create(orgId: string, userId: string, userName: string, entityType: EntityType, entityId: string, entityName?: string): AuditLog {
    return this.log({ orgId, userId, userName, action: 'CREATE', entityType, entityId, entityName });
  }

  update(orgId: string, userId: string, userName: string, entityType: EntityType, entityId: string, entityName?: string, prevValue?: any, newValue?: any): AuditLog {
    return this.log({ orgId, userId, userName, action: 'UPDATE', entityType, entityId, entityName, previousValue: prevValue, newValue: newValue });
  }

  delete(orgId: string, userId: string, userName: string, entityType: EntityType, entityId: string, entityName?: string): AuditLog {
    return this.log({ orgId, userId, userName, action: 'SOFT_DELETE', entityType, entityId, entityName });
  }

  hardDelete(orgId: string, userId: string, userName: string, entityType: EntityType, entityId: string, entityName?: string): AuditLog {
    return this.log({ orgId, userId, userName, action: 'DELETE', entityType, entityId, entityName });
  }

  post(orgId: string, userId: string, userName: string, entityType: EntityType, entityId: string, entityName?: string, details?: string): AuditLog {
    return this.log({ orgId, userId, userName, action: 'POST', entityType, entityId, entityName, details });
  }

  approve(orgId: string, userId: string, userName: string, entityType: EntityType, entityId: string, entityName?: string): AuditLog {
    return this.log({ orgId, userId, userName, action: 'APPROVE', entityType, entityId, entityName });
  }

  reject(orgId: string, userId: string, userName: string, entityType: EntityType, entityId: string, entityName?: string, reason?: string): AuditLog {
    return this.log({ orgId, userId, userName, action: 'REJECT', entityType, entityId, entityName, details: reason });
  }

  void(orgId: string, userId: string, userName: string, entityType: EntityType, entityId: string, entityName?: string, reason?: string): AuditLog {
    return this.log({ orgId, userId, userName, action: 'VOID', entityType, entityId, entityName, details: reason });
  }

  login(orgId: string, userId: string, userName: string): AuditLog {
    return this.log({ orgId, userId, userName, action: 'LOGIN', entityType: 'USER', entityId: userId });
  }

  logout(orgId: string, userId: string, userName: string): AuditLog {
    return this.log({ orgId, userId, userName, action: 'LOGOUT', entityType: 'USER', entityId: userId });
  }
}

// Export singleton instance
export const AuditService = new AuditServiceClass();
