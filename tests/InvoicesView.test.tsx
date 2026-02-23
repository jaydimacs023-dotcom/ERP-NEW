import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import InvoicesView from '../views/InvoicesView';
import { Invoice } from '../types';

describe('InvoicesView tax category dropdown', () => {
  const baseProps: any = {
    invoices: [],
    sponsors: [],
    students: [],
    enrollments: [],
    batches: [],
    qualifications: [],
    courseFees: [],
    accounts: [],
    currency: 'PHP',
    onAddInvoice: vi.fn(),
    onUpdateInvoice: vi.fn(),
    onDeleteInvoice: vi.fn().mockResolvedValue(true),
    orgId: 'org1',
    taxCategories: [
      { id: 'tc1', orgId: 'org1', code: 'VAT', description: 'VAT goods', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tc2', orgId: 'org1', code: 'EXEMPT', description: 'Tax exempt', taxType: 'EXEMPT', rate: 0, isInclusive: false, outputAccountId: '', createdAt: '' }
    ]
  };

  it('shows tax category options in new invoice form', () => {
    render(<InvoicesView {...baseProps} />);
    // open form
    const newBtn = screen.getByText(/New Invoice/i);
    fireEvent.click(newBtn);
    // click add line
    const addLine = screen.getByText(/Add Line/i);
    fireEvent.click(addLine);
    // the Tax Cat header should exist
    expect(screen.getByText(/Tax Cat/i)).toBeInTheDocument();
    // VAT pricing/rate inputs should no longer be rendered
    expect(screen.queryByText(/VAT Pricing/i)).toBeNull();
    expect(screen.queryByText(/VAT Rate/i)).toBeNull();
    // verify options in the first dropdown
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
    fireEvent.change(selects[0], { target: { value: 'tc1' } });
    expect(screen.getByDisplayValue(/VAT/)).toBeInTheDocument();

    // also check that choosing a category affects computed amounts
    const qtyInput = screen.getByDisplayValue('1');
    const priceInput = screen.getByDisplayValue('0');
    // change quantity and price
    fireEvent.change(qtyInput, { target: { value: '2' } });
    fireEvent.change(priceInput, { target: { value: '100' } });
    // subtotal should now reflect net + vat (12% of 200 = 24 -> 224)
    expect(screen.getByText(/224/)).toBeInTheDocument();
  });
});