import { describe, expect, it } from 'vitest';
import { BillingComputationService, BillingComputationContext } from '../services/BillingComputationService';
import { Batch, CourseFee, Enrollment, Invoice, Payment } from '../types';

const batch = (overrides: Partial<Batch> = {}): Batch => ({
  id: 'batch-1',
  orgId: 'org-1',
  batchCode: 'batch10',
  name: 'heo-batch10',
  year: 2026,
  qualificationId: 'qual-1',
  trainerId: 'trainer-1',
  sponsorId: 'sponsor-1',
  studentIds: [],
  status: 'ONGOING' as any,
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  ...overrides
});

const enrollment = (index: number, overrides: Partial<Enrollment> = {}): Enrollment => ({
  id: `enrollment-${index}`,
  orgId: 'org-1',
  studentId: `student-${index}`,
  batchId: 'batch-1',
  billingType: 'BILLABLE',
  billingStatus: 'UNBILLED',
  enrollmentStatus: 'ACTIVE',
  enrollmentDate: `2026-05-${String(index).padStart(2, '0')}`,
  createdAt: `2026-05-${String(index).padStart(2, '0')}T08:00:00.000Z`,
  ...overrides
});

const courseFee = (overrides: Partial<CourseFee> = {}): CourseFee => ({
  id: 'fee-1',
  orgId: 'org-1',
  feeCode: 'HEO-FEE-001',
  qualificationId: 'qual-1',
  feeName: 'Tuition Fee',
  amount: 45000,
  glAccountId: 'revenue-1',
  isSubjectToEwt: false,
  isActive: true,
  createdAt: '2026-05-01T00:00:00.000Z',
  ...overrides
});

const context = (overrides: Partial<BillingComputationContext> = {}): BillingComputationContext => ({
  batches: [batch()],
  enrollments: Array.from({ length: 8 }, (_, index) => enrollment(index + 1)),
  courseFees: [courseFee()],
  ...overrides
});

