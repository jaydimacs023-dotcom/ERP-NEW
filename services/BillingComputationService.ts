import {
  Batch,
  ChartOfAccount,
  CourseFee,
  Enrollment,
  EnrollmentBillingType,
  Invoice,
  InvoiceLine,
  JournalEntry,
  JournalLine,
  Payment
} from '../types';

type RawRecord = Record<string, any>;

export interface BillingComputationContext {
  batches: Batch[];
  enrollments: Enrollment[];
  courseFees: CourseFee[];
  invoices?: Invoice[];
  payments?: Payment[];
  journalEntries?: JournalEntry[];
  journalLines?: JournalLine[];
  accounts?: ChartOfAccount[];
}

export interface EnrollmentClassificationResult {
  batch?: Batch;
  validEnrollments: Enrollment[];
  classifiedEnrollments: Enrollment[];
  billableEnrollments: Enrollment[];
  freeExcessEnrollments: Enrollment[];
  billableQty: number;
  validEnrollmentCount: number;
  manualFreeCount: number;
  limit: number;
  sponsorId: string;
}

export interface InvoiceLineValidationMismatch {
  lineId?: string;
  lineNumber?: number;
  description?: string;
  expectedQty: number;
  actualQty: number;
  reason: string;
}

export interface InvoiceLineValidationResult {
  isValid: boolean;
  expectedQty: number;
  mismatches: InvoiceLineValidationMismatch[];
}

export interface ComputedCourseFeeInvoice {
  batch?: Batch;
  billableQty: number;
  enrolledQty: number;
  courseFeeTotal: number;
  lines: InvoiceLine[];
  classification: EnrollmentClassificationResult;
}

export interface DraftInvoiceRecalculation {
  invoice?: Invoice;
  canRecalculate: boolean;
  reason?: string;
  expectedQty?: number;
  lines?: InvoiceLine[];
  subtotal?: number;
  vatAmount?: number;
  grandTotal?: number;
  netAmountDue?: number;
  balanceDue?: number;
}

export interface PaymentApplicationValidation {
  isValid: boolean;
  availableBalance: number;
  attemptedAmount: number;
  projectedBalance: number;
  reason?: string;
}

const PROTECTED_FREE_TYPES = new Set<EnrollmentBillingType>(['MANUAL_FREE', 'FREE_SPONSORED']);
const NON_BILLABLE_STATUSES = new Set(['DROPPED', 'CANCELLED', 'CANCELED', 'INACTIVE', 'ARCHIVED']);

const toNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const getRaw = (entity: unknown) => entity as RawRecord | null | undefined;

export class BillingComputationService {
  static getBatchSponsorId(batch?: Batch | null): string {
    const raw = getRaw(batch);
    return String(raw?.sponsorId || raw?.sponsor_id || '').trim();
  }

  static getBatchBillableStudentLimit(batch?: Batch | null): number {
    return 0;
  }

  static getValidEnrollments(context: BillingComputationContext, batchId: string): Enrollment[] {
    return this.sortEnrollmentsForBatchBilling(
      (context.enrollments || []).filter(enrollment => {
        const raw = getRaw(enrollment);
        const status = this.getEnrollmentStatus(enrollment);
        return this.getEnrollmentBatchId(enrollment) === batchId &&
          !enrollment.isDeleted &&
          !raw?.deleted_at &&
          !raw?.archived &&
          !raw?.isArchived &&
          !NON_BILLABLE_STATUSES.has(status);
      })
    );
  }

