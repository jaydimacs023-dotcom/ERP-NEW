import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import InvoicesView from '../views/InvoicesView';
import { Invoice } from '../types';
import { SupabaseDataService } from '../services/SupabaseDataService';


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

  // spy on SupabaseDataService to prevent real network calls and return known categories
  beforeEach(() => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchPage').mockResolvedValue({
      rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0
    });
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tc1', orgId: 'org1', code: 'VAT', description: 'VAT goods', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tc2', orgId: 'org1', code: 'EXEMPT', description: 'Tax exempt', taxType: 'EXEMPT', rate: 0, isInclusive: false, outputAccountId: '', createdAt: '' }
    ]);
  });

  const waitForTaxOption = async (select: HTMLElement, value: string) => {
    await waitFor(() => expect(select.querySelector(`option[value="${value}"]`)).not.toBeNull());
  };

  it('shows tax category options in new invoice form', async () => {
    render(<InvoicesView {...baseProps} />);
    // open form
    const newBtn = screen.getByText(/New Invoice/i);
    fireEvent.click(newBtn);
    // click add line
    const addLine = screen.getByRole('button', { name: /Add Line/i });
    fireEvent.click(addLine);
    // the Tax Cat header should exist
    expect(screen.getByText('Tax Category *')).toBeInTheDocument();
    // VAT pricing/rate inputs should no longer be rendered
    expect(screen.queryByText(/VAT Pricing/i)).toBeNull();
    expect(screen.queryByText(/VAT Rate/i)).toBeNull();
    // verify options in the first dropdown
    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc1');
    fireEvent.change(taxCategory, { target: { value: 'tc1' } });
    expect(screen.getByDisplayValue(/VAT/)).toBeInTheDocument();

    // also check that choosing a category affects computed amounts
    const qtyInput = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const priceInput = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    // change quantity and price
    fireEvent.change(qtyInput, { target: { value: '2' } });
    fireEvent.change(priceInput, { target: { value: '100' } });
    // subtotal should now reflect net 200 and vat 24; amount column shows 200
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('200');
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('24');
    const amt = screen.getByRole('textbox', { name: /Amount line 1/i });
    expect(amt).toBeInTheDocument();
  });

  it('calculates correctly for exclusive vs inclusive pricing', async () => {
    // override spy data with one inclusive and one exclusive category
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tc_ex', orgId: 'org1', code: 'EX', description: 'Exclusive VAT', taxType: 'VAT', rate: 0.12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tc_in', orgId: 'org1', code: 'IN', description: 'Inclusive VAT', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' }
    ]);

    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc_ex');
    // pick exclusive first
    fireEvent.change(taxCategory, { target: { value: 'tc_ex' } });
    const qty = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const price = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    fireEvent.change(qty, { target: { value: '1' } });
    fireEvent.change(price, { target: { value: '100' } });
    // amount column should show net 100 (vat kept separate)
    expect(screen.getByRole('textbox', { name: /Amount line 1/i })).toHaveValue('100.00');
    // totals should show subtotal 100, VAT 12, grand total 112
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('100');
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('12');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('112');

    // now switch to inclusive category
    fireEvent.change(taxCategory, { target: { value: 'tc_in' } });
    // amount should now equal entered price (100) and vat derived from gross
    expect(screen.getByRole('textbox', { name: /Amount line 1/i })).toHaveValue('100.00');
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('89.29');
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('10.71');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('100');
  });

  it('lets user override amount and recalculates tax accordingly', async () => {
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    // set exclusive category
    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc1');
    fireEvent.change(taxCategory, { target: { value: 'tc1' } });

    // manually override amount to 100; since exclusive, VAT=12 -> total shown separately
    const amountInput = screen.getByRole('textbox', { name: /Amount line 1/i });
    fireEvent.change(amountInput, { target: { value: '100' } });
    // amount column shows net only
    expect(amountInput).toHaveValue('100.00');
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('100');
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('12');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('112');

    // quantity and unit price edits intentionally restore the calculated amount
    const qty = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const price = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    fireEvent.change(qty, { target: { value: '5' } });
    fireEvent.change(price, { target: { value: '200' } });
    expect(amountInput).toHaveValue('1,000.00');

    // change category to inclusive, tax should be derived from gross 100
    fireEvent.change(taxCategory, { target: { value: 'tc2' } });
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('1,000');
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('0');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('1,000');
  });

  it('computes VAT correctly for inclusive categories (VATGOODS or VATSERV)', async () => {
    // inclusive tax categories should extract VAT from the gross amount using
    // the formula: (gross ÷ (1 + rate)) × rate.  behaviour must be identical
    // whether the code is "VATGOODS" or "VatServ".
    const cats = [
      { id: 'tc_vs', orgId: 'org1', code: 'VatServ', description: 'Service VAT', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' },
      { id: 'tc_g', orgId: 'org1', code: 'VATGOODS', description: 'Goods VAT', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' }
    ];
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue(cats);
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc_vs');
    fireEvent.change(taxCategory, { target: { value: 'tc_vs' } });
    const qty2 = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const price2 = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    fireEvent.change(qty2, { target: { value: '10' } });
    fireEvent.change(price2, { target: { value: '3972' } });

    const gross = 10 * 3972;          // 39,720
    const expectedVat = Math.round((gross / 1.12 * 0.12) * 100) / 100; // 4,251.43
    const expectedNet = Math.round((gross - expectedVat) * 100) / 100; // 35,468.57

    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent(expectedNet.toLocaleString('en-US'));
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent(expectedVat.toLocaleString('en-US'));
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent(gross.toLocaleString('en-US'));

    // switch to the other category and ensure amounts remain unchanged
    fireEvent.change(taxCategory, { target: { value: 'tc_g' } });
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent(expectedNet.toLocaleString('en-US'));
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent(expectedVat.toLocaleString('en-US'));
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent(gross.toLocaleString('en-US'));
  });

  it('does not charge output VAT for non-VAT, exempt, and zero-rated categories', async () => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tc_nv', orgId: 'org1', code: 'NVGOODS', description: 'Non‑VAT Goods', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' },
      { id: 'tc_ex', orgId: 'org1', code: 'EXMPTGOODS', description: 'Exempt Goods', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' },
      { id: 'tc_z', orgId: 'org1', code: 'ZEROGOODS', description: 'Zero‑rate Goods', taxType: 'VAT', rate: 0, isInclusive: true, outputAccountId: '', createdAt: '' }
    ]);
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc_nv');
    const qty = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const price = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    fireEvent.change(qty, { target: { value: '5' } });
    fireEvent.change(price, { target: { value: '112' } });
    const gross = 5 * 112; // 560
    // These classifications all carry zero output VAT.
    fireEvent.change(taxCategory, { target: { value: 'tc_nv' } });
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('0');

    fireEvent.change(taxCategory, { target: { value: 'tc_ex' } });
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('0');

    // Zero rate results in 0 VAT
    fireEvent.change(taxCategory, { target: { value: 'tc_z' } });
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('0');
  });

  it('fetches and displays categories when prop is empty', async () => {
    const props = { ...baseProps, taxCategories: [] };
    render(<InvoicesView {...props} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    // wait for fetch call and dropdown update
    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc1');
    expect(SupabaseDataService.prototype.fetchTaxCategories).toHaveBeenCalledWith('org1');
  });

  it('does not modify amount when tax category is changed', async () => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tcX', orgId: 'org1', code: 'X', description: 'VAT 12%', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' }
    ]);

    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const amountInput = screen.getByRole('textbox', { name: /Amount line 1/i });
    fireEvent.change(amountInput, { target: { value: '250' } });

    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tcX');
    fireEvent.change(taxCategory, { target: { value: 'tcX' } });

    expect(amountInput).toHaveValue('250.00');
  });

  it('preserves line values when a batch is selected after lines exist', () => {
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const descInput = screen.getByPlaceholderText('Description');
    const priceInput = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    const amountInput = screen.getByRole('textbox', { name: /Amount line 1/i });

    fireEvent.change(descInput, { target: { value: 'Manual item' } });
    fireEvent.change(priceInput, { target: { value: '150' } });
    fireEvent.change(amountInput, { target: { value: '150' } });

    // simulate selecting a batch
    const batchSelect = screen.getByRole('combobox', { name: /Select Batch/i });
    fireEvent.change(batchSelect, { target: { value: 'someBatch' } });

    expect(descInput).toHaveValue('Manual item');
    expect(priceInput).toHaveValue('150.00');
    expect(amountInput).toHaveValue('150');
  });

  it('normalizes percentage rates and computes vat correctly for both inclusive and exclusive', async () => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tcExPerc', orgId: 'org1', code: 'VAT12', description: '12% exclusive', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tcInPerc', orgId: 'org1', code: 'VAT12I', description: '12% inclusive', taxType: 'VAT', rate: 12, isInclusive: true, outputAccountId: '', createdAt: '' }
    ]);

    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));
    const qty = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const price = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    fireEvent.change(qty, { target: { value: '1' } });
    fireEvent.change(price, { target: { value: '100' } });

    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tcExPerc');
    // exclusive first
    fireEvent.change(taxCategory, { target: { value: 'tcExPerc' } });
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('12');
    // now inclusive
    fireEvent.change(taxCategory, { target: { value: 'tcInPerc' } });
    // VAT on 100 gross should be 10.71
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('10.71');
    // grand total should equal the gross base of 100
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('100');
  });

});
