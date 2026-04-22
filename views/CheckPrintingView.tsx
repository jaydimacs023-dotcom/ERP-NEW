import React, { useState, useMemo } from 'react';
import {
  CheckVoucher, CheckStatus, BankAccount, Vendor, Payable,
  JournalEntry, JournalLine, ChartOfAccount
} from '../types';
import { format } from 'date-fns';
import EmptyState from '../components/EmptyState';
import ModalPortal from '../components/ModalPortal';
import {
  FileText, Printer, Send, CheckCircle, XCircle,
  X, Plus, Search, ChevronDown, AlertCircle,
  Hash, RotateCcw, CheckSquare
} from 'lucide-react';

interface CheckPrintingViewProps {
  orgId: string;
  checks: CheckVoucher[];
  bankAccounts: BankAccount[];
  vendors: Vendor[];
  payables: Payable[];
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  currentUserId?: string;
  onCreateCheck: (check: Partial<CheckVoucher>) => Promise<CheckVoucher | null> | void;
  onUpdateCheck: (id: string, updates: Partial<CheckVoucher>) => Promise<CheckVoucher | null> | void;
  onDeleteCheck?: (id: string) => Promise<boolean> | void;
  onPostJournal?: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const STATUS_CONFIG: Record<CheckStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  PRINTED: { label: 'Printed', color: 'text-brand', bgColor: 'bg-brand/10' },
  RELEASED: { label: 'Released', color: 'text-brand', bgColor: 'bg-brand/10' },
  CLEARED: { label: 'Cleared', color: 'text-brand', bgColor: 'bg-brand/10' },
  VOIDED: { label: 'Voided', color: 'text-rose-600', bgColor: 'bg-rose-50' },
  STALE: { label: 'Stale', color: 'text-amber-600', bgColor: 'bg-amber-50' },
};

const getCheckDateValue = (check: Pick<CheckVoucher, 'checkDate' | 'createdAt'>) =>
  (check.checkDate || check.createdAt || '').slice(0, 10);