  static classifyEnrollmentsByBatchCap(
    context: BillingComputationContext,
    batchId: string
  ): EnrollmentClassificationResult {
    const batch = context.batches.find(row => row.id === batchId);
    const sponsorId = this.getBatchSponsorId(batch);
    const validEnrollments = this.getValidEnrollments(context, batchId);
    const billableCandidates = validEnrollments.filter(enrollment => {
      const billingType = this.getEnrollmentBillingType(enrollment);
      return !PROTECTED_FREE_TYPES.has(billingType);
    });
    const billableQty = billableCandidates.length;

    const classifiedEnrollments = validEnrollments.map(enrollment => {
      const currentType = this.getEnrollmentBillingType(enrollment);
      if (PROTECTED_FREE_TYPES.has(currentType)) {
        return {
          ...enrollment,
          sponsorId: enrollment.sponsorId || sponsorId || undefined,
          billingType: currentType
        };
      }

      return {
        ...enrollment,
        sponsorId: sponsorId || enrollment.sponsorId,
        billingType: 'BILLABLE' as EnrollmentBillingType
      };
    });

    return {
      batch,
      validEnrollments,
      classifiedEnrollments,
      billableEnrollments: classifiedEnrollments.filter(enrollment => this.getEnrollmentBillingType(enrollment) === 'BILLABLE'),
      freeExcessEnrollments: [],
      billableQty,
      validEnrollmentCount: validEnrollments.length,
      manualFreeCount: validEnrollments.length - billableCandidates.length,
      limit: 0,
      sponsorId
    };
  }

  static getBillableQty(context: BillingComputationContext, batchId: string): number {
    return this.classifyEnrollmentsByBatchCap(context, batchId).billableQty;
  }

  static getValidEnrolledQty(context: BillingComputationContext, batchId: string): number {
    const enrollmentCount = this.getValidEnrollments(context, batchId).length;
    if (enrollmentCount > 0) return enrollmentCount;

    const batch = context.batches.find(row => row.id === batchId) as RawRecord | Batch | undefined;
    const studentIds = Array.isArray((batch as RawRecord | undefined)?.student_ids)
      ? (batch as RawRecord).student_ids
      : batch?.studentIds;
    return Array.isArray(studentIds) ? new Set(studentIds.filter(Boolean)).size : 0;
  }

  static computeCourseFeeInvoice(context: BillingComputationContext, batchId: string): ComputedCourseFeeInvoice {
    const classification = this.classifyEnrollmentsByBatchCap(context, batchId);
    const batch = classification.batch;
    const enrolledQty = this.getValidEnrolledQty(context, batchId);
    const fees = (context.courseFees || []).filter(fee =>
      !!batch &&
      fee.qualificationId === batch.qualificationId &&
      fee.isActive &&
      !fee.isDeleted
    );

    const lines = fees.map((fee, index) => {
      const unitPrice = toNumber(fee.amount, 0);
      const amount = roundMoney(unitPrice * enrolledQty);
      return {
        id: '',
        orgId: fee.orgId || batch?.orgId || '',
        invoiceId: '',
        lineNumber: index + 1,
        description: fee.feeName,
        courseFeeId: fee.id,
        lineType: 'COURSE_FEE',
        quantity: enrolledQty,
        unitPrice,
        netAmount: amount,
        vatAmount: 0,
        grossAmount: amount,
        amount,
        glAccountId: fee.glAccountId,
        taxCategoryId: fee.taxCategoryId || ''
      } as InvoiceLine;
    });

    return {
      batch,
      billableQty: classification.billableQty,
      enrolledQty,
      courseFeeTotal: roundMoney(lines.reduce((sum, line) => sum + toNumber(line.unitPrice) * enrolledQty, 0)),
      lines,
      classification
    };
  }

  static validateInvoiceLinesAgainstBatchCap(
    context: BillingComputationContext,
    batchId: string,
    invoiceLines: InvoiceLine[]
  ): InvoiceLineValidationResult {
    const expectedQty = this.getValidEnrolledQty(context, batchId);
    const courseFeeIds = new Set(
      this.computeCourseFeeInvoice(context, batchId).lines.map(line => line.courseFeeId).filter(Boolean)
    );
    const mismatches = (invoiceLines || [])
      .filter(line => !!line.courseFeeId && (courseFeeIds.size === 0 || courseFeeIds.has(line.courseFeeId)))
      .filter(line => toNumber(line.quantity, 0) !== expectedQty)
      .map(line => ({
        lineId: line.id,
        lineNumber: line.lineNumber,
        description: line.description,
        expectedQty,
        actualQty: toNumber(line.quantity, 0),
        reason: 'Course fee line quantity does not match backend valid enrolled quantity.'
      }));

    return {
      isValid: mismatches.length === 0,
      expectedQty,
      mismatches
    };
  }

