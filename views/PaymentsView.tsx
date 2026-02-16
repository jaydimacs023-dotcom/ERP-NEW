import React, { useState, useMemo } from 'react';
import { Payment, PaymentApplication, PaymentStatus, PaymentMethod, Sponsor, Student, Invoice, BankAccount } from '../types';
import { generateUUID } from '../utils/uuid';
import { 
  DollarSign, Plus, Search, Filter, X, Save, Trash2, Edit3, Eye, 
  Building2, User, Calendar, CheckCircle, Clock, XCircle, AlertTriangle,
  CreditCard, Landmark, Wallet, Receipt, Ban, RefreshCcw, Link, Unlink,
  ChevronDown, ChevronUp, Percent, ArrowRight
} from 'lucide-react';

interface PaymentsViewProps {
  payments: Payment[];
  sponsors: Sponsor[];
  students: Student[];
  invoices: Invoice[];
  bankAccounts: BankAccount[];
  currency: string;
  onAddPayment: (payment: Payment) => void;
  onUpdatePayment: (payment: Payment) => void;
  onDeletePayment: (id: string) => Promise<boolean>;
  onPostPayment?: (payment: Payment) => void;
  onVoidPayment?: (id: string, reason: string) => void;
  onApplyToInvoice?: (paymentId: string, invoiceId: string, amount: number) => void;
  onReverseApplication?: (paymentId: string, applicationId: string, reason: string) => void;
}

