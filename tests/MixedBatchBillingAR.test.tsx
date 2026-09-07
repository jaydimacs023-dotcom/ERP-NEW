// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import InvoicesView from '../views/InvoicesView';
import { Batch, CourseFee, Enrollment, Invoice, Qualification, Sponsor, Student, User } from '../types';
import { BillingComputationService } from '../services/BillingComputationService';
import { canAccess, UserRole } from '../config/permissions';
import { DataServiceFactory } from '../services/DataServiceFactory';

import { SupabaseDataService } from '../services/SupabaseDataService';

describe('AR Role - Mixed Batch Billing in Invoices', () => {
  const mockOrgId = 'org-test-1';

  beforeEach(() => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchBillingCourseFeeInvoice').mockResolvedValue([] as any);
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([] as any);
    vi.spyOn(SupabaseDataService.prototype, 'fetchPage').mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 25, totalPages: 1 } as any);
  });

  const mockARUser: User = {
    id: 'user-ar-1',
    orgId: mockOrgId,
    name: 'AR Specialist Jane',
    email: 'ar@institution.edu',
    role: 'AR_SPECIALIST' as any,
    createdAt: new Date().toISOString()
  };

  const mockSponsor: Sponsor = {
    id: 'sponsor-owwa',
    orgId: mockOrgId,
    code: 'OWWA-XI',
    name: 'OWWA Regional Office XI',
    contactPerson: 'Director Santos',
    email: 'owwa@gov.ph',
    phone: '1234567',
    address: 'Davao City',
    customerType: 'SPONSOR',
    taxType: 'NON_VAT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockQual: Qualification = {
    id: 'qual-excavator',
    orgId: mockOrgId,
    code: 'HEO-NC2',
    name: 'Heavy Equipment Operation NC II',
    durationDays: 28,
    fullDurationDays: 28,
    nominalHours: 224,
    sector: 'Construction',
    courseFee: 15000,
    assessmentFee: 2000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockStudents: Student[] = [
    {
      id: 'stud-1',
      orgId: mockOrgId,
      studentId: 'ST-001',
      firstName: 'Wilfredo',
      lastName: 'Saldon',
      email: 'wilfredo@test.com',
      uli: '47-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'stud-2',
      orgId: mockOrgId,
      studentId: 'ST-002',
      firstName: 'Joshua',
      lastName: 'Tiñula',
      email: 'joshua@test.com',
      uli: '24-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'stud-3',
      orgId: mockOrgId,
      studentId: 'ST-003',
      firstName: 'Renante',
      lastName: 'Cea',
      email: 'renante@test.com',
      uli: '47-002',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const mockBatch: Batch = {
    id: 'batch-mixed-01',
    orgId: mockOrgId,
    batchCode: 'HEO-2026-B1',
    name: 'HEO Excavator NC II Batch 1',
    year: 2026,
    qualificationId: mockQual.id,
    trainerId: 'trainer-1',
    sponsorId: mockSponsor.id, // Primary batch sponsor is OWWA
    studentIds: ['stud-1', 'stud-2', 'stud-3'],
    studentSponsors: {
      'stud-1': 'sponsor-owwa',
      'stud-2': 'sponsor-owwa',
      'stud-3': '' // Private self-pay
    },
    status: 'ONGOING' as any,
    startDate: '2026-09-01',
    endDate: '2026-09-29',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockEnrollments: Enrollment[] = [
    {
      id: 'enr-1',
      orgId: mockOrgId,
      studentId: 'stud-1',
      batchId: mockBatch.id,
      qualificationId: mockQual.id,
      enrollmentCode: 'ENR-HEO-001',
      sponsorId: 'sponsor-owwa',
      billingType: 'BILLABLE',
      billingStatus: 'UNBILLED',
      enrollmentStatus: 'ACTIVE',
      registrationDate: '2026-09-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'enr-2',
      orgId: mockOrgId,
      studentId: 'stud-2',
      batchId: mockBatch.id,
      qualificationId: mockQual.id,
      enrollmentCode: 'ENR-HEO-002',
      sponsorId: 'sponsor-owwa',
      billingType: 'BILLABLE',
      billingStatus: 'UNBILLED',
      enrollmentStatus: 'ACTIVE',
      registrationDate: '2026-09-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'enr-3',
      orgId: mockOrgId,
      studentId: 'stud-3',
      batchId: mockBatch.id,
      qualificationId: mockQual.id,
      enrollmentCode: 'ENR-HEO-003',
      sponsorId: '', // Private student
      billingType: 'BILLABLE',
      billingStatus: 'UNBILLED',
      enrollmentStatus: 'ACTIVE',
      registrationDate: '2026-09-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const mockCourseFees: CourseFee[] = [
    {
      id: 'fee-sponsored',
      orgId: mockOrgId,
      qualificationId: mockQual.id,
      feeName: 'Tuition Fee - Sponsored',
      amount: 12000,
      fundingType: 'SPONSORED',
      category: 'TUITION',
      isActive: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'fee-private',
      orgId: mockOrgId,
      qualificationId: mockQual.id,
      feeName: 'Tuition Fee - Private Individual',
      amount: 15000,
      fundingType: 'PRIVATE',
      category: 'TUITION',
      isActive: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const mockAccounts = [
    { id: 'acc-ar-sponsor', orgId: mockOrgId, code: '11110', name: 'Accounts Receivable - Sponsor', class: 'ASSET', isActive: true },
    { id: 'acc-ar-student', orgId: mockOrgId, code: '11100', name: 'Accounts Receivable - Student', class: 'ASSET', isActive: true },
    { id: 'acc-revenue', orgId: mockOrgId, code: '40100', name: 'Tuition Revenue', class: 'REVENUE', isActive: true }
  ];

  it('verifies AR_SPECIALIST role has access to Invoices module', () => {
    expect(canAccess('AR_SPECIALIST', 'invoices')).toBe(true);
  });

  it('correctly detects funding groups for mixed batch in BillingComputationService', () => {
    const context = {
      batches: [mockBatch],
      enrollments: mockEnrollments,
      sponsors: [mockSponsor],
      courseFees: mockCourseFees
    };

    const groups = BillingComputationService.getBatchFundingGroups(context, mockBatch.id);
    expect(groups).toHaveLength(2);

    const owwaGroup = groups.find(g => g.sponsorId === 'sponsor-owwa');
    expect(owwaGroup).toBeDefined();
    expect(owwaGroup?.totalLearners).toBe(2);
    expect(owwaGroup?.unbilledLearners).toBe(2);
    expect(owwaGroup?.studentIds).toContain('stud-1');
    expect(owwaGroup?.studentIds).toContain('stud-2');

    const privateGroup = groups.find(g => !g.sponsorId);
    expect(privateGroup).toBeDefined();
    expect(privateGroup?.totalLearners).toBe(1);
    expect(privateGroup?.unbilledLearners).toBe(1);
    expect(privateGroup?.studentIds).toContain('stud-3');
  });

  it('computes sponsored invoice with 2 learners for OWWA XI', () => {
    const context = {
      batches: [mockBatch],
      enrollments: mockEnrollments,
      sponsors: [mockSponsor],
      courseFees: mockCourseFees
    };

    const invoice = BillingComputationService.computeCourseFeeInvoice(
      context,
      mockBatch.id,
      'sponsor-owwa',
      undefined
    );

    expect(invoice.enrolledQty).toBe(2);
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0].quantity).toBe(2);
    expect(invoice.lines[0].unitPrice).toBe(12000);
    expect(invoice.lines[0].netAmount).toBe(24000);
  });

  it('computes private individual invoice with 1 learner for Renante Cea', () => {
    const context = {
      batches: [mockBatch],
      enrollments: mockEnrollments,
      sponsors: [mockSponsor],
      courseFees: mockCourseFees
    };

    const invoice = BillingComputationService.computeCourseFeeInvoice(
      context,
      mockBatch.id,
      undefined,
      'stud-3'
    );

    expect(invoice.enrolledQty).toBe(1);
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0].quantity).toBe(1);
    expect(invoice.lines[0].unitPrice).toBe(15000);
    expect(invoice.lines[0].netAmount).toBe(15000);
  });

  it('renders InvoicesView in FORM mode for mixed batch and displays Mixed Cohort funding selectors', async () => {
    const onAddInvoice = vi.fn();
    const onUpdateInvoice = vi.fn();

    render(
      <InvoicesView
        invoices={[]}
        payments={[]}
        sponsors={[mockSponsor]}
        students={mockStudents}
        users={[mockARUser]}
        enrollments={mockEnrollments}
        assessmentRegistrations={[]}
        batches={[mockBatch]}
        qualifications={[mockQual]}
        courseFees={mockCourseFees}
        accounts={mockAccounts as any}
        currency="PHP"
        isVatRegistered={false}
        taxCategories={[]}
        orgId={mockOrgId}
        onAddInvoice={onAddInvoice}
        onUpdateInvoice={onUpdateInvoice}
        onDeleteInvoice={vi.fn().mockResolvedValue(true)}
      />
    );

    // Open "New Invoice" modal
    const newInvoiceBtn = screen.getByRole('button', { name: /new invoice/i });
    fireEvent.click(newInvoiceBtn);

    // Select the batch in the dropdown
    const batchSelects = screen.getAllByRole('combobox');
    const batchSelect = batchSelects.find(s => (s as HTMLSelectElement).querySelector('option[value="batch-mixed-01"]'));
    expect(batchSelect).toBeDefined();

    fireEvent.change(batchSelect!, { target: { value: 'batch-mixed-01' } });

    // The Mixed Cohort section should now be visible with both funding groups
    await waitFor(() => {
      expect(screen.getByText(/Mixed Cohort \(2 Funding Groups\)/i)).toBeTruthy();
    });

    // Check both funding group pill buttons exist
    const owwaBtn = screen.getByRole('button', { name: /OWWA Regional Office XI/i });
    const privateBtn = screen.getByRole('button', { name: /Private \/ Self-Funded/i });
    expect(owwaBtn).toBeTruthy();
    expect(privateBtn).toBeTruthy();

    // Click "Private / Self-Funded" to toggle to the private student
    fireEvent.click(privateBtn);

    // After clicking Private, the header and student dropdown should show Cea, Renante
    await waitFor(() => {
      expect(screen.getAllByText(/Cea, Renante/i).length).toBeGreaterThan(0);
    });

    const inputs = screen.getAllByRole('textbox');
    const inputValues = inputs.map(i => (i as HTMLInputElement).value);
    expect(inputValues).toContain('15,000.00');
  });
});
