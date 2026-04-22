import React, { useState, useMemo } from 'react';
import { BankDeposit, BankDepositLine, BankDepositStatus, BankAccount, Payment } from '../types';
import { generateUUID } from '../utils/uuid';
import { format } from 'date-fns';
import ModalPortal from '../components/ModalPortal';
import {
  Landmark, Plus, Search, X, Save, Trash2, Edit3, Eye,
  CheckCircle, Clock, XCircle, AlertTriangle, Receipt,
  ChevronDown, ChevronUp, Wallet, Ban,
  PlusCircle, MinusCircle, RotateCcw, CheckSquare
} from 'lucide-react';

interface BankDepositsViewProps {
  deposits: BankDeposit[];
  bankAccounts: BankAccount[];
  payments: Payment[];
  currency: string;
  onAddDeposit: (deposit: BankDeposit) => void;
  onUpdateDeposit: (deposit: BankDeposit) => void;
  onDeleteDeposit: (id: string) => Promise<boolean>;
  onPostDeposit?: (deposit: BankDeposit) => void;
  onVoidDeposit?: (id: string, reason: string) => void;
}

const formatDepositDate = (value?: string) => {
  if (!value) return '-';

  try {
    return format(new Date(`${value.slice(0, 10)}T00:00:00`), 'MM-dd-yyyy');
  } catch {
    return value;
  }
};

const getTodayDateValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const BankDepositsView: React.FC<BankDepositsViewProps> = ({
  deposits, bankAccounts, payments, currency,
  onAddDeposit, onUpdateDeposit, onDeleteDeposit, onPostDeposit, onVoidDeposit
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<BankDeposit | null>(null);
  const [viewingDeposit, setViewingDeposit] = useState<BankDeposit | null>(null);
  const [voidingDeposit, setVoidingDeposit] = useState<BankDeposit | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BankDepositStatus | 'ALL'>('ALL');
  const [bankFilter, setBankFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState<{
    depositNo: string;
    bankAccountId: string;
    referenceNo: string;
    depositDate: string;
    cashAmount: number;
    notes: string;
    lines: BankDepositLine[];
  }>({
    depositNo: '',
    bankAccountId: '',
    referenceNo: '',
    depositDate: new Date().toISOString().split('T')[0],
    cashAmount: 0,
    notes: '',
    lines: []
  });

  // Generate next deposit number
  const generateDepositNo = () => {
    const year = new Date().getFullYear();
    const existingNums = deposits
      .filter(d => d.depositNo?.startsWith(`DEP-${year}-`))
      .map(d => parseInt(d.depositNo?.split('-')[2] || '0'))
      .filter(n => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    return `DEP-${year}-${String(nextNum).padStart(5, '0')}`;
  };

  // Get undeposited payments
  const undepositedPayments = useMemo(() => {
    const depositedPaymentIds = new Set(
      deposits.flatMap(d => (d.lines || []).map(l => l.paymentId).filter(Boolean))
    );
    return payments.filter(p =>
      (p.status === 'POSTED' || p.status === 'OPEN') &&
      p.amountReceived > 0 &&
      !depositedPaymentIds.has(p.id)
    );
  }, [deposits, payments]);

  // Reset form
  const resetForm = () => {
    setFormData({
      depositNo: generateDepositNo(),
      bankAccountId: bankAccounts[0]?.id || '',
      referenceNo: '',
      depositDate: new Date().toISOString().split('T')[0],
      cashAmount: 0,
      notes: '',
      lines: []
    });
    setEditingDeposit(null);
  };

  // Open modal for new deposit
  const handleNew = () => {
    resetForm();
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (deposit: BankDeposit) => {
    setEditingDeposit(deposit);
    setFormData({
      depositNo: deposit.depositNo,
      bankAccountId: deposit.bankAccountId,
      referenceNo: deposit.referenceNo || '',
      depositDate: deposit.depositDate,
      cashAmount: deposit.cashAmount,
      notes: deposit.notes || '',
      lines: deposit.lines || []
    });
    setShowModal(true);
  };

  // View deposit details
  const handleView = (deposit: BankDeposit) => {
    setViewingDeposit(deposit);
    setShowViewModal(true);
  };

  // Add line from payment
  const handleAddPaymentLine = (payment: Payment) => {
    const newLine: BankDepositLine = {
      id: generateUUID(),
      depositId: editingDeposit?.id || '',
      paymentId: payment.id,
      description: `Payment ${payment.paymentNo}`,
      amount: payment.amountReceived,
      checkNumber: payment.checkNumber,
      checkDate: payment.checkDate,
      payerName: payment.sponsorId ? 'Sponsor Payment' : 'Student Payment',
      createdAt: new Date().toISOString()
    };
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));
  };

  // Add manual line
  const handleAddManualLine = () => {
    const newLine: BankDepositLine = {
      id: generateUUID(),
      depositId: editingDeposit?.id || '',
      description: '',
      amount: 0,
      createdAt: new Date().toISOString()
    };
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));
  };

  // Update line
  const handleUpdateLine = (lineId: string, field: keyof BankDepositLine, value: any) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map(l => l.id === lineId ? { ...l, [field]: value } : l)
    }));
  };

  // Remove line
  const handleRemoveLine = (lineId: string) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter(l => l.id !== lineId)
    }));
  };

  // Calculate totals
  const checkAmount = useMemo(() => {
    return formData.lines.reduce((sum, l) => sum + (l.amount || 0), 0);
  }, [formData.lines]);

  const totalAmount = formData.cashAmount + checkAmount;

  const bankAccountById = useMemo(
    () => new Map(bankAccounts.map(account => [account.id, account])),
    [bankAccounts]
  );

  // Save deposit
  const handleSave = () => {
    if (!formData.bankAccountId) {
      alert('Please select a bank account.');
      return;
    }
    if (totalAmount <= 0) {
      alert('Deposit total must be greater than zero.');
      return;
    }

    const deposit: BankDeposit = {
      id: editingDeposit?.id || generateUUID(),
      orgId: editingDeposit?.orgId || '',
      depositNo: formData.depositNo,
      bankAccountId: formData.bankAccountId,
      referenceNo: formData.referenceNo || undefined,
      depositDate: formData.depositDate,
      status: editingDeposit?.status || 'DRAFT',
      totalAmount: totalAmount,
      cashAmount: formData.cashAmount,
      checkAmount: checkAmount,
      lines: formData.lines,
      notes: formData.notes || undefined,
      createdAt: editingDeposit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingDeposit) {
      onUpdateDeposit(deposit);
    } else {
      onAddDeposit(deposit);
    }

    setShowModal(false);
    resetForm();
  };

  // Post deposit
  const handlePost = (deposit: BankDeposit) => {
    if (onPostDeposit) {
      onPostDeposit({ ...deposit, status: 'POSTED', postedAt: new Date().toISOString() });
    } else {
      onUpdateDeposit({ ...deposit, status: 'POSTED', postedAt: new Date().toISOString() });
    }
  };

  // Void deposit
  const handleVoid = () => {
    if (voidingDeposit && voidReason.trim()) {
      if (onVoidDeposit) {
        onVoidDeposit(voidingDeposit.id, voidReason);
      } else {
        onUpdateDeposit({
          ...voidingDeposit,
          status: 'VOIDED',
          voidedAt: new Date().toISOString(),
          voidReason
        });
      }
      setShowVoidModal(false);
      setVoidingDeposit(null);
      setVoidReason('');
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

  // Filter deposits
  const filteredDeposits = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const todayValue = getTodayDateValue();
    const currentMonthValue = todayValue.slice(0, 7);

    return deposits.filter(dep => {
      const bank = bankAccountById.get(dep.bankAccountId);
      const bankLabel = `${bank?.bankName || ''} ${bank?.accountNumber || ''}`.toLowerCase();
      const depositDateValue = dep.depositDate?.slice(0, 10) || '';

      const matchesSearch =
        normalizedSearch === '' ||
        (dep.depositNo || '').toLowerCase().includes(normalizedSearch) ||
        (dep.referenceNo || '').toLowerCase().includes(normalizedSearch) ||
        bankLabel.includes(normalizedSearch);

      const matchesStatus = statusFilter === 'ALL' || dep.status === statusFilter;
      const matchesBank = bankFilter === 'ALL' || dep.bankAccountId === bankFilter;

      let matchesDate = true;
      if (dateFilterMode === 'TODAY') {
        matchesDate = depositDateValue === todayValue;
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = depositDateValue.slice(0, 7) === currentMonthValue;
      } else if (dateFilterMode === 'CUSTOM') {
        matchesDate =
          (!dateFrom || depositDateValue >= dateFrom) &&
          (!dateTo || depositDateValue <= dateTo);
      }

      return matchesSearch && matchesStatus && matchesBank && matchesDate;
    }).sort((a, b) => (b.depositDate || '').localeCompare(a.depositDate || ''));
  }, [deposits, searchTerm, statusFilter, bankFilter, dateFilterMode, dateFrom, dateTo, bankAccountById]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    statusFilter !== 'ALL' ||
    bankFilter !== 'ALL' ||
    dateFilterMode !== 'ALL' ||
    !!dateFrom ||
    !!dateTo;

  // Summary stats
  const stats = useMemo(() => {
    const draft = deposits.filter(d => d.status === 'DRAFT');
    const posted = deposits.filter(d => d.status === 'POSTED');
    const voided = deposits.filter(d => d.status === 'VOIDED');
    const totalDeposited = posted.reduce((sum, d) => sum + d.totalAmount, 0);
    const totalCash = posted.reduce((sum, d) => sum + d.cashAmount, 0);
    const totalChecks = posted.reduce((sum, d) => sum + d.checkAmount, 0);
    return { draft, posted, voided, totalDeposited, totalCash, totalChecks };
  }, [deposits]);

  // Helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: currency || 'PHP' }).format(amount);
  };

  const getStatusBadge = (status: BankDepositStatus) => {
    switch (status) {
      case 'DRAFT': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 flex items-center gap-1"><Clock size={12} />Draft</span>;
      case 'POSTED': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-brand/10 text-brand flex items-center gap-1"><CheckCircle size={12} />Posted</span>;
      case 'VOIDED': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-600 flex items-center gap-1"><XCircle size={12} />Voided</span>;
    }
  };

  const getBankName = (id?: string) => bankAccountById.get(id || '')?.bankName || '-';
  const getBankAccountNumber = (id?: string) => bankAccountById.get(id || '')?.accountNumber || '-';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Bank Deposits</h2>
          <p className="text-gray-500 text-sm italic">Manage deposit slips for collections and cash receipts</p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover shadow-sm shadow-brand/20 transition-all"
        >
          <Plus size={20} />
          New Deposit
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
            <div className="p-2 rounded-lg bg-brand/10">
              <CheckCircle size={20} className="text-brand" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Posted</p>
              <p className="text-xl font-bold text-brand">{stats.posted.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10 text-brand">
              <Landmark size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Deposited</p>
              <p className="text-lg font-bold text-brand">{formatCurrency(stats.totalDeposited)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10">
              <Wallet size={20} className="text-brand" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Cash</p>
              <p className="text-lg font-bold text-brand">{formatCurrency(stats.totalCash)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10">
              <Receipt size={20} className="text-brand" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Checks</p>
              <p className="text-lg font-bold text-brand">{formatCurrency(stats.totalChecks)}</p>
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
      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search deposits..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as BankDepositStatus | 'ALL')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer"
            >
              <option value="ALL">All</option>
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Posted</option>
              <option value="VOIDED">Voided</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Bank:</span>
            <select
              value={bankFilter}
              onChange={e => setBankFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[210px]"
            >
              <option value="ALL">All</option>
              {bankAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.bankName}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative">
            <div
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
            >
              <span className="text-[13px] text-gray-500 mr-1">Date:</span>
              <span className="text-[13px] font-bold text-gray-800 pr-5 truncate max-w-[120px]">
                {dateFilterMode === 'ALL' ? 'All' : dateFilterMode === 'TODAY' ? 'Today' : dateFilterMode === 'THIS_MONTH' ? 'This Month' : 'Between...'}
              </span>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {showDateDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1">
                    <button
                      onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                      className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
                    >
                      Remove Quick Filter
                    </button>
                  </div>

                  <div className="border-t border-gray-100 p-1">
                    <button
                      onClick={() => setDateFilterMode('CUSTOM')}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'CUSTOM' ? 'font-bold text-brand bg-brand/10' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Is Between
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'TODAY' ? 'font-bold text-brand bg-brand/10' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'TODAY' && <CheckSquare size={14} />} Today
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'THIS_MONTH' ? 'font-bold text-brand bg-brand/10' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'THIS_MONTH' && <CheckSquare size={14} />} This Month
                    </button>
                  </div>

                  <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">From:</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => { setDateFrom(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-brand"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">To:</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => { setDateTo(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-brand"
                      />
                    </div>
                    <div className="flex justify-end items-center gap-2 pt-1">
                      <button
                        onClick={() => setShowDateDropdown(false)}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-bold text-gray-600 uppercase transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setShowDateDropdown(false)}
                        className="px-4 py-1 bg-brand hover:bg-brand-hover rounded text-[11px] font-bold text-white uppercase transition-colors shadow-sm"
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
              setBankFilter('ALL');
              setDateFilterMode('ALL');
              setDateFrom('');
              setDateTo('');
              setShowDateDropdown(false);
            }}
            className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Deposit List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full font-sans">
          <thead className="bg-brand border-b">
            <tr>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Date</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Deposit No.</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Bank Account</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Reference</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Status</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Cash</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Checks</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Total</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredDeposits.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  <Landmark size={40} className="mx-auto mb-2 text-gray-300" />
                  {hasActiveFilters ? 'Try adjusting your search or filters.' : 'No deposits found. Create one to get started!'}
                </td>
              </tr>
            ) : (
              filteredDeposits.map(dep => {
                const isExpanded = expandedRows.has(dep.id);

                return (
                  <React.Fragment key={dep.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => toggleRow(dep.id)}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatDepositDate(dep.depositDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                          <span className="font-medium text-gray-800">{dep.depositNo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Landmark size={14} className="mt-0.5 text-gray-400 shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-gray-800">{getBankName(dep.bankAccountId)}</div>
                            <div className="text-xs text-gray-400">{getBankAccountNumber(dep.bankAccountId)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{dep.referenceNo || '-'}</td>
                      <td className="px-4 py-3">{getStatusBadge(dep.status)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-brand">{formatCurrency(dep.cashAmount)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-brand">{formatCurrency(dep.checkAmount)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-brand">{formatCurrency(dep.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleView(dep)} className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand/10 rounded" title="View">
                            <Eye size={16} />
                          </button>
                          {dep.status === 'DRAFT' && (
                            <>
                              <button onClick={() => handleEdit(dep)} className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand/10 rounded" title="Edit">
                                <Edit3 size={16} />
                              </button>
                              <button onClick={() => handlePost(dep)} className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand/10 rounded" title="Post">
                                <CheckCircle size={16} />
                              </button>
                              <button onClick={() => onDeleteDeposit(dep.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded" title="Delete">
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          {dep.status === 'POSTED' && (
                            <button
                              onClick={() => { setVoidingDeposit(dep); setShowVoidModal(true); }}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Void"
                            >
                              <Ban size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && dep.lines && dep.lines.length > 0 && (
                      <tr>
                        <td colSpan={9} className="bg-gray-50 px-8 py-4">
                          <h4 className="mb-3 text-sm font-medium text-gray-700">Deposit Items</h4>
                          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr className="text-gray-500">
                                  <th className="px-4 py-2 text-left font-medium">Description</th>
                                  <th className="px-4 py-2 text-left font-medium">Check #</th>
                                  <th className="px-4 py-2 text-left font-medium">Payer</th>
                                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {dep.lines.map((line, idx) => (
                                  <tr key={line.id || idx}>
                                    <td className="px-4 py-2 text-gray-700">{line.description || '-'}</td>
                                    <td className="px-4 py-2 text-gray-700">{line.checkNumber || '-'}</td>
                                    <td className="px-4 py-2 text-gray-700">{line.payerName || '-'}</td>
                                    <td className="px-4 py-2 text-right font-medium text-brand">{formatCurrency(line.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Deposit Form Modal */}
      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-brand/10">
              <h3 className="text-lg font-bold text-gray-800">
                {editingDeposit ? 'Edit Deposit' : 'New Bank Deposit'}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-gray-200 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Deposit No</label>
                  <input
                    type="text"
                    value={formData.depositNo}
                    onChange={e => setFormData({ ...formData, depositNo: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Deposit Date *</label>
                  <input
                    type="date"
                    value={formData.depositDate}
                    onChange={e => setFormData({ ...formData, depositDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Bank Account *</label>
                  <select
                    value={formData.bankAccountId}
                    onChange={e => setFormData({ ...formData, bankAccountId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="">-- Select Bank --</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Reference / Slip No</label>
                  <input
                    type="text"
                    value={formData.referenceNo}
                    onChange={e => setFormData({ ...formData, referenceNo: e.target.value })}
                    placeholder="Deposit slip #"
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>

              {/* Cash Amount */}
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet size={20} className="text-brand" />
                    <span className="font-medium text-gray-700">Cash Amount</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cashAmount}
                    onChange={e => setFormData({ ...formData, cashAmount: parseFloat(e.target.value) || 0 })}
                    className="w-40 px-3 py-2 border rounded-lg text-right focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>

              {/* Checks / Items */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Receipt size={20} className="text-brand" />
                    <span className="font-medium text-gray-700">Checks & Other Items</span>
                  </div>
                  <div className="flex gap-2">
                    {undepositedPayments.length > 0 && (
                      <select
                        onChange={e => {
                          const payment = undepositedPayments.find(p => p.id === e.target.value);
                          if (payment) handleAddPaymentLine(payment);
                          e.target.value = '';
                        }}
                        className="px-3 py-1.5 border rounded-lg text-sm bg-white"
                      >
                        <option value="">+ Add from Payments</option>
                        {undepositedPayments.map(p => (
                          <option key={p.id} value={p.id}>{p.paymentNo} - {formatCurrency(p.amountReceived)}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={handleAddManualLine}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-brand bg-brand/10 hover:bg-brand/20 rounded-lg"
                    >
                      <PlusCircle size={16} />
                      Manual Entry
                    </button>
                  </div>
                </div>

                {formData.lines.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">No check items added</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b">
                        <th className="text-left py-2 px-2">Description</th>
                        <th className="text-left py-2 px-2 w-28">Check #</th>
                        <th className="text-left py-2 px-2 w-32">Payer</th>
                        <th className="text-right py-2 px-2 w-32">Amount</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lines.map(line => (
                        <tr key={line.id} className="border-b border-blue-100">
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={line.description}
                              onChange={e => handleUpdateLine(line.id, 'description', e.target.value)}
                              className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-brand/20"
                              placeholder="Description"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={line.checkNumber || ''}
                              onChange={e => handleUpdateLine(line.id, 'checkNumber', e.target.value)}
                              className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-brand/20"
                              placeholder="Check #"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={line.payerName || ''}
                              onChange={e => handleUpdateLine(line.id, 'payerName', e.target.value)}
                              className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-brand/20"
                              placeholder="Payer"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.amount}
                              onChange={e => handleUpdateLine(line.id, 'amount', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border rounded text-right focus:ring-1 focus:ring-brand/20"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <button
                              onClick={() => handleRemoveLine(line.id)}
                              className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <MinusCircle size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-medium">
                        <td colSpan={3} className="py-2 px-2 text-right">Subtotal Checks:</td>
                        <td className="py-2 px-2 text-right text-brand">{formatCurrency(checkAmount)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Total */}
              <div className="bg-gray-100 rounded-lg p-4 flex justify-between items-center">
                <span className="text-lg font-bold text-gray-700">Total Deposit:</span>
                <span className="text-2xl font-bold text-brand">{formatCurrency(totalAmount)}</span>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-gray-500">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/20"
                  placeholder="Deposit notes..."
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
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-all"
              >
                <Save size={18} />
                {editingDeposit ? 'Update Deposit' : 'Save as Draft'}
              </button>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* View Deposit Modal */}
      {showViewModal && viewingDeposit && (
        <ModalPortal>
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Deposit {viewingDeposit.depositNo}</h3>
                <p className="text-sm text-gray-500">{formatDepositDate(viewingDeposit.depositDate)}</p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(viewingDeposit.status)}
                <button onClick={() => setShowViewModal(false)} className="p-1 hover:bg-gray-200 rounded">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              {/* Bank Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Bank Account</p>
                  <p className="font-medium text-gray-800">{getBankName(viewingDeposit.bankAccountId)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-500 mb-1">Reference / Slip No</p>
                  <p className="font-medium text-gray-800">{viewingDeposit.referenceNo || '-'}</p>
                </div>
              </div>

              {/* Amounts */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cash:</span>
                  <span className="font-medium text-brand">{formatCurrency(viewingDeposit.cashAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Checks:</span>
                  <span className="font-medium text-brand">{formatCurrency(viewingDeposit.checkAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-bold">Total Deposit:</span>
                  <span className="font-bold text-lg text-brand">{formatCurrency(viewingDeposit.totalAmount)}</span>
                </div>
              </div>

              {/* Lines */}
              {viewingDeposit.lines && viewingDeposit.lines.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Deposit Items</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left">Check #</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingDeposit.lines.map((line, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{line.description}</td>
                            <td className="px-3 py-2">{line.checkNumber || '-'}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(line.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {viewingDeposit.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{viewingDeposit.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Void Modal */}
      {showVoidModal && voidingDeposit && (
        <ModalPortal>
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-lg">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Void Deposit</h3>
                <p className="text-sm text-gray-500">{voidingDeposit.depositNo}</p>
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
                onClick={() => { setShowVoidModal(false); setVoidingDeposit(null); setVoidReason(''); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim()}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                Void Deposit
              </button>
            </div>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default BankDepositsView;

