import React, { useEffect, useMemo, useState } from 'react';
import { Payment, PaymentApplication, PaymentMethod, PaymentStatus, Sponsor, Student, Invoice, BankAccount, ChartOfAccount } from '../types';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  CreditCard,
  Landmark,
  Plus,
  Save,
  Search,
  User,
  Wallet,
  X,
  XCircle,
  FileText
} from 'lucide-react';

interface PaymentsViewProps {
  currentOrgId: string;  // Current organization for org_id separation
  payments: Payment[];
  sponsors: Sponsor[];
  students: Student[];
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
}

type PayorType = 'SPONSOR' | 'STUDENT';
type ViewMode = 'list' | 'create-payment' | 'apply-payment' | 'payment-details';

const PaymentsView: React.FC<PaymentsViewProps> = ({
  currentOrgId,
  payments,
  sponsors,
  students,
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
  onViewJournal
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
  
  // Application state
  const [invoiceApplyMap, setInvoiceApplyMap] = useState<Record<string, number>>({});
  const [invoiceSelectionMap, setInvoiceSelectionMap] = useState<Record<string, boolean>>({});
  const [openInvoicesForPayor, setOpenInvoicesForPayor] = useState<Invoice[]>([]);
  const [isFetchingOpenInvoices, setIsFetchingOpenInvoices] = useState(false);
  
  // Modals
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);

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

  // Initialize form for new payment
  const startNewPayment = () => {
    setEditingPayment(null);
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setPayorType('SPONSOR');
    setFormData({
      paymentNo: generatePaymentNo(),
      sponsorId: '',
      studentId: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'BANK_TRANSFER',
      refNo: '',
      bankAccountId: defaultCashAccountId,
      checkNumber: '',
      checkDate: '',
      amountReceived: 0,
      ewtAmountCertified: 0,
      notes: ''
    });
    setViewMode('create-payment');
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
      postedAt: status === 'POSTED' ? (editingPayment?.postedAt || new Date().toISOString()) : editingPayment?.postedAt
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

    // Post to GL when saving (Acumatica workflow)
    const payment = buildPayment('POSTED');
    if (editingPayment) {
      onUpdatePayment(payment);
      // Call onPostPayment for existing draft payments being posted for the first time
      if (editingPayment.status === 'DRAFT' && onPostPayment) {
        onPostPayment(payment);
      }
    } else {
      onAddPayment(payment);
      if (onPostPayment) onPostPayment(payment);
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

  const filteredPayments = useMemo(() => {
    return payments.filter(pay => {
      const payor = getPayorName(pay).toLowerCase();
      const matchesSearch =
        pay.paymentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payor.includes(searchTerm.toLowerCase()) ||
        (pay.refNo || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || pay.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payments, searchTerm, statusFilter, sponsors, students]);

  const getMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'CASH': return <Wallet size={14} className="text-emerald-600" />;
      case 'BANK_TRANSFER': return <Landmark size={14} className="text-sky-600" />;
      case 'CREDIT_CARD': return <CreditCard size={14} className="text-indigo-600" />;
      default: return <Wallet size={14} className="text-gray-600" />;
    }
  };

  // ===== VIEW: PAYMENT LIST (DASHBOARD) =====
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Payments and Applications</h2>
            <p className="text-sm text-gray-500 italic">Acumatica Workflow: Record payments first, then apply invoices separately</p>
          </div>
          <button
            onClick={startNewPayment}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-white font-semibold"
            style={{ backgroundColor: brandColor }}
          >
            <Plus size={20} />
            New Payment
          </button>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">Payment Register</h3>
            <div className="ml-auto text-xs text-blue-600 italic">💡 Click on any <span className="underline">Draft payment</span> to edit</div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="pointer-events-none absolute left-2 top-2.5 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search payments..."
                  className="w-full rounded-lg border py-2 pl-8 pr-3 text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as PaymentStatus | 'ALL')}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">On Hold</option>
                <option value="POSTED">Posted</option>
                <option value="VOIDED">Voided</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Payment No.</th>
                  <th className="px-3 py-2 text-left">GL Reference</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Sponsor/Student</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-right">Amount Received</th>
                  <th className="px-3 py-2 text-right">Amount Applied</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <FileText size={40} className="text-gray-300" />
                        <span>No payments found</span>
                      </div>
                    </td>
                  </tr>
                )}
                {filteredPayments.map(payment => (
                  <tr 
                    key={payment.id} 
                    className={`border-t ${
                      payment.status === 'DRAFT'
                        ? 'hover:bg-blue-50 transition-colors'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Payment No. - Clickable to view in Payment Interface */}
                    <td 
                      className="px-3 py-2 font-medium cursor-pointer"
                      onClick={() => loadPaymentForViewing(payment)}
                    >
                      <span className={`${
                        payment.status === 'DRAFT' ? 'text-blue-600 underline' : 'text-blue-600 underline hover:text-blue-700'
                      }`}>
                        {payment.paymentNo}
                      </span>
                    </td>
                    
                    {/* GL Reference */}
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {payment.glEntryNumber || (payment.status === 'DRAFT' ? '—' : 'Pending')}
                    </td>
                    
                    {/* Date */}
                    <td className="px-3 py-2">
                      {new Date(payment.paymentDate).toLocaleDateString()}
                    </td>
                    
                    {/* Sponsor/Student */}
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-2">
                        {payment.sponsorId ? <Building2 size={14} className="text-gray-400" /> : <User size={14} className="text-gray-400" />}
                        {getPayorName(payment)}
                      </div>
                    </td>
                    
                    {/* Status */}
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        payment.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' :
                        payment.status === 'VOIDED' ? 'bg-rose-100 text-rose-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {payment.status === 'DRAFT' ? 'On Hold' : payment.status}
                      </span>
                    </td>
                    
                    {/* Method */}
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1 text-gray-600">
                        {getMethodIcon(payment.paymentMethod)}
                        <span>{payment.paymentMethod}</span>
                      </div>
                    </td>
                    
                    {/* Amount Received */}
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(payment.amountReceived + payment.ewtAmountCertified)}</td>
                    
                    {/* Amount Applied */}
                    <td className="px-3 py-2 text-right text-emerald-700">{formatCurrency(payment.totalApplied)}</td>
                    
                    {/* Balance */}
                    <td className="px-3 py-2 text-right font-semibold text-sky-700">{formatCurrency(payment.customerDepositBalance)}</td>
                    
                    {/* Actions */}
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        {payment.status === 'DRAFT' && (
                          <button
                            onClick={() => loadPaymentForEditing(payment)}
                            className="rounded-lg border px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                            title="Edit draft payment"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => loadPaymentForApplication(payment)}
                          disabled={payment.status !== 'POSTED'}
                          className="rounded-lg border px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Apply invoices to this payment"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => onDeletePayment(payment.id)}
                          className="rounded-lg border px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                        {payment.status !== 'VOIDED' && (
                          <button
                            onClick={() => {
                              setVoidingPayment(payment);
                              setVoidReason('');
                              setShowVoidModal(true);
                            }}
                            className="rounded-lg border px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                {editingPayment ? 'Edit Draft Payment' : 'Record New Payment'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {editingPayment 
                  ? `Editing: ${editingPayment.paymentNo}` 
                  : 'Step 1 of 2: Record cash received, then apply invoices'}
              </p>
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
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 bg-white border border-gray-300 font-semibold hover:bg-gray-50 text-sm"
              >
                <Save size={16} />
                {editingPayment ? 'Update Draft' : 'Save as Draft'}
              </button>
              <button
                onClick={handleSavePayment}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold text-sm"
                style={{ backgroundColor: brandColor }}
              >
                <CheckCircle size={16} />
                {editingPayment ? 'Update & Post' : 'Post to GL'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              {/* Payment Information */}
              <div className="space-y-4 xl:col-span-8">
                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Payment Information</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Payment No.</label>
                      <input
                        value={formData.paymentNo}
                        disabled
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-gray-50 text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Payment Date *</label>
                      <div className="relative mt-1">
                        <Calendar size={14} className="pointer-events-none absolute right-3 top-2.5 text-gray-400" />
                        <input
                          type="date"
                          value={formData.paymentDate}
                          onChange={e => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Payment Method *</label>
                      <select
                        value={formData.paymentMethod}
                        onChange={e => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as PaymentMethod }))}
                        disabled={isReadOnly}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
                      <label className="text-xs font-semibold text-gray-500">Payor Type *</label>
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
                      <label className="text-xs font-semibold text-gray-500">Payor Name *</label>
                      {payorType === 'SPONSOR' ? (
                        <select
                          value={formData.sponsorId}
                          onChange={e => setFormData(prev => ({ ...prev, sponsorId: e.target.value, studentId: '' }))}
                          disabled={isReadOnly}
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Student</option>
                          {students.map(s => (
                            <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Payment Details</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Amount Received *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.amountReceived}
                        onChange={e => setFormData(prev => ({ ...prev, amountReceived: parseFloat(e.target.value) || 0 }))}
                        disabled={isReadOnly}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">EWT Amount Certified</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.ewtAmountCertified}
                        onChange={e => setFormData(prev => ({ ...prev, ewtAmountCertified: parseFloat(e.target.value) || 0 }))}
                        disabled={isReadOnly}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Reference No.</label>
                      <input
                        value={formData.refNo}
                        onChange={e => setFormData(prev => ({ ...prev, refNo: e.target.value }))}
                        disabled={isReadOnly}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="TRF / OR / Check Ref"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Cash Account *</label>
                      <select
                        value={formData.bankAccountId}
                        onChange={e => setFormData(prev => ({ ...prev, bankAccountId: e.target.value }))}
                        disabled={isReadOnly}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="">Select Cash Account</option>
                        {cashAccountOptions.map(account => (
                          <option key={account.id} value={account.id}>{account.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-semibold text-gray-500">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      disabled={isReadOnly}
                      rows={2}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="Add any notes..."
                    />
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
                      ⚠️ Configure required GL accounts before posting this payment.
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
                        <div className="mb-2">📋 GL Entry Details:</div>
                        <ul className="space-y-1 pl-4 text-xs font-normal">
                          <li>• Journal Entry Date: {new Date(formData.paymentDate).toLocaleDateString()}</li>
                          <li>• Reference: {formData.paymentNo}</li>
                          <li>• Total Debit = Total Credit (balanced entry)</li>
                        </ul>
                      </div>
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                        ✓ Click "Post to GL" to create this journal entry, or "Save as Draft" to save without posting
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
                {new Date(editingPayment.paymentDate).toLocaleDateString()} • {getPayorName(editingPayment)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Payment Status</div>
                <div className="mt-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    editingPayment.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' :
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
            {editingPayment.status === 'POSTED' && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">GL Entry Details</h3>
                <div className="rounded-lg border bg-gray-50 p-4 space-y-3 mb-4">
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">GL Entry Number:</dt>
                    <dd className="text-sm font-semibold text-blue-600">
                      {editingPayment.glEntryNumber || '—'}
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
                          <td className="px-4 py-2 text-xs">{line.account?.code || '—'} - {line.account?.name || 'Unknown'}</td>
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
                      </tr>
                    </thead>
                    <tbody>
                      {editingPayment.applications.map((app, index) => {
                        const invoice = invoices.find(i => i.id === app.invoiceId);
                        return (
                          <tr key={index} className="border-t text-gray-700 hover:bg-gray-50">
                            <td className="px-4 py-2 text-xs font-medium">{invoice?.invoiceNo || app.invoiceId}</td>
                            <td className="px-4 py-2 text-right font-semibold text-emerald-700">{formatCurrency(app.amountApplied)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {editingPayment.notes && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">Notes</h3>
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

