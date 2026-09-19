import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PayablesView from '../views/PayablesView';
import { AccountClass, Payable, Vendor, ChartOfAccount, User, Qualification, TaxCategoryEntry } from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';

describe('PayablesView - AR-style Interactive Line Items & Reimbursement Workflow', () => {
  const mockOrgId = 'org-test-123';
  const mockCurrentUserId = 'user-admin-1';

  const mockVendors: Vendor[] = [
    {
      id: 'ven-1',
      orgId: mockOrgId,
      name: 'Office Depot Supplies',
      tin: '123-456-789',
      status: 'active',
      apAccountId: 'acc-ap-1',
      paymentTermsDays: 30,
      createdAt: '2026-01-01T00:00:00Z',
    }
  ];

  const mockAccounts: ChartOfAccount[] = [
    {
      id: 'acc-exp-1',
      orgId: mockOrgId,
      code: '5100',
      name: 'Training & Instructional Supplies',
      class: AccountClass.EXPENSE,
      balance: 0,
      isHeader: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'acc-exp-2',
      orgId: mockOrgId,
      code: '5200',
      name: 'Travel & Meals Expense',
      class: AccountClass.EXPENSE,
      balance: 0,
      isHeader: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'acc-ap-1',
      orgId: mockOrgId,
      code: '2100',
      name: 'Accounts Payable',
      class: AccountClass.LIABILITY,
      balance: 0,
      isHeader: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'acc-wht-1',
      orgId: mockOrgId,
      code: '2150',
      name: 'Withholding Tax Payable',
      class: AccountClass.LIABILITY,
      balance: 0,
      isHeader: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'acc-vat-1',
      orgId: mockOrgId,
      code: '1170',
      name: 'Input Tax / VAT',
      class: AccountClass.ASSET,
      balance: 0,
      isHeader: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  const mockQualifications: Qualification[] = [
    {
      id: 'qual-1',
      orgId: mockOrgId,
      code: 'SMAW-NC2',
      name: 'Shielded Metal Arc Welding NC II',
      description: 'Welding',
      nominalDurationHours: 268,
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    }
  ];

  const mockEmployees: User[] = [
    {
      id: 'emp-ranil',
      orgId: mockOrgId,
      name: 'Ranil Melgo',
      email: 'ranil@institution.edu',
      role: 'FINANCE',
      createdAt: '2026-01-01T00:00:00Z',
      isDeleted: false,
    }
  ];

  const mockTaxCategories: TaxCategoryEntry[] = [
    {
      id: 'tc-vat-12',
      orgId: mockOrgId,
      code: 'VATGOODS',
      description: 'VAT on Goods (12%)',
      taxType: 'VAT',
      rate: 12,
      isInclusive: true,
      createdAt: '2026-01-01T00:00:00Z',
    }
  ];

  const baseProps = {
    orgId: mockOrgId,
    currentUserId: mockCurrentUserId,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canApprove: true,
    canPay: true,
    canCancel: true,
    payables: [] as Payable[],
    vendors: mockVendors,
    accounts: mockAccounts,
    qualifications: mockQualifications,
    entries: [],
    bankAccounts: [],
    purchaseOrders: [],
    vendorTaxSettings: [],
    employees: mockEmployees,
    taxCategories: mockTaxCategories,
    onCreatePayable: vi.fn().mockImplementation((p: Payable) => Promise.resolve(p)),
    onUpdatePayable: vi.fn().mockImplementation((p: Payable) => Promise.resolve(p)),
    onDeletePayable: vi.fn().mockResolvedValue(true),
    onPostJournal: vi.fn().mockResolvedValue('je-1'),
    onJournalChanged: vi.fn(),
    onNotify: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(DataServiceFactory, 'getService').mockReturnValue({
      fetchPage: vi.fn().mockResolvedValue({ rows: [], total: 0, totalPages: 1, page: 1, pageSize: 10 }),
      getTimeExpensesByOrg: vi.fn().mockResolvedValue([]),
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the Create Bill form with AR-style interactive line items table and buttons', async () => {
    render(<PayablesView {...baseProps} />);

    // Click "New Bill" button
    const createBtn = screen.getByRole('button', { name: /new bill/i });
    fireEvent.click(createBtn);

    // Verify line item action buttons from AR invoice table styling
    expect(screen.getByRole('button', { name: /export line items/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add line/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discount/i })).toBeInTheDocument();

    // Verify column headers
    expect(screen.getByText('Class')).toBeInTheDocument();
    expect(screen.getByText('Expense / Asset Account *')).toBeInTheDocument();
    expect(screen.getByText('Tax Category')).toBeInTheDocument();

    // Verify GL Journal Entry Preview card
    expect(screen.getByText(/GL Journal Preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Balanced/i)).toBeInTheDocument();
  });

  it('allows adding line items and updating quantities & prices', async () => {
    render(<PayablesView {...baseProps} />);

    // Open Create Bill form
    const createBtn = screen.getByRole('button', { name: /new bill/i });
    fireEvent.click(createBtn);

    // Click "+ Add Line"
    const addLineBtn = screen.getByRole('button', { name: /add line/i });
    fireEvent.click(addLineBtn);

    // Should now have 2 lines badge
    expect(screen.getByText('2 lines')).toBeInTheDocument();

    // Click "Discount" button
    const discountBtn = screen.getByRole('button', { name: /discount/i });
    fireEvent.click(discountBtn);

    // Should now have 3 lines badge
    expect(screen.getByText('3 lines')).toBeInTheDocument();
  });

  it('supports monthly consolidated employee reimbursement for Ranil Melgo with multi-line receipts', async () => {
    const consolidatedBill: Payable = {
      id: 'bill-ranil-august',
      orgId: mockOrgId,
      payableNumber: 'BILL-2026-0088',
      category: 'employee_reimbursements',
      qualificationId: 'qual-1',
      description: 'August 2026 Consolidated Reimbursement - Ranil Melgo (3 receipts)',
      amount: 4500,
      billDate: '2026-08-31',
      dueDate: '2026-09-15',
      currency: 'PHP',
      status: 'for_approval',
      claimedBy: 'Ranil Melgo',
      employeeId: 'emp-ranil',
      inputVatAmount: 0,
      netPayable: 4500,
      expenseAllocations: [
        {
          lineNumber: 1,
          lineType: 'EXPENSE',
          expenseAccountId: 'acc-exp-1',
          qualificationId: 'qual-1',
          description: 'Welding rods for mock assessment',
          amount: 2500,
          quantity: 1,
          unitPrice: 2500,
          sourceExpenseId: 'exp-1'
        },
        {
          lineNumber: 2,
          lineType: 'EXPENSE',
          expenseAccountId: 'acc-exp-2',
          qualificationId: 'qual-1',
          description: 'TESDA Regional Meeting grab taxi fare',
          amount: 2000,
          quantity: 1,
          unitPrice: 2000,
          sourceExpenseId: 'exp-2'
        }
      ],
      createdAt: '2026-08-31T10:00:00Z',
    };

    vi.spyOn(DataServiceFactory, 'getService').mockReturnValue({
      fetchPage: vi.fn().mockResolvedValue({ rows: [consolidatedBill], total: 1, totalPages: 1, page: 1, pageSize: 10 }),
      getTimeExpensesByOrg: vi.fn().mockResolvedValue([]),
    } as any);

    render(<PayablesView {...baseProps} payables={[consolidatedBill]} />);

    // Wait for the bill to be listed in the table
    await waitFor(() => {
      expect(screen.getByText('BILL-2026-0088')).toBeInTheDocument();
    });

    // Check that claimant "Ranil Melgo" is displayed
    expect(screen.getByText('Ranil Melgo')).toBeInTheDocument();
  });
});
