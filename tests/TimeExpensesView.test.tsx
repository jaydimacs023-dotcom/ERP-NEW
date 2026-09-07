import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      createTimeExpense: vi.fn().mockImplementation((expense) => Promise.resolve({ ...expense, id: 'new-id' })),
    } as any);
  });

  afterEach(() => {
    cleanup();
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

  it('populates Expense Account combobox with all chart of accounts from 1000-level to 9000-level sorted by code', async () => {
    const onNotify = vi.fn();
    const testAccounts = [
      { id: 'hdr-1000', orgId: 'org-1', code: '1000', name: 'ASSETS', class: 'ASSET', isHeader: true, isActive: true },
      { id: 'acc-1140', orgId: 'org-1', code: '1140', name: 'Prepaid Expenses', class: 'ASSET', isHeader: false, isActive: true },
      { id: 'hdr-2000', orgId: 'org-1', code: '2000', name: 'LIABILITIES', class: 'LIABILITY', isHeader: true, isActive: true },
      { id: 'acc-2101', orgId: 'org-1', code: '2101', name: 'Accounts Payable', class: 'LIABILITY', isHeader: false, isActive: true },
      { id: 'hdr-3000', orgId: 'org-1', code: '3000', name: 'EQUITY', class: 'EQUITY', isHeader: true, isActive: true },
      { id: 'acc-3101', orgId: 'org-1', code: '3101', name: 'Capital', class: 'EQUITY', isHeader: false, isActive: true },
      { id: 'hdr-4000', orgId: 'org-1', code: '4000', name: 'REVENUE', class: 'REVENUE', isHeader: true, isActive: true },
      { id: 'acc-4110', orgId: 'org-1', code: '4110', name: 'Training Fees', class: 'REVENUE', isHeader: false, isActive: true },
      { id: 'hdr-5000', orgId: 'org-1', code: '5000', name: 'EXPENSES', class: 'EXPENSE', isHeader: true, isActive: true },
      { id: 'acc-5101', orgId: 'org-1', code: '5101', name: 'Trainer Fees', class: 'EXPENSE', isHeader: false, isActive: true },
      { id: 'hdr-8000', orgId: 'org-1', code: '8000', name: 'OTHER INCOME', class: 'REVENUE', isHeader: true, isActive: true },
      { id: 'acc-8110', orgId: 'org-1', code: '8110', name: 'Interest Income', class: 'REVENUE', isHeader: false, isActive: true },
      { id: 'hdr-9000', orgId: 'org-1', code: '9000', name: 'OTHER EXPENSES', class: 'EXPENSE', isHeader: true, isActive: true },
      { id: 'acc-9101', orgId: 'org-1', code: '9101', name: 'Penalties and Surcharges', class: 'EXPENSE', isHeader: false, isActive: true },
    ];

    render(
      <TimeExpensesView
        orgId="org-1"
        vendors={[{ id: 'vendor-1', orgId: 'org-1', name: 'Vendor One' } as any]}
        accounts={testAccounts as any}
        employees={[{ id: 'emp-1', orgId: 'org-1', name: 'Juan Dela Cruz', role: 'TRAINER' } as any]}
        currency="PHP"
        onCreatePayable={vi.fn()}
        onNotify={onNotify}
      />,
    );

    // Open create form
    fireEvent.click(screen.getAllByRole('button', { name: /new expense/i })[0]);

    // Form title should show "New Cost Record"
    expect(screen.getByRole('heading', { name: /new cost record/i })).toBeInTheDocument();

    // Click and focus on the expense account combobox
    const accountInput = screen.getByRole('combobox', { name: /expense account/i });
    fireEvent.focus(accountInput);

    // Listbox should be rendered with all non-header accounts from 1000-level to 9000-level
    const listbox = await screen.findByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(7); // 1140, 2101, 3101, 4110, 5101, 8110, 9101

    // Verify order from 1000-level to 9000-level
    expect(options[0]).toHaveTextContent('1140');
    expect(options[0]).toHaveTextContent('Prepaid Expenses');
    expect(options[1]).toHaveTextContent('2101');
    expect(options[1]).toHaveTextContent('Accounts Payable');
    expect(options[2]).toHaveTextContent('3101');
    expect(options[2]).toHaveTextContent('Capital');
    expect(options[3]).toHaveTextContent('4110');
    expect(options[3]).toHaveTextContent('Training Fees');
    expect(options[4]).toHaveTextContent('5101');
    expect(options[4]).toHaveTextContent('Trainer Fees');
    expect(options[5]).toHaveTextContent('8110');
    expect(options[5]).toHaveTextContent('Interest Income');
    expect(options[6]).toHaveTextContent('9101');
    expect(options[6]).toHaveTextContent('Penalties and Surcharges');

    // Select an account from the list
    fireEvent.click(options[0]);
    expect(accountInput).toHaveValue('1140 — Prepaid Expenses');
  });

  it('allows saving a cost record with an asset/advance account like 1130 Advances to Officers and Employees', async () => {
    const onNotify = vi.fn();
    const createTimeExpenseMock = vi.fn().mockImplementation((expense) => Promise.resolve({ ...expense, id: 'new-id' }));
    vi.spyOn(DataServiceFactory, 'getService').mockReturnValue({
      getTimeExpensesByOrg: vi.fn().mockResolvedValue([]),
      createTimeExpense: createTimeExpenseMock,
    } as any);

    render(
      <TimeExpensesView
        orgId="org-1"
        vendors={[{ id: 'vendor-1', orgId: 'org-1', name: 'Vendor One' } as any]}
        accounts={[
          { id: 'acc-1130', orgId: 'org-1', code: '1130', name: 'Advances to Officers and Employees', class: 'ASSET', isHeader: false, isActive: true },
        ] as any}
        employees={[{ id: 'emp-1', orgId: 'org-1', name: 'Juan Dela Cruz', role: 'TRAINER' } as any]}
        qualifications={[{ id: 'qual-1', orgId: 'org-1', code: 'WLD-NC2', name: 'SMAW NC II' } as any]}
        taxCategories={[{ id: 'tax-1', orgId: 'org-1', code: 'NON-VAT', description: 'Zero/Non-VAT', rate: 0 } as any]}
        currency="PHP"
        onCreatePayable={vi.fn()}
        onNotify={onNotify}
      />,
    );

    // Open create form
    fireEvent.click(screen.getAllByRole('button', { name: /new expense/i })[0]);

    // Fill in form fields
    fireEvent.change(screen.getByLabelText(/rfq code/i), { target: { value: 'ADV-001' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Travel cash advance for training' } });
    fireEvent.change(screen.getByPlaceholderText(/supplier or merchant name/i), { target: { value: 'Juan Dela Cruz' } });
    fireEvent.change(screen.getByLabelText(/claimed by/i), { target: { value: 'emp-1' } });
    fireEvent.change(screen.getByLabelText(/^class$/i), { target: { value: 'qual-1' } });
    fireEvent.change(screen.getByLabelText(/supplier tax category/i), { target: { value: 'tax-1' } });

    // Select the Cash Advance account
    const accountInput = screen.getByRole('combobox', { name: /expense account/i });
    fireEvent.focus(accountInput);
    const listbox = await screen.findByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options[0]).toHaveTextContent('1130');
    expect(options[0]).toHaveTextContent('Advances to Officers and Employees');
    fireEvent.click(options[0]);

    // Quantity & Unit Cost
    fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^unit cost$/i), { target: { value: '5000' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /save expense/i }));

    await waitFor(() => {
      expect(createTimeExpenseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseAccountId: 'acc-1130',
          amount: 5000,
          claimedBy: 'Juan Dela Cruz',
        }),
      );
    });

    expect(onNotify).toHaveBeenCalledWith('success', 'Expense record created.');
  });
});


