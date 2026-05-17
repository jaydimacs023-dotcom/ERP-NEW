import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  FileText,
  Printer,
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

type LedgerLineRow = {
  id: string;
  date: string;
  transactionType: string;
  reference: string;
  glReference: string;
  description: string;
  debit: number;
  credit: number;
  amount: number;
};

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

  const escapeHtml = (value: any): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatReportDate = (dateValue?: string) => {
    if (!dateValue) return '-';
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? dateValue : format(parsed, 'MMM d, yyyy');
  };

  const getTransactionType = (entry: JournalEntry) => {
    const source = String(entry.sourceType || '').toUpperCase();
    const reference = String(entry.reference || entry.glEntryNumber || '').toUpperCase();
    if (reference.startsWith('WO-') || source.includes('WRITE_OFF') || source.includes('WRITEOFF')) return 'Write-Off';
    if (reference.startsWith('CM-')) return 'Credit Memo';
    if (reference.startsWith('DM-')) return 'Debit Memo';
    if (source.includes('CREDIT') && !source.includes('DEBIT')) return 'Credit Memo';
    if (source.includes('DEBIT') && !source.includes('CREDIT')) return 'Debit Memo';
    if (source.includes('PAYMENT') || reference.startsWith('PAY-') || reference.startsWith('OR-')) return 'Payment';
    if (source.includes('INVOICE') || reference.startsWith('INV-')) return 'Invoice';
    return entry.sourceType || 'Journal Entry';
  };

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

  const selectedCustomer = useMemo<Sponsor | Student | undefined>(() => {
    if (!customerId) return undefined;
    if (customerType === 'SPONSOR') {
      return sponsors.find(sponsor => sponsor.id === customerId);
    }
    return students.find(item => item.id === customerId);
  }, [customerId, customerType, sponsors, students]);

  const customerName = useMemo(() => {
    if (!selectedCustomer) return '';
    return customerType === 'SPONSOR'
      ? (selectedCustomer as Sponsor).name
      : `${(selectedCustomer as Student).lastName}, ${(selectedCustomer as Student).firstName}`;
  }, [customerType, selectedCustomer]);

  const customerDisplayId = useMemo(() => {
    if (!selectedCustomer) return '-';
    return customerType === 'SPONSOR'
      ? ((selectedCustomer as Sponsor).sponsorCode || selectedCustomer.id)
      : ((selectedCustomer as Student).uli || selectedCustomer.id);
  }, [customerType, selectedCustomer]);

  const ledgerLines = useMemo<LedgerLineRow[]>(() => {
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
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        const amount = debit - credit;
        return {
          id: `${line.journalEntryId}-${line.id}`,
          date: entry.date,
          transactionType: getTransactionType(entry),
          reference: entry.reference || '-',
          glReference: entry.glEntryNumber || entry.reference || '-',
          description: entry.description,
          debit,
          credit,
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

  const totalCharges = useMemo(
    () => filteredPeriodLines.reduce((sum, line) => sum + line.debit, 0),
    [filteredPeriodLines]
  );
  const totalCredits = useMemo(
    () => filteredPeriodLines.reduce((sum, line) => sum + line.credit, 0),
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

  const exportRows = () => runningLines.map(line => ({
    'Transaction Type': line.transactionType,
    'Transaction Date': formatReportDate(line.date),
    'Reference No.': line.reference,
    'GL Reference No.': line.glReference,
    Description: line.description,
    'Charges / Debit': line.debit ? line.debit.toFixed(2) : '',
    'Payments / Credit': line.credit ? line.credit.toFixed(2) : '',
    'Running Balance': line.balance.toFixed(2)
  }));

  const buildPrintableLedgerHtml = () => {
    const rows = runningLines.map(line => `
      <tr>
        <td>${escapeHtml(line.transactionType)}</td>
        <td>${escapeHtml(formatReportDate(line.date))}</td>
        <td>${escapeHtml(line.reference)}</td>
        <td>${escapeHtml(line.glReference)}</td>
        <td>${escapeHtml(line.description)}</td>
        <td class="num">${line.debit ? escapeHtml(formatCurrency(line.debit)) : '&mdash;'}</td>
        <td class="num credit">${line.credit ? escapeHtml(formatCurrency(line.credit)) : '&mdash;'}</td>
        <td class="num">${escapeHtml(formatCurrency(line.balance))}</td>
      </tr>
    `).join('');

    return `<!doctype html><html><head><meta charset="utf-8"/><title>Customer Ledger Report</title><style>
      body{font-family:Inter,"Open Sans","Segoe UI",Arial,sans-serif;color:#172033;margin:24px}
      h1{font-size:22px;margin:0 0 4px}
      .sub{font-size:12px;color:#64748b;margin-bottom:18px}
      .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px;border:1px solid #e5e7eb;padding:14px}
      .meta div{font-size:11px;color:#64748b}.meta strong{display:block;margin-top:5px;color:#172033;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#059669;color:white;text-align:left;padding:9px;border:1px solid #047857}
      td{padding:8px;border:1px solid #e5e7eb}
      .num{text-align:right;white-space:nowrap}.credit{color:#dc2626;font-weight:700}
      @media print{body{margin:12mm}}
    </style></head><body>
      <h1>Customer Ledger Report</h1>
      <div class="sub">View detailed AR activity and running balance by customer</div>
      <div class="meta">
        <div>Customer ID<strong>${escapeHtml(customerDisplayId)}</strong></div>
        <div>Customer Name<strong>${escapeHtml(customerName || '-')}</strong></div>
        <div>Customer Type<strong>${escapeHtml(customerType === 'SPONSOR' ? 'Sponsor' : 'Student')}</strong></div>
        <div>Ledger Type<strong>${escapeHtml(customerType === 'SPONSOR' ? 'Sponsor Ledger' : 'Student Ledger')}</strong></div>
      </div>
      <table><thead><tr><th>Transaction Type</th><th>Transaction Date</th><th>Reference No.</th><th>GL Reference No.</th><th>Description</th><th>Charges / Debit</th><th>Payments / Credit</th><th>Running Balance</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No ledger entries found.</td></tr>'}</tbody></table>
    </body></html>`;
  };

  const downloadBlob = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const rows = exportRows();
    const headers = Object.keys(rows[0] || {
      'Transaction Type': '',
      'Transaction Date': '',
      'Reference No.': '',
      'GL Reference No.': '',
      Description: '',
      'Charges / Debit': '',
      'Payments / Credit': '',
      'Running Balance': ''
    });
    const html = `<!doctype html><html><head><meta charset="utf-8"/></head><body><table>
      <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${headers.map(header => `<td>${escapeHtml(row[header as keyof typeof row])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></body></html>`;
    downloadBlob(html, `Customer_Ledger_${new Date().toISOString().slice(0, 10)}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  };

  const handlePrintLedger = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) return;
    printWindow.document.write(buildPrintableLedgerHtml());
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleExportPdf = () => {
    handlePrintLedger();
  };

  const customerTypeLabel = customerType === 'SPONSOR' ? 'Sponsor' : 'Student';
  const ledgerTypeLabel = customerType === 'SPONSOR' ? 'Sponsor Ledger' : 'Student Ledger';
  const dateFilterLabel =
    dateFilterMode === 'ALL'
      ? 'All'
      : dateFilterMode === 'TODAY'
        ? 'Today'
        : dateFilterMode === 'THIS_MONTH'
          ? 'This Month'
          : 'Between...';

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Customer Ledger Report</h2>
        <p className="mt-1 text-sm text-gray-500 font-normal italic">View detailed AR activity and running balance by customer</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500">Selected Customer</p>
          <p className="mt-2 text-lg font-semibold text-gray-900 truncate">{customerName || 'None selected'}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500">Beginning Balance</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{formatCurrency(beginningBalance)}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500">Total Charges / Billings</p>
          <p className="mt-2 text-lg font-bold text-emerald-600">{formatCurrency(totalCharges)}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500">Total Credits / Adjustments</p>
          <p className="mt-2 text-lg font-bold text-red-600">{formatCurrency(totalCredits)}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500">Ending Balance</p>
          <p className="mt-2 text-lg font-bold text-emerald-700">{formatCurrency(endingBalance)}</p>
        </div>
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex h-9 w-full items-center rounded-md border border-gray-200 bg-white px-3 transition-colors hover:bg-gray-50 md:w-56">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search ledger entries..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] font-medium text-gray-700 outline-none placeholder:text-gray-400 placeholder:font-normal"
            />
          </div>

          <div className="relative">
            <div
              onClick={() => setShowCustomerTypeDropdown(prev => !prev)}
              className="relative flex h-9 min-w-44 cursor-pointer select-none items-center rounded-md border border-gray-200 bg-white px-3 transition-colors hover:bg-gray-50"
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
                        {option === 'SPONSOR' ? 'Sponsor' : 'Student'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <select
            className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-[13px] font-bold text-slate-800 outline-none md:w-48"
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
          >
            <option value="">Customer: Select...</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customerType === 'SPONSOR'
                  ? (customer as Sponsor).name
                  : `${(customer as Student).lastName}, ${(customer as Student).firstName}`}
              </option>
            ))}
          </select>

          <div className="relative">
            <div
              onClick={() => setShowDateDropdown(prev => !prev)}
              className="relative flex h-9 min-w-40 cursor-pointer select-none items-center rounded-md border border-gray-200 bg-white px-3 transition-colors hover:bg-gray-50"
            >
              <span className="text-[13px] text-gray-500 mr-1">Date Range:</span>
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

          <div className="flex h-9 w-[136px] items-center gap-2 rounded-md border border-gray-200 bg-white px-3">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setDateFilterMode('CUSTOM'); }}
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-slate-700 outline-none"
              title="From date"
            />
            
          </div>

          <div className="flex h-9 w-[136px] items-center gap-2 rounded-md border border-gray-200 bg-white px-3">
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setDateFilterMode('CUSTOM'); }}
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-slate-700 outline-none"
              title="To date"
            />
            
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50"
            style={hasActiveFilters ? { color: brandColor } : undefined}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          <button
            type="button"
            onClick={handlePrintLedger}
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 px-3 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <Printer size={14} /> Print Ledger
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 px-3 text-[12px] font-semibold text-rose-600 transition-colors hover:bg-rose-50"
          >
            <FileDown size={14} /> Export PDF
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 px-3 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>
        </div>
      </div>

      <div className="rounded-md border border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-[170px_1fr_1fr_1fr_1fr] md:divide-x md:divide-y-0">
          <div className="py-3 text-sm font-bold text-emerald-600 md:py-0">Customer Information</div>
          <div className="py-3 md:px-6 md:py-0">
            <p className="text-xs text-slate-500">Customer ID</p>
            <p className="mt-2 text-xs font-bold text-slate-900">{customerDisplayId}</p>
          </div>
          <div className="py-3 md:px-6 md:py-0">
            <p className="text-xs text-slate-500">Customer Name</p>
            <p className="mt-2 text-xs font-bold text-slate-900">{customerName || '-'}</p>
          </div>
          <div className="py-3 md:px-6 md:py-0">
            <p className="text-xs text-slate-500">Customer Type</p>
            <p className="mt-2 text-xs font-bold text-slate-900">{customerTypeLabel}</p>
          </div>
          <div className="py-3 md:px-6 md:py-0">
            <p className="text-xs text-slate-500">Ledger Type</p>
            <p className="mt-2 text-xs font-bold text-slate-900">{ledgerTypeLabel}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-base font-semibold text-gray-800">Ledger Details</div>
          <select
            className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-[13px] font-bold text-slate-800 outline-none md:w-48"
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

        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full divide-y divide-gray-100">
            <thead className="bg-emerald-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-white">Transaction Type</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-white">Transaction Date</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-white">Reference No.</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-white">GL Reference No.</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-white">Description</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-white">Charges / Debit</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-white">Payments / Credit</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-white">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRunningLines.map(line => (
                <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-medium text-slate-700">{line.transactionType}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{formatReportDate(line.date)}</td>
                  <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-700">{line.reference}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-700">{line.glReference}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-gray-800">{line.description}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono font-bold text-emerald-600">
                    {line.debit ? formatCurrency(line.debit) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono font-bold text-red-600">
                    {line.credit ? formatCurrency(line.credit) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono font-bold text-slate-900">
                    {formatCurrency(line.balance)}
                  </td>
                </tr>
              ))}
              {customerId && runningLines.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
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
                  <td colSpan={8} className="py-20 text-center">
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
