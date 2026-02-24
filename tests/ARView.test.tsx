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
        // make various categories inclusive so formula is exercised
        { id: 'tc1', orgId: 'org', code: 'VATGOODS', description: 'VAT Goods', taxType: 'VAT', rate: 12.0, isInclusive: true, outputAccountId: '', createdAt: '' },
        { id: 'tc_vs', orgId: 'org', code: 'VATSERV', description: 'VAT Services', taxType: 'VAT', rate: 12.0, isInclusive: true, outputAccountId: '', createdAt: '' },
        { id: 'tc_nv', orgId: 'org', code: 'NVGOODS', description: 'Non‑VAT Goods', taxType: 'VAT', rate: 12.0, isInclusive: true, outputAccountId: '', createdAt: '' },
        { id: 'tc_ex', orgId: 'org', code: 'EXMPTGOODS', description: 'Exempt Goods', taxType: 'VAT', rate: 12.0, isInclusive: true, outputAccountId: '', createdAt: '' },
        { id: 'tc_z', orgId: 'org', code: 'ZEROGOODS', description: 'Zero-rate Goods', taxType: 'VAT', rate: 0, isInclusive: true, outputAccountId: '', createdAt: '' },
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

    // now verify the VAT calculation works for an inclusive category
    // set quantity and price, then inspect totals displayed in footer
    const qtyInputs = screen.getAllByRole('spinbutton');
    // first spinner should be quantity, second is price
    fireEvent.change(qtyInputs[0], { target: { value: '1' } });
    fireEvent.change(qtyInputs[1], { target: { value: '112' } });

    // totals should reflect inclusive calculation: net ₱100.00 and VAT ₱12.00
    expect(screen.getByText(/₱\s*100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/₱\s*12\.00/)).toBeInTheDocument();

    // switch to service category and amounts should remain the same
    fireEvent.change(combos[0], { target: { value: 'tc_vs' } });
    expect(screen.getByText(/₱\s*100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/₱\s*12\.00/)).toBeInTheDocument();

    // also verify NV/EXMPT behave same and zero category gives zero VAT
    fireEvent.change(combos[0], { target: { value: 'tc_nv' } });
    expect(screen.getByText(/₱\s*12\.00/)).toBeInTheDocument();
    fireEvent.change(combos[0], { target: { value: 'tc_ex' } });
    expect(screen.getByText(/₱\s*12\.00/)).toBeInTheDocument();
    fireEvent.change(combos[0], { target: { value: 'tc_z' } });
    expect(screen.getByText(/₱\s*0\.00/)).toBeInTheDocument();
  });
});
