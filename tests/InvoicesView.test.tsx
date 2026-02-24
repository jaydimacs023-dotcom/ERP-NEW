import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tc1', orgId: 'org1', code: 'VAT', description: 'VAT goods', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tc2', orgId: 'org1', code: 'EXEMPT', description: 'Tax exempt', taxType: 'EXEMPT', rate: 0, isInclusive: false, outputAccountId: '', createdAt: '' }
    ]);
  });

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
    // subtotal should now reflect net 200 and vat 24; amount column shows 200
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('200');
    expect(screen.getByText(/VAT:/i).nextSibling).toHaveTextContent('24');
    const amt = screen.getByDisplayValue('200');
    expect(amt).toBeInTheDocument();
  });

  it('calculates correctly for exclusive vs inclusive pricing', () => {
    // override spy data with one inclusive and one exclusive category
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tc_ex', orgId: 'org1', code: 'EX', description: 'Exclusive VAT', taxType: 'VAT', rate: 0.12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tc_in', orgId: 'org1', code: 'IN', description: 'Inclusive VAT', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' }
    ]);

    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByText(/Add Line/i));

    const selects = screen.getAllByRole('combobox');
    // pick exclusive first
    fireEvent.change(selects[0], { target: { value: 'tc_ex' } });
    const qty = screen.getByDisplayValue('1');
    const price = screen.getByDisplayValue('0');
    fireEvent.change(qty, { target: { value: '1' } });
    fireEvent.change(price, { target: { value: '100' } });
    // amount column should show net 100 (vat kept separate)
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    // totals should show subtotal 100, VAT 12, grand total 112
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('100');
    expect(screen.getByText(/VAT:/i).nextSibling).toHaveTextContent('12');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('112');

    // now switch to inclusive category
    fireEvent.change(selects[0], { target: { value: 'tc_in' } });
    // amount should now equal entered price (100) and vat derived from gross
    expect(screen.getByText(/100/)).toBeInTheDocument();
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('89.29');
    expect(screen.getByText(/VAT:/i).nextSibling).toHaveTextContent('10.71');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('100');
  });

  it('lets user override amount and recalculates tax accordingly', () => {
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByText(/Add Line/i));

    // set exclusive category
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'tc1' } });

    // manually override amount to 100; since exclusive, VAT=12 -> total shown separately
    const amountInput = screen.getByDisplayValue('0');
    fireEvent.change(amountInput, { target: { value: '100' } });
    // amount column shows net only
    expect(amountInput).toHaveValue(100);
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('100');
    expect(screen.getByText(/VAT:/i).nextSibling).toHaveTextContent('12');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('112');

    // change qty and price after manual override - amount should not change
    const qty = screen.getByDisplayValue('1');
    const price = screen.getByDisplayValue('0');
    fireEvent.change(qty, { target: { value: '5' } });
    fireEvent.change(price, { target: { value: '200' } });
    expect(amountInput).toHaveValue(100);

    // change category to inclusive, tax should be derived from gross 100
    fireEvent.change(selects[0], { target: { value: 'tc2' } });
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('89.29');
    expect(screen.getByText(/VAT:/i).nextSibling).toHaveTextContent('10.71');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('100');
  });

  it('uses gross when category is inclusive and computes VAT as rate × gross', () => {
    // the price is quoted VAT‑inclusive; VAT is simply a percentage of that
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tc_vs', orgId: 'org1', code: 'VatServ', description: 'Service VAT', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' }
    ]);
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByText(/Add Line/i));

    const selects2 = screen.getAllByRole('combobox');
    fireEvent.change(selects2[0], { target: { value: 'tc_vs' } });
    const qty2 = screen.getByDisplayValue('1');
    const price2 = screen.getByDisplayValue('0');
    fireEvent.change(qty2, { target: { value: '10' } });
    fireEvent.change(price2, { target: { value: '3972' } });

    const gross = 10 * 3972;          // 39,720
    const expectedVat = Math.round(gross * 0.12 * 100) / 100; // 4,766.4
    const expectedNet = Math.round((gross - expectedVat) * 100) / 100; // 34,953.6

    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent(expectedNet.toString());
    expect(screen.getByText(/VAT:/i).nextSibling).toHaveTextContent(expectedVat.toString());
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent(gross.toString());
  });

  it('fetches and displays categories when prop is empty', async () => {
    const props = { ...baseProps, taxCategories: [] };
    render(<InvoicesView {...props} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByText(/Add Line/i));

    // wait for fetch call and dropdown update
    await screen.findByDisplayValue(/VAT/);
    expect(SupabaseDataService.prototype.fetchTaxCategories).toHaveBeenCalledWith('org1');
  });

  it('does not modify amount when tax category is changed', () => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tcX', orgId: 'org1', code: 'X', description: 'VAT 12%', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' }
    ]);

    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByText(/Add Line/i));

    const amountInput = screen.getByDisplayValue('0');
    fireEvent.change(amountInput, { target: { value: '250' } });

    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'tcX' } });

    expect(screen.getByDisplayValue('250')).toBeInTheDocument();
  });

  it('preserves line values when a batch is selected after lines exist', () => {
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByText(/Add Line/i));

    const descInput = screen.getByPlaceholderText('Description');
    const priceInput = screen.getByDisplayValue('0');
    const amountInput = screen.getByDisplayValue('0');

    fireEvent.change(descInput, { target: { value: 'Manual item' } });
    fireEvent.change(priceInput, { target: { value: '150' } });
    fireEvent.change(amountInput, { target: { value: '150' } });

    // simulate selecting a batch
    const batchSelect = screen.getByDisplayValue('');
    fireEvent.change(batchSelect, { target: { value: 'someBatch' } });

    expect(descInput).toHaveValue('Manual item');
    expect(priceInput).toHaveValue(150);
    expect(amountInput).toHaveValue(150);
  });

  it('normalizes percentage rates and computes vat correctly for both inclusive and exclusive', () => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tcExPerc', orgId: 'org1', code: 'VAT12', description: '12% exclusive', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tcInPerc', orgId: 'org1', code: 'VAT12I', description: '12% inclusive', taxType: 'VAT', rate: 12, isInclusive: true, outputAccountId: '', createdAt: '' }
    ]);

    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByText(/Add Line/i));
    const qty = screen.getByDisplayValue('1');
    const price = screen.getByDisplayValue('0');
    fireEvent.change(qty, { target: { value: '1' } });
    fireEvent.change(price, { target: { value: '100' } });

    const selects = screen.getAllByRole('combobox');
    // exclusive first
    fireEvent.change(selects[0], { target: { value: 'tcExPerc' } });
    expect(screen.getByText(/VAT:/i).nextSibling).toHaveTextContent('12');
    // now inclusive
    fireEvent.change(selects[0], { target: { value: 'tcInPerc' } });
    // VAT on 100 gross should be 10.71
    expect(screen.getByText(/VAT:/i).nextSibling).toHaveTextContent('10.71');
    // grand total should equal the gross base of 100
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('100');
  });

});