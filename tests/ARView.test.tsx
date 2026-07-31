// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import ARView from '../views/ARView';

describe('ARView smoke tests', () => {
  it('lists all matching course fees as invoice lines when a batch is selected', () => {
    const onNotify = vi.fn();
    const props: any = {
      entries: [],
      lines: [],
      students: [],
      sponsors: [{ id: 'sponsor-1', orgId: 'org', name: 'Forklift Sponsor', courseFeeType: 'SPONSORED' }],
      items: [],
      itemGroups: [],
      accounts: [
        { id: 'ar-1', orgId: 'org', code: '1200', name: 'Accounts Receivable', class: 'ASSET', isActive: true, isHeader: false },
        { id: 'revenue-1', orgId: 'org', code: '4100', name: 'Training Revenue', class: 'REVENUE', isActive: true, isHeader: false }
      ],
      bankAccounts: [],
      batches: [{
        id: 'batch-forklift',
        orgId: 'org',
        batchCode: 'FL-2026-01',
        name: 'Forklift Batch',
        year: 2026,
        qualificationId: 'qualification-forklift',
        trainerId: 'trainer-1',
        sponsorId: 'sponsor-1',
        studentIds: ['student-1', 'student-2'],
        status: 'ONGOING',
        startDate: '2026-07-01',
        endDate: '2026-07-31'
      }],
      qualifications: [{
        id: 'qualification-forklift',
        orgId: 'org',
        code: 'FORKLIFT',
        name: 'Forklift Operation',
        durationDays: 20,
        createdAt: ''
      }],
      enrollments: [],
      courseFees: [
        {
          id: 'fee-training',
          orgId: 'org',
          feeCode: 'FL-TRAINING',
          qualificationId: 'qualification-forklift',
          fundingType: 'SPONSORED',
          feeName: 'Forklift Training Fee',
          amount: 5000,
          glAccountId: 'revenue-1',
          isActive: true,
          createdAt: ''
        },
        {
          id: 'fee-assessment',
          orgId: 'org',
          feeCode: 'FL-ASSESSMENT',
          qualificationId: 'qualification-forklift',
          fundingType: 'SPONSORED',
          feeName: 'Forklift Assessment Fee',
          amount: 1000,
          glAccountId: 'revenue-1',
          isActive: true,
          createdAt: ''
        },
        {
          id: 'fee-other-course',
          orgId: 'org',
          feeCode: 'OTHER',
          qualificationId: 'another-qualification',
          fundingType: 'SPONSORED',
          feeName: 'Unrelated Course Fee',
          amount: 9999,
          glAccountId: 'revenue-1',
          isActive: true,
          createdAt: ''
        }
      ],
      taxCategories: [],
      onPostInvoice: vi.fn(),
      onNotify,
      orgId: 'org'
    };

    render(<ARView {...props} />);
    fireEvent.click(screen.getByText(/New Invoice/i));

    const recipientSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(recipientSelect, { target: { value: 'sponsor-1' } });
    fireEvent.change(screen.getByLabelText('Training Batch'), { target: { value: 'batch-forklift' } });

    expect(screen.getByText('Forklift Training Fee')).toBeInTheDocument();
    expect(screen.getByText('Forklift Assessment Fee')).toBeInTheDocument();
    expect(screen.queryByText('Unrelated Course Fee')).not.toBeInTheDocument();
    expect(onNotify).toHaveBeenCalledWith('success', expect.stringContaining('Loaded 2 course fees'));
  });

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