const formatCheckDate = (value?: string) => {
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

const CheckPrintingView: React.FC<CheckPrintingViewProps> = ({
  orgId,
  checks,
  bankAccounts,
  vendors,
  payables,
  accounts,
  entries,
  currentUserId,
  onCreateCheck,
  onUpdateCheck,
  onDeleteCheck,
  onPostJournal,
  onNotify
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<CheckVoucher | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<CheckStatus | 'all'>('all');
  const [bankFilter, setBankFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Check number settings per bank account
  const [checkNumberSettings, setCheckNumberSettings] = useState<Record<string, { prefix: string; startNumber: number }>>({});

  // Form state
  const [formData, setFormData] = useState({
    bankAccountId: '',
    payeeType: 'VENDOR' as 'VENDOR' | 'EMPLOYEE' | 'OTHER',
    payeeId: '',
    payeeName: '',
    checkDate: new Date().toISOString().slice(0, 10),
    amount: 0,
    payableIds: [] as string[],
    checkNumber: '', // Manual check number input
  });

  // Filter data
  const orgChecks = useMemo(() =>
    checks.filter(c => c.orgId === orgId && !c.isDeleted),
    [checks, orgId]
  );

  const orgBankAccounts = useMemo(() =>
    bankAccounts.filter(b => b.orgId === orgId && !b.isDeleted && b.type !== 'CASH'),
    [bankAccounts, orgId]
  );

  const orgVendors = useMemo(() =>
    vendors.filter(v => v.orgId === orgId && !v.isDeleted),
    [vendors, orgId]
  );

  const bankAccountById = useMemo(
    () => new Map(orgBankAccounts.map(bank => [bank.id, bank])),
    [orgBankAccounts]
  );

  const getBankName = (id: string) => bankAccountById.get(id)?.bankName || 'Unknown';

  // Search & Filter
  const filteredChecks = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const todayValue = getTodayDateValue();
    const currentMonthValue = todayValue.slice(0, 7);

    return orgChecks.filter(c => {
      const checkDateValue = getCheckDateValue(c);
      const matchesSearch =
        normalizedSearch === '' ||
        c.checkNumber.toLowerCase().includes(normalizedSearch) ||
        c.payeeName.toLowerCase().includes(normalizedSearch) ||
        c.payeeType.toLowerCase().includes(normalizedSearch) ||
        (bankAccountById.get(c.bankAccountId)?.bankName || '').toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesBank = bankFilter === 'all' || c.bankAccountId === bankFilter;
      let matchesDate = true;

      if (dateFilterMode === 'TODAY') {
        matchesDate = checkDateValue === todayValue;
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = checkDateValue.slice(0, 7) === currentMonthValue;
      } else if (dateFilterMode === 'CUSTOM') {
        matchesDate =
          (!dateFrom || checkDateValue >= dateFrom) &&
          (!dateTo || checkDateValue <= dateTo);
      }

      return matchesSearch && matchesStatus && matchesBank && matchesDate;
    }).sort((a, b) => {
      const left = getCheckDateValue(a) || a.createdAt || '';
      const right = getCheckDateValue(b) || b.createdAt || '';
      return right.localeCompare(left);
    });
  }, [orgChecks, searchTerm, statusFilter, bankFilter, dateFilterMode, dateFrom, dateTo, bankAccountById]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    statusFilter !== 'all' ||
    bankFilter !== 'all' ||
    dateFilterMode !== 'ALL' ||
    !!dateFrom ||
    !!dateTo;

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const drafts = orgChecks.filter(c => c.status === 'DRAFT');
    const printed = orgChecks.filter(c => c.status === 'PRINTED');
    const released = orgChecks.filter(c => c.status === 'RELEASED');
    const cleared = orgChecks.filter(c => c.status === 'CLEARED');

    return {
      draftCount: drafts.length,
      draftAmount: drafts.reduce((sum, c) => sum + c.amount, 0),
      printedCount: printed.length,
      printedAmount: printed.reduce((sum, c) => sum + c.amount, 0),
      releasedCount: released.length,
      releasedAmount: released.reduce((sum, c) => sum + c.amount, 0),
      clearedAmount: cleared.reduce((sum, c) => sum + c.amount, 0),
    };
  }, [orgChecks]);

  // Get next check number based on settings or existing checks
  const getNextCheckNumber = (bankAccountId: string) => {
    const settings = checkNumberSettings[bankAccountId];
    const bankChecks = orgChecks.filter(c => c.bankAccountId === bankAccountId);

    // Find max existing check number
    const maxNum = bankChecks.reduce((max, c) => {
      const num = parseInt(c.checkNumber.replace(/\D/g, '')) || 0;
      return num > max ? num : max;
    }, 0);

    // If settings exist and start number is higher, use that
    let nextNum = maxNum + 1;
    if (settings && settings.startNumber > nextNum) {
      nextNum = settings.startNumber;
    }

    const prefix = settings?.prefix || '';
    return prefix + String(nextNum).padStart(6, '0');
  };

  // Update form check number when bank account changes
  const handleBankAccountChange = (bankAccountId: string) => {
    setFormData(prev => ({
      ...prev,
      bankAccountId,
      checkNumber: getNextCheckNumber(bankAccountId)
    }));
  };

  // Number to words conversion
  const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';

    const convert = (n: number): string => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
      if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      return convert(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + convert(n % 1000000) : '');
    };

    const pesos = Math.floor(num);
    const centavos = Math.round((num - pesos) * 100);

    let result = convert(pesos) + ' Pesos';
    if (centavos > 0) {
      result += ' and ' + convert(centavos) + ' Centavos';
    }
    return result + ' Only';
  };

  // Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.bankAccountId) {
      onNotify('error', 'Please select a bank account.');
      return;
    }
    if (!formData.payeeName || formData.amount <= 0) {
      onNotify('error', 'Please enter payee name and amount.');
      return;
    }
    if (!formData.checkNumber) {
      onNotify('error', 'Please enter a check number.');
      return;
    }

    // Check for duplicate check number
    const isDuplicate = orgChecks.some(c =>
      c.bankAccountId === formData.bankAccountId &&
      c.checkNumber === formData.checkNumber
    );
    if (isDuplicate) {
      onNotify('error', `Check number ${formData.checkNumber} already exists for this bank account.`);
      return;
    }

    const newCheck: Partial<CheckVoucher> = {
      orgId,
      checkNumber: formData.checkNumber,
      bankAccountId: formData.bankAccountId,
      payeeId: formData.payeeId,
      payeeType: formData.payeeType,
      payeeName: formData.payeeName,
      checkDate: formData.checkDate,
      amount: formData.amount,
      amountInWords: numberToWords(formData.amount),
      status: 'DRAFT',
      payableIds: formData.payableIds,
      preparedBy: currentUserId,
      preparedAt: new Date().toISOString(),
    };

    await onCreateCheck(newCheck);
    setShowCreateModal(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!onDeleteCheck) return;
    const check = orgChecks.find(c => c.id === id);
    if (check && check.status !== 'DRAFT') {
      onNotify('error', 'Only draft checks can be deleted.');
      return;
    }
    await onDeleteCheck(id);
    setConfirmDelete(null);
  };

  const handlePrint = (check: CheckVoucher) => {
    if (check.status !== 'DRAFT' && check.status !== 'PRINTED') {
      onNotify('error', 'Only draft or printed checks can be printed.');
      return;
    }

    setSelectedCheck(check);
    setShowPrintPreview(true);
  };

  const confirmPrint = () => {
    if (!selectedCheck) return;

    onUpdateCheck(selectedCheck.id, {
      status: 'PRINTED',
      printedBy: currentUserId,
      printedAt: new Date().toISOString(),
    });

    // Trigger browser print
    window.print();

    onNotify('success', `Check #${selectedCheck.checkNumber} marked as printed.`);
    setShowPrintPreview(false);
    setSelectedCheck(null);
  };

  const handleRelease = (check: CheckVoucher) => {
    if (check.status !== 'PRINTED') {
      onNotify('error', 'Only printed checks can be released.');
      return;
    }

    onUpdateCheck(check.id, {
      status: 'RELEASED',
      releasedBy: currentUserId,
      releasedAt: new Date().toISOString(),
    });

    onNotify('success', `Check #${check.checkNumber} released.`);
  };

  const handleClear = (check: CheckVoucher) => {
    if (check.status !== 'RELEASED') {
      onNotify('error', 'Only released checks can be cleared.');
      return;
    }

    // Post journal entry for the payment
    if (onPostJournal) {
      const bank = orgBankAccounts.find(b => b.id === check.bankAccountId);
      const apAccount = accounts.find(a => a.name.toLowerCase().includes('accounts payable'));

      if (bank && apAccount) {
        const lines: JournalLine[] = [
          {
            id: `jl-${Date.now()}-1`,
            journalEntryId: '',
            orgId,
            accountId: apAccount.id,
            description: `Payment to ${check.payeeName}`,
            debit: check.amount,
            credit: 0,
            contactId: check.payeeId,
            contactType: 'VENDOR',
          },
          {
            id: `jl-${Date.now()}-2`,
            journalEntryId: '',
            orgId,
            accountId: bank.glAccountId,
            description: `Check #${check.checkNumber}`,
            debit: 0,
            credit: check.amount,
          },
        ];

        onPostJournal({
          orgId,
          date: check.checkDate,
          reference: `CHK-${check.checkNumber}`,
          description: `Check payment to ${check.payeeName}`,
          sourceType: 'PAYMENT',
          status: 'POSTED',
        }, lines);
      }
    }

    onUpdateCheck(check.id, {
      status: 'CLEARED',
    });

    onNotify('success', `Check #${check.checkNumber} cleared and posted.`);
  };

  const handleVoid = (checkId: string, reason: string) => {
    const check = orgChecks.find(c => c.id === checkId);
    if (!check) return;

    if (check.status === 'CLEARED') {
      onNotify('error', 'Cannot void a cleared check. Create a reversal entry instead.');
      return;
    }

    onUpdateCheck(checkId, {
      status: 'VOIDED',
      voidedBy: currentUserId,
      voidedAt: new Date().toISOString(),
      voidReason: reason,
    });

    onNotify('success', `Check #${check.checkNumber} voided.`);
    setConfirmVoid(null);
  };

  const resetForm = () => {
    setFormData({
      bankAccountId: '',
      payeeType: 'VENDOR',
      payeeId: '',
      payeeName: '',
      checkDate: new Date().toISOString().slice(0, 10),
      amount: 0,
      payableIds: [],
      checkNumber: '',
    });
  };

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2 });

  // Settings modal for check number sequence
  const [settingsBank, setSettingsBank] = useState<string>('');
  const [settingsPrefix, setSettingsPrefix] = useState('');
  const [settingsStartNumber, setSettingsStartNumber] = useState(1);

  const openSettings = (bankId?: string) => {
    const bank = bankId || orgBankAccounts[0]?.id || '';
    setSettingsBank(bank);
    const existing = checkNumberSettings[bank];
    setSettingsPrefix(existing?.prefix || '');
    setSettingsStartNumber(existing?.startNumber || 1);
    setShowSettingsModal(true);
  };

  const saveSettings = () => {
    if (!settingsBank) return;
    setCheckNumberSettings(prev => ({
      ...prev,
      [settingsBank]: {
        prefix: settingsPrefix,
        startNumber: settingsStartNumber
      }
    }));
    onNotify('success', `Check number settings saved for ${getBankName(settingsBank)}`);
    setShowSettingsModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Check Voucher Management</h2>
          <p className="text-sm text-gray-500 font-normal italic">Prepare, print, and track check payments.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openSettings()}
            disabled={orgBankAccounts.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand/10 text-brand border border-brand-light rounded hover:bg-brand/20 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Check Number Settings"
          >
            <Hash size={18} /> Settings
          </button>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            disabled={orgBankAccounts.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={18} /> New Check Voucher
          </button>
        </div>
      </div>

      {/* No Bank Accounts Warning */}
      {orgBankAccounts.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded">
              <AlertCircle className="text-amber-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 mb-1">No Checking/Savings Accounts Found</h3>
              <p className="text-sm text-amber-700 leading-relaxed">
                To create check vouchers, you need at least one <strong>CHECKING</strong> or <strong>SAVINGS</strong> bank account configured.
                Cash accounts cannot be used for check printing.
              </p>
              <p className="text-sm text-amber-600 mt-2">
                Go to <strong>Treasury</strong> to add a bank account first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Draft</p>
          <p className="text-lg font-semibold mt-1 text-gray-600">{summaryMetrics.draftCount}</p>
          <p className="text-xs text-gray-500">{"\u20B1"}{formatCurrency(summaryMetrics.draftAmount)}</p>
        </div>
        <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-brand uppercase tracking-wide">Printed</p>
          <p className="text-lg font-semibold mt-1 text-brand">{summaryMetrics.printedCount}</p>
          <p className="text-xs text-brand/80">{"\u20B1"}{formatCurrency(summaryMetrics.printedAmount)}</p>
        </div>
        <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-brand uppercase tracking-wide">Released</p>
          <p className="text-lg font-semibold mt-1 text-brand">{summaryMetrics.releasedCount}</p>
          <p className="text-xs text-brand/80">{"\u20B1"}{formatCurrency(summaryMetrics.releasedAmount)}</p>
        </div>
        <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-brand uppercase tracking-wide">Cleared (Total)</p>
          <p className="text-lg font-semibold mt-1 text-brand">{"\u20B1"}{formatCurrency(summaryMetrics.clearedAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search checks..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as CheckStatus | 'all')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer"
            >
              <option value="all">All</option>
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Bank:</span>
            <select
              value={bankFilter}
              onChange={e => setBankFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-5 appearance-none cursor-pointer max-w-[180px]"
            >
              <option value="all">All</option>
              {orgBankAccounts.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.bankName}</option>
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
              setStatusFilter('all');
              setBankFilter('all');
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

      {/* Checks Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full font-sans">
          <thead className="bg-brand border-b">
            <tr>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Date</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Check No.</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Bank</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Payee</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Amount</th>
              <th className="px-4 py-3 text-center text-[13px] font-bold text-white">Status</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredChecks.length > 0 ? (
              filteredChecks.map(check => {
                  const statusConfig = STATUS_CONFIG[check.status];

                  return (
                    <tr key={check.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{formatCheckDate(getCheckDateValue(check))}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-brand">{check.checkNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{getBankName(check.bankAccountId)}</div>
                        <div className="text-xs text-gray-400">{bankAccountById.get(check.bankAccountId)?.accountNumber || 'No account number'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{check.payeeName}</div>
                        <div className="text-xs text-gray-400">{check.payeeType}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-semibold text-gray-700">{"\u20B1"}{formatCurrency(check.amount)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {check.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handlePrint(check)}
                                className="p-1.5 hover:bg-brand/10 rounded-lg text-brand transition-colors"
                                title="Print"
                              >
                                <Printer size={16} />
                              </button>
                              {onDeleteCheck && (
                                <button
                                  onClick={() => setConfirmDelete(check.id)}
                                  className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                                  title="Delete"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </>
                          )}
                          {check.status === 'PRINTED' && (
                            <>
                              <button
                                onClick={() => handlePrint(check)}
                                className="p-1.5 hover:bg-brand/10 rounded-lg text-brand transition-colors"
                                title="Reprint"
                              >
                                <Printer size={16} />
                              </button>
                              <button
                                onClick={() => handleRelease(check)}
                                className="p-1.5 hover:bg-brand/10 rounded-lg text-brand transition-colors"
                                title="Release"
                              >
                                <Send size={16} />
                              </button>
                            </>
                          )}
                          {check.status === 'RELEASED' && (
                            <button
                              onClick={() => handleClear(check)}
                              className="p-1.5 hover:bg-brand/10 rounded-lg text-brand transition-colors"
                              title="Clear"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                          {check.status !== 'CLEARED' && check.status !== 'VOIDED' && (
                            <button
                              onClick={() => setConfirmVoid(check.id)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                              title="Void"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
            ) : (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <EmptyState
                    icon={<FileText className="text-gray-300" size={48} />}
                    title="No checks found"
                    description={hasActiveFilters ? 'Try adjusting your search or filters.' : 'Create your first check voucher to get started.'}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-md shadow-md w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-md">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">New Check Voucher</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank Account *</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-medium"
                    value={formData.bankAccountId}
                    onChange={e => handleBankAccountChange(e.target.value)}
                  >
                    <option value="">Select Bank...</option>
                    {orgBankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.bankName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Check Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="000001"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-mono"
                    value={formData.checkNumber}
                    onChange={e => setFormData({ ...formData, checkNumber: e.target.value })}
                  />
                  <p className="text-xs text-gray-400">Auto-filled from sequence or enter manually</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payee Type</label>
                  <select
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-medium"
                    value={formData.payeeType}
                    onChange={e => setFormData({ ...formData, payeeType: e.target.value as 'VENDOR' | 'EMPLOYEE' | 'OTHER', payeeId: '', payeeName: '' })}
                  >
                    <option value="VENDOR">Vendor</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Check Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                    value={formData.checkDate}
                    onChange={e => setFormData({ ...formData, checkDate: e.target.value })}
                  />
                </div>
              </div>

              {formData.payeeType === 'VENDOR' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Vendor</label>
                  <select
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-medium"
                    value={formData.payeeId}
                    onChange={e => {
                      const vendor = orgVendors.find(v => v.id === e.target.value);
                      setFormData({ ...formData, payeeId: e.target.value, payeeName: vendor?.name || '' });
                    }}
                  >
                    <option value="">Select Vendor...</option>
                    {orgVendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Pay to the order of..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                  value={formData.payeeName}
                  onChange={e => setFormData({ ...formData, payeeName: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none font-mono text-sm"
                  value={formData.amount || ''}
                  onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                />
                {formData.amount > 0 && (
                  <p className="text-xs text-gray-500 italic mt-1">{numberToWords(formData.amount)}</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold shadow-lg shadow-brand/20"
                >
                  Create Check
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && selectedCheck && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-md shadow-md w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 no-print">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-md">
                  <Printer size={20} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Check Print Preview</h3>
              </div>
              <button onClick={() => setShowPrintPreview(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            {/* Check Template */}
            <div className="p-8 print:p-4" id="check-print-area">
              <div className="border-2 border-gray-300 rounded p-6 bg-[#f8f8e8] font-serif">
                {/* Bank Header */}
                <div className="flex justify-between items-start mb-6 border-b border-gray-300 pb-4">
                  <div>
                    <p className="text-lg font-bold text-gray-800">{getBankName(selectedCheck.bankAccountId)}</p>
                    <p className="text-xs text-gray-500">Account: {orgBankAccounts.find(b => b.id === selectedCheck.bankAccountId)?.accountNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase">Check No.</p>
                    <p className="text-xl font-mono font-bold text-brand">{selectedCheck.checkNumber}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="flex justify-end mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Date:</span>
                    <span className="font-mono font-bold border-b border-gray-400 px-4">{selectedCheck.checkDate}</span>
                  </div>
                </div>

                {/* Pay To */}
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 whitespace-nowrap">Pay to the order of:</span>
                    <span className="flex-1 font-bold text-lg border-b border-gray-400 px-2">{selectedCheck.payeeName}</span>
                  </div>
                </div>

                {/* Amount */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 border-b border-gray-400 px-2 py-1">
                    <span className="text-sm italic">{selectedCheck.amountInWords}</span>
                  </div>
                  <div className="border-2 border-gray-400 px-4 py-2 bg-white">
                    <span className="font-mono font-bold text-xl">{"\u20B1"}{formatCurrency(selectedCheck.amount)}</span>
                  </div>
                </div>

                {/* Signature Line */}
                <div className="flex justify-end mt-8">
                  <div className="w-48 text-center">
                    <div className="border-b border-gray-400 mb-1 h-8"></div>
                    <p className="text-xs text-gray-500 uppercase">Authorized Signature</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3 no-print">
              <button
                onClick={() => setShowPrintPreview(false)}
                className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPrint}
                className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Print Check
              </button>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Void Confirmation */}
      {confirmVoid && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded shadow-md w-full max-w-md p-6 animate-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertCircle className="text-rose-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Void Check?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmVoid(null)}
                className="flex-1 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVoid(confirmVoid, 'Voided by user')}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded text-sm font-bold hover:bg-rose-700 transition-colors"
              >
                Void Check
              </button>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded p-6 max-w-sm w-full shadow-md">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Check?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete check #{orgChecks.find(c => c.id === confirmDelete)?.checkNumber}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded text-sm font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded text-sm font-bold hover:bg-rose-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Check Number Settings Modal */}
      {showSettingsModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-md shadow-md w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-md">
                  <Hash size={20} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Check Number Settings</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank Account</label>
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-medium"
                  value={settingsBank}
                  onChange={e => {
                    const bank = e.target.value;
                    setSettingsBank(bank);
                    const existing = checkNumberSettings[bank];
                    setSettingsPrefix(existing?.prefix || '');
                    setSettingsStartNumber(existing?.startNumber || 1);
                  }}
                >
                  {orgBankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Check Number Prefix (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., CHK-"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-mono"
                  value={settingsPrefix}
                  onChange={e => setSettingsPrefix(e.target.value)}
                />
                <p className="text-xs text-gray-400">Prefix will be added before the check number</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Starting Check Number</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-mono"
                  value={settingsStartNumber}
                  onChange={e => setSettingsStartNumber(parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-gray-400">Next check will use this number (or higher if checks already exist)</p>
              </div>

              <div className="bg-brand/10 border border-brand-light rounded p-4">
                <p className="text-sm text-brand">
                  <strong>Preview:</strong> Next check number will be <span className="font-mono font-bold">{settingsPrefix}{String(settingsStartNumber).padStart(6, '0')}</span>
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded text-sm font-bold hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  className="flex-1 py-2.5 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #check-print-area, #check-print-area * {
            visibility: visible;
          }
          #check-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CheckPrintingView;

