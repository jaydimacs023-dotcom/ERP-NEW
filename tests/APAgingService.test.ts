import { describe, expect, it, vi } from 'vitest';
import type { Payable } from '../types';
import { fetchAllOpenPayables, getPayableOutstanding } from '../services/APAgingService';

const payable = (overrides: Partial<Payable>): Payable => ({
  id: 'payable-1',
  orgId: 'org-1',
  vendorId: 'vendor-1',
  payableNumber: 'BILL-001',
  category: 'other',
  description: 'Open bill',
  amount: 1000,
  billDate: '2026-01-01',
  dueDate: '2026-01-31',
  status: 'approved',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('APAgingService', () => {
  it('fetches every page of posted open AP transactions for the active organization', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ rows: [payable({ id: 'payable-1' })], total: 2, page: 1, pageSize: 500, totalPages: 2 })
      .mockResolvedValueOnce({ rows: [payable({ id: 'payable-2' })], total: 2, page: 2, pageSize: 500, totalPages: 2 });

    const rows = await fetchAllOpenPayables({ fetchPage } as any, 'org-1', 'id,org_id,status');

    expect(rows.map(row => row.id)).toEqual(['payable-1', 'payable-2']);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 'payables', expect.objectContaining({
      page: 1,
      pageSize: 500,
      filters: [
        { column: 'org_id', operator: 'eq', value: 'org-1' },
        { column: 'is_deleted', operator: 'eq', value: false },
        { column: 'status', operator: 'in', value: ['approved', 'partially_paid'] },
      ],
    }));
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'payables', expect.objectContaining({ page: 2 }));
  });

  it('uses VAT, withholding, memos, and payments in the outstanding balance', () => {
    expect(getPayableOutstanding(payable({
      amount: 1000,
      inputVatAmount: 120,
      withholdingAmount: 20,
      memoAdjustmentTotal: -100,
      paidAmount: 400,
    }))).toBe(600);
  });

  it('reduces AP for credit memos instead of treating them as zero', () => {
    expect(getPayableOutstanding(payable({ invoiceType: 'credit_memo', amount: 250 }))).toBe(-250);
  });
});
