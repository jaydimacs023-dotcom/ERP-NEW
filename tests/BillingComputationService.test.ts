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
  fundingType: 'SPONSORED',
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
  sponsors: [{ id: 'sponsor-1', orgId: 'org-1', name: 'Standard Sponsor', courseFeeType: 'SPONSORED' }],
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

  it('loads sponsored fees when the batch has a sponsor', () => {
    const result = BillingComputationService.computeCourseFeeInvoice(
      context({
        courseFees: [
          courseFee({ id: 'sponsored-fee', fundingType: 'SPONSORED', amount: 45000 }),
          courseFee({ id: 'private-fee', fundingType: 'PRIVATE', amount: 30000 }),
          courseFee({ id: 'other-course-fee', qualificationId: 'qual-2', fundingType: 'SPONSORED' })
        ]
      }),
      'batch-1'
    );

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].courseFeeId).toBe('sponsored-fee');
    expect(result.courseFeeTotal).toBe(360000);
  });

  it('loads private fees when the batch has no sponsor', () => {
    const result = BillingComputationService.computeCourseFeeInvoice(
      context({
        batches: [batch({ sponsorId: undefined })],
        courseFees: [
          courseFee({ id: 'sponsored-fee', fundingType: 'SPONSORED', amount: 45000 }),
          courseFee({ id: 'private-fee', fundingType: 'PRIVATE', amount: 30000 })
        ]
      }),
      'batch-1'
    );

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].courseFeeId).toBe('private-fee');
    expect(result.courseFeeTotal).toBe(240000);
  });

  it('loads the TESDA scholarship schedule without standard sponsored OJT fees', () => {
    const result = BillingComputationService.computeCourseFeeInvoice(
      context({
        sponsors: [{ id: 'sponsor-1', orgId: 'org-1', name: 'TESDA DCDO', courseFeeType: 'TESDA_SCHOLARSHIP' }],
        courseFees: [
          courseFee({ id: 'sponsored-training', fundingType: 'SPONSORED', feeName: 'Training Fee' }),
          courseFee({ id: 'sponsored-ojt', fundingType: 'SPONSORED', feeName: 'OJT Fee' }),
          courseFee({ id: 'tesda-training', fundingType: 'TESDA_SCHOLARSHIP', feeName: 'Training Fee' }),
          courseFee({ id: 'tesda-assessment', fundingType: 'TESDA_SCHOLARSHIP', feeName: 'Assessment Fee' })
        ]
      }),
      'batch-1'
    );

    expect(result.lines.map(line => line.description)).toEqual(['Assessment Fee', 'Training Fee']);
    expect(result.lines.some(line => line.description === 'OJT Fee')).toBe(false);
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

  describe('Mixed Batch Student Funding and Billing', () => {
    const mixedBatch: Batch = {
      id: 'mixed-batch-1',
      orgId: 'org-1',
      batchCode: 'MIX-2026',
      name: 'Mixed Batch Class 2026',
      year: 2026,
      qualificationId: 'qual-welding',
      trainerId: 'trainer-1',
      studentIds: [],
      status: 'ONGOING' as any,
      startDate: '2026-06-01',
      endDate: '2026-06-30'
    };

    const privateFee: CourseFee = {
      id: 'fee-priv',
      orgId: 'org-1',
      feeCode: 'FEE-PRIV',
      qualificationId: 'qual-welding',
      fundingType: 'PRIVATE',
      feeName: 'Welding Private Tuition',
      amount: 25000,
      glAccountId: 'gl-rev',
      isSubjectToEwt: false,
      isActive: true,
      createdAt: '2026-05-01'
    };

    const sponsoredFee: CourseFee = {
      id: 'fee-spon',
      orgId: 'org-1',
      feeCode: 'FEE-SPON',
      qualificationId: 'qual-welding',
      fundingType: 'SPONSORED',
      feeName: 'Welding Corporate Tuition',
      amount: 22000,
      glAccountId: 'gl-rev',
      isSubjectToEwt: false,
      isActive: true,
      createdAt: '2026-05-01'
    };

    const tesdaFee: CourseFee = {
      id: 'fee-tesda',
      orgId: 'org-1',
      feeCode: 'FEE-TESDA',
      qualificationId: 'qual-welding',
      fundingType: 'TESDA_SCHOLARSHIP',
      feeName: 'Welding TESDA Training Fee',
      amount: 20000,
      glAccountId: 'gl-rev',
      isSubjectToEwt: false,
      isActive: true,
      createdAt: '2026-05-01'
    };

    const mixedEnrollments: Enrollment[] = [
      // 2 Private Students
      { id: 'enr-priv-1', orgId: 'org-1', studentId: 'stu-p1', batchId: 'mixed-batch-1', billingType: 'BILLABLE', billingStatus: 'UNBILLED', enrollmentStatus: 'ACTIVE', enrollmentDate: '2026-06-01', createdAt: '2026-06-01' },
      { id: 'enr-priv-2', orgId: 'org-1', studentId: 'stu-p2', batchId: 'mixed-batch-1', billingType: 'BILLABLE', billingStatus: 'UNBILLED', enrollmentStatus: 'ACTIVE', enrollmentDate: '2026-06-01', createdAt: '2026-06-01' },
      // 3 Corporate Sponsored Students (Toyota)
      { id: 'enr-corp-1', orgId: 'org-1', studentId: 'stu-c1', batchId: 'mixed-batch-1', sponsorId: 'spon-toyota', billingType: 'BILLABLE', billingStatus: 'UNBILLED', enrollmentStatus: 'ACTIVE', enrollmentDate: '2026-06-01', createdAt: '2026-06-01' },
      { id: 'enr-corp-2', orgId: 'org-1', studentId: 'stu-c2', batchId: 'mixed-batch-1', sponsorId: 'spon-toyota', billingType: 'BILLABLE', billingStatus: 'UNBILLED', enrollmentStatus: 'ACTIVE', enrollmentDate: '2026-06-01', createdAt: '2026-06-01' },
      { id: 'enr-corp-3', orgId: 'org-1', studentId: 'stu-c3', batchId: 'mixed-batch-1', sponsorId: 'spon-toyota', billingType: 'BILLABLE', billingStatus: 'UNBILLED', enrollmentStatus: 'ACTIVE', enrollmentDate: '2026-06-01', createdAt: '2026-06-01' },
      // 4 TESDA Scholars
      { id: 'enr-tesda-1', orgId: 'org-1', studentId: 'stu-t1', batchId: 'mixed-batch-1', sponsorId: 'spon-tesda', billingType: 'BILLABLE', billingStatus: 'UNBILLED', enrollmentStatus: 'ACTIVE', enrollmentDate: '2026-06-01', createdAt: '2026-06-01' },
      { id: 'enr-tesda-2', orgId: 'org-1', studentId: 'stu-t2', batchId: 'mixed-batch-1', sponsorId: 'spon-tesda', billingType: 'BILLABLE', billingStatus: 'UNBILLED', enrollmentStatus: 'ACTIVE', enrollmentDate: '2026-06-01', createdAt: '2026-06-01' },
      { id: 'enr-tesda-3', orgId: 'org-1', studentId: 'stu-t3', batchId: 'mixed-batch-1', sponsorId: 'spon-tesda', billingType: 'BILLABLE', billingStatus: 'UNBILLED', enrollmentStatus: 'ACTIVE', enrollmentDate: '2026-06-01', createdAt: '2026-06-01' },
      { id: 'enr-tesda-4', orgId: 'org-1', studentId: 'stu-t4', batchId: 'mixed-batch-1', sponsorId: 'spon-tesda', billingType: 'BILLABLE', billingStatus: 'UNBILLED', enrollmentStatus: 'ACTIVE', enrollmentDate: '2026-06-01', createdAt: '2026-06-01' }
    ];

    const mixedContext: BillingComputationContext = {
      batches: [mixedBatch],
      enrollments: mixedEnrollments,
      courseFees: [privateFee, sponsoredFee, tesdaFee],
      sponsors: [
        { id: 'spon-toyota', orgId: 'org-1', name: 'Toyota Motors', courseFeeType: 'SPONSORED' },
        { id: 'spon-tesda', orgId: 'org-1', name: 'TESDA Regional Office', courseFeeType: 'TESDA_SCHOLARSHIP' }
      ]
    };

    it('correctly breaks down funding groups for a mixed batch', () => {
      const groups = BillingComputationService.getBatchFundingGroups(mixedContext, 'mixed-batch-1');
      expect(groups).toHaveLength(3);

      const privateGroup = groups.find(g => !g.sponsorId);
      expect(privateGroup).toBeDefined();
      expect(privateGroup?.fundingType).toBe('PRIVATE');
      expect(privateGroup?.totalLearners).toBe(2);

      const corporateGroup = groups.find(g => g.sponsorId === 'spon-toyota');
      expect(corporateGroup).toBeDefined();
      expect(corporateGroup?.fundingType).toBe('SPONSORED');
      expect(corporateGroup?.totalLearners).toBe(3);

      const tesdaGroup = groups.find(g => g.sponsorId === 'spon-tesda');
      expect(tesdaGroup).toBeDefined();
      expect(tesdaGroup?.fundingType).toBe('TESDA_SCHOLARSHIP');
      expect(tesdaGroup?.totalLearners).toBe(4);
    });

    it('computes invoice for corporate sponsor using SPONSORED fees and corporate student count only', () => {
      const invoice = BillingComputationService.computeCourseFeeInvoice(
        mixedContext,
        'mixed-batch-1',
        'spon-toyota'
      );

      expect(invoice.enrolledQty).toBe(3);
      expect(invoice.billableQty).toBe(3);
      expect(invoice.lines).toHaveLength(1);
      expect(invoice.lines[0].description).toBe('Welding Corporate Tuition');
      expect(invoice.lines[0].unitPrice).toBe(22000);
      expect(invoice.lines[0].quantity).toBe(3);
      expect(invoice.courseFeeTotal).toBe(66000);
    });

    it('computes invoice for TESDA using TESDA_SCHOLARSHIP fees and TESDA scholar count only', () => {
      const invoice = BillingComputationService.computeCourseFeeInvoice(
        mixedContext,
        'mixed-batch-1',
        'spon-tesda'
      );

      expect(invoice.enrolledQty).toBe(4);
      expect(invoice.billableQty).toBe(4);
      expect(invoice.lines).toHaveLength(1);
      expect(invoice.lines[0].description).toBe('Welding TESDA Training Fee');
      expect(invoice.lines[0].unitPrice).toBe(20000);
      expect(invoice.lines[0].quantity).toBe(4);
      expect(invoice.courseFeeTotal).toBe(80000);
    });

    it('computes invoice for a private student using PRIVATE fees and quantity 1', () => {
      const invoice = BillingComputationService.computeCourseFeeInvoice(
        mixedContext,
        'mixed-batch-1',
        null,
        'stu-p1'
      );

      expect(invoice.enrolledQty).toBe(1);
      expect(invoice.billableQty).toBe(1);
      expect(invoice.lines).toHaveLength(1);
      expect(invoice.lines[0].description).toBe('Welding Private Tuition');
      expect(invoice.lines[0].unitPrice).toBe(25000);
      expect(invoice.lines[0].quantity).toBe(1);
      expect(invoice.courseFeeTotal).toBe(25000);
    });
  });
});
