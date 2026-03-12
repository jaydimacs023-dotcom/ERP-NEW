import React, { useEffect, useMemo, useState } from 'react';
import { Payment, PaymentApplication, PaymentMethod, PaymentStatus, Sponsor, Student, Invoice, BankAccount, ChartOfAccount } from '../types';
import { generateUUID } from '../utils/uuid';
import {
  AlertTriangle,
  ArrowRight,
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
  XCircle
} from 'lucide-react';

interface PaymentsViewProps {
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
}

type PayorType = 'SPONSOR' | 'STUDENT';

const PaymentsView: React.FC<PaymentsViewProps> = ({
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
  onApplyToInvoice
}) => {
  const CASH_ON_HAND_UNDEPOSITED_ID = 'CASH_ON_HAND_UNDEPOSITED_FUNDS';
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [payorType, setPayorType] = useState<PayorType>('SPONSOR');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [invoiceApplyMap, setInvoiceApplyMap] = useState<Record<string, number>>({});
  const [invoiceSelectionMap, setInvoiceSelectionMap] = useState<Record<string, boolean>>({});
  const [openInvoicesForPayor, setOpenInvoicesForPayor] = useState<Invoice[]>([]);
  const [isFetchingOpenInvoices, setIsFetchingOpenInvoices] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'apply' | 'register'>('info');

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

  const brandColor = '#F47721';
  const selectedPayorId = payorType === 'SPONSOR' ? formData.sponsorId : formData.studentId;

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency || 'PHP'
  }).format(amount || 0);

  const generatePaymentNo = () => {
    const year = new Date().getFullYear();
    const existingNums = payments
      .filter(p => p.paymentNo?.startsWith(`PAY-${year}-`))
      .map(p => parseInt(p.paymentNo?.split('-')[2] || '0', 10))
      .filter(n => !Number.isNaN(n));
    const nextNum = existingNums.length ? Math.max(...existingNums) + 1 : 1;
    return `PAY-${year}-${String(nextNum).padStart(5, '0')}`;
  };

  const getPayorName = (payment: Payment) => {
    if (payment.sponsorId) return sponsors.find(s => s.id === payment.sponsorId)?.name || '-';
    const student = students.find(s => s.id === payment.studentId);
    return student ? `${student.lastName}, ${student.firstName}` : '-';
  };

  const getBankLabel = (bankId?: string) => {
    if (bankId === CASH_ON_HAND_UNDEPOSITED_ID) return 'Cash on Hand - Undeposited Funds';
    const bank = bankAccounts.find(b => b.id === bankId);
    if (!bank) return '-';
    return `${bank.bankName} - ${bank.accountNumber}`;
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
    if (!gl) return getBankLabel(bankId);
    const code = gl.code ? `${gl.code} - ` : '';
    return `${code}${gl.name}`;
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
  };

  useEffect(() => {
    if (!formData.paymentNo) {
      startNewPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const loadPayment = (payment: Payment) => {
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
  };

  const baseTotalCredit = formData.amountReceived + formData.ewtAmountCertified;

  const plannedAppliedTotal = useMemo(() => {
    return Object.values(invoiceApplyMap).reduce((sum, amount) => sum + (amount || 0), 0);
  }, [invoiceApplyMap]);

  const existingApplied = editingPayment?.totalApplied || 0;
  const availableToApply = Math.max((editingPayment?.customerDepositBalance ?? baseTotalCredit), 0);

  const glImpactRows = [
    { account: getCashGlLabel(formData.bankAccountId), debit: formData.amountReceived, credit: 0 },
    { account: '14001 - Creditable Withholding Tax (CWT 2307)', debit: formData.ewtAmountCertified, credit: 0 },
    { account: payorType === 'SPONSOR' ? 'Accounts Receivable - Sponsors' : 'Accounts Receivable - Students', debit: 0, credit: baseTotalCredit }
  ];

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

    return {
      id: paymentId,
      orgId: editingPayment?.orgId || '',
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
    } satisfies Payment;
  };

  const handleSaveDraft = () => {
    const error = validateHeader();
    if (error) {
      alert(error);
      return;
    }

    const payment = buildPayment('DRAFT');
    if (editingPayment) onUpdatePayment(payment);
    else onAddPayment(payment);
    setEditingPayment(payment);
  };

  const handlePost = () => {
    const error = validateHeader();
    if (error) {
      alert(error);
      return;
    }

    const payment = buildPayment('POSTED');
    if (onPostPayment) onPostPayment(payment);
    else if (editingPayment) onUpdatePayment(payment);
    else onAddPayment(payment);
    setEditingPayment(payment);
  };

  const applySelectedInvoices = () => {
    if (!editingPayment) {
      alert('Save draft first, then apply invoices.');
      return;
    }

    if (editingPayment.status !== 'POSTED') {
      const posted = { ...editingPayment, status: 'POSTED' as const, postedAt: new Date().toISOString() };
      if (onPostPayment) onPostPayment(posted);
      else onUpdatePayment(posted);
      setEditingPayment(posted);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Payments and Applications</h2>
          <p className="text-sm text-gray-500">New Payment & Application Worksheet</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={startNewPayment}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Plus size={16} />
            New
          </button>
          <button
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Save size={16} />
            Save Draft
          </button>
          <button
            onClick={handlePost}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: brandColor }}
          >
            <CheckCircle size={16} />
            Post Payment
          </button>
        </div>
      </div>

      <div className="flex space-x-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('info')}
          className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'info' ? 'border-[#F47721] text-[#F47721]' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
          style={activeTab === 'info' ? { borderColor: brandColor, color: brandColor } : {}}
        >
          Payment Information and Details
        </button>
        <button
          onClick={() => setActiveTab('apply')}
          className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'apply' ? 'border-[#F47721] text-[#F47721]' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
          style={activeTab === 'apply' ? { borderColor: brandColor, color: brandColor } : {}}
        >
          Apply Payment to Invoices
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'register' ? 'border-[#F47721] text-[#F47721]' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
          style={activeTab === 'register' ? { borderColor: brandColor, color: brandColor } : {}}
        >
          Payment Register
        </button>
      </div>

      {activeTab === 'info' && (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <div className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Payment Information</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-gray-500">Payment No.</label>
                <input
                  value={formData.paymentNo}
                  onChange={e => setFormData(prev => ({ ...prev, paymentNo: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Auto-generated"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Payment Date</label>
                <div className="relative mt-1">
                  <Calendar size={14} className="pointer-events-none absolute right-3 top-2.5 text-gray-400" />
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={e => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={e => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as PaymentMethod }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
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
                <label className="text-xs font-semibold text-gray-500">Payor Type</label>
                <div className="mt-2 flex gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={payorType === 'SPONSOR'}
                      onChange={() => {
                        setPayorType('SPONSOR');
                        setFormData(prev => ({ ...prev, studentId: '' }));
                      }}
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
                    />
                    Student
                  </label>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-500">Payor Name</label>
                {payorType === 'SPONSOR' ? (
                  <select
                    value={formData.sponsorId}
                    onChange={e => setFormData(prev => ({ ...prev, sponsorId: e.target.value, studentId: '' }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
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
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">Select Student</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              GL Credit (AR): {payorType === 'SPONSOR' ? '11110 - Accounts Receivable - Sponsors' : '11100 - Accounts Receivable - Students'}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Payment Details</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-gray-500">Amount Received</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amountReceived}
                  onChange={e => setFormData(prev => ({ ...prev, amountReceived: parseFloat(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">EWT Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.ewtAmountCertified}
                  onChange={e => setFormData(prev => ({ ...prev, ewtAmountCertified: parseFloat(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Reference No.</label>
                <input
                  value={formData.refNo}
                  onChange={e => setFormData(prev => ({ ...prev, refNo: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="TRF / OR / Check Ref"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Cash Account</label>
                <select
                  value={formData.bankAccountId}
                  onChange={e => setFormData(prev => ({ ...prev, bankAccountId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Select Cash Account</option>
                  {cashAccountOptions.map(account => (
                    <option key={account.id} value={account.id}>{account.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              GL Debit Account: {getCashGlLabel(formData.bankAccountId)}
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <div className="rounded-xl border bg-white p-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-600">GL Impact (Auto-Generated)</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="pb-2">Account</th>
                  <th className="pb-2 text-right">Debit</th>
                  <th className="pb-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {glImpactRows.map((row, index) => (
                  <tr key={index} className="border-t text-gray-700">
                    <td className="py-2">{row.account}</td>
                    <td className="py-2 text-right">{row.debit ? formatCurrency(row.debit) : '-'}</td>
                    <td className="py-2 text-right">{row.credit ? formatCurrency(row.credit) : '-'}</td>
                  </tr>
                ))}
                <tr className="border-t font-bold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right">{formatCurrency(baseTotalCredit)}</td>
                  <td className="py-2 text-right">{formatCurrency(baseTotalCredit)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">
              Journal Entry Ready for Posting
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 text-sm">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-600">Account Mapping (Reference)</h3>
            <div className="space-y-2 text-gray-700">
              <div className="flex items-center justify-between border-b pb-2">
                <span>Cash Account</span>
                <span className="font-semibold">{getCashGlLabel(formData.bankAccountId)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span>AR Clearing</span>
                <span className="font-semibold">{payorType === 'SPONSOR' ? '11110 - AR Sponsors' : '11100 - AR Students'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>CWT (BIR 2307)</span>
                <span className="font-semibold">14001 - Creditable Withholding Tax</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'apply' && (
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">Apply Payment to Invoices</h3>
          <div className="text-sm text-gray-600">
            Available to Apply: <span className="font-bold text-emerald-700">{formatCurrency(availableToApply)}</span>
          </div>
        </div>

        {!editingPayment && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Save Draft first to lock Payment No and enable application posting.
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-center">Tick</th>
                <th className="px-3 py-2 text-left">Invoice No</th>
                <th className="px-3 py-2 text-left">Billing Date</th>
                <th className="px-3 py-2 text-right">Amount Due</th>
                <th className="px-3 py-2 text-right">Amount Applied</th>
              </tr>
            </thead>
            <tbody>
              {isFetchingOpenInvoices && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">Fetching open invoices for selected payor...</td>
                </tr>
              )}
              {!isFetchingOpenInvoices && openInvoicesForPayor.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No open invoices for selected payor.</td>
                </tr>
              )}
              {!isFetchingOpenInvoices && openInvoicesForPayor.map(inv => (
                <tr key={inv.id} className="border-t">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      disabled={!editingPayment}
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
                      disabled={!editingPayment || !invoiceSelectionMap[inv.id]}
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
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={3} className="px-3 py-2 font-semibold text-gray-700">Total Applied</td>
                <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(plannedAppliedTotal)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={applySelectedInvoices}
                    disabled={!editingPayment || plannedAppliedTotal <= 0}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: brandColor }}
                  >
                    Apply to Invoice
                    <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}

      {activeTab === 'register' && (
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">Payment Register</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2 top-2.5 text-gray-400" />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search payments"
                className="rounded-lg border py-2 pl-8 pr-3 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as PaymentStatus | 'ALL')}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
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
                <th className="px-3 py-2 text-left">Payor</th>
                <th className="px-3 py-2 text-left">Method</th>
                <th className="px-3 py-2 text-right">Received</th>
                <th className="px-3 py-2 text-right">Applied</th>
                <th className="px-3 py-2 text-right">Deposit Balance</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">No payments found.</td>
                </tr>
              )}
              {filteredPayments.map(payment => (
                <tr key={payment.id} className="border-t">
                  <td className="px-3 py-2 font-medium text-gray-800">{payment.paymentNo}</td>
                  <td className="px-3 py-2">
                    <div className="inline-flex items-center gap-2">
                      {payment.sponsorId ? <Building2 size={14} className="text-gray-400" /> : <User size={14} className="text-gray-400" />}
                      {getPayorName(payment)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="inline-flex items-center gap-1 text-gray-600">
                      {getMethodIcon(payment.paymentMethod)}
                      <span>{payment.paymentMethod}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(payment.amountReceived + payment.ewtAmountCertified)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{formatCurrency(payment.totalApplied)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-sky-700">{formatCurrency(payment.customerDepositBalance)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      payment.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' :
                        payment.status === 'VOIDED' ? 'bg-rose-100 text-rose-700' :
                          'bg-gray-100 text-gray-700'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => loadPayment(payment)}
                        className="rounded-lg border px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Load
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
      )}

      {showVoidModal && voidingPayment && (
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
      )}
    </div>
  );
};

export default PaymentsView;
