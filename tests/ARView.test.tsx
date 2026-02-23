import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import ARView from '../views/ARView';

describe('ARView smoke tests', () => {
  it('renders safely with undefined arrays and opens invoice modal', () => {
    const props: any = {
      entries: undefined,
      lines: undefined,
      students: undefined,
      sponsors: undefined,
      items: undefined,
      itemGroups: undefined,
      accounts: undefined,
      bankAccounts: undefined,
      batches: undefined,
      qualifications: undefined,
      taxCategories: [
        { id: 'tc1', orgId: 'org', code: 'VATGOODS', description: 'VAT Goods', taxType: 'VAT', rate: 12.0, isInclusive: false, outputAccountId: '', createdAt: '' },
        { id: 'tc2', orgId: 'org', code: 'EXEMPT', description: 'Exempt', taxType: 'EXEMPT', rate: 0, isInclusive: false, outputAccountId: '', createdAt: '' }
      ],
      onPostInvoice: vi.fn(),
      onNotify: vi.fn(),
    };

    render(<ARView {...props} />);

    // Basic render verification
    expect(screen.getByText(/Receivables & Collections/i)).toBeInTheDocument();

    // Open invoice modal and verify modal content renders without throwing
    const newInvoiceBtn = screen.getByText(/New Invoice/i);
    fireEvent.click(newInvoiceBtn);
    expect(screen.getByText(/Target G\/L Receivable Account/i)).toBeInTheDocument();
    // tax category column should be available in line items
    expect(screen.getByText(/Tax Cat/i)).toBeInTheDocument();
    // and dropdown should include options from passed taxCategories
    const combos = screen.getAllByRole('combobox');
    expect(combos.length).toBeGreaterThan(0);
    fireEvent.change(combos[0], { target: { value: 'tc1' } });
    expect(screen.getByRole('option', { name: /VATGOODS/ })).toBeInTheDocument();

  });
});
