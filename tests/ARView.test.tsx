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
  });
});
