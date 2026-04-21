import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronLeft, FileText, Filter, GraduationCap, Plus, RotateCcw, Search } from 'lucide-react';
import { AccountingService } from '../accountingService';
import {
  Sponsor,
  Student,
  JournalEntry,
  JournalLine,
  ChartOfAccount,
  AccountClass
} from '../types';

interface ARCreditDebitMemoViewProps {
  orgId: string;
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  students: Student[];
  sponsors: Sponsor[];
  currency: string;
  onPostJournal: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  brandColor?: string;
}

type MemoType = 'CREDIT' | 'DEBIT';
type ViewMode = 'LIST' | 'FORM';
type DateFilterMode = 'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM';
type CustomerFilter = 'ALL' | 'SPONSOR' | 'STUDENT';

const ARCreditDebitMemoView: React.FC<ARCreditDebitMemoViewProps> = ({
  orgId,
  entries,
  lines,
  accounts,
  students,
  sponsors,
  currency,
  onPostJournal,
  onNotify,
  brandColor = '#4f46e5'
}) => {
  const today = new Date().toISOString().split('T')[0];
  const getNextReference = (type: MemoType) =>
    AccountingService.getNextReference(entries, type === 'CREDIT' ? 'CM' : 'DM');

  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [memoType, setMemoType] = useState<MemoType>('CREDIT');
  const [memoDate, setMemoDate] = useState(today);
  const [reference, setReference] = useState('');
  const [customerType, setCustomerType] = useState<'SPONSOR' | 'STUDENT'>('SPONSOR');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState(0);
  const [arAccountId, setArAccountId] = useState('');
  const [offsetAccountId, setOffsetAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [memoTypeFilter, setMemoTypeFilter] = useState<'ALL' | MemoType>('ALL');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerFilter>('ALL');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showMemoTypeDropdown, setShowMemoTypeDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  useEffect(() => {
    setReference(getNextReference(memoType));
  }, [entries, memoType]);

  useEffect(() => {
    if (customerType === 'SPONSOR' && customerId) {
      const sponsor = sponsors.find(s => s.id === customerId);
      if (sponsor?.arAccountId) {
        setArAccountId(sponsor.arAccountId);
        return;
      }
    }

    const defaultAr =
      accounts.find(a => a.code === '1200' && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('accounts receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id;
    if (defaultAr) setArAccountId(defaultAr);
  }, [accounts, customerType, customerId, sponsors]);

  useEffect(() => {
    if (memoType === 'CREDIT') {
      const preferred = accounts.find(a =>
        a.class === AccountClass.REVENUE &&
        !a.isHeader &&
        (
          (a.name || '').toLowerCase().includes('sales return') ||
          (a.name || '').toLowerCase().includes('allowance') ||
          (a.name || '').toLowerCase().includes('contra')
        )
      )?.id;

      if (preferred) {
        setOffsetAccountId(preferred);
        return;
      }
    }

    const fallback =
      accounts.find(a => a.class === AccountClass.REVENUE && !a.isHeader)?.id ||
      accounts.find(a => a.class === AccountClass.EXPENSE && !a.isHeader)?.id;
    if (fallback) setOffsetAccountId(fallback);
  }, [accounts, memoType]);

  const customerName = useMemo(() => {
    if (!customerId) return '';
    if (customerType === 'SPONSOR') {
      return sponsors.find(s => s.id === customerId)?.name || '';
    }
    const student = students.find(x => x.id === customerId);
    return student ? `${student.lastName}, ${student.firstName}` : '';
  }, [customerId, customerType, sponsors, students]);

  const memoEntries = useMemo(() => {
    return entries
      .filter(e => e.status === 'POSTED' && (e.reference || '').match(/^(CM|DM)-/))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries]);

  const memoRows = useMemo(() => {
    return memoEntries.map(entry => {
      const arLine = lines.find(line => line.journalEntryId === entry.id && (line.debit > 0 || line.credit > 0) && line.contactId);
      const amountVal = arLine ? Math.abs(arLine.debit - arLine.credit) : 0;
      const resolvedMemoType: MemoType = (entry.reference || '').startsWith('CM-') ? 'CREDIT' : 'DEBIT';

      let customerLabel = 'Unknown';
      let customerKind: CustomerFilter = 'ALL';
      if (arLine?.contactType === 'SPONSOR') {
        customerKind = 'SPONSOR';
        customerLabel = sponsors.find(s => s.id === arLine.contactId)?.name || 'Unknown Sponsor';
      } else if (arLine?.contactType === 'STUDENT') {
        customerKind = 'STUDENT';
        const student = students.find(s => s.id === arLine.contactId);
        customerLabel = student ? `${student.lastName}, ${student.firstName}` : 'Unknown Student';
      }

      return {
        entry,
        amount: amountVal,
        memoType: resolvedMemoType,
        customerLabel,
        customerKind
      };
    });
  }, [lines, memoEntries, sponsors, students]);

  const filteredMemoRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const todayDate = new Date();
    const currentMonth = todayDate.getMonth();
    const currentYear = todayDate.getFullYear();

    return memoRows.filter(row => {
      const matchesSearch =
        !term ||
        (row.entry.reference || '').toLowerCase().includes(term) ||
        (row.entry.description || '').toLowerCase().includes(term) ||
        row.customerLabel.toLowerCase().includes(term);

      const matchesMemoType = memoTypeFilter === 'ALL' || row.memoType === memoTypeFilter;
      const matchesCustomerType = customerTypeFilter === 'ALL' || row.customerKind === customerTypeFilter;

      const rowDate = new Date(row.entry.date);
      let matchesDate = true;
      if (dateFilterMode === 'TODAY') {
        matchesDate = row.entry.date === today;
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = rowDate.getMonth() === currentMonth && rowDate.getFullYear() === currentYear;
      } else if (dateFilterMode === 'CUSTOM') {
        const afterFrom = !dateFrom || row.entry.date >= dateFrom;
        const beforeTo = !dateTo || row.entry.date <= dateTo;
        matchesDate = afterFrom && beforeTo;
      }

      return matchesSearch && matchesMemoType && matchesCustomerType && matchesDate;
    });
  }, [customerTypeFilter, dateFilterMode, dateFrom, dateTo, memoRows, memoTypeFilter, searchTerm, today]);

  const summary = useMemo(() => {
    const totalAmount = filteredMemoRows.reduce((sum, row) => sum + row.amount, 0);
    const creditCount = filteredMemoRows.filter(row => row.memoType === 'CREDIT').length;
    const debitCount = filteredMemoRows.filter(row => row.memoType === 'DEBIT').length;
    return {
      count: filteredMemoRows.length,
      creditCount,
      debitCount,
      totalAmount
    };
  }, [filteredMemoRows]);

  const formatCurrency = (val: number) =>
    `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    memoTypeFilter !== 'ALL' ||
    customerTypeFilter !== 'ALL' ||
    dateFilterMode !== 'ALL' ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = () => {
    setSearchTerm('');
    setMemoTypeFilter('ALL');
    setCustomerTypeFilter('ALL');
    setDateFilterMode('ALL');
    setDateFrom('');
    setDateTo('');
    setShowMemoTypeDropdown(false);
    setShowCustomerDropdown(false);
    setShowDateDropdown(false);
  };

  const resetFormState = (nextMemoType: MemoType = memoType) => {
    setMemoType(nextMemoType);
    setMemoDate(today);
    setReference(getNextReference(nextMemoType));
    setCustomerType('SPONSOR');
    setCustomerId('');
    setAmount(0);
    setReason('');
  };

  const openNewForm = () => {
    resetFormState(memoType);
    setViewMode('FORM');
  };

  const handleBackToList = () => {
    resetFormState(memoType);
    setViewMode('LIST');
  };

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return onNotify('error', 'Please select a customer.');
    if (!arAccountId) return onNotify('error', 'Please select an Accounts Receivable G/L account.');
    if (!offsetAccountId) return onNotify('error', 'Please select an offset account.');
    if (amount <= 0) return onNotify('error', 'Memo amount must be greater than zero.');

    const entryId = `je-memo-${Date.now()}`;
    const descPrefix = memoType === 'CREDIT' ? '[CREDIT MEMO]' : '[DEBIT MEMO]';
    const desc = `${descPrefix} ${customerName}${reason ? ` - ${reason}` : ''}`;

    const journalLines: JournalLine[] = memoType === 'CREDIT'
      ? [
          {
            id: `l-cm-dr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: offsetAccountId,
            debit: amount,
            credit: 0,
            memo: reason || 'Credit memo'
          },
          {
            id: `l-cm-cr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: arAccountId,
            debit: 0,
            credit: amount,
            memo: reason || 'Credit memo',
            contactId: customerId,
            contactType: customerType
          }
        ]
      : [
          {
            id: `l-dm-dr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: arAccountId,
            debit: amount,
            credit: 0,
            memo: reason || 'Debit memo',
            contactId: customerId,
            contactType: customerType
          },
          {
            id: `l-dm-cr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: offsetAccountId,
            debit: 0,
            credit: amount,
            memo: reason || 'Debit memo'
          }
        ];

    onPostJournal(
      {
        id: entryId,
        date: memoDate,
        reference,
        description: desc,
        sourceType: 'CREDIT_MEMO',
        status: 'POSTED'
      },
      journalLines
    );

    handleBackToList();
    onNotify('success', `${memoType === 'CREDIT' ? 'Credit' : 'Debit'} memo posted to General Ledger.`);
  };

  return (
    <div className="space-y-8 pb-20">
      {viewMode === 'LIST' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Credit / Debit Memo</h2>
              <p className="text-sm text-gray-500 font-normal italic">Adjust customer balances with credit or debit memos.</p>
            </div>
            <button
              type="button"
              onClick={openNewForm}
              className="flex items-center gap-2 px-6 py-2.5 text-white rounded-lg transition-all shadow-md font-bold text-sm"
              style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -10px ${brandColor}` }}
            >
              <Plus size={16} /> New Memo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Visible Memos</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.count}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Credit Memos</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.creditCount}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Debit Memos</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>{summary.debitCount}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Amount</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(summary.totalAmount)}</p>
            </div>
          </div>

          <div className="bg-white border-y px-4 py-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-72">
                <Search size={14} className="text-gray-400 mr-2" />
                <input
                  type="text"
                  placeholder="Search memos..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
                />
              </div>

              <div className="relative">
                <div
                  onClick={() => setShowMemoTypeDropdown(prev => !prev)}
                  className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
                >
                  <span className="text-[13px] text-gray-500 mr-1">Type:</span>
                  <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">
                    {memoTypeFilter === 'ALL' ? 'All' : memoTypeFilter === 'CREDIT' ? 'Credit' : 'Debit'}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                </div>

                {showMemoTypeDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMemoTypeDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        {(['ALL', 'CREDIT', 'DEBIT'] as Array<'ALL' | MemoType>).map(option => (
                          <button
                            key={option}
                            onClick={() => { setMemoTypeFilter(option); setShowMemoTypeDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${memoTypeFilter === option ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                            style={memoTypeFilter === option ? { backgroundColor: brandColor } : undefined}
                          >
                            {option === 'ALL' ? 'All Types' : option === 'CREDIT' ? 'Credit Memo' : 'Debit Memo'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <div
                  onClick={() => setShowCustomerDropdown(prev => !prev)}
                  className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[220px]"
                >
                  <span className="text-[13px] text-gray-500 mr-1 truncate">Customer:</span>
                  <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">
                    {customerTypeFilter === 'ALL' ? 'All' : customerTypeFilter === 'SPONSOR' ? 'Sponsors' : 'Students'}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                </div>

                {showCustomerDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCustomerDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        {(['ALL', 'SPONSOR', 'STUDENT'] as CustomerFilter[]).map(option => (
                          <button
                            key={option}
                            onClick={() => { setCustomerTypeFilter(option); setShowCustomerDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${customerTypeFilter === option ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                            style={customerTypeFilter === option ? { backgroundColor: brandColor } : undefined}
                          >
                            {option === 'ALL' ? 'All Customers' : option === 'SPONSOR' ? 'Sponsors' : 'Students'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <div
                  onClick={() => setShowDateDropdown(prev => !prev)}
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
                      <div className="border-b border-gray-100 p-1">
                        <button
                          onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100 rounded"
                        >
                          All Dates
                        </button>
                        <button
                          onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] rounded ${dateFilterMode === 'TODAY' ? 'text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                          style={dateFilterMode === 'TODAY' ? { backgroundColor: brandColor } : undefined}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] rounded ${dateFilterMode === 'THIS_MONTH' ? 'text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                          style={dateFilterMode === 'THIS_MONTH' ? { backgroundColor: brandColor } : undefined}
                        >
                          This Month
                        </button>
                      </div>

                      <div className="p-3 space-y-2 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">From:</span>
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">To:</span>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowDateDropdown(false)}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-bold text-gray-600 uppercase transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDateDropdown(false)}
                            className="px-4 py-1 rounded text-[11px] font-bold text-white uppercase transition-colors shadow-sm"
                            style={{ backgroundColor: brandColor }}
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
                type="button"
                onClick={clearFilters}
                className="p-2 text-gray-400 transition-colors"
                style={hasActiveFilters ? { color: brandColor } : undefined}
                title="Clear all filters"
              >
                <RotateCcw size={16} />
              </button>

              <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <Filter size={14} />
                <span>{filteredMemoRows.length} record{filteredMemoRows.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead style={{ backgroundColor: brandColor }}>
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Reference</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Description</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMemoRows.map(row => {
                  return (
                    <tr key={row.entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-xs text-gray-600">{row.entry.date}</td>
                      <td className="px-6 py-4 text-xs font-mono font-bold text-gray-700">{row.entry.reference}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                          {row.customerKind === 'SPONSOR' ? <Building2 size={12} style={{ color: brandColor }} /> : row.customerKind === 'STUDENT' ? <GraduationCap size={12} style={{ color: brandColor }} /> : <FileText size={12} style={{ color: brandColor }} />}
                          {row.customerLabel}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-700">{row.entry.description}</td>
                      <td className="px-6 py-4 text-right text-xs font-mono font-semibold text-gray-900">
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  );
                })}
                {filteredMemoRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-gray-400 italic">No memos found for the current search and filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <button
                type="button"
                onClick={handleBackToList}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide transition-colors"
                style={{ color: brandColor }}
              >
                <ChevronLeft size={14} /> Back to Memo Registry
              </button>
              <h2 className="mt-3 text-xl font-semibold text-gray-800 tracking-tight">New Credit / Debit Memo</h2>
              <p className="text-sm text-gray-500 font-normal italic">Create a memo entry on a dedicated form page before posting it to the General Ledger.</p>
            </div>
            <div
              className="px-4 py-2 border rounded text-xs font-semibold uppercase tracking-wide"
              style={{ backgroundColor: 'var(--acm-primary-light)', color: brandColor, borderColor: 'var(--acm-primary-light)' }}
            >
              {reference}
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
            <form onSubmit={handlePost} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Memo Type</label>
                  <select
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={memoType}
                    onChange={e => setMemoType(e.target.value as MemoType)}
                  >
                    <option value="CREDIT">Credit Memo</option>
                    <option value="DEBIT">Debit Memo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
                  <input
                    type="date"
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={memoDate}
                    onChange={e => setMemoDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</label>
                  <input
                    type="text"
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer Type</label>
                  <select
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={customerType}
                    onChange={e => { setCustomerType(e.target.value as 'SPONSOR' | 'STUDENT'); setCustomerId(''); }}
                  >
                    <option value="SPONSOR">Sponsor</option>
                    <option value="STUDENT">Student</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</label>
                  <select
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                  >
                    <option value="">Select customer...</option>
                    {customerType === 'SPONSOR' && sponsors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    {customerType === 'STUDENT' && students.map(s => (
                      <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AR Account</label>
                  <select
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={arAccountId}
                    onChange={e => setArAccountId(e.target.value)}
                  >
                    <option value="">Select AR account...</option>
                    {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader && (a.name || '').toLowerCase().includes('receivable')).map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {memoType === 'CREDIT' ? 'Contra / Revenue Account' : 'Revenue Account'}
                  </label>
                  <select
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={offsetAccountId}
                    onChange={e => setOffsetAccountId(e.target.value)}
                  >
                    <option value="">Select account...</option>
                    {accounts.filter(a => (a.class === AccountClass.REVENUE || a.class === AccountClass.EXPENSE) && !a.isHeader).map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason / Memo</label>
                <input
                  type="text"
                  className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g., Pricing adjustment or billing correction"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="px-6 py-3 border border-gray-200 text-gray-600 rounded text-sm font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 text-white rounded text-sm font-semibold shadow-md active:scale-95 transition-all"
                  style={{ backgroundColor: brandColor }}
                >
                  Post Memo
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default ARCreditDebitMemoView;
