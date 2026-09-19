import { describe, expect, it } from 'vitest';
import { canAccess, canPerformAction, getDefaultTab } from '../config/permissions';

describe('AP, AR, and Registrar permissions', () => {
  it('keeps AP clerk entry separate from AP supervisor approval', () => {
    expect(canPerformAction('AP_CLERK', 'payables', 'create')).toBe(true);
    expect(canPerformAction('AP_CLERK', 'payables', 'approve')).toBe(false);
    expect(canPerformAction('AP_SUPERVISOR', 'payables', 'approve')).toBe(true);
    expect(canPerformAction('AP_SUPERVISOR', 'payables', 'void')).toBe(true);
  });

  it('keeps read-only financial roles from mutating payables', () => {
    expect(canAccess('AUDITOR', 'payables')).toBe(true);
    expect(canPerformAction('AUDITOR', 'payables', 'view')).toBe(true);
    expect(canPerformAction('AUDITOR', 'payables', 'edit')).toBe(false);
    expect(canPerformAction('AUDITOR', 'payables', 'approve')).toBe(false);
  });

  it('gives Registrar explicit enrollment and assessment access', () => {
    expect(canAccess('REGISTRAR', 'enrollments')).toBe(true);
    expect(canAccess('REGISTRAR', 'assessment-registrations')).toBe(true);
    expect(canPerformAction('REGISTRAR', 'assessment-registrations', 'edit')).toBe(true);
    expect(canPerformAction('REGISTRAR', 'assessment-registrations', 'delete')).toBe(false);
    expect(getDefaultTab('REGISTRAR')).toBe('students');
  });

  it('does not grant Registrar access to AP or AR financial documents', () => {
    expect(canAccess('REGISTRAR', 'payables')).toBe(false);
    expect(canAccess('REGISTRAR', 'invoices')).toBe(false);
    expect(canPerformAction('REGISTRAR', 'payments', 'create')).toBe(false);
  });
});
