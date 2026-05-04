import React, { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  FileText,
  Filter,
  GraduationCap,
  RotateCcw,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import {
  Sponsor,
  Student,
  JournalEntry,
  JournalLine,
  ChartOfAccount,
  AccountClass
} from '../types';

interface ARCustomerLedgerViewProps {
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  students: Student[];
  sponsors: Sponsor[];
  currency: string;
  brandColor?: string;
}

type CustomerType = 'SPONSOR' | 'STUDENT';
type DateFilterMode = 'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM';

const toDateInput = (d: Date) => {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split('T')[0];
};

const todayKey = () => new Date().toISOString().split('T')[0];

const ARCustomerLedgerView: React.FC<ARCustomerLedgerViewProps> = ({
  entries,
  lines,
  accounts,
  students,
  sponsors,
  currency,
  brandColor = '#4f46e5'
}) => {
  const today = new Date();
  const initialFromDate = toDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
  const initialToDate = toDateInput(today);

  const [searchTerm, setSearchTerm] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('SPONSOR');
  const [customerId, setCustomerId] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('THIS_MONTH');
  const [dateFrom, setDateFrom] = useState(initialFromDate);
  const [dateTo, setDateTo] = useState(initialToDate);
  const [showCustomerTypeDropdown, setShowCustomerTypeDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const formatCurrency = (val: number) =>
    `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const arAccountIds = useMemo(() => {
    return new Set(
      accounts
        .filter(account =>
          account.class === AccountClass.ASSET &&
          !account.isHeader &&
          ((account.name || '').toLowerCase().includes('receivable') || account.code === '1200')
        )
        .map(account => account.id)
    );
  }, [accounts]);

  const postedEntryById = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    entries.filter(entry => entry.status === 'POSTED').forEach(entry => map.set(entry.id, entry));
    return map;
  }, [entries]);

  const customers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (customerType === 'SPONSOR') {
      return sponsors.filter(sponsor =>
        !sponsor.isDeleted &&
        (
          !term ||
          sponsor.name.toLowerCase().includes(term) ||
          (sponsor.sponsorCode || '').toLowerCase().includes(term)
        )
      );
    }

    return students.filter(student =>
      !student.isDeleted &&
      (
        !term ||
        `${student.lastName}, ${student.firstName}`.toLowerCase().includes(term) ||
        (student.uli || '').toLowerCase().includes(term)
      )
    );
  }, [customerType, searchTerm, sponsors, students]);

  const customerName = useMemo(() => {
    if (!customerId) return '';
    if (customerType === 'SPONSOR') {
      return sponsors.find(sponsor => sponsor.id === customerId)?.name || '';
    }
    const student = students.find(item => item.id === customerId);
    return student ? `${student.lastName}, ${student.firstName}` : '';
  }, [customerId, customerType, sponsors, students]);

  const ledgerLines = useMemo(() => {
    if (!customerId) return [];
    return lines
      .filter(line =>
        line.contactId === customerId &&
        line.contactType === customerType &&
        postedEntryById.has(line.journalEntryId) &&
        arAccountIds.has(line.accountId)
      )
      .map(line => {
        const entry = postedEntryById.get(line.journalEntryId)!;
        const amount = line.debit - line.credit;
        return {
          id: `${line.journalEntryId}-${line.id}`,
          date: entry.date,
          reference: entry.reference,
          description: entry.description,
          amount
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [arAccountIds, customerId, customerType, lines, postedEntryById]);

  const dateRange = useMemo(() => {
    const todayDate = new Date();
    if (dateFilterMode === 'TODAY') {
      return { start: todayKey(), end: todayKey() };
    }
    if (dateFilterMode === 'THIS_MONTH') {
      return {
        start: toDateInput(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)),
        end: toDateInput(todayDate)
      };
    }
    if (dateFilterMode === 'CUSTOM') {
      return { start: dateFrom || '', end: dateTo || '' };
    }
    return { start: '', end: '' };
  }, [dateFilterMode, dateFrom, dateTo]);

  const beginningBalance = useMemo(() => {
    if (!customerId) return 0;
    if (!dateRange.start) return 0;
    const startDate = new Date(dateRange.start);
    return ledgerLines
      .filter(line => new Date(line.date) < startDate)
      .reduce((sum, line) => sum + line.amount, 0);
  }, [customerId, dateRange.start, ledgerLines]);

  const filteredPeriodLines = useMemo(() => {
    if (!customerId) return [];
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return ledgerLines.filter(line => {
      let matchesDate = true;
      if (dateRange.start) {
        matchesDate = line.date >= dateRange.start;
      }
      if (matchesDate && dateRange.end) {
        matchesDate = line.date <= dateRange.end;
      }

      const matchesSearch =
        !normalizedSearch ||
        line.reference.toLowerCase().includes(normalizedSearch) ||
        line.description.toLowerCase().includes(normalizedSearch) ||
        line.date.toLowerCase().includes(normalizedSearch) ||
        formatCurrency(line.amount).toLowerCase().includes(normalizedSearch) ||
        customerName.toLowerCase().includes(normalizedSearch);

      return matchesDate && matchesSearch;
    });
  }, [customerId, customerName, dateRange.end, dateRange.start, ledgerLines, searchTerm]);

  const runningLines = useMemo(() => {
    let running = beginningBalance;
    return filteredPeriodLines.map(line => {
      running += line.amount;
      return { ...line, balance: running };
    });
  }, [beginningBalance, filteredPeriodLines]);

  const totalActivity = useMemo(
    () => filteredPeriodLines.reduce((sum, line) => sum + line.amount, 0),
    [filteredPeriodLines]
  );

  const endingBalance = runningLines.length > 0 ? runningLines[runningLines.length - 1].balance : beginningBalance;
  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows: paginatedRunningLines,
    setCurrentPage
  } = usePaginatedRows(runningLines, [searchTerm, customerType, customerId, dateFilterMode, dateFrom, dateTo]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    customerType !== 'SPONSOR' ||
    dateFilterMode !== 'THIS_MONTH' ||
    dateFrom !== initialFromDate ||
    dateTo !== initialToDate;

  const clearFilters = () => {
    setSearchTerm('');
    setCustomerType('SPONSOR');
    setCustomerId('');
    setDateFilterMode('THIS_MONTH');
    setDateFrom(initialFromDate);
    setDateTo(initialToDate);
    setShowCustomerTypeDropdown(false);
    setShowDateDropdown(false);
  };

  const customerTypeLabel = customerType === 'SPONSOR' ? 'Sponsors' : 'Students';
  const dateFilterLabel =
    dateFilterMode === 'ALL'
      ? 'All'
      : dateFilterMode === 'TODAY'
        ? 'Today'
        : dateFilterMode === 'THIS_MONTH'
          ? 'This Month'
          : 'Between...';

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Customer Ledger</h2>
        <p className="text-sm text-gray-500 font-normal italic">View detailed AR activity by customer.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Selected Customer</p>
          <p className="mt-2 text-lg font-semibold text-gray-900 truncate">{customerName || 'None selected'}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Beginning Balance</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(beginningBalance)}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Period Activity</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>{formatCurrency(totalActivity)}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ending Balance</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(endingBalance)}</p>
        </div>
      </div>

      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-72">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search customer or ledger..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative">
            <div
              onClick={() => setShowCustomerTypeDropdown(prev => !prev)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[220px]"
            >
              <span className="text-[13px] text-gray-500 mr-1 truncate">Customer Type:</span>
              <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">{customerTypeLabel}</span>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {showCustomerTypeDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCustomerTypeDropdown(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1">
                    {(['SPONSOR', 'STUDENT'] as CustomerType[]).map(option => (
                      <button
                        key={option}
                        onClick={() => {
                          setCustomerType(option);
                          setCustomerId('');
                          setShowCustomerTypeDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${
                          customerType === option ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        style={customerType === option ? { backgroundColor: brandColor } : undefined}
                      >
                        {option === 'SPONSOR' ? 'Sponsors' : 'Students'}
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
              <span className="text-[13px] font-bold text-gray-800 pr-5 truncate max-w-[120px]">{dateFilterLabel}</span>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {showDateDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="border-b border-gray-100 p-1">
                    <button
                      onClick={() => { setDateFilterMode('ALL'); setShowDateDropdown(false); }}
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
            <span>{runningLines.length} record{runningLines.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm font-semibold text-gray-700">
            {customerName ? `Ledger for ${customerName}` : 'Select a customer'}
          </div>
          <div className="w-full md:w-[360px]">
            <select
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none"
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
            >
              <option value="">Select customer...</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customerType === 'SPONSOR'
                    ? (customer as Sponsor).name
                    : `${(customer as Student).lastName}, ${(customer as Student).firstName}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead style={{ backgroundColor: brandColor }}>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-white">Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-white">Reference</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-white">Description</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-white">Amount</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-white">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRunningLines.map(line => (
                <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-xs text-gray-600">{format(new Date(line.date), 'yyyy-MM-dd')}</td>
                  <td className="px-6 py-4 text-xs font-mono font-bold text-gray-700">{line.reference}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-800">{line.description}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-400">
                      {customerType === 'SPONSOR' ? <Building2 size={12} /> : <GraduationCap size={12} />}
                      <span>{customerType === 'SPONSOR' ? 'Sponsor Ledger' : 'Student Ledger'}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right text-xs font-mono font-semibold ${line.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {formatCurrency(line.amount)}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-mono font-semibold text-gray-900">
                    {formatCurrency(line.balance)}
                  </td>
                </tr>
              ))}
              {customerId && runningLines.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <FileText size={28} className="opacity-40" />
                      <p className="text-sm font-medium">No ledger activity found for the current search and filter.</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-2 px-5 py-2 text-white rounded text-sm font-semibold transition-all"
                          style={{ backgroundColor: brandColor }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {!customerId && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <FileText size={28} className="opacity-40" />
                      <p className="text-sm font-medium">Please select a customer to view the ledger.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={runningLines.length}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={setCurrentPage}
          itemLabel="ledger entries"
        />
      </div>
    </div>
  );
};

export default ARCustomerLedgerView;