const PaymentsView: React.FC<PaymentsViewProps> = ({
  payments, sponsors, students, invoices, bankAccounts, currency,
  onAddPayment, onUpdatePayment, onDeletePayment, onPostPayment, onVoidPayment,
  onApplyToInvoice, onReverseApplication
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [applyingPayment, setApplyingPayment] = useState<Payment | null>(null);
  const [reversingApplication, setReversingApplication] = useState<{ payment: Payment; application: PaymentApplication } | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Application form state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [applyAmount, setApplyAmount] = useState(0);

  // Form state
  const [formData, setFormData] = useState<{
    paymentNo: string;
    sponsorId: string;
    studentId: string;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    refNo: string;
    bankAccountId: string;
    checkNumber: string;
    checkDate: string;
    amountReceived: number;
    ewtAmountCertified: number;
    notes: string;
  }>({
    paymentNo: '',
    sponsorId: '',
    studentId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'CHECK',
    refNo: '',
    bankAccountId: '',
    checkNumber: '',
    checkDate: '',
    amountReceived: 0,
    ewtAmountCertified: 0,
    notes: ''
  });

  const brandColor = '#F47721';

  // Generate next payment number
  const generatePaymentNo = () => {
    const year = new Date().getFullYear();
    const existingNums = payments
      .filter(p => p.paymentNo?.startsWith(`PAY-${year}-`))
      .map(p => parseInt(p.paymentNo?.split('-')[2] || '0'))
      .filter(n => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    return `PAY-${year}-${String(nextNum).padStart(5, '0')}`;
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      paymentNo: generatePaymentNo(),
      sponsorId: '',
      studentId: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'CHECK',
      refNo: '',
      bankAccountId: '',
      checkNumber: '',
      checkDate: '',
      amountReceived: 0,
      ewtAmountCertified: 0,
      notes: ''
    });
    setEditingPayment(null);
  };

  // Open modal for new payment
  const handleNew = () => {
    resetForm();
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      paymentNo: payment.paymentNo,
      sponsorId: payment.sponsorId || '',
      studentId: payment.studentId || '',
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      refNo: payment.refNo || '',
      bankAccountId: payment.bankAccountId || '',
      checkNumber: payment.checkNumber || '',
      checkDate: payment.checkDate || '',
      amountReceived: payment.amountReceived,
      ewtAmountCertified: payment.ewtAmountCertified,
      notes: payment.notes || ''
    });
    setShowModal(true);
  };

  // View payment details
  const handleView = (payment: Payment) => {
    setViewingPayment(payment);
    setShowViewModal(true);
  };

  // Handle sponsor change - auto-fill EWT from sponsor if applicable
  const handleSponsorChange = (sponsorId: string) => {
    const sponsor = sponsors.find(s => s.id === sponsorId);
    setFormData(prev => ({
      ...prev,
      sponsorId,
      studentId: '' // Clear student when sponsor selected
    }));
  };

  // Save payment
  const handleSave = () => {
    if (!formData.sponsorId && !formData.studentId) {
      alert('Please select a sponsor or student.');
      return;
    }
    if (formData.amountReceived <= 0 && formData.ewtAmountCertified <= 0) {
      alert('Please enter amount received or EWT certified.');
      return;
    }

    const payment: Payment = {
      id: editingPayment?.id || generateUUID(),
      orgId: editingPayment?.orgId || '',
      paymentNo: formData.paymentNo,
      sponsorId: formData.sponsorId || undefined,
      studentId: formData.studentId || undefined,
      paymentDate: formData.paymentDate,
      status: editingPayment?.status || 'DRAFT',
      paymentMethod: formData.paymentMethod,
      refNo: formData.refNo || undefined,
      bankAccountId: formData.bankAccountId || undefined,
      checkNumber: formData.checkNumber || undefined,
      checkDate: formData.checkDate || undefined,
      amountReceived: formData.amountReceived,
      ewtAmountCertified: formData.ewtAmountCertified,
      totalApplied: editingPayment?.totalApplied || 0,
      customerDepositBalance: (formData.amountReceived + formData.ewtAmountCertified) - (editingPayment?.totalApplied || 0),
      applications: editingPayment?.applications || [],
      notes: formData.notes || undefined,
      createdAt: editingPayment?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingPayment) {
      onUpdatePayment(payment);
    } else {
      onAddPayment(payment);
    }

    setShowModal(false);
    resetForm();
  };

  // Post payment
  const handlePost = (payment: Payment) => {
    if (onPostPayment) {
      onPostPayment({ ...payment, status: 'POSTED', postedAt: new Date().toISOString() });
    } else {
      onUpdatePayment({ ...payment, status: 'POSTED', postedAt: new Date().toISOString() });
    }
  };

  // Void payment
  const handleVoid = () => {
    if (voidingPayment && voidReason.trim()) {
      if (onVoidPayment) {
        onVoidPayment(voidingPayment.id, voidReason);
      } else {
        onUpdatePayment({
          ...voidingPayment,
          status: 'VOIDED',
          voidedAt: new Date().toISOString(),
          voidReason
        });
      }
      setShowVoidModal(false);
      setVoidingPayment(null);
      setVoidReason('');
    }
  };

  // Apply payment to invoice
  const handleApply = () => {
    if (applyingPayment && selectedInvoiceId && applyAmount > 0) {
      if (onApplyToInvoice) {
        onApplyToInvoice(applyingPayment.id, selectedInvoiceId, applyAmount);
      } else {
        // Local state update
        const newApplication: PaymentApplication = {
          id: generateUUID(),
          paymentId: applyingPayment.id,
          invoiceId: selectedInvoiceId,
          amountApplied: applyAmount,
          isReversed: false,
          createdAt: new Date().toISOString()
        };
        const updatedPayment = {
          ...applyingPayment,
          applications: [...(applyingPayment.applications || []), newApplication],
          totalApplied: (applyingPayment.totalApplied || 0) + applyAmount,
          customerDepositBalance: applyingPayment.customerDepositBalance - applyAmount
        };
        onUpdatePayment(updatedPayment);
      }
      setShowApplyModal(false);
      setApplyingPayment(null);
      setSelectedInvoiceId('');
      setApplyAmount(0);
    }
  };

  // Reverse application
  const handleReverseApplication = () => {
    if (reversingApplication && reversalReason.trim()) {
      const { payment, application } = reversingApplication;
      if (onReverseApplication) {
        onReverseApplication(payment.id, application.id, reversalReason);
      } else {
        // Local state update
        const updatedApplications = (payment.applications || []).map(app =>
          app.id === application.id
            ? { ...app, isReversed: true, reversalReason, reversedAt: new Date().toISOString() }
            : app
        );
        const reversedAmount = application.amountApplied;
        const updatedPayment = {
          ...payment,
          applications: updatedApplications,
          totalApplied: (payment.totalApplied || 0) - reversedAmount,
          customerDepositBalance: payment.customerDepositBalance + reversedAmount
        };
        onUpdatePayment(updatedPayment);
      }
      setShowReverseModal(false);
      setReversingApplication(null);
      setReversalReason('');
    }
  };

  // Toggle row expansion
  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Get open invoices for a payer (sponsor or student)
  const getOpenInvoices = (payment: Payment) => {
    return invoices.filter(inv => {
      const matchesPayer = payment.sponsorId 
        ? inv.sponsorId === payment.sponsorId 
        : inv.studentId === payment.studentId;
      return matchesPayer && inv.status === 'OPEN' && inv.balanceDue > 0;
    });
  };

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter(pay => {
      const matchesSearch = 
        pay.paymentNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pay.refNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sponsors.find(s => s.id === pay.sponsorId)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        students.find(s => s.id === pay.studentId)?.firstName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || pay.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payments, searchTerm, statusFilter, sponsors, students]);

  // Summary stats
  const stats = useMemo(() => {
    const draft = payments.filter(p => p.status === 'DRAFT');
    const posted = payments.filter(p => p.status === 'POSTED');
    const voided = payments.filter(p => p.status === 'VOIDED');
    const totalReceived = posted.reduce((sum, p) => sum + p.amountReceived, 0);
    const totalEwt = posted.reduce((sum, p) => sum + p.ewtAmountCertified, 0);
    const totalDeposits = posted.reduce((sum, p) => sum + p.customerDepositBalance, 0);
    return { draft, posted, voided, totalReceived, totalEwt, totalDeposits };
  }, [payments]);

  // Helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: currency || 'PHP' }).format(amount);
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'DRAFT': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 flex items-center gap-1"><Clock size={12} />Draft</span>;
      case 'POSTED': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-600 flex items-center gap-1"><CheckCircle size={12} />Posted</span>;
      case 'VOIDED': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-600 flex items-center gap-1"><XCircle size={12} />Voided</span>;
    }
  };

  const getMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'CASH': return <Wallet size={14} className="text-green-500" />;
      case 'CHECK': return <Receipt size={14} className="text-blue-500" />;
      case 'BANK_TRANSFER': return <Landmark size={14} className="text-purple-500" />;
      case 'CREDIT_CARD': return <CreditCard size={14} className="text-orange-500" />;
      case 'EWALLET': return <Wallet size={14} className="text-pink-500" />;
      case 'OFFSET': return <RefreshCcw size={14} className="text-gray-500" />;
      default: return <DollarSign size={14} />;
    }
  };

  const getSponsorName = (id?: string) => sponsors.find(s => s.id === id)?.name || '-';
  const getStudentName = (id?: string) => {
    const s = students.find(st => st.id === id);
    return s ? `${s.lastName}, ${s.firstName}` : '-';
  };
  const getInvoiceNo = (id?: string) => invoices.find(i => i.id === id)?.invoiceNo || '-';
  const getBankName = (id?: string) => bankAccounts.find(b => b.id === id)?.name || '-';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Payments</h2>
          <p className="text-gray-500 text-sm">Manage AR payments with EWT certification and invoice applications</p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
          style={{ backgroundColor: brandColor }}
        >
          <Plus size={20} />
          New Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <Clock size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Draft</p>
              <p className="text-xl font-bold text-gray-800">{stats.draft.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Posted</p>
              <p className="text-xl font-bold text-green-600">{stats.posted.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${brandColor}20` }}>
              <DollarSign size={20} style={{ color: brandColor }} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Received</p>
              <p className="text-lg font-bold" style={{ color: brandColor }}>{formatCurrency(stats.totalReceived)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Percent size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">EWT Certified</p>
              <p className="text-lg font-bold text-purple-600">{formatCurrency(stats.totalEwt)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Wallet size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Customer Deposits</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalDeposits)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100">
              <XCircle size={20} className="text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Voided</p>
              <p className="text-xl font-bold text-rose-600">{stats.voided.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search payments..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as PaymentStatus | 'ALL')}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Posted</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payment List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sponsor/Student</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">EWT</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Applied</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deposit Bal</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                  <DollarSign size={40} className="mx-auto mb-2 text-gray-300" />
                  No payments found
                </td>
              </tr>
            ) : (
              filteredPayments.map(pay => (
                <React.Fragment key={pay.id}>
                  <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(pay.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {expandedRows.has(pay.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        <span className="font-medium text-gray-800">{pay.paymentNo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{pay.paymentDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {pay.sponsorId ? <Building2 size={14} className="text-gray-400" /> : <User size={14} className="text-gray-400" />}
                        <span className="text-sm">{pay.sponsorId ? getSponsorName(pay.sponsorId) : getStudentName(pay.studentId)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {getMethodIcon(pay.paymentMethod)}
                        <span className="text-xs text-gray-500">{pay.paymentMethod}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(pay.status)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(pay.amountReceived)}</td>
                    <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(pay.ewtAmountCertified)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(pay.totalApplied)}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">{formatCurrency(pay.customerDepositBalance)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleView(pay)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View">
                          <Eye size={16} />
                        </button>
                        {pay.status === 'DRAFT' && (
                          <>
                            <button onClick={() => handleEdit(pay)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded" title="Edit">
                              <Edit3 size={16} />
                            </button>
                            <button onClick={() => handlePost(pay)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Post">
                              <CheckCircle size={16} />
                            </button>
                            <button onClick={() => onDeletePayment(pay.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        {pay.status === 'POSTED' && pay.customerDepositBalance > 0 && (
                          <button 
                            onClick={() => { setApplyingPayment(pay); setShowApplyModal(true); }} 
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" 
                            title="Apply to Invoice"
                          >
                            <Link size={16} />
                          </button>
                        )}
                        {pay.status === 'POSTED' && (
                          <button 
                            onClick={() => { setVoidingPayment(pay); setShowVoidModal(true); }} 
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded" 
                            title="Void"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Expanded row with applications */}
                  {expandedRows.has(pay.id) && pay.applications && pay.applications.length > 0 && (
                    <tr>
                      <td colSpan={10} className="bg-gray-50 px-8 py-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Payment Applications</h4>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left py-1">Invoice</th>
                              <th className="text-right py-1">Amount Applied</th>
                              <th className="text-center py-1">Status</th>
                              <th className="text-left py-1">Reversal Reason</th>
                              <th className="text-center py-1">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pay.applications.map((app, idx) => (
                              <tr key={app.id || idx} className={app.isReversed ? 'text-gray-400 line-through' : ''}>
                                <td className="py-1">{getInvoiceNo(app.invoiceId)}</td>
                                <td className="py-1 text-right">{formatCurrency(app.amountApplied)}</td>
                                <td className="py-1 text-center">
                                  {app.isReversed ? (
                                    <span className="px-2 py-0.5 text-xs bg-rose-100 text-rose-600 rounded">Reversed</span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded">Applied</span>
                                  )}
                                </td>
                                <td className="py-1 text-gray-500">{app.reversalReason || '-'}</td>
                                <td className="py-1 text-center">
                                  {!app.isReversed && pay.status === 'POSTED' && (
                                    <button
                                      onClick={() => { setReversingApplication({ payment: pay, application: app }); setShowReverseModal(true); }}
                                      className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                      title="Reverse"
                                    >
                                      <Unlink size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: `${brandColor}10` }}>
              <h3 className="text-lg font-bold text-gray-800">
                {editingPayment ? 'Edit Payment' : 'New Payment'}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-gray-200 rounded">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header fields */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Payment No</label>
                  <input
                    type="text"
                    value={formData.paymentNo}
                    onChange={e => setFormData({ ...formData, paymentNo: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Payment Date *</label>
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Payment Method *</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CHECK">Check</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="EWALLET">E-Wallet</option>
                    <option value="OFFSET">Offset</option>
                  </select>
                </div>
              </div>

              {/* Payer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Sponsor</label>
                  <select
                    value={formData.sponsorId}
                    onChange={e => handleSponsorChange(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  >
                    <option value="">-- Select Sponsor --</option>
                    {sponsors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Or Student</label>
                  <select
                    value={formData.studentId}
                    onChange={e => setFormData({ ...formData, studentId: e.target.value, sponsorId: '' })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                    disabled={!!formData.sponsorId}
                  >
                    <option value="">-- Select Student --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference / Check Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Reference No</label>
                  <input
                    type="text"
                    value={formData.refNo}
                    onChange={e => setFormData({ ...formData, refNo: e.target.value })}
                    placeholder="Check #, Transfer Ref"
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Bank Account</label>
                  <select
                    value={formData.bankAccountId}
                    onChange={e => setFormData({ ...formData, bankAccountId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  >
                    <option value="">-- Select Bank --</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                {formData.paymentMethod === 'CHECK' && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Check Number</label>
                      <input
                        type="text"
                        value={formData.checkNumber}
                        onChange={e => setFormData({ ...formData, checkNumber: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Check Date</label>
                      <input
                        type="date"
                        value={formData.checkDate}
                        onChange={e => setFormData({ ...formData, checkDate: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Amounts */}
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Amounts</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Amount Received *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amountReceived}
                      onChange={e => setFormData({ ...formData, amountReceived: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">EWT Amount Certified</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.ewtAmountCertified}
                      onChange={e => setFormData({ ...formData, ewtAmountCertified: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-200"
                    />
                    <p className="text-xs text-gray-400 mt-1">EWT certified by sponsor (Certificate 2307)</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-green-200 flex justify-between">
                  <span className="font-medium text-gray-700">Total Credit to AR:</span>
                  <span className="font-bold text-lg" style={{ color: brandColor }}>
                    {formatCurrency(formData.amountReceived + formData.ewtAmountCertified)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-gray-500">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  placeholder="Payment notes..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                style={{ backgroundColor: brandColor }}
              >
                <Save size={18} />
                {editingPayment ? 'Update Payment' : 'Save as Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Payment Modal */}
      {showViewModal && viewingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Payment {viewingPayment.paymentNo}</h3>
                <p className="text-sm text-gray-500">{viewingPayment.paymentDate}</p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(viewingPayment.status)}
                <button onClick={() => setShowViewModal(false)} className="p-1 hover:bg-gray-200 rounded">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              {/* Payer Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Received From</p>
                  <p className="font-medium text-gray-800">
                    {viewingPayment.sponsorId ? getSponsorName(viewingPayment.sponsorId) : getStudentName(viewingPayment.studentId)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-500 mb-1">Payment Method</p>
                  <div className="flex items-center justify-end gap-2">
                    {getMethodIcon(viewingPayment.paymentMethod)}
                    <span>{viewingPayment.paymentMethod}</span>
                  </div>
                  {viewingPayment.refNo && (
                    <p className="text-sm text-gray-500">Ref: {viewingPayment.refNo}</p>
                  )}
                </div>
              </div>

              {/* Amounts */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Received:</span>
                  <span className="font-medium">{formatCurrency(viewingPayment.amountReceived)}</span>
                </div>
                <div className="flex justify-between text-purple-600">
                  <span>EWT Certified:</span>
                  <span>{formatCurrency(viewingPayment.ewtAmountCertified)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Total Credit to AR:</span>
                  <span className="font-bold">{formatCurrency(viewingPayment.amountReceived + viewingPayment.ewtAmountCertified)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Applied to Invoices:</span>
                  <span>({formatCurrency(viewingPayment.totalApplied)})</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-blue-600">
                  <span className="font-bold">Customer Deposit Balance:</span>
                  <span className="font-bold text-lg">{formatCurrency(viewingPayment.customerDepositBalance)}</span>
                </div>
              </div>

              {/* Applications */}
              {viewingPayment.applications && viewingPayment.applications.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Applications</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Invoice</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingPayment.applications.map((app, idx) => (
                          <tr key={idx} className={`border-t ${app.isReversed ? 'text-gray-400' : ''}`}>
                            <td className="px-3 py-2">{getInvoiceNo(app.invoiceId)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(app.amountApplied)}</td>
                            <td className="px-3 py-2 text-center">
                              {app.isReversed ? (
                                <span className="text-rose-500 text-xs">Reversed</span>
                              ) : (
                                <span className="text-green-500 text-xs">Applied</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {viewingPayment.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{viewingPayment.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {showVoidModal && voidingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-lg">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Void Payment</h3>
                <p className="text-sm text-gray-500">{voidingPayment.paymentNo}</p>
              </div>
            </div>
            <div className="p-4">
              <label className="text-sm font-medium text-gray-700">Reason for voiding *</label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                rows={3}
                className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-200"
                placeholder="Enter reason..."
              />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => { setShowVoidModal(false); setVoidingPayment(null); setVoidReason(''); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim()}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                Void Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply to Invoice Modal */}
      {showApplyModal && applyingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Link size={20} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Apply Payment to Invoice</h3>
                <p className="text-sm text-gray-500">Available: {formatCurrency(applyingPayment.customerDepositBalance)}</p>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Select Invoice *</label>
                <select
                  value={selectedInvoiceId}
                  onChange={e => {
                    setSelectedInvoiceId(e.target.value);
                    const inv = invoices.find(i => i.id === e.target.value);
                    if (inv) {
                      setApplyAmount(Math.min(inv.balanceDue, applyingPayment.customerDepositBalance));
                    }
                  }}
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-200"
                >
                  <option value="">-- Select Invoice --</option>
                  {getOpenInvoices(applyingPayment).map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNo} - Balance: {formatCurrency(inv.balanceDue)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Amount to Apply *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Math.min(
                    invoices.find(i => i.id === selectedInvoiceId)?.balanceDue || 0,
                    applyingPayment.customerDepositBalance
                  )}
                  value={applyAmount}
                  onChange={e => setApplyAmount(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => { setShowApplyModal(false); setApplyingPayment(null); setSelectedInvoiceId(''); setApplyAmount(0); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={!selectedInvoiceId || applyAmount <= 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Apply Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Application Modal */}
      {showReverseModal && reversingApplication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-lg">
                <Unlink size={20} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Reverse Application</h3>
                <p className="text-sm text-gray-500">
                  {getInvoiceNo(reversingApplication.application.invoiceId)} - {formatCurrency(reversingApplication.application.amountApplied)}
                </p>
              </div>
            </div>
            <div className="p-4">
              <label className="text-sm font-medium text-gray-700">Reason for reversal *</label>
              <textarea
                value={reversalReason}
                onChange={e => setReversalReason(e.target.value)}
                rows={3}
                className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-200"
                placeholder="Enter reason..."
              />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => { setShowReverseModal(false); setReversingApplication(null); setReversalReason(''); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReverseApplication}
                disabled={!reversalReason.trim()}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                Reverse Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsView;