  static recalculateDraftInvoice(
    context: BillingComputationContext,
    invoiceId: string
  ): DraftInvoiceRecalculation {
    const invoice = (context.invoices || []).find(row => row.id === invoiceId);
    if (!invoice) return { canRecalculate: false, reason: 'Invoice not found.' };
    if (!invoice.batchId) return { invoice, canRecalculate: false, reason: 'Invoice is not linked to a batch.' };
    if (!this.isDraftInvoice(invoice)) {
      const validation = this.validateInvoiceLinesAgainstBatchCap(context, invoice.batchId, invoice.lines || []);
      return {
        invoice,
        canRecalculate: false,
        reason: validation.isValid ? 'Posted invoices keep their historical quantity snapshot.' : 'Posted invoice quantity differs from current enrolled quantity and needs controlled correction.',
        expectedQty: validation.expectedQty
      };
    }

    const computed = this.computeCourseFeeInvoice(context, invoice.batchId);
    const subtotal = roundMoney(computed.lines.reduce((sum, line) => sum + toNumber(line.netAmount), 0));
    const vatAmount = roundMoney(computed.lines.reduce((sum, line) => sum + toNumber(line.vatAmount), 0));
    const grandTotal = roundMoney(subtotal + vatAmount);
    const netAmountDue = roundMoney(grandTotal - toNumber(invoice.totalEwtAmount, 0));
    const balanceDue = roundMoney(Math.max(netAmountDue - toNumber(invoice.amountPaid, 0), 0));

    return {
      invoice,
      canRecalculate: true,
      expectedQty: computed.enrolledQty,
      lines: computed.lines.map((line, index) => ({
        ...line,
        id: invoice.lines?.[index]?.id || line.id,
        invoiceId: invoice.id,
        orgId: invoice.orgId,
        lineNumber: index + 1
      })),
      subtotal,
      vatAmount,
      grandTotal,
      netAmountDue,
      balanceDue
    };
  }

  static reconcileInvoiceBalance(context: BillingComputationContext, invoiceId: string) {
    const invoice = (context.invoices || []).find(row => row.id === invoiceId);
    if (!invoice) return { isValid: false, reason: 'Invoice not found.', mismatches: ['Invoice not found.'] };

    const expectedBalanceDue = roundMoney(Math.max(toNumber(invoice.netAmountDue ?? invoice.grandTotal, 0) - toNumber(invoice.amountPaid, 0), 0));
    const mismatches: string[] = [];
    if (Math.abs(expectedBalanceDue - toNumber(invoice.balanceDue, 0)) > 0.01) {
      mismatches.push(`Invoice balanceDue ${invoice.balanceDue} differs from computed ${expectedBalanceDue}.`);
    }

    const arLines = (context.journalLines || []).filter(line =>
      (context.journalEntries || []).some(entry =>
        entry.id === line.journalEntryId &&
        entry.sourceType === 'INVOICE' &&
        entry.sourceRef === invoiceId &&
        entry.status === 'POSTED'
      )
    );
    const glArBalance = roundMoney(arLines.reduce((sum, line) => sum + toNumber(line.debit) - toNumber(line.credit), 0));
    if (arLines.length > 0 && Math.abs(glArBalance - toNumber(invoice.balanceDue, 0)) > 0.01) {
      mismatches.push(`GL AR balance ${glArBalance} differs from invoice balanceDue ${invoice.balanceDue}.`);
    }

    return {
      isValid: mismatches.length === 0,
      invoiceId,
      expectedBalanceDue,
      glArBalance,
      mismatches
    };
  }

  static computePaymentExcess(payment: Pick<Payment, 'amountReceived' | 'ewtAmountCertified' | 'totalApplied'>): number {
    return roundMoney(Math.max(
      toNumber(payment.amountReceived, 0) + toNumber(payment.ewtAmountCertified, 0) - toNumber(payment.totalApplied, 0),
      0
    ));
  }

  static validatePaymentApplication(
    payment: Pick<Payment, 'customerDepositBalance' | 'amountReceived' | 'ewtAmountCertified' | 'totalApplied'>,
    amountApplied: number
  ): PaymentApplicationValidation {
    const availableBalance = roundMoney(Math.max(
      Number.isFinite(Number(payment.customerDepositBalance))
        ? toNumber(payment.customerDepositBalance, 0)
        : this.computePaymentExcess(payment),
      0
    ));
    const attemptedAmount = roundMoney(toNumber(amountApplied, 0));
    const projectedBalance = roundMoney(availableBalance - attemptedAmount);
    const isValid = attemptedAmount > 0 && projectedBalance >= -0.01;
    return {
      isValid,
      availableBalance,
      attemptedAmount,
      projectedBalance: Math.max(projectedBalance, 0),
      reason: isValid ? undefined : 'Payment application exceeds available unapplied customer deposit balance.'
    };
  }

