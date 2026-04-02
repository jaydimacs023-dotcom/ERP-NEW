import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Payment, PaymentApplication, PaymentMethod, PaymentStatus, Sponsor, Student, Invoice, BankAccount, ChartOfAccount, Organization, User as AppUser } from '../types';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Clock,
  Download,
  DollarSign,
  FileSpreadsheet,
  Landmark,
  Plus,
  Printer,
  Save,
  Search,
  Send,
  CornerUpLeft,
  User,
  Wallet,
  X,
  XCircle,
  RotateCcw,
  FileText,
  CheckSquare
} from 'lucide-react';

interface PaymentsViewProps {
  currentOrgId: string;  // Current organization for org_id separation
  organization?: Organization;
  payments: Payment[];
  sponsors: Sponsor[];
  students: Student[];
  users?: AppUser[];
  invoices: Invoice[];
  bankAccounts: BankAccount[];
  accounts: ChartOfAccount[];
  currency: string;
  onAddPayment: (payment: Payment) => void;
  onUpdatePayment: (payment: Payment) => void;
  onDeletePayment: (id: string) => Promise<boolean>;
  onPostPayment?: (payment: Payment) => void;
  onVoidPayment?: (id: string, reason: string) => void;
  onApplyToInvoice?: (paymentId: string, invoiceId: string, amount: number) => void;
  onReverseApplication?: (paymentId: string, applicationId: string, reason: string) => void;
  onViewJournal?: (journalEntryId: string) => void;
  initialContext?: { viewMode: ViewMode; invoice?: Invoice };
  onClearContext?: () => void;
}

type PayorType = 'SPONSOR' | 'STUDENT';
type ViewMode = 'list' | 'create-payment' | 'apply-payment' | 'payment-details';
type PaymentRegistryColumn = {
  key: string;
  label: string;
  align: 'text-left' | 'text-center' | 'text-right';
  minWidth: number;
  sortKey?: string;
  value: (payment: Payment) => string | number;
  render: (payment: Payment) => React.ReactNode;
};