describe('BillingComputationService', () => {
  it('classifies all valid learners as BILLABLE because discounts handle sponsor reductions', () => {
    const result = BillingComputationService.classifyEnrollmentsByBatchCap(context(), 'batch-1');

    expect(result.billableQty).toBe(8);
    expect(result.billableEnrollments).toHaveLength(8);
    expect(result.freeExcessEnrollments).toHaveLength(0);

    const invoice = BillingComputationService.computeCourseFeeInvoice(context(), 'batch-1');
    expect(invoice.lines[0].quantity).toBe(8);
    expect(invoice.courseFeeTotal).toBe(360000);
  });

  it('preserves MANUAL_FREE learners and excludes them from sponsor billing distribution', () => {
    const rows = Array.from({ length: 8 }, (_, index) => enrollment(index + 1));
    rows[0] = { ...rows[0], billingType: 'MANUAL_FREE' };
    rows[1] = { ...rows[1], billingType: 'MANUAL_FREE' };

    const result = BillingComputationService.classifyEnrollmentsByBatchCap(context({ enrollments: rows }), 'batch-1');

    expect(result.manualFreeCount).toBe(2);
    expect(result.classifiedEnrollments.filter(row => row.billingType === 'MANUAL_FREE')).toHaveLength(2);
    expect(result.billableEnrollments).toHaveLength(6);
    expect(result.freeExcessEnrollments).toHaveLength(0);
  });

  it('allows draft invoices to recalculate from the current enrolled quantity', () => {
    const invoice: Invoice = {
      id: 'invoice-1',
      orgId: 'org-1',
      invoiceNo: 'INV-2026-00001',
      sponsorId: 'sponsor-1',
      batchId: 'batch-1',
      invoiceDate: '2026-05-22',
      dueDate: '2026-06-21',
      status: 'DRAFT',
      vatPricing: 'EXEMPT',
      vatRate: 0,
      subtotal: 0,
      vatAmount: 0,
      grandTotal: 0,
      amountPaid: 0,
      balanceDue: 0,
      lines: [],
      createdAt: '2026-05-22T00:00:00.000Z'
    };

    const result = BillingComputationService.recalculateDraftInvoice(context({ invoices: [invoice] }), 'invoice-1');

    expect(result.canRecalculate).toBe(true);
    expect(result.expectedQty).toBe(8);
    expect(result.lines?.[0].quantity).toBe(8);
  });

  it('falls back to batch studentIds when enrollment rows are not present yet', () => {
    const result = BillingComputationService.computeCourseFeeInvoice(
      context({
        batches: [batch({ studentIds: ['student-1', 'student-2', 'student-3'] })],
        enrollments: []
      }),
      'batch-1'
    );

    expect(result.enrolledQty).toBe(3);
    expect(result.lines[0].quantity).toBe(3);
    expect(result.lines[0].amount).toBe(135000);
  });

  it('does not silently recalculate posted invoices and flags quantity mismatch', () => {
    const invoice: Invoice = {
      id: 'invoice-1',
      orgId: 'org-1',
      invoiceNo: 'INV-2026-00001',
      sponsorId: 'sponsor-1',
      batchId: 'batch-1',
      invoiceDate: '2026-05-22',
      dueDate: '2026-06-21',
      status: 'OPEN',
      vatPricing: 'EXEMPT',
      vatRate: 0,
      subtotal: 360000,
      vatAmount: 0,
      grandTotal: 360000,
      amountPaid: 0,
      balanceDue: 360000,
      journalEntryId: 'je-1',
      lines: [{
        id: 'line-1',
        orgId: 'org-1',
        invoiceId: 'invoice-1',
        lineNumber: 1,
        description: 'Tuition Fee',
        courseFeeId: 'fee-1',
        quantity: 5,
        unitPrice: 45000,
        netAmount: 360000,
        vatAmount: 0,
        grossAmount: 360000,
        amount: 360000
      }],
      createdAt: '2026-05-22T00:00:00.000Z'
    };

    const recalc = BillingComputationService.recalculateDraftInvoice(context({ invoices: [invoice] }), 'invoice-1');
    const validation = BillingComputationService.validateInvoiceLinesAgainstBatchCap(context(), 'batch-1', invoice.lines || []);

    expect(recalc.canRecalculate).toBe(false);
    expect(validation.isValid).toBe(false);
    expect(validation.mismatches[0].expectedQty).toBe(8);
  });

  it('keeps payment excess in customerDepositBalance computation', () => {
    const payment: Pick<Payment, 'amountReceived' | 'ewtAmountCertified' | 'totalApplied'> = {
      amountReceived: 10000,
      ewtAmountCertified: 500,
      totalApplied: 8000
    };

    expect(BillingComputationService.computePaymentExcess(payment)).toBe(2500);
  });

  it('blocks payment application beyond available customer deposit balance', () => {
    const validation = BillingComputationService.validatePaymentApplication({
      amountReceived: 10000,
      ewtAmountCertified: 0,
      totalApplied: 9000,
      customerDepositBalance: 1000
    }, 1500);

    expect(validation.isValid).toBe(false);
    expect(validation.availableBalance).toBe(1000);
  });

  it('accepts Supabase snake_case enrollment rows when deriving billable qty', () => {
    const snakeRows = Array.from({ length: 8 }, (_, index) => ({
      ...enrollment(index + 1),
      batchId: undefined,
      billingType: undefined,
      enrollmentStatus: undefined,
      batch_id: 'batch-1',
      billing_type: 'BILLABLE',
      enrollment_status: 'ACTIVE'
    } as any));

    const result = BillingComputationService.classifyEnrollmentsByBatchCap(
      context({ enrollments: snakeRows }),
      'batch-1'
    );

    expect(result.billableQty).toBe(8);
    expect(result.billableEnrollments).toHaveLength(8);
  });
});