  static reconcileBatchCapVsEnrollments(context: BillingComputationContext) {
    return (context.batches || []).map(batch => {
      const classification = this.classifyEnrollmentsByBatchCap(context, batch.id);
      return {
        batchId: batch.id,
        batchCode: batch.batchCode,
        validEnrollmentCount: classification.validEnrollmentCount,
        manualFreeCount: classification.manualFreeCount,
        billableLimit: classification.limit,
        billableQty: classification.billableQty,
        freeExcessQty: classification.freeExcessEnrollments.length
      };
    });
  }

  static reconcileEnrollmentTagsVsBatchCap(context: BillingComputationContext) {
    return (context.batches || []).flatMap(batch => {
      const classification = this.classifyEnrollmentsByBatchCap(context, batch.id);
      return classification.classifiedEnrollments
        .filter(expected => {
          const actual = context.enrollments.find(enrollment => enrollment.id === expected.id);
          return actual && String(actual.billingType || 'BILLABLE') !== expected.billingType;
        })
        .map(expected => ({
          batchId: batch.id,
          enrollmentId: expected.id,
          actualBillingType: context.enrollments.find(enrollment => enrollment.id === expected.id)?.billingType || 'BILLABLE',
          expectedBillingType: expected.billingType
        }));
    });
  }

  static reconcileInvoiceLineQtyVsBatchCap(context: BillingComputationContext) {
    return (context.invoices || [])
      .filter(invoice => !!invoice.batchId && invoice.status !== 'VOIDED')
      .map(invoice => ({
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        status: invoice.status,
        ...this.validateInvoiceLinesAgainstBatchCap(context, invoice.batchId!, invoice.lines || [])
      }))
      .filter(row => !row.isValid);
  }

  static reconcilePaymentDepositBalances(context: BillingComputationContext) {
    return (context.payments || []).map(payment => {
      const expectedBalance = this.computePaymentExcess(payment);
      const actualBalance = roundMoney(Math.max(toNumber(payment.customerDepositBalance, 0), 0));
      return {
        paymentId: payment.id,
        paymentNo: payment.paymentNo,
        expectedBalance,
        actualBalance,
        isValid: Math.abs(expectedBalance - actualBalance) <= 0.01 && actualBalance >= 0
      };
    }).filter(row => !row.isValid);
  }

  private static sortEnrollmentsForBatchBilling(rows: Enrollment[]) {
    return [...rows].sort((a, b) => {
      const leftDate = String((a as RawRecord).enrolledAt || (a as RawRecord).enrolled_at || a.enrollmentDate || a.createdAt || '');
      const rightDate = String((b as RawRecord).enrolledAt || (b as RawRecord).enrolled_at || b.enrollmentDate || b.createdAt || '');
      const dateCompare = leftDate.localeCompare(rightDate);
      if (dateCompare !== 0) return dateCompare;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  private static getEnrollmentBatchId(enrollment: Enrollment): string {
    const raw = enrollment as RawRecord;
    return String(enrollment.batchId || raw.batch_id || '').trim();
  }

  private static getEnrollmentStatus(enrollment: Enrollment): string {
    const raw = enrollment as RawRecord;
    return String(enrollment.enrollmentStatus || raw.enrollment_status || '').toUpperCase();
  }

  private static getEnrollmentBillingType(enrollment: Enrollment): EnrollmentBillingType {
    const raw = enrollment as RawRecord;
    return String(enrollment.billingType || raw.billing_type || 'BILLABLE') as EnrollmentBillingType;
  }

  private static isDraftInvoice(invoice: Invoice) {
    return (invoice.status === 'DRAFT' || invoice.status === 'ON_HOLD') &&
      !invoice.postedAt &&
      !invoice.journalEntryId &&
      !invoice.glEntryNumber;
  }
}