const PaymentsView: React.FC<PaymentsViewProps> = ({
  currentOrgId,
  organization,
  payments,
  sponsors,
  students,
  users = [],
  invoices,
  bankAccounts,
  accounts,
  currency,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onPostPayment,
  onVoidPayment,
  onApplyToInvoice,
  onViewJournal,
  initialContext,
  onClearContext
}) => {
  const CASH_ON_HAND_UNDEPOSITED_ID = 'CASH_ON_HAND_UNDEPOSITED_FUNDS';
  const brandColor = '#F47721';

  // View mode management
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [payorType, setPayorType] = useState<PayorType>('SPONSOR');
  
  // List filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | 'none' }>({ key: 'paymentDate', direction: 'desc' });
  const [showPayerDropdown, setShowPayerDropdown] = useState(false);
  const [payerFilterMode, setPayerFilterMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [payerSearchTerm, setPayerSearchTerm] = useState('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  
  // Application state
  const [invoiceApplyMap, setInvoiceApplyMap] = useState<Record<string, number>>({});
  const [invoiceSelectionMap, setInvoiceSelectionMap] = useState<Record<string, boolean>>({});
  const [openInvoicesForPayor, setOpenInvoicesForPayor] = useState<Invoice[]>([]);
  const [isFetchingOpenInvoices, setIsFetchingOpenInvoices] = useState(false);
  
  // Modals
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [reversingApplication, setReversingApplication] = useState<{ payment: Payment; application: PaymentApplication } | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [showReverseModal, setShowReverseModal] = useState(false);

  // Drag-and-drop column ordering state (registry table)
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'date', 'postPeriod', 'paymentNo', 'status', 'glReference', 'payor', 'method', 'amountReceived', 'amountApplied', 'balance', 'createdBy', 'createdOn'
  ]);
  const [draggedColumnIdx, setDraggedColumnIdx] = useState<number | null>(null);

  // Column resize state (registry table)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    paymentNo: '',
    sponsorId: '',
    studentId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER' as PaymentMethod,
    refNo: '',
    bankAccountId: '',
    checkNumber: '',
    checkDate: '',
    amountReceived: 0,
    ewtAmountCertified: 0,
    notes: ''
  });

  const selectedPayorId = payorType === 'SPONSOR' ? formData.sponsorId : formData.studentId;
  // Read-only for posted/voided payments when viewing, or for payments with certain statuses
  const isReadOnly = editingPayment && (editingPayment.status === 'POSTED' || editingPayment.status === 'VOIDED' || editingPayment.status === 'OPEN' || editingPayment.status === 'CLOSED');

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency || 'PHP'
  }).format(amount || 0);

  const formatInputCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value ?? 0);
  };

  const parseInputCurrency = (value: string) => {
    const cleaned = value.replace(/,/g, '').replace(/\s/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const generatePaymentNo = () => {
    const year = new Date().getFullYear();
    // Filter payments by current year, exclude deleted payments
    // Note: This is a temporary number for UI display - the actual number is generated server-side
    const existingNums = payments
      .filter(p => 
        !p.isDeleted && 
        p.paymentNo?.startsWith(`PAY-${year}-`)
      )
      .map(p => {
        const parts = p.paymentNo.split('-');
        const n = parseInt(parts[2] || '0', 10);
        return Number.isFinite(n) ? n : 0;
      })
      .filter(n => n > 0);

    const existingSet = new Set(existingNums);
    let nextNum = existingNums.length ? Math.max(...existingNums) + 1 : 1;
    
    // Ensure no duplicates
    while (existingSet.has(nextNum)) {
      nextNum += 1;
    }

    return `PAY-${year}-${String(nextNum).padStart(5, '0')}`;
  };

  const getPayorName = (payment: Payment) => {
    if (payment.sponsorId) return sponsors.find(s => s.id === payment.sponsorId)?.name || '-';
    const student = students.find(s => s.id === payment.studentId);
    return student ? `${student.lastName}, ${student.firstName}` : '-';
  };

  const getCashGlAccount = (bankId?: string) => {
    if (!bankId) return undefined;
    const normalizedName = (name?: string) => (name || '').toLowerCase();
    if (bankId === CASH_ON_HAND_UNDEPOSITED_ID) {
      return accounts.find(a => normalizedName(a.name).includes('undeposited')) ||
        accounts.find(a => normalizedName(a.name).includes('cash on hand')) ||
        accounts.find(a => a.code === '1000');
    }
    const bank = bankAccounts.find(b => b.id === bankId);
    if (bank?.glAccountId) {
      return accounts.find(a => a.id === bank.glAccountId) ||
        accounts.find(a => a.code === bank.glAccountId);
    }
    return accounts.find(a => a.id === bankId);
  };

  const getCashGlLabel = (bankId?: string) => {
    const gl = getCashGlAccount(bankId);
    if (!gl) return `${bankAccounts.find(b => b.id === bankId)?.bankName || 'Cash Account'}`;
    const code = gl.code ? `${gl.code} - ` : '';
    return `${code}${gl.name}`;
  };

  // Resolve GL accounts for payment posting
  const resolvePaymentGlAccounts = () => {
    const normalizedName = (name?: string) => (name || '').toLowerCase();
    const byName = (patterns: string[], acctList?: ChartOfAccount[]) => {
      const acctSet = acctList || accounts;
      return acctSet.find(a => {
        const name = normalizedName(a.name);
        return patterns.every(p => name.includes(p));
      });
    };
    const byCode = (codes: string[], acctList?: ChartOfAccount[]) => {
      const acctSet = acctList || accounts;
      return acctSet.find(a => codes.includes(a.code || ''));
    };

    const cashAccount = getCashGlAccount(formData.bankAccountId);
    const customerDepositsAccount =
      byName(['customer', 'deposit']) ||
      byName(['advance', 'customer']) ||
      byName(['unearned', 'revenue']) ||
      byCode(['2000']);

    const ewtReceivableAccount =
      byName(['creditable', 'withholding', 'tax']) ||
      byName(['cwt', '2307']) ||
      byName(['ewt', 'receivable']) ||
      byName(['withholding', 'receivable']) ||
      byCode(['14001', '14200']);

    return { cashAccount, customerDepositsAccount, ewtReceivableAccount };
  };

  // Calculate GL lines for GL Review
  const calculatePaymentGlLines = () => {
    const { cashAccount, customerDepositsAccount, ewtReceivableAccount } = resolvePaymentGlAccounts();
    const amountReceived = Number(formData.amountReceived ?? 0) || 0;
    const ewtAmount = Number(formData.ewtAmountCertified ?? 0) || 0;
    const totalCredit = amountReceived + ewtAmount;

    const lines: Array<{ account?: ChartOfAccount; description: string; debit: number; credit: number }> = [];

    // Cash account debit
    if (cashAccount) {
      lines.push({
        account: cashAccount,
        description: `Cash receipt for ${formData.paymentNo}`,
        debit: amountReceived,
        credit: 0
      });
    }

    // EWT receivable debit
    if (ewtAmount > 0 && ewtReceivableAccount) {
      lines.push({
        account: ewtReceivableAccount,
        description: `Creditable Withholding Tax (CWT 2307) for ${formData.paymentNo}`,
        debit: ewtAmount,
        credit: 0
      });
    }

    // Customer deposits credit
    if (customerDepositsAccount) {
      lines.push({
        account: customerDepositsAccount,
        description: `Customer deposits for ${formData.paymentNo}`,
        debit: 0,
        credit: totalCredit
      });
    }

    return lines;
  };

  const cashAccountOptions = useMemo(() => {
    const base = [{ id: CASH_ON_HAND_UNDEPOSITED_ID, label: 'Cash on Hand - Undeposited Funds' }];
    const mappedBanks = bankAccounts.map(bank => ({
      id: bank.id,
      label: `${bank.bankName} - ${bank.accountNumber}`
    }));
    return [...base, ...mappedBanks];
  }, [bankAccounts]);

  const defaultCashAccountId = useMemo(() => {
    const undeposited = bankAccounts.find(account => {
      const bankName = account.bankName?.toLowerCase() || '';
      const accountNumber = account.accountNumber?.toLowerCase() || '';
      return bankName.includes('undeposited funds') || accountNumber.includes('undeposited funds');
    });
    if (undeposited) return undeposited.id;
    return CASH_ON_HAND_UNDEPOSITED_ID;
  }, [bankAccounts]);

  const buildBlankPaymentForm = () => ({
    paymentNo: generatePaymentNo(),
    sponsorId: '',
    studentId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER' as PaymentMethod,
    refNo: '',
    bankAccountId: defaultCashAccountId,
    checkNumber: '',
    checkDate: '',
    amountReceived: 0,
    ewtAmountCertified: 0,
    notes: ''
  });

  // Initialize form for new payment
  const startNewPayment = () => {
    setEditingPayment(null);
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setPayorType('SPONSOR');
    setFormData(buildBlankPaymentForm());
    setViewMode('create-payment');
  };

  const discardPaymentChanges = () => {
    setEditingPayment(null);
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setPayorType('SPONSOR');
    setFormData(buildBlankPaymentForm());
    setViewMode('list');
  };

  // Load payment for editing/viewing if it's in draft status
  const loadPaymentForEditing = (payment: Payment) => {
    if (payment.status !== 'DRAFT') {
      alert('Only Draft payments can be edited. Posted or Voided payments are read-only.');
      return;
    }
    
    setEditingPayment(payment);
    setPayorType(payment.sponsorId ? 'SPONSOR' : 'STUDENT');
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setFormData({
      paymentNo: payment.paymentNo,
      sponsorId: payment.sponsorId || '',
      studentId: payment.studentId || '',
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      refNo: payment.refNo || '',
      bankAccountId: payment.bankAccountId || defaultCashAccountId,
      checkNumber: payment.checkNumber || '',
      checkDate: payment.checkDate || '',
      amountReceived: payment.amountReceived,
      ewtAmountCertified: payment.ewtAmountCertified,
      notes: payment.notes || ''
    });
    setViewMode('create-payment');
  };

  // Load payment for viewing in the payment interface (for all statuses)
  const loadPaymentForViewing = (payment: Payment) => {
    setEditingPayment(payment);
    setPayorType(payment.sponsorId ? 'SPONSOR' : 'STUDENT');
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setFormData({
      paymentNo: payment.paymentNo,
      sponsorId: payment.sponsorId || '',
      studentId: payment.studentId || '',
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      refNo: payment.refNo || '',
      bankAccountId: payment.bankAccountId || defaultCashAccountId,
      checkNumber: payment.checkNumber || '',
      checkDate: payment.checkDate || '',
      amountReceived: payment.amountReceived,
      ewtAmountCertified: payment.ewtAmountCertified,
      notes: payment.notes || ''
    });
    setViewMode('create-payment');
  };

  const loadPaymentForDetails = (payment: Payment) => {
    loadPaymentForViewing(payment);
    setViewMode('payment-details');
  };

  // Load payment for applying
  const loadPaymentForApplication = (payment: Payment) => {
    setEditingPayment(payment);
    setPayorType(payment.sponsorId ? 'SPONSOR' : 'STUDENT');
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setFormData({
      paymentNo: payment.paymentNo,
      sponsorId: payment.sponsorId || '',
      studentId: payment.studentId || '',
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      refNo: payment.refNo || '',
      bankAccountId: payment.bankAccountId || defaultCashAccountId,
      checkNumber: payment.checkNumber || '',
      checkDate: payment.checkDate || '',
      amountReceived: payment.amountReceived,
      ewtAmountCertified: payment.ewtAmountCertified,
      notes: payment.notes || ''
    });
    setViewMode('apply-payment');
  };

  const handlePrintPayment = () => {
    const printablePayment = {
      ...(editingPayment || {}),
      paymentNo: formData.paymentNo,
      sponsorId: formData.sponsorId || editingPayment?.sponsorId || '',
      studentId: formData.studentId || editingPayment?.studentId || '',
      paymentDate: formData.paymentDate,
      paymentMethod: formData.paymentMethod,
      refNo: formData.refNo || editingPayment?.refNo || '',
      bankAccountId: formData.bankAccountId === CASH_ON_HAND_UNDEPOSITED_ID ? undefined : (formData.bankAccountId || editingPayment?.bankAccountId || ''),
      checkNumber: formData.checkNumber || editingPayment?.checkNumber || '',
      checkDate: formData.checkDate || editingPayment?.checkDate || '',
      amountReceived: Number(formData.amountReceived ?? editingPayment?.amountReceived ?? 0),
      ewtAmountCertified: Number(formData.ewtAmountCertified ?? editingPayment?.ewtAmountCertified ?? 0),
      totalApplied: Number(editingPayment?.totalApplied ?? 0),
      customerDepositBalance: Number(editingPayment?.customerDepositBalance ?? (Number(formData.amountReceived ?? 0) + Number(formData.ewtAmountCertified ?? 0))),
      status: editingPayment?.status || 'DRAFT',
      notes: formData.notes || editingPayment?.notes || '',
      applications: editingPayment?.applications || []
    } as Payment;

    const payorName = getPayorName(printablePayment);
    const activeApplications = (printablePayment.applications || []).filter(app => !app.isReversed);
    const totalReceived = Number(printablePayment.amountReceived ?? 0) + Number(printablePayment.ewtAmountCertified ?? 0);
    const dateLabel = printablePayment.paymentDate ? format(new Date(printablePayment.paymentDate), 'MM-dd-yyyy') : '-';
    const statusLabel = getDisplayStatusLabel(printablePayment.status);
    const bankLabel = getCashGlLabel(printablePayment.bankAccountId as string | undefined);
    const esc = (value: any) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Payment Voucher</title><style>
      @page { size: landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin:0; padding:20px; font-family: Arial, Helvetica, sans-serif; color:#111827; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; padding-bottom:12px; border-bottom:2px solid #f3f4f6; }
      .org { font-size:18px; font-weight:700; }
      .title { font-size:22px; font-weight:800; color:#f47721; margin-top:4px; }
      .sub { color:#6b7280; font-size:12px; margin-top:4px; }
      .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; }
      .card { border:1px solid #e5e7eb; border-radius:12px; padding:14px; }
      .card h3 { margin:0 0 10px; font-size:14px; text-transform:uppercase; letter-spacing:.04em; color:#4b5563; }
      .row { display:flex; justify-content:space-between; gap:12px; padding:5px 0; font-size:13px; }
      .row span:first-child { color:#6b7280; }
      .row span:last-child { font-weight:600; color:#111827; text-align:right; }
      table { width:100%; border-collapse:collapse; font-size:12px; }
      th { text-align:left; background:#f9fafb; color:#4b5563; text-transform:uppercase; font-size:10px; letter-spacing:.04em; padding:8px 10px; border-bottom:1px solid #e5e7eb; }
      td { padding:8px 10px; border-bottom:1px solid #e5e7eb; vertical-align:top; }
      td.num { text-align:right; white-space:nowrap; }
      .footer { margin-top:18px; color:#9ca3af; font-size:10px; text-align:right; }
    </style></head><body>
      <div class="header">
        <div>
          <div class="org">${esc(organization?.name || 'Payment Registry')}</div>
          <div class="title">Payment Voucher</div>
          <div class="sub">Payment No. ${esc(printablePayment.paymentNo || '-')} | ${esc(dateLabel)} | ${esc(statusLabel)}</div>
        </div>
        <div class="sub" style="text-align:right">
          Printed ${esc(new Date().toLocaleString('en-PH'))}
        </div>
      </div>
      <div class="grid">
        <div class="card">
          <h3>Payment Information</h3>
          <div class="row"><span>Payor</span><span>${esc(payorName || '-')}</span></div>
          <div class="row"><span>Payment Method</span><span>${esc(printablePayment.paymentMethod || '-')}</span></div>
          <div class="row"><span>Reference No.</span><span>${esc(printablePayment.refNo || '-')}</span></div>
          <div class="row"><span>Cash Account</span><span>${esc(bankLabel || '-')}</span></div>
          <div class="row"><span>Check Number</span><span>${esc(printablePayment.checkNumber || '-')}</span></div>
          <div class="row"><span>Check Date</span><span>${esc(printablePayment.checkDate || '-')}</span></div>
        </div>
        <div class="card">
          <h3>Amount Summary</h3>
          <div class="row"><span>Amount Received</span><span>${formatCurrency(Number(printablePayment.amountReceived ?? 0))}</span></div>
          <div class="row"><span>EWT Amount Certified</span><span>${formatCurrency(Number(printablePayment.ewtAmountCertified ?? 0))}</span></div>
          <div class="row"><span>Total Received</span><span>${formatCurrency(totalReceived)}</span></div>
          <div class="row"><span>Amount Applied</span><span>${formatCurrency(Number(printablePayment.totalApplied ?? 0))}</span></div>
          <div class="row"><span>Unapplied Balance</span><span>${formatCurrency(Number(printablePayment.customerDepositBalance ?? 0))}</span></div>
          <div class="row"><span>Status</span><span>${statusLabel}</span></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Invoice Applications</h3>
        ${activeApplications.length === 0 ? '<div class="sub">No applications yet.</div>' : `
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Application Status</th>
                <th class="num">Applied Amount</th>
              </tr>
            </thead>
            <tbody>
              ${activeApplications.map(app => {
                const invoice = invoices.find(i => i.id === app.invoiceId);
                return `<tr>
                  <td>${esc(invoice?.invoiceNo || app.invoiceId)}</td>
                  <td>${esc(app.isReversed ? 'Reversed' : 'Active')}</td>
                  <td class="num">${formatCurrency(Number(app.amountApplied ?? 0))}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
      ${printablePayment.notes ? `<div class="card" style="margin-top:16px"><h3>Transaction Description</h3><div class="sub" style="white-space:pre-wrap;color:#111827">${esc(printablePayment.notes).replace(/\n/g, '<br/>')}</div></div>` : ''}
      <div class="footer">Generated by ${esc(organization?.name || 'AT-ERP')}</div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      alert('Please allow popups to print the payment.');
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const handleOpenApplyPayment = () => {
    if (!editingPayment) {
      alert('Save or open a payment before applying invoices.');
      return;
    }
    if (editingPayment.status !== 'OPEN' && editingPayment.status !== 'POSTED') {
      alert('Approve the payment before applying invoices.');
      return;
    }
    setViewMode('apply-payment');
  };

  const handleOpenReversePayment = () => {
    if (!editingPayment) {
      alert('Open a saved payment before reversing applications.');
      return;
    }
    const hasActiveApplication = (editingPayment.applications || []).some(app => !app.isReversed);
    if (!hasActiveApplication) {
      alert('There are no active applications to reverse yet.');
      return;
    }
    setViewMode('payment-details');
  };

  // Fetch open invoices for payor
  useEffect(() => {
    let isMounted = true;
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});

    if (!selectedPayorId) {
      setOpenInvoicesForPayor([]);
      return () => {
        isMounted = false;
      };
    }

    setIsFetchingOpenInvoices(true);

    Promise.resolve().then(() => {
      if (!isMounted) return;
      const fetchedOpenInvoices = invoices.filter(inv => {
        if (inv.status !== 'OPEN' || inv.balanceDue <= 0) return false;
        if (payorType === 'SPONSOR') return inv.sponsorId === formData.sponsorId;
        return inv.studentId === formData.studentId;
      });
      setOpenInvoicesForPayor(fetchedOpenInvoices);
      setIsFetchingOpenInvoices(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedPayorId, payorType, formData.sponsorId, formData.studentId, invoices]);

  useEffect(() => {
    if (!editingPayment && defaultCashAccountId && !formData.bankAccountId) {
      setFormData(prev => ({ ...prev, bankAccountId: defaultCashAccountId }));
    }
  }, [editingPayment, defaultCashAccountId, formData.bankAccountId]);

  useEffect(() => {
    if (!editingPayment) return;
    const latest = payments.find(p => p.id === editingPayment.id);
    if (latest) setEditingPayment(latest);
  }, [payments, editingPayment?.id]);

  // Handle initial context for deep-linking (e.g. from InvoicesView)
  useEffect(() => {
    if (initialContext && initialContext.viewMode === 'create-payment' && initialContext.invoice) {
      const inv = initialContext.invoice;
      setEditingPayment(null);
      setInvoiceApplyMap({});
      setInvoiceSelectionMap({});
      setPayorType(inv.sponsorId ? 'SPONSOR' : 'STUDENT');
      setFormData({
        paymentNo: generatePaymentNo(),
        sponsorId: inv.sponsorId || '',
        studentId: inv.studentId || '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'BANK_TRANSFER',
        refNo: '',
        bankAccountId: defaultCashAccountId,
        checkNumber: '',
        checkDate: '',
        amountReceived: inv.balanceDue,
        ewtAmountCertified: 0,
        notes: `Payment for Invoice ${inv.invoiceNo}`
      });
      setViewMode('create-payment');
      if (onClearContext) onClearContext();
      return;
    }

    if (initialContext && initialContext.viewMode === 'payment-details' && initialContext.invoice) {
      const inv = initialContext.invoice;
      const matches = payments.flatMap(payment =>
        (payment.applications || [])
          .filter(app => app.invoiceId === inv.id && !app.isReversed)
          .map(app => ({ payment, app }))
      );

      if (matches.length > 0) {
        const latestMatch = [...matches].sort((a, b) =>
          new Date(b.app.createdAt || b.payment.updatedAt || b.payment.createdAt || b.payment.paymentDate || 0).getTime() -
          new Date(a.app.createdAt || a.payment.updatedAt || a.payment.createdAt || a.payment.paymentDate || 0).getTime()
        )[0];

        loadPaymentForDetails(latestMatch.payment);
      } else {
        setViewMode('list');
      }

      if (onClearContext) onClearContext();
    }
  }, [initialContext, defaultCashAccountId, onClearContext, payments]);

  const baseTotalCredit = formData.amountReceived + formData.ewtAmountCertified;

  const plannedAppliedTotal = useMemo(() => {
    return Object.values(invoiceApplyMap).reduce((sum, amount) => sum + (amount || 0), 0);
  }, [invoiceApplyMap]);

  const existingApplied = editingPayment?.totalApplied || 0;
  const availableToApply = Math.max((editingPayment?.customerDepositBalance ?? baseTotalCredit), 0);

  const glImpactRows = useMemo(() => {
    const glLines = calculatePaymentGlLines();
    return glLines.map(line => ({
      account: line.account?.code 
        ? `${line.account.code} - ${line.account.name}`
        : line.account?.name || 'Unknown Account',
      debit: line.debit,
      credit: line.credit
    }));
  }, [formData.bankAccountId, formData.amountReceived, formData.ewtAmountCertified, accounts]);

  const validateHeader = () => {
    if (!formData.paymentNo) return 'Payment number is required.';
    if (!formData.paymentDate) return 'Payment date is required.';
    if (!formData.bankAccountId) return 'Cash account is required.';
    if (!formData.sponsorId && !formData.studentId) return 'Select a sponsor or student.';
    if (baseTotalCredit <= 0) return 'Amount received or EWT must be greater than zero.';
    return '';
  };

  const buildPayment = (status: PaymentStatus) => {
    const paymentId = editingPayment?.id || generateUUID();
    const currentApplications = editingPayment?.applications || [];

    const payment: Partial<Payment> = {
      id: paymentId,
      orgId: currentOrgId,  // Always include org_id for complete data separation
      paymentNo: formData.paymentNo,
      sponsorId: formData.sponsorId || undefined,
      studentId: formData.studentId || undefined,
      paymentDate: formData.paymentDate,
      status,
      paymentMethod: formData.paymentMethod,
      refNo: formData.refNo || undefined,
      bankAccountId: formData.bankAccountId === CASH_ON_HAND_UNDEPOSITED_ID ? undefined : (formData.bankAccountId || undefined),
      checkNumber: formData.checkNumber || undefined,
      checkDate: formData.checkDate || undefined,
      amountReceived: formData.amountReceived,
      ewtAmountCertified: formData.ewtAmountCertified,
      totalApplied: existingApplied,
      customerDepositBalance: baseTotalCredit - existingApplied,
      applications: currentApplications,
      notes: formData.notes || undefined,
      createdAt: editingPayment?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      postedAt: status === 'OPEN' ? (editingPayment?.postedAt || new Date().toISOString()) : editingPayment?.postedAt
    };

    return payment as Payment;
  };

  const handleSaveDraft = () => {
    const error = validateHeader();
    if (error) {
      alert(error);
      return;
    }

    // Save as draft without posting to GL
    const payment = buildPayment('DRAFT');
    if (editingPayment) onUpdatePayment(payment);
    else onAddPayment(payment);
    setViewMode('list');
    setEditingPayment(null);
  };

  const handleSavePayment = () => {
    const error = validateHeader();
    if (error) {
      alert(error);
      return;
    }

    // Approve and post to GL (Acumatica workflow)
    const payment = buildPayment('OPEN');
    if (editingPayment) {
      onUpdatePayment(payment);
      // Call onPostPayment for existing draft payments being posted for the first time
      if (editingPayment.status === 'DRAFT' && onPostPayment) {
        onPostPayment(payment);
      }
    } else {
      onAddPayment(payment);
    }
    setViewMode('list');
    setEditingPayment(null);
  };

  const applySelectedInvoices = () => {
    if (!editingPayment) {
      alert('Payment not found.');
      return;
    }

    const selected = Object.entries(invoiceApplyMap).filter(([invoiceId, amt]) => invoiceSelectionMap[invoiceId] && amt > 0);
    if (!selected.length) {
      alert('Tick at least one invoice and enter amount to apply.');
      return;
    }

    const totalToApply = selected.reduce((sum, [_, amt]) => sum + amt, 0);
    if (totalToApply > availableToApply) {
      alert('Applied total exceeds available unapplied balance.');
      return;
    }

    selected.forEach(([invoiceId, amount]) => {
      if (onApplyToInvoice) onApplyToInvoice(editingPayment.id, invoiceId, amount);
    });

    if (!onApplyToInvoice) {
      const newApps: PaymentApplication[] = selected.map(([invoiceId, amount]) => ({
        id: generateUUID(),
        paymentId: editingPayment.id,
        invoiceId,
        amountApplied: amount,
        isReversed: false,
        createdAt: new Date().toISOString()
      }));

      const updatedPayment: Payment = {
        ...editingPayment,
        applications: [...(editingPayment.applications || []), ...newApps],
        totalApplied: (editingPayment.totalApplied || 0) + totalToApply,
        customerDepositBalance: (editingPayment.customerDepositBalance || 0) - totalToApply,
        updatedAt: new Date().toISOString()
      };
      onUpdatePayment(updatedPayment);
      setEditingPayment(updatedPayment);
    }

    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setViewMode('list');
  };

  const handleInvoiceTick = (invoice: Invoice, checked: boolean) => {
    setInvoiceSelectionMap(prev => ({ ...prev, [invoice.id]: checked }));
    if (!checked) {
      setInvoiceApplyMap(prev => ({ ...prev, [invoice.id]: 0 }));
      return;
    }

    setInvoiceApplyMap(prev => {
      const existing = prev[invoice.id] || 0;
      if (existing > 0) return prev;

      const otherSelectedTotal = Object.entries(prev).reduce((sum, [id, amount]) => {
        if (id === invoice.id) return sum;
        if (!invoiceSelectionMap[id]) return sum;
        return sum + (amount || 0);
      }, 0);
      const remaining = Math.max(availableToApply - otherSelectedTotal, 0);
      const suggested = Math.min(invoice.balanceDue, remaining);
      return { ...prev, [invoice.id]: suggested };
    });
  };

  const openReverseApplicationModal = (payment: Payment, application: PaymentApplication) => {
    setReversingApplication({ payment, application });
    setReverseReason('');
    setShowReverseModal(true);
  };

  const formatPostPeriod = (dateValue?: string) => {
    if (!dateValue) return '';
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return '';
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${month}-${year}`;
  };

  const formatCreatedOn = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, 'MM-dd-yyyy');
  };

  const invoiceLabelClass = 'text-xs font-medium text-gray-500';
  const invoiceInputClass = 'w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 disabled:opacity-60 disabled:cursor-not-allowed';
  const invoiceReadOnlyClass = 'w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 bg-gray-50 text-gray-900';
  const invoicePostPeriodClass = 'w-full mt-1 px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-200 bg-orange-50 text-gray-900';

  const getCreatedByName = (createdBy?: string) => {
    if (!createdBy) return '-';
    return users.find(u => u.id === createdBy)?.name || createdBy || '-';
  };

  const getDisplayStatusLabel = (status: PaymentStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'ON HOLD';
      case 'OPEN':
      case 'POSTED':
        return 'OPEN';
      case 'CLOSED':
        return 'CLOSED';
      case 'VOIDED':
        return 'VOIDED';
      default:
        return status;
    }
  };

  const getMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'CASH': return <Wallet size={14} className="text-emerald-600" />;
      case 'BANK_TRANSFER': return <Landmark size={14} className="text-sky-600" />;
      case 'CREDIT_CARD': return <CreditCard size={14} className="text-indigo-600" />;
      default: return <Wallet size={14} className="text-gray-600" />;
    }
  };

  const handleSort = (columnKey: string) => {
    setSortConfig(current => {
      if (current.key !== columnKey) return { key: columnKey, direction: 'asc' as const };
      if (current.direction === 'asc') return { key: columnKey, direction: 'desc' as const };
      if (current.direction === 'desc') return { key: columnKey, direction: 'none' as const };
      return { key: columnKey, direction: 'asc' as const };
    });
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey || sortConfig.direction === 'none') {
      return <ArrowUpDown size={12} className="ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={12} className="ml-1 text-emerald-400" />
      : <ChevronDown size={12} className="ml-1 text-emerald-400" />;
  };

  const getPaymentSortValue = (payment: Payment, key: string) => {
    switch (key) {
      case 'date':
      case 'paymentDate':
        return payment.paymentDate || '';
      case 'postPeriod':
        return payment.paymentDate || '';
      case 'paymentNo':
        return payment.paymentNo || '';
      case 'status':
        return getDisplayStatusLabel(payment.status);
      case 'glReference':
        return payment.glEntryNumber || '';
      case 'payor':
        return getPayorName(payment);
      case 'method':
        return payment.paymentMethod || '';
      case 'amountReceived':
        return Number(payment.amountReceived ?? 0) + Number(payment.ewtAmountCertified ?? 0);
      case 'amountApplied':
        return Number(payment.totalApplied ?? 0);
      case 'balance':
        return Number(payment.customerDepositBalance ?? 0);
      case 'createdBy':
        return getCreatedByName(payment.createdBy);
      case 'createdOn':
        return payment.createdAt || '';
      default:
        return '';
    }
  };

  const paymentRegistryColumns: PaymentRegistryColumn[] = [
    {
      key: 'date',
      label: 'Date',
      align: 'text-left',
      minWidth: 128,
      sortKey: 'date',
      value: (payment) => payment.paymentDate ? format(new Date(payment.paymentDate), 'MM-dd-yyyy') : '-',
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {payment.paymentDate ? format(new Date(payment.paymentDate), 'MM-dd-yyyy') : '-'}
        </span>
      )
    },
    {
      key: 'postPeriod',
      label: 'Post Period',
      align: 'text-left',
      minWidth: 112,
      sortKey: 'postPeriod',
      value: (payment) => formatPostPeriod(payment.paymentDate),
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {formatPostPeriod(payment.paymentDate) || '-'}
        </span>
      )
    },
    {
      key: 'paymentNo',
      label: 'Payment No.',
      align: 'text-left',
      minWidth: 160,
      sortKey: 'paymentNo',
      value: (payment) => payment.paymentNo || '',
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {payment.paymentNo || '-'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      align: 'text-left',
      minWidth: 96,
      sortKey: 'status',
      value: (payment) => getDisplayStatusLabel(payment.status),
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {getDisplayStatusLabel(payment.status)}
        </span>
      )
    },
    {
      key: 'glReference',
      label: 'GL Reference No.',
      align: 'text-left',
      minWidth: 128,
      sortKey: 'glReference',
      value: (payment) => payment.glEntryNumber || '',
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {payment.glEntryNumber || (payment.status === 'DRAFT' ? '-' : 'Pending')}
        </span>
      )
    },
    {
      key: 'payor',
      label: 'Sponsor/Student',
      align: 'text-left',
      minWidth: 256,
      sortKey: 'payor',
      value: (payment) => getPayorName(payment),
      render: (payment) => (
        <span className="inline-flex items-center gap-2 font-medium text-gray-800">
          {payment.sponsorId ? (
            <Building2 size={14} className="text-gray-400" />
          ) : (
            <User size={14} className="text-gray-400" />
          )}
          {getPayorName(payment)}
        </span>
      )
    },
    {
      key: 'method',
      label: 'Method',
      align: 'text-left',
      minWidth: 112,
      sortKey: 'method',
      value: (payment) => payment.paymentMethod || '',
      render: (payment) => (
        <span className="inline-flex items-center gap-1 font-medium text-gray-800">
          {getMethodIcon(payment.paymentMethod)}
          <span>{payment.paymentMethod}</span>
        </span>
      )
    },
    {
      key: 'amountReceived',
      label: 'Amount Received',
      align: 'text-right',
      minWidth: 128,
      sortKey: 'amountReceived',
      value: (payment) => Number(payment.amountReceived ?? 0) + Number(payment.ewtAmountCertified ?? 0),
      render: (payment) => (
        <span className="font-medium text-gray-800">{formatCurrency(payment.amountReceived + payment.ewtAmountCertified)}</span>
      )
    },
    {
      key: 'amountApplied',
      label: 'Amount Applied',
      align: 'text-right',
      minWidth: 128,
      sortKey: 'amountApplied',
      value: (payment) => Number(payment.totalApplied ?? 0),
      render: (payment) => (
        <span className="font-medium text-gray-800">{formatCurrency(payment.totalApplied)}</span>
      )
    },
    {
      key: 'balance',
      label: 'Balance',
      align: 'text-right',
      minWidth: 128,
      sortKey: 'balance',
      value: (payment) => Number(payment.customerDepositBalance ?? 0),
      render: (payment) => (
        <span className="font-medium text-gray-800">{formatCurrency(payment.customerDepositBalance)}</span>
      )
    },
    {
      key: 'createdBy',
      label: 'Created By',
      align: 'text-left',
      minWidth: 160,
      sortKey: 'createdBy',
      value: (payment) => getCreatedByName(payment.createdBy),
      render: (payment) => (
        <span className="font-medium text-gray-800">{getCreatedByName(payment.createdBy)}</span>
      )
    },
    {
      key: 'createdOn',
      label: 'Created On',
      align: 'text-left',
      minWidth: 128,
      sortKey: 'createdOn',
      value: (payment) => formatCreatedOn(payment.createdAt),
      render: (payment) => (
        <span className="font-medium text-gray-800">{formatCreatedOn(payment.createdAt)}</span>
      )
    }
  ];

  const registryColumns = columnOrder
    .map(key => paymentRegistryColumns.find(col => col.key === key))
    .filter(Boolean) as PaymentRegistryColumn[];

  const filteredPayments = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const matches = payments.filter(pay => {
      const payor = getPayorName(pay).toLowerCase();
      const matchesSearch =
        pay.paymentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payor.includes(searchTerm.toLowerCase()) ||
        (pay.refNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pay.glEntryNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'OPEN'
          ? (pay.status === 'OPEN' || pay.status === 'POSTED')
          : pay.status === statusFilter);

      const paymentDate = pay.paymentDate?.slice(0, 10) || '';
      let matchesDate = true;
      if (dateFilterMode === 'TODAY') {
        matchesDate = paymentDate === todayStr;
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = paymentDate >= monthStart && paymentDate <= monthEnd;
      } else if (dateFilterMode === 'CUSTOM') {
        matchesDate = (!dateFrom || paymentDate >= dateFrom) &&
          (!dateTo || paymentDate <= dateTo);
      }

      const matchesPayer = payerFilterMode !== 'CUSTOM' || payerSearchTerm.trim() === '' ||
        payor.includes(payerSearchTerm.toLowerCase());

      return matchesSearch && matchesStatus && matchesDate && matchesPayer;
    });

    return [...matches].sort((a, b) => {
      if (sortConfig.direction === 'none') return 0;
      const valueA = getPaymentSortValue(a, sortConfig.key);
      const valueB = getPaymentSortValue(b, sortConfig.key);
      let comparison = 0;
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB;
      } else {
        comparison = String(valueA).localeCompare(String(valueB), undefined, { numeric: true, sensitivity: 'base' });
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [payments, searchTerm, statusFilter, dateFilterMode, dateFrom, dateTo, payerFilterMode, payerSearchTerm, sortConfig, sponsors, students, users]);

  const getRegistryExportColumns = () => registryColumns;

  const getExportRows = () => {
    const columns = getRegistryExportColumns();
    return filteredPayments.map(payment => {
      const row: Record<string, any> = {};
      columns.forEach(col => {
        row[col.label] = col.value(payment);
      });
      return row;
    });
  };

  const exportToExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No payments to export.'); return; }
    const columns = getRegistryExportColumns();
    const headers = columns.map(c => c.label);
    const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s] as string));
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><style>td{padding:6px 10px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:13px;color:#222;font-weight:500;}th{padding:6px 10px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:13px;background:#059669;color:#fff;font-weight:700;}td.num{text-align:right;mso-number-format:"#,##0.00"}</style></head><body><table>';
    html += '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
    rows.forEach(r => {
      html += '<tr>';
      columns.forEach(col => {
        const val = r[col.label];
        const isNum = typeof val === 'number';
        const value = isNum ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : val;
        html += `<td${isNum ? ' class="num"' : ''}>${esc(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</table></body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payment_Registry_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToPdf = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No payments to export.'); return; }
    const columns = getRegistryExportColumns();
    const cols = columns.map(c => c.label);
    const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s] as string));
    const orgName = organization?.name || 'Payment Registry';
    let html = `<!doctype html><html><head><meta charset="utf-8"/><title>Payment Registry</title><style>
      @page { size: landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; color:#111827; padding:20px; }
      h2 { margin:0 0 4px; font-size:18px; }
      .subtitle { color:#6b7280; font-size:12px; margin-bottom:16px; }
      table { width:100%; border-collapse:collapse; font-size:11px; }
      th { background:#059669; color:#fff; padding:8px 10px; text-align:left; font-weight:700; }
      td { padding:7px 10px; border-bottom:1px solid #e5e7eb; }
      tr:nth-child(even) { background:#f9fafb; }
      .num { text-align:right; }
      .footer { margin-top:16px; font-size:10px; color:#9ca3af; text-align:right; }
    </style></head><body>`;
    html += `<h2>${esc(orgName)}</h2>`;
    html += `<div class="subtitle">Payment Registry &mdash; Exported ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} &mdash; ${rows.length} record(s)</div>`;
    html += '<table><thead><tr>' + cols.map(c => `<th>${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach(r => {
      html += '<tr>';
      cols.forEach(c => {
        const val = r[c];
        const isNum = typeof val === 'number';
        const value = isNum ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : val;
        html += `<td${isNum ? ' class="num"' : ''}>${esc(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += `<div class="footer">Generated on ${new Date().toLocaleString('en-PH')}</div>`;
    html += '</body></html>';
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 400);
    }
  };

  const paymentStats = useMemo(() => {
    const draftCount = payments.filter(p => p.status === 'DRAFT').length;
    const openCount = payments.filter(p => p.status === 'OPEN' || p.status === 'POSTED').length;
    const closedCount = payments.filter(p => p.status === 'CLOSED').length;
    const unappliedPayments = payments.reduce((sum, payment) => {
      if (payment.status !== 'OPEN' && payment.status !== 'POSTED') return sum;
      return sum + Math.max(Number(payment.customerDepositBalance ?? 0), 0);
    }, 0);
    return { draftCount, openCount, closedCount, unappliedPayments };
  }, [payments]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColumnIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedColumnIdx(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedColumnIdx === null || draggedColumnIdx === dropIndex) return;

    const newOrder = [...columnOrder];
    const [draggedKey] = newOrder.splice(draggedColumnIdx, 1);
    newOrder.splice(dropIndex, 0, draggedKey);

    setColumnOrder(newOrder);
    setDraggedColumnIdx(null);
  };

  // ===== VIEW: PAYMENT LIST (DASHBOARD) =====
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Payments and Applications</h2>
          </div>
          <button
            onClick={startNewPayment}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-white font-semibold transition-colors bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-300"
          >
            <Plus size={20} />
            New Payment
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gray-100 p-2">
                <Clock size={20} className="text-gray-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">On Hold</p>
                <p className="text-xl font-semibold text-gray-800">{paymentStats.draftCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Send size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Open</p>
                <p className="text-xl font-semibold text-blue-600">{paymentStats.openCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Closed</p>
                <p className="text-xl font-semibold text-green-600">{paymentStats.closedCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <DollarSign size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Unapplied Payments</p>
                <p className="text-lg font-semibold text-gray-800">{formatCurrency(paymentStats.unappliedPayments)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-y px-4 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex h-9 w-64 items-center rounded border bg-white px-3 transition-colors hover:bg-gray-50">
              <Search size={14} className="mr-2 text-gray-400" />
              <input
                type="text"
                placeholder="Search payments..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 border-none bg-transparent text-[13px] font-medium text-gray-700 outline-none placeholder:font-normal placeholder:text-gray-300"
              />
            </div>

            <div className="relative flex h-9 items-center rounded border bg-white px-3 transition-colors hover:bg-gray-50">
              <span className="mr-1 text-[13px] text-gray-500">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as PaymentStatus | 'ALL')}
                className="cursor-pointer appearance-none border-none bg-transparent pr-4 text-[13px] font-bold text-gray-800 outline-none"
              >
                <option value="ALL">All</option>
                <option value="DRAFT">ON HOLD</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
                <option value="VOIDED">VOIDED</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 text-gray-400" />
            </div>

            <div className="relative">
              <div
                onClick={() => setShowPayerDropdown(!showPayerDropdown)}
                className="relative flex h-9 max-w-[220px] cursor-pointer select-none items-center rounded border bg-white px-3 transition-colors hover:bg-gray-50"
              >
                <span className="mr-1 truncate text-[13px] text-gray-500">Sponsor/Student:</span>
                <span className="truncate pr-5 text-[13px] font-bold text-gray-800">
                  {payerFilterMode === 'ALL' ? 'All' : payerFilterMode === 'CUSTOM' && payerSearchTerm ? `"${payerSearchTerm}"` : 'Custom...'}
                </span>
                <ChevronDown size={14} className="pointer-events-none absolute right-2 text-gray-400" />
              </div>

              {showPayerDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPayerDropdown(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
                    <div className="p-1">
                      <button
                        onClick={() => { setSortConfig({ key: 'payor', direction: 'asc' }); setShowPayerDropdown(false); }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 ${sortConfig.key === 'payor' && sortConfig.direction === 'asc' ? 'bg-orange-50 font-bold text-orange-600' : 'text-gray-700'}`}
                      >
                        <ChevronUp size={14} /> Sort Ascending
                      </button>
                      <button
                        onClick={() => { setSortConfig({ key: 'payor', direction: 'desc' }); setShowPayerDropdown(false); }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 ${sortConfig.key === 'payor' && sortConfig.direction === 'desc' ? 'bg-orange-50 font-bold text-orange-600' : 'text-gray-700'}`}
                      >
                        <ChevronDown size={14} /> Sort Descending
                      </button>
                    </div>
                    <div className="border-t border-gray-100 p-1">
                      <button
                        onClick={() => { setPayerFilterMode('ALL'); setPayerSearchTerm(''); setShowPayerDropdown(false); }}
                        className="w-full px-3 py-1.5 text-left text-[13px] text-gray-700 hover:bg-gray-100"
                      >
                        Remove Quick Filter
                      </button>
                      <button
                        onClick={() => { setPayerFilterMode('ALL'); setPayerSearchTerm(''); setShowPayerDropdown(false); }}
                        className="w-full cursor-not-allowed px-3 py-1.5 text-left text-[13px] text-gray-400 hover:bg-gray-100"
                        disabled
                      >
                        Clear Filter
                      </button>
                    </div>
                    <div className="border-t border-gray-100 p-1">
                      <button
                        onClick={() => setPayerFilterMode('CUSTOM')}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${payerFilterMode === 'CUSTOM' ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {payerFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Equal to
                      </button>
                    </div>
                    <div className="space-y-2 border-t border-gray-100 bg-gray-50/50 p-3">
                      <input
                        type="text"
                        placeholder="Type to search..."
                        value={payerSearchTerm}
                        onChange={(e) => {
                          setPayerSearchTerm(e.target.value);
                          if (payerFilterMode !== 'CUSTOM') setPayerFilterMode('CUSTOM');
                        }}
                        className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                      />
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => setShowPayerDropdown(false)}
                          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <div
                onClick={() => setShowDateDropdown(!showDateDropdown)}
                className="relative flex h-9 cursor-pointer select-none items-center rounded border bg-white px-3 transition-colors hover:bg-gray-50"
              >
                <span className="mr-1 text-[13px] text-gray-500">Date:</span>
                <span className="max-w-[120px] truncate pr-5 text-[13px] font-bold text-gray-800">
                  {dateFilterMode === 'ALL' ? 'All' : dateFilterMode === 'TODAY' ? 'Today' : dateFilterMode === 'THIS_MONTH' ? 'This Month' : 'Between...'}
                </span>
                <ChevronDown size={14} className="pointer-events-none absolute right-2 text-gray-400" />
              </div>

              {showDateDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
                    <div className="p-1">
                      <button
                        onClick={() => { setSortConfig({ key: 'date', direction: 'asc' }); setShowDateDropdown(false); }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 ${sortConfig.key === 'date' && sortConfig.direction === 'asc' ? 'bg-orange-50 font-bold text-orange-600' : 'text-gray-700'}`}
                      >
                        <ChevronUp size={14} /> Sort Ascending
                      </button>
                      <button
                        onClick={() => { setSortConfig({ key: 'date', direction: 'desc' }); setShowDateDropdown(false); }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 ${sortConfig.key === 'date' && sortConfig.direction === 'desc' ? 'bg-orange-50 font-bold text-orange-600' : 'text-gray-700'}`}
                      >
                        <ChevronDown size={14} /> Sort Descending
                      </button>
                    </div>
                    <div className="border-t border-gray-100 p-1">
                      <button
                        onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                        className="w-full px-3 py-1.5 text-left text-[13px] text-gray-700 hover:bg-gray-100"
                      >
                        Remove Quick Filter
                      </button>
                      <button
                        onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                        className="w-full cursor-not-allowed px-3 py-1.5 text-left text-[13px] text-gray-400 hover:bg-gray-100"
                        disabled
                      >
                        Clear Filter
                      </button>
                    </div>
                    <div className="border-t border-gray-100 p-1">
                      <button
                        onClick={() => setDateFilterMode('CUSTOM')}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${dateFilterMode === 'CUSTOM' ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {dateFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Is Between
                      </button>
                      <button
                        onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${dateFilterMode === 'TODAY' ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {dateFilterMode === 'TODAY' && <CheckSquare size={14} />} Today
                      </button>
                      <button
                        onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${dateFilterMode === 'THIS_MONTH' ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {dateFilterMode === 'THIS_MONTH' && <CheckSquare size={14} />} This Month
                      </button>
                    </div>
                    <div className="space-y-2 border-t border-gray-100 bg-gray-50/50 p-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-[11px] font-semibold uppercase text-gray-400">From:</span>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => { setDateFrom(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                          className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-[11px] font-semibold uppercase text-gray-400">To:</span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => { setDateTo(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                          className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => setShowDateDropdown(false)}
                          className="rounded bg-gray-200 px-3 py-1 text-[11px] font-bold uppercase text-gray-600 transition-colors hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setShowDateDropdown(false)}
                          className="rounded bg-blue-600 px-4 py-1 text-[11px] font-bold uppercase text-white shadow-sm transition-colors hover:bg-blue-700"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setDateFilterMode('ALL');
                setDateFrom('');
                setDateTo('');
                setPayerFilterMode('ALL');
                setPayerSearchTerm('');
                setShowDateDropdown(false);
                setShowPayerDropdown(false);
                setShowExportDropdown(false);
              }}
              className="p-2 text-gray-400 transition-colors hover:text-orange-500"
              title="Clear all filters"
            >
              <RotateCcw size={16} />
            </button>

            <div className="relative ml-auto">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="flex h-9 select-none items-center gap-1.5 rounded border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                title="Export"
              >
                <Download size={16} />
                <span>Export</span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>

              {showExportDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setShowExportDropdown(false);
                          exportToExcel();
                        }}
                        className="flex w-full items-center gap-2 rounded px-3 py-2 text-[13px] text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <FileSpreadsheet size={16} className="text-emerald-600" />
                        Export as Excel
                      </button>
                      <button
                        onClick={() => {
                          setShowExportDropdown(false);
                          exportToPdf();
                        }}
                        className="flex w-full items-center gap-2 rounded px-3 py-2 text-[13px] text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        <FileText size={16} className="text-red-500" />
                        Export as PDF
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-max w-full font-sans">
              <thead className="border-b bg-emerald-600">
                <tr>
                  {registryColumns.map((col, idx) => (
                    <th
                      key={col.key}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={`group relative cursor-move select-none border-x border-transparent px-4 py-3 font-semibold text-white transition-colors hover:border-emerald-200 hover:bg-emerald-700 ${draggedColumnIdx === idx ? 'border-2 border-dashed border-emerald-300 bg-emerald-700 opacity-50' : ''} ${col.align}`}
                      style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : { width: col.minWidth, minWidth: col.minWidth }}
                      title="Drag to reorder column"
                    >
                      <div
                        className={`flex items-center text-[13px] font-bold text-white ${
                          col.align === 'text-right' ? 'justify-end' : col.align === 'text-center' ? 'justify-center' : ''
                        } ${col.sortKey ? 'cursor-pointer hover:text-gray-100' : ''}`}
                        onClick={col.sortKey ? () => handleSort(col.sortKey!) : undefined}
                      >
                        {col.label} {col.sortKey && <SortIndicator columnKey={col.sortKey} />}
                      </div>
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const th = e.currentTarget.parentElement;
                          if (!th) return;
                          const startWidth = th.getBoundingClientRect().width;
                          resizeRef.current = { colKey: col.key, startX: e.clientX, startWidth };
                          const onMouseMove = (ev: MouseEvent) => {
                            if (!resizeRef.current) return;
                            const diff = ev.clientX - resizeRef.current.startX;
                            const newWidth = Math.max(60, resizeRef.current.startWidth + diff);
                            setColumnWidths(prev => ({ ...prev, [resizeRef.current!.colKey]: newWidth }));
                          };
                          const onMouseUp = () => {
                            resizeRef.current = null;
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                            document.body.style.cursor = '';
                            document.body.style.userSelect = '';
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                          document.body.style.cursor = 'col-resize';
                          document.body.style.userSelect = 'none';
                        }}
                        className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-emerald-400 transition-colors z-10"
                        title="Drag to resize column"
                        draggable={false}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={registryColumns.length} className="p-12 text-center text-gray-500">
                      <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-gray-700">No payments recorded</p>
                        <p className="text-sm text-gray-500">Click "New Payment" to get started</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(payment => (
                    <tr
                      key={payment.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() => loadPaymentForViewing(payment)}
                      title={payment.status === 'DRAFT' ? 'Click to edit draft payment' : 'Click to view payment'}
                    >
                      {registryColumns.map(col => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 ${col.align}`}
                          style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : { width: col.minWidth, minWidth: col.minWidth }}
                        >
                          {col.render(payment)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        {showVoidModal && voidingPayment && (
          <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
                <div className="flex items-center gap-3 border-b p-4">
                  <div className="rounded-lg bg-rose-100 p-2">
                    <AlertTriangle size={18} className="text-rose-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">Void Payment</h4>
                    <p className="text-sm text-gray-500">{voidingPayment.paymentNo}</p>
                  </div>
                </div>
                <div className="p-4">
                  <label className="text-sm font-medium text-gray-700">Reason *</label>
                  <textarea
                    value={voidReason}
                    onChange={e => setVoidReason(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 border-t bg-gray-50 p-4">
                  <button
                    onClick={() => {
                      setShowVoidModal(false);
                      setVoidingPayment(null);
                      setVoidReason('');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!voidReason.trim()) return;
                      if (onVoidPayment) onVoidPayment(voidingPayment.id, voidReason);
                      else onUpdatePayment({ ...voidingPayment, status: 'VOIDED', voidReason, voidedAt: new Date().toISOString() });
                      setShowVoidModal(false);
                      setVoidingPayment(null);
                      setVoidReason('');
                    }}
                    disabled={!voidReason.trim()}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <XCircle size={14} />
                    Void Payment
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {showReverseModal && reversingApplication && (
          <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
                <div className="flex items-center gap-3 border-b p-4">
                  <div className="rounded-lg bg-amber-100 p-2">
                    <RotateCcw size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">Reverse Application</h4>
                    <p className="text-sm text-gray-500">{reversingApplication.payment.paymentNo}</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="text-sm text-gray-600">
                    Invoice: <span className="font-semibold text-gray-900">{invoices.find(i => i.id === reversingApplication.application.invoiceId)?.invoiceNo || reversingApplication.application.invoiceId}</span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Reason *</label>
                    <textarea
                      value={reverseReason}
                      onChange={e => setReverseReason(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="Enter reversal reason..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t bg-gray-50 p-4">
                  <button
                    onClick={() => {
                      setShowReverseModal(false);
                      setReversingApplication(null);
                      setReverseReason('');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!reverseReason.trim() || !reversingApplication) return;
                      if (onReverseApplication) {
                        onReverseApplication(reversingApplication.payment.id, reversingApplication.application.id, reverseReason);
                      }
                      setShowReverseModal(false);
                      setReversingApplication(null);
                      setReverseReason('');
                    }}
                    disabled={!reverseReason.trim()}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <RotateCcw size={14} />
                    Reverse Application
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
      </div>
    );
  }

  // ===== VIEW: CREATE NEW PAYMENT =====
  if (viewMode === 'create-payment') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to Payments
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: `${brandColor}10` }}>
            <div>
              <h3 className="text-xl font-bold text-gray-800">
                New Payment : {formData.paymentNo}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
             
              </p>
            </div>
          </div>
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-white">
            <button
              title="Discard Changes and Close"
              onClick={discardPaymentChanges}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <RotateCcw size={20} />
            </button>
            {!isReadOnly && (
              <>
                <button
                  title="Save as Draft"
                  onClick={handleSaveDraft}
                  className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Save size={20} />
                </button>
                <button
                  title="Approve"
                  onClick={handleSavePayment}
                  className="p-2 text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  <CheckCircle size={20} />
                </button>
              </>
            )}
            <button
              title="Add New Payment"
              onClick={startNewPayment}
              className="p-2 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
            >
              <Plus size={20} />
            </button>
            <button
              title="Apply"
              onClick={handleOpenApplyPayment}
              disabled={!editingPayment || (editingPayment.status !== 'OPEN' && editingPayment.status !== 'POSTED')}
              className="px-3 py-2 text-sm font-bold uppercase tracking-wide text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              APPLY
            </button>
            <button
              title="Print"
              onClick={handlePrintPayment}
              className="p-2 text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Printer size={20} />
            </button>
            <button
              title="Reverse"
              onClick={handleOpenReversePayment}
              disabled={!editingPayment || !(editingPayment.applications || []).some(app => !app.isReversed)}
              className="p-2 text-gray-500 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CornerUpLeft size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              {/* Payment Information */}
              <div className="space-y-4 xl:col-span-8">
                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Payment Information</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                      <label className={invoiceLabelClass}>Payment No.</label>
                      <input
                        value={formData.paymentNo}
                        disabled
                        className={invoiceReadOnlyClass}
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Post Period</label>
                      <input
                        type="text"
                        value={formatPostPeriod(formData.paymentDate)}
                        readOnly
                        className={invoicePostPeriodClass}
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Payment Date *</label>
                      <div className="relative mt-1">
                        <Calendar size={14} className="pointer-events-none absolute right-3 top-2.5 text-gray-400" />
                        <input
                          type="date"
                          value={formData.paymentDate}
                          onChange={e => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                          disabled={isReadOnly}
                          className={invoiceInputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Payment Method *</label>
                      <select
                        value={formData.paymentMethod}
                        onChange={e => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as PaymentMethod }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                      >
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CHECK">Check</option>
                        <option value="CASH">Cash</option>
                        <option value="CREDIT_CARD">Credit Card</option>
                        <option value="EWALLET">E-Wallet</option>
                        <option value="OFFSET">Offset</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className={invoiceLabelClass}>Payor Type *</label>
                      <div className="mt-2 flex gap-4 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            checked={payorType === 'SPONSOR'}
                            onChange={() => {
                              setPayorType('SPONSOR');
                              setFormData(prev => ({ ...prev, studentId: '' }));
                            }}
                            disabled={isReadOnly}
                          />
                          Sponsor
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            checked={payorType === 'STUDENT'}
                            onChange={() => {
                              setPayorType('STUDENT');
                              setFormData(prev => ({ ...prev, sponsorId: '' }));
                            }}
                            disabled={isReadOnly}
                          />
                          Student
                        </label>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className={invoiceLabelClass}>Payor Name *</label>
                      {payorType === 'SPONSOR' ? (
                        <select
                          value={formData.sponsorId}
                          onChange={e => setFormData(prev => ({ ...prev, sponsorId: e.target.value, studentId: '' }))}
                          disabled={isReadOnly}
                          className={invoiceInputClass}
                        >
                          <option value="">Select Sponsor</option>
                          {sponsors.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={formData.studentId}
                          onChange={e => setFormData(prev => ({ ...prev, studentId: e.target.value, sponsorId: '' }))}
                          disabled={isReadOnly}
                          className={invoiceInputClass}
                        >
                          <option value="">Select Student</option>
                          {students.map(s => (
                            <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className={invoiceLabelClass}>Transaction Description *</label>
                      <input
                        value={formData.notes}
                        onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                        placeholder="Payment notes or memo..."
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Status</label>
                      <div className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50">
                        <span className="text-[13px] font-medium text-gray-700">
                          {getDisplayStatusLabel(editingPayment?.status || 'DRAFT')}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>GL Reference No.</label>
                      {editingPayment?.journalEntryId && onViewJournal ? (
                        <button
                          type="button"
                          onClick={() => onViewJournal(editingPayment.journalEntryId!)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-base font-normal rounded-lg bg-emerald-50 text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 transition-all w-full justify-center shadow-sm"
                          title="Open the related journal entry"
                          style={{ cursor: 'pointer' }}
                        >
                          <FileText size={16} />
                          <span>{editingPayment.glEntryNumber || `GL No. ${editingPayment.journalEntryId!.slice(-8).toUpperCase()}`}</span>
                          <span className="text-base font-normal text-emerald-600 ml-auto">{'-> View Journal Entry'}</span>
                        </button>
                      ) : (
                        <>
                          <input
                            value={editingPayment?.glEntryNumber || ''}
                            readOnly
                            placeholder="Generated when payment is approved"
                            className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-orange-200 cursor-default"
                          />
                           <p className="text-xs text-gray-400 mt-1">GL Reference will be auto-generated and linked when you click "Approve"</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Payment Details</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className={invoiceLabelClass}>Amount Received *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatInputCurrency(formData.amountReceived)}
                        onChange={e => setFormData(prev => ({ ...prev, amountReceived: parseInputCurrency(e.target.value) }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>EWT Amount Certified</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatInputCurrency(formData.ewtAmountCertified)}
                        onChange={e => setFormData(prev => ({ ...prev, ewtAmountCertified: parseInputCurrency(e.target.value) }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Reference No.</label>
                      <input
                        value={formData.refNo}
                        onChange={e => setFormData(prev => ({ ...prev, refNo: e.target.value }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                        placeholder="TRF / OR / Check Ref"
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Cash Account *</label>
                      <select
                        value={formData.bankAccountId}
                        onChange={e => setFormData(prev => ({ ...prev, bankAccountId: e.target.value }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                      >
                        <option value="">Select Cash Account</option>
                        {cashAccountOptions.map(account => (
                          <option key={account.id} value={account.id}>{account.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>
              </div>

              {/* GL Impact Summary */}
              <div className="space-y-4 xl:col-span-4">
                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-600">
                    GL Journal Entry Preview
                  </h3>
                  
                  {glImpactRows.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                      âš ï¸ Configure required GL accounts before posting this payment.
                    </div>
                  ) : (
                    <>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-500">
                            <th className="pb-2">GL Account</th>
                            <th className="pb-2 text-right">Debit</th>
                            <th className="pb-2 text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {glImpactRows.map((row, index) => (
                            <tr key={index} className="border-t text-gray-700">
                              <td className="py-2 text-xs">{row.account}</td>
                              <td className="py-2 text-right font-medium text-blue-600">{row.debit ? formatCurrency(row.debit) : '-'}</td>
                              <td className="py-2 text-right font-medium text-green-600">{row.credit ? formatCurrency(row.credit) : '-'}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-300 font-bold text-gray-800">
                            <td className="py-3 text-xs">Total</td>
                            <td className="py-3 text-right text-xs text-blue-600">{formatCurrency(baseTotalCredit)}</td>
                            <td className="py-3 text-right text-xs text-green-600">{formatCurrency(baseTotalCredit)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-700">
                        <div className="mb-2">ðŸ“‹ GL Entry Details:</div>
                        <ul className="space-y-1 pl-4 text-xs font-normal">
                          <li>â€¢ Journal Entry Date: {new Date(formData.paymentDate).toLocaleDateString()}</li>
                          <li>â€¢ Reference: {formData.paymentNo}</li>
                          <li>â€¢ Total Debit = Total Credit (balanced entry)</li>
                        </ul>
                      </div>
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                        âœ“ Click "Approve" to create this journal entry and record payment
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== VIEW: APPLY INVOICES =====
  if (viewMode === 'apply-payment' && editingPayment) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to Payments
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: `${brandColor}10` }}>
            <div className="flex items-center justify-between flex-1">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Apply Payment to Invoices</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Payment: <span className="font-semibold text-gray-900">{editingPayment.paymentNo}</span> | 
                  Payor: <span className="font-semibold text-gray-900">{getPayorName(editingPayment)}</span>
                </p>
              </div>
              <div className="text-right mx-4">
                <div className="text-xs text-gray-600">Available to Apply</div>
                <div className="text-lg font-bold" style={{ color: brandColor }}>
                  {formatCurrency(availableToApply)}
                </div>
              </div>
            </div>
            {/* Action Buttons - Top Right */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('list')}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={applySelectedInvoices}
                disabled={plannedAppliedTotal <= 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                style={{ backgroundColor: brandColor }}
              >
                <CheckCircle size={16} />
                Apply Selected
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-center">Apply</th>
                    <th className="px-3 py-2 text-left">Invoice No</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Amount Due</th>
                    <th className="px-3 py-2 text-right">Apply Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {isFetchingOpenInvoices && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-500">Fetching open invoices...</td>
                    </tr>
                  )}
                  {!isFetchingOpenInvoices && openInvoicesForPayor.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No open invoices for this payor.</td>
                    </tr>
                  )}
                  {!isFetchingOpenInvoices && openInvoicesForPayor.map(inv => (
                    <tr key={inv.id} className="border-t">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!invoiceSelectionMap[inv.id]}
                          onChange={e => handleInvoiceTick(inv, e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{inv.invoiceNo}</td>
                      <td className="px-3 py-2 text-gray-600">{inv.invoiceDate}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(inv.balanceDue)}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!invoiceSelectionMap[inv.id]}
                          max={Math.min(inv.balanceDue, availableToApply)}
                          value={invoiceApplyMap[inv.id] || ''}
                          onChange={e => {
                            const value = parseFloat(e.target.value) || 0;
                            setInvoiceApplyMap(prev => ({ ...prev, [inv.id]: Math.min(value, inv.balanceDue) }));
                          }}
                          className="w-36 rounded-lg border px-2 py-1 text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-lg border bg-gray-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Total to Apply:</span>
                <span className="font-bold" style={{ color: brandColor }}>{formatCurrency(plannedAppliedTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== VIEW: PAYMENT DETAILS =====
  if (viewMode === 'payment-details' && editingPayment) {
    const glLines = calculatePaymentGlLines();

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to Payment Register
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ backgroundColor: `${brandColor}10` }}>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{editingPayment.paymentNo}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(editingPayment.paymentDate).toLocaleDateString()} â€¢ {getPayorName(editingPayment)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Payment Status</div>
                <div className="mt-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    editingPayment.status === 'OPEN' || editingPayment.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' :
                    editingPayment.status === 'VOIDED' ? 'bg-rose-100 text-rose-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {editingPayment.status === 'DRAFT' ? 'On Hold' : editingPayment.status}
                  </span>
                </div>
              </div>
              {/* Close Button - Top Right */}
              <button
                onClick={() => setViewMode('list')}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Details */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">Payment Details</h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">Payment Number:</dt>
                    <dd className="text-sm font-semibold text-gray-900">{editingPayment.paymentNo}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">Payment Date:</dt>
                    <dd className="text-sm text-gray-900">{new Date(editingPayment.paymentDate).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">Payor:</dt>
                    <dd className="text-sm text-gray-900">{getPayorName(editingPayment)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">Payment Method:</dt>
                    <dd className="text-sm text-gray-900">{editingPayment.paymentMethod}</dd>
                  </div>
                  {editingPayment.refNo && (
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-600">Reference No.:</dt>
                      <dd className="text-sm text-gray-900">{editingPayment.refNo}</dd>
                    </div>
                  )}
                  {editingPayment.checkNumber && (
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-600">Check Number:</dt>
                      <dd className="text-sm text-gray-900">{editingPayment.checkNumber}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Amount Summary */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">Amount Summary</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount Received:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(editingPayment.amountReceived)}</span>
                  </div>
                  {editingPayment.ewtAmountCertified > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">EWT Amount Certified:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(editingPayment.ewtAmountCertified)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-semibold text-gray-700">Total Received:</span>
                    <span className="font-bold text-lg" style={{ color: brandColor }}>
                      {formatCurrency(editingPayment.amountReceived + editingPayment.ewtAmountCertified)}
                    </span>
                  </div>
                  <div className="pt-3 flex justify-between">
                    <span className="text-sm text-gray-600">Amount Applied:</span>
                    <span className="text-sm font-semibold text-emerald-700">{formatCurrency(editingPayment.totalApplied)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Unapplied Balance:</span>
                    <span className="text-sm font-semibold text-sky-700">{formatCurrency(editingPayment.customerDepositBalance)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* GL Entry Details */}
            {(editingPayment.status === 'OPEN' || editingPayment.status === 'POSTED') && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">GL Entry Details</h3>
                <div className="rounded-lg border bg-gray-50 p-4 space-y-3 mb-4">
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">GL Entry Number:</dt>
                    <dd className="text-sm font-semibold text-blue-600">
                      {editingPayment.glEntryNumber || 'â€”'}
                    </dd>
                  </div>
                  {editingPayment.postedAt && (
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-600">Posted Date:</dt>
                      <dd className="text-sm text-gray-900">{new Date(editingPayment.postedAt).toLocaleDateString()}</dd>
                    </div>
                  )}
                  {editingPayment.postedBy && (
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-600">Posted By:</dt>
                      <dd className="text-sm text-gray-900">{editingPayment.postedBy}</dd>
                    </div>
                  )}
                </div>

                {/* GL Journal Lines */}
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr className="text-left text-xs uppercase font-semibold text-gray-600">
                        <th className="px-4 py-2">GL Account</th>
                        <th className="px-4 py-2 text-right">Debit</th>
                        <th className="px-4 py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {glLines.map((line, index) => (
                        <tr key={index} className="border-t text-gray-700 hover:bg-gray-50">
                          <td className="px-4 py-2 text-xs">{line.account?.code || 'â€”'} - {line.account?.name || 'Unknown'}</td>
                          <td className="px-4 py-2 text-right font-medium text-blue-600">{line.debit ? formatCurrency(line.debit) : '-'}</td>
                          <td className="px-4 py-2 text-right font-medium text-green-600">{line.credit ? formatCurrency(line.credit) : '-'}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 font-bold text-gray-800">
                        <td className="px-4 py-2 text-xs">Total</td>
                        <td className="px-4 py-2 text-right text-blue-600">{formatCurrency(editingPayment.amountReceived + editingPayment.ewtAmountCertified)}</td>
                        <td className="px-4 py-2 text-right text-green-600">{formatCurrency(editingPayment.amountReceived + editingPayment.ewtAmountCertified)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {editingPayment.journalEntryId && onViewJournal && (
                  <button
                    onClick={() => onViewJournal(editingPayment.journalEntryId!)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold"
                    style={{ backgroundColor: brandColor }}
                  >
                    <ArrowRight size={16} />
                    View Full GL Entry
                  </button>
                )}
              </div>
            )}

            {/* Payment Applications */}
            {editingPayment.applications && editingPayment.applications.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">Invoice Applications</h3>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr className="text-left text-xs uppercase font-semibold text-gray-600">
                        <th className="px-4 py-2">Invoice Number</th>
                        <th className="px-4 py-2 text-right">Applied Amount</th>
                        <th className="px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingPayment.applications.map((app, index) => {
                        const invoice = invoices.find(i => i.id === app.invoiceId);
                        return (
                          <tr key={index} className="border-t text-gray-700 hover:bg-gray-50">
                            <td className="px-4 py-2 text-xs font-medium">{invoice?.invoiceNo || app.invoiceId}</td>
                            <td className="px-4 py-2 text-right font-semibold text-emerald-700">{formatCurrency(app.amountApplied)}</td>
                            <td className="px-4 py-2 text-right">
                              {app.isReversed ? (
                                <span className="text-xs font-semibold text-gray-400">Reversed</span>
                              ) : onReverseApplication ? (
                                <button
                                  type="button"
                                  onClick={() => openReverseApplicationModal(editingPayment, app)}
                                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                                >
                                  <RotateCcw size={12} />
                                  Reverse
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transaction Description */}
            {editingPayment.notes && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">Transaction Description</h3>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4">{editingPayment.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PaymentsView;

