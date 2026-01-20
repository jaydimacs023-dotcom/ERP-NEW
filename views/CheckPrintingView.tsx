import React, { useState, useMemo } from 'react';
import { 
  CheckVoucher, CheckStatus, BankAccount, Vendor, Payable, 
  JournalEntry, JournalEntryLine, ChartOfAccount
} from '../types';
import { AccountingService } from '../accountingService';
import EmptyState from '../components/EmptyState';
import {
  FileText, Printer, Send, CheckCircle, Clock, XCircle,
  X, Plus, Search, Filter, ChevronDown, Eye, AlertCircle,
  Download, Calendar, Building, Banknote, Hash, RotateCcw
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
  onPostJournal?: (entry: Partial<JournalEntry>, lines: JournalEntryLine[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const STATUS_CONFIG: Record<CheckStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  PRINTED: { label: 'Printed', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  RELEASED: { label: 'Released', color: 'text-violet-600', bgColor: 'bg-violet-50' },
  CLEARED: { label: 'Cleared', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  VOIDED: { label: 'Voided', color: 'text-rose-600', bgColor: 'bg-rose-50' },
  STALE: { label: 'Stale', color: 'text-amber-600', bgColor: 'bg-amber-50' },
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

  const orgPayables = useMemo(() => 
    payables.filter(p => p.orgId === orgId && !p.isDeleted && 
      (p.status === 'approved' || p.status === 'partially_paid')),
    [payables, orgId]
  );

  // Search & Filter
  const filteredChecks = useMemo(() => {
    return orgChecks.filter(c => {
      const matchesSearch = 
        c.checkNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.payeeName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesBank = bankFilter === 'all' || c.bankAccountId === bankFilter;
      return matchesSearch && matchesStatus && matchesBank;
    });
  }, [orgChecks, searchTerm, statusFilter, bankFilter]);

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
        const lines: JournalEntryLine[] = [
          {
            id: `jl-${Date.now()}-1`,
            journalEntryId: '',
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
  const getBankName = (id: string) => orgBankAccounts.find(b => b.id === id)?.bankName || 'Unknown';

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
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <FileText className="text-indigo-600" size={28} />
            Check Voucher Management
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Prepare, print, and track check payments.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => openSettings()}
            disabled={orgBankAccounts.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Check Number Settings"
          >
            <Hash size={18} /> Settings
          </button>
          <button 
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            disabled={orgBankAccounts.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={18} /> New Check Voucher
          </button>
        </div>
      </div>

      {/* No Bank Accounts Warning */}
      {orgBankAccounts.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
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
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Draft</p>
          <p className="text-2xl font-black mt-1 text-slate-600">{summaryMetrics.draftCount}</p>
          <p className="text-xs text-slate-500">₱{formatCurrency(summaryMetrics.draftAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Printed</p>
          <p className="text-2xl font-black mt-1 text-blue-600">{summaryMetrics.printedCount}</p>
          <p className="text-xs text-blue-500">₱{formatCurrency(summaryMetrics.printedAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Released</p>
          <p className="text-2xl font-black mt-1 text-violet-600">{summaryMetrics.releasedCount}</p>
          <p className="text-xs text-violet-500">₱{formatCurrency(summaryMetrics.releasedAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Cleared (Total)</p>
          <p className="text-2xl font-black mt-1 text-emerald-600">₱{formatCurrency(summaryMetrics.clearedAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search checks..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as CheckStatus | 'all')}
            className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm appearance-none"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
        <div className="relative">
          <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <select
            value={bankFilter}
            onChange={e => setBankFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm appearance-none"
          >
            <option value="all">All Banks</option>
            {orgBankAccounts.map(b => (
              <option key={b.id} value={b.id}>{b.bankName}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>

      {/* Checks Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Check #</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank / Date</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payee</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredChecks.length > 0 ? (
              filteredChecks
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(check => {
                  const statusConfig = STATUS_CONFIG[check.status];
                  
                  return (
                    <tr key={check.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-indigo-600">{check.checkNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-700">{getBankName(check.bankAccountId)}</p>
                        <p className="text-xs text-slate-400">{check.checkDate}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-800">{check.payeeName}</p>
                        <p className="text-xs text-slate-400">{check.payeeType}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono font-semibold text-slate-700">₱{formatCurrency(check.amount)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {check.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handlePrint(check)}
                                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
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
                                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                                title="Reprint"
                              >
                                <Printer size={16} />
                              </button>
                              <button
                                onClick={() => handleRelease(check)}
                                className="p-1.5 hover:bg-violet-50 rounded-lg text-violet-600 transition-colors"
                                title="Release"
                              >
                                <Send size={16} />
                              </button>
                            </>
                          )}
                          {check.status === 'RELEASED' && (
                            <button
                              onClick={() => handleClear(check)}
                              className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors"
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
                <td colSpan={6} className="py-16 text-center">
                  <EmptyState 
                    icon={<FileText className="text-slate-300" size={48} />}
                    title="No checks found"
                    description="Create your first check voucher to get started."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">New Check Voucher</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Bank Account *</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
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
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Check Number *</label>
                  <input 
                    type="text"
                    required
                    placeholder="000001"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-mono"
                    value={formData.checkNumber}
                    onChange={e => setFormData({...formData, checkNumber: e.target.value})}
                  />
                  <p className="text-[10px] text-slate-400">Auto-filled from sequence or enter manually</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Payee Type</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                    value={formData.payeeType}
                    onChange={e => setFormData({...formData, payeeType: e.target.value as 'VENDOR' | 'EMPLOYEE' | 'OTHER', payeeId: '', payeeName: ''})}
                  >
                    <option value="VENDOR">Vendor</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Check Date *</label>
                  <input 
                    type="date"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                    value={formData.checkDate}
                    onChange={e => setFormData({...formData, checkDate: e.target.value})}
                  />
                </div>
              </div>

              {formData.payeeType === 'VENDOR' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Select Vendor</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                    value={formData.payeeId}
                    onChange={e => {
                      const vendor = orgVendors.find(v => v.id === e.target.value);
                      setFormData({...formData, payeeId: e.target.value, payeeName: vendor?.name || ''});
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
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Payee Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="Pay to the order of..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                  value={formData.payeeName}
                  onChange={e => setFormData({...formData, payeeName: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Amount *</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-sm"
                  value={formData.amount || ''}
                  onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                />
                {formData.amount > 0 && (
                  <p className="text-xs text-slate-500 italic mt-1">{numberToWords(formData.amount)}</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100"
                >
                  Create Check
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && selectedCheck && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50 no-print">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
                  <Printer size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">Check Print Preview</h3>
              </div>
              <button onClick={() => setShowPrintPreview(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            {/* Check Template */}
            <div className="p-8 print:p-4" id="check-print-area">
              <div className="border-2 border-slate-300 rounded-xl p-6 bg-[#f8f8e8] font-serif">
                {/* Bank Header */}
                <div className="flex justify-between items-start mb-6 border-b border-slate-300 pb-4">
                  <div>
                    <p className="text-lg font-bold text-slate-800">{getBankName(selectedCheck.bankAccountId)}</p>
                    <p className="text-xs text-slate-500">Account: {orgBankAccounts.find(b => b.id === selectedCheck.bankAccountId)?.accountNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Check No.</p>
                    <p className="text-xl font-mono font-bold text-indigo-600">{selectedCheck.checkNumber}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="flex justify-end mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Date:</span>
                    <span className="font-mono font-bold border-b border-slate-400 px-4">{selectedCheck.checkDate}</span>
                  </div>
                </div>

                {/* Pay To */}
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 whitespace-nowrap">Pay to the order of:</span>
                    <span className="flex-1 font-bold text-lg border-b border-slate-400 px-2">{selectedCheck.payeeName}</span>
                  </div>
                </div>

                {/* Amount */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 border-b border-slate-400 px-2 py-1">
                    <span className="text-sm italic">{selectedCheck.amountInWords}</span>
                  </div>
                  <div className="border-2 border-slate-400 px-4 py-2 bg-white">
                    <span className="font-mono font-bold text-xl">₱{formatCurrency(selectedCheck.amount)}</span>
                  </div>
                </div>

                {/* Signature Line */}
                <div className="flex justify-end mt-8">
                  <div className="w-48 text-center">
                    <div className="border-b border-slate-400 mb-1 h-8"></div>
                    <p className="text-[10px] text-slate-500 uppercase">Authorized Signature</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50/50 flex gap-3 no-print">
              <button 
                onClick={() => setShowPrintPreview(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmPrint}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Print Check
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Confirmation */}
      {confirmVoid && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertCircle className="text-rose-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Void Check?</h3>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmVoid(null)}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVoid(confirmVoid, 'Voided by user')}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors"
              >
                Void Check
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Check?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete check #{orgChecks.find(c => c.id === confirmDelete)?.checkNumber}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check Number Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                  <Hash size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">Check Number Settings</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Bank Account</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
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
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Check Number Prefix (Optional)</label>
                <input 
                  type="text"
                  placeholder="e.g., CHK-"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-mono"
                  value={settingsPrefix}
                  onChange={e => setSettingsPrefix(e.target.value)}
                />
                <p className="text-[10px] text-slate-400">Prefix will be added before the check number</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Starting Check Number</label>
                <input 
                  type="number"
                  min="1"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-mono"
                  value={settingsStartNumber}
                  onChange={e => setSettingsStartNumber(parseInt(e.target.value) || 1)}
                />
                <p className="text-[10px] text-slate-400">Next check will use this number (or higher if checks already exist)</p>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  <strong>Preview:</strong> Next check number will be <span className="font-mono font-bold">{settingsPrefix}{String(settingsStartNumber).padStart(6, '0')}</span>
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveSettings}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
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
