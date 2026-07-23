import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataServiceFactory } from '../services/DataServiceFactory';
import TimeExpensesView from '../views/TimeExpensesView';

describe('TimeExpensesView expense selection', () => {
  const expenses = [
    {
      id: 'expense-1',
      orgId: 'org-1',
      rfqCode: 'RFQ-001',
      transactionDate: '2026-07-21',
      description: 'Office supplies',
      quantity: 1,
      unitCost: 100,
      amount: 100,
      expenseAccountId: 'account-1',
      supplierId: 'vendor-1',
      claimedBy: 'User One',
      status: 'open',
      createdAt: '2026-07-21T00:00:00.000Z',
    },
    {
      id: 'expense-2',
      orgId: 'org-1',
      rfqCode: 'RFQ-002',
      transactionDate: '2026-07-22',
      description: 'Delivery fee',
      quantity: 1,
      unitCost: 50,
      amount: 50,
      expenseAccountId: 'account-2',
      supplierId: 'vendor-1',
      claimedBy: 'User One',
      status: 'open',
      createdAt: '2026-07-22T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(DataServiceFactory, 'getService').mockReturnValue({
      getTimeExpensesByOrg: vi.fn().mockResolvedValue(expenses),
    } as any);
  });

  it('allows expenses from the same supplier with different expense accounts', async () => {
    const onNotify = vi.fn();
    render(
      <TimeExpensesView
        orgId="org-1"
        vendors={[{ id: 'vendor-1', orgId: 'org-1', name: 'Vendor One' } as any]}
        accounts={[
          { id: 'account-1', orgId: 'org-1', code: '5000', name: 'Supplies', class: 'EXPENSE', isHeader: false },
          { id: 'account-2', orgId: 'org-1', code: '5100', name: 'Delivery', class: 'EXPENSE', isHeader: false },
        ] as any}
        currency="PHP"
        onCreatePayable={vi.fn()}
        onNotify={onNotify}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    const checkboxes = screen.getAllByRole('checkbox');

    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();
    expect(onNotify).not.toHaveBeenCalledWith(
      'info',
      expect.stringContaining('expense account'),
    );
  });
});
