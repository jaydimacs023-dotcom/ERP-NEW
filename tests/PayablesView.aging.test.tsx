// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Payable } from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';
import PayablesView, { getPayableOutstanding } from '../views/PayablesView';

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

describe('PayablesView AP Aging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fetches every page of posted open AP transactions for the active organization', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ rows: [payable({ id: 'payable-1' })], total: 2, page: 1, pageSize: 500, totalPages: 2 })
      .mockResolvedValueOnce({ rows: [payable({ id: 'payable-2', amount: 500 })], total: 2, page: 2, pageSize: 500, totalPages: 2 });
    vi.spyOn(DataServiceFactory, 'getService').mockReturnValue({
      fetchPage,
      getTimeExpensesByOrg: vi.fn().mockResolvedValue([]),
    } as any);

    render(
      <PayablesView
        view="aging"
        orgId="org-1"
        payables={[]}
        vendors={[{ id: 'vendor-1', orgId: 'org-1', name: 'Vendor One', createdAt: '2026-01-01' } as any]}
        accounts={[]}
        qualifications={[]}
        entries={[]}
        onCreatePayable={vi.fn()}
        onUpdatePayable={vi.fn()}
        onDeletePayable={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage).toHaveBeenNthCalledWith(1, 'payables', expect.objectContaining({
      page: 1,
      pageSize: 500,
      filters: expect.arrayContaining([
        { column: 'org_id', operator: 'eq', value: 'org-1' },
        { column: 'is_deleted', operator: 'eq', value: false },
        { column: 'status', operator: 'in', value: ['approved', 'partially_paid'] },
      ]),
    }));
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'payables', expect.objectContaining({ page: 2 }));
    expect(await screen.findByText('Vendor One')).toBeInTheDocument();
  });

  it('reduces AP for credit memos instead of treating them as zero', () => {
    expect(getPayableOutstanding(payable({ invoiceType: 'credit_memo', amount: 250 }))).toBe(-250);
  });
});
