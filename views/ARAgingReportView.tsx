import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { Sponsor, Student, JournalEntry, JournalLine, ChartOfAccount, AccountClass } from '../types';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';

interface ARAgingReportViewProps {
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  students: Student[];
  sponsors: Sponsor[];
  currency: string;
  brandColor?: string;
  orgName?: string;
}

type PayorTypeFilter = 'ALL' | 'SPONSOR' | 'STUDENT';
type StatusFilter = 'ALL' | 'OPEN' | 'OVERDUE';
type PeriodFilter = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY';
type AgingBucketKey = 'current' | 'thirty' | 'sixty' | 'ninety' | 'overNinety';

interface AgingLineItem {
  id: string;
  journalEntryId: string;
  dueDate: string;
  referenceLabel: string;
  current: number;
  thirty: number;
  sixty: number;
  ninety: number;
  overNinety: number;
  balance: number;
  status: 'Open' | 'Overdue';
}

interface AgingRow {
  id: string;
  payorName: string;
  customerCode: string;
  accountNo: string;
  accountName: string;
  total: number;
  current: number;
  thirty: number;
  sixty: number;
  ninety: number;
  overNinety: number;
  type: PayorTypeFilter;
  dueDate: string;
  status: 'Open' | 'Overdue' | 'Partially Overdue';
  lineItems: AgingLineItem[];
}

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi Annual' },
  { value: 'YEARLY', label: 'Yearly' },
];

const normalizePayorType = (type?: JournalLine['contactType']): PayorTypeFilter | 'OTHER' =>
  type === 'SPONSOR' || type === 'STUDENT' ? type : 'OTHER';

const getPeriodStartDate = (asOfDate: string, period: PeriodFilter) => {
  const date = new Date(`${asOfDate}T00:00:00`);
  const daysByPeriod: Record<PeriodFilter, number> = {
    WEEKLY: 6,
    MONTHLY: 30,
    QUARTERLY: 91,
    SEMI_ANNUAL: 182,
    YEARLY: 364,
  };
  date.setDate(date.getDate() - daysByPeriod[period]);
  return date.toISOString().split('T')[0];
};

const ARAgingReportView: React.FC<ARAgingReportViewProps> = ({
  entries,
  lines,
  accounts,
  students,
  sponsors,
  currency,
  brandColor = '#0b8f4d',
  orgName = 'Institution',
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('MONTHLY');
  const [agingAsOf, setAgingAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [payorTypeFilter, setPayorTypeFilter] = useState<PayorTypeFilter>('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [expandedPayorId, setExpandedPayorId] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({ period: 'MONTHLY', agingAsOf: new Date().toISOString().split('T')[0] });

  const formatCurrency = (val: number) =>
    `${currency}${currency.length === 1 ? '' : ' '}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDateLabel = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'MM-dd-yyyy');
  };

  const getPeriodLabel = (value: PeriodFilter | string) =>
    periodOptions.find(option => option.value === value)?.label || 'Monthly';

  const arAccounts = useMemo(
    () => accounts.filter(account =>
      account.class === AccountClass.ASSET &&
      !account.isHeader &&
      ((account.name || '').toLowerCase().includes('receivable') || account.code === '1200')
    ),
    [accounts]
  );

  const agingReport = useMemo<AgingRow[]>(() => {
    const targetAccountIds = new Set(arAccounts.map(account => account.id));
    const periodStartDate = getPeriodStartDate(appliedFilters.agingAsOf, appliedFilters.period as PeriodFilter);
    const targetEntries = entries.filter(entry =>
      entry.date >= periodStartDate &&
      entry.date <= appliedFilters.agingAsOf &&
      entry.status === 'POSTED'
    );
    const entryMap = new Map(targetEntries.map(entry => [entry.id, entry]));
    const referenceDate = new Date(`${appliedFilters.agingAsOf}T00:00:00`);
    const buckets: Record<string, AgingRow> = {};

    lines
      .filter(line => entryMap.has(line.journalEntryId) && targetAccountIds.has(line.accountId) && line.contactId)
      .forEach(line => {
        const entry = entryMap.get(line.journalEntryId);
        if (!entry || !line.contactId) return;

        const payorType = normalizePayorType(line.contactType);
        if (payorType === 'OTHER') return;

        const account = arAccounts.find(item => item.id === line.accountId);
        const groupKey = `${payorType}-${line.contactId}-${line.accountId}`;
        const student = payorType === 'STUDENT' ? students.find(item => item.id === line.contactId) : undefined;
        const sponsor = payorType === 'SPONSOR' ? sponsors.find(item => item.id === line.contactId) : undefined;
        const payorName = sponsor?.name || (student ? `${student.lastName}, ${student.firstName}` : line.contactId);
        const customerCode = sponsor?.sponsorCode || student?.uli || line.contactId;
        const runtimeEntry = entry as JournalEntry & { dueDate?: string; invoiceDueDate?: string; invoice_due_date?: string };
        const dueDate = runtimeEntry.dueDate || runtimeEntry.invoiceDueDate || runtimeEntry.invoice_due_date || entry.date;
        const ageDays = Math.floor((referenceDate.getTime() - new Date(`${dueDate}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24));
        const amount = line.debit - line.credit;
        if (Math.abs(amount) <= 0.01) return;

        const bucket: AgingBucketKey =
          ageDays <= 0 ? 'current' :
          ageDays <= 30 ? 'thirty' :
          ageDays <= 60 ? 'sixty' :
          ageDays <= 90 ? 'ninety' :
          'overNinety';

        if (!buckets[groupKey]) {
          buckets[groupKey] = {
            id: groupKey,
            payorName,
            customerCode,
            accountNo: account?.code || '-',
            accountName: account?.name || 'Accounts Receivable',
            total: 0,
            current: 0,
            thirty: 0,
            sixty: 0,
            ninety: 0,
            overNinety: 0,
            type: payorType,
            dueDate,
            status: 'Open',
            lineItems: [],
          };
        }

        buckets[groupKey].total += amount;
        buckets[groupKey][bucket] += amount;
        if (dueDate < buckets[groupKey].dueDate) {
          buckets[groupKey].dueDate = dueDate;
        }

        buckets[groupKey].lineItems.push({
          id: line.id,
          journalEntryId: line.journalEntryId,
          dueDate,
          referenceLabel: entry.reference || entry.glEntryNumber || entry.sourceRef || line.journalEntryId,
          current: bucket === 'current' ? amount : 0,
          thirty: bucket === 'thirty' ? amount : 0,
          sixty: bucket === 'sixty' ? amount : 0,
          ninety: bucket === 'ninety' ? amount : 0,
          overNinety: bucket === 'overNinety' ? amount : 0,
          balance: amount,
          status: ageDays <= 0 ? 'Open' : 'Overdue',
        });
      });

    return Object.values(buckets)
      .filter(row => Math.abs(row.total) > 0.01)
      .map(row => {
        const overdue = row.thirty + row.sixty + row.ninety + row.overNinety;
        const status: AgingRow['status'] = overdue <= 0 ? 'Open' : row.current > 0 ? 'Partially Overdue' : 'Overdue';
        return {
          ...row,
          status,
          lineItems: row.lineItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [appliedFilters, arAccounts, entries, lines, sponsors, students]);

  const filteredAgingReport = useMemo(() => agingReport.filter(row => {
    const matchesPayorType = payorTypeFilter === 'ALL' || row.type === payorTypeFilter;
    const matchesAccount = accountFilter === 'ALL' || row.accountNo === accountFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'OPEN' && row.status === 'Open') ||
      (statusFilter === 'OVERDUE' && row.status !== 'Open');
    return matchesPayorType && matchesAccount && matchesStatus;
  }), [accountFilter, agingReport, payorTypeFilter, statusFilter]);

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows: paginatedAgingReport,
    setCurrentPage,
  } = usePaginatedRows(filteredAgingReport, [period, agingAsOf, payorTypeFilter, accountFilter, statusFilter], 8);

  const totals = useMemo(() => filteredAgingReport.reduce(
    (sum, row) => ({
      current: sum.current + row.current,
      thirty: sum.thirty + row.thirty,
      sixty: sum.sixty + row.sixty,
      ninety: sum.ninety + row.ninety,
      overNinety: sum.overNinety + row.overNinety,
      total: sum.total + row.total,
      overdueAccounts: sum.overdueAccounts + (row.status !== 'Open' ? 1 : 0),
    }),
    { current: 0, thirty: 0, sixty: 0, ninety: 0, overNinety: 0, total: 0, overdueAccounts: 0 }
  ), [filteredAgingReport]);

  const handleGenerate = () => {
    setAppliedFilters({ period, agingAsOf });
    setExpandedPayorId(null);
  };

  const clearFilters = () => {
    setPeriod('MONTHLY');
    setAgingAsOf(new Date().toISOString().split('T')[0]);
    setPayorTypeFilter('ALL');
    setAccountFilter('ALL');
    setStatusFilter('OPEN');
    setExpandedPayorId(null);
    setAppliedFilters({ period: 'MONTHLY', agingAsOf: new Date().toISOString().split('T')[0] });
  };

  const exportCsv = () => {
    const header = ['Payor Name', 'Account No.', 'Customer Code', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', 'Over 90 Days', 'Total Oustanding', 'Due Date', 'Status'];
    const csvRows = filteredAgingReport.map(row => [
      row.payorName,
      row.accountNo,
      row.customerCode,
      row.current,
      row.thirty,
      row.sixty,
      row.ninety,
      row.overNinety,
      row.total,
      row.dueDate,
      row.status,
    ]);
    const csv = [header, ...csvRows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ar-aging-report-${appliedFilters.agingAsOf}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (showPrintPreview) {
    const reportPeriodLabel = `${getPeriodLabel(appliedFilters.period)} Aging Report`;

    return (
      <div className="space-y-5 pb-10 text-slate-900">
        <style>{`
          @page { size: A4 landscape; margin: 10mm; }
          @media print {
            body { background: #fff !important; }
            body * { visibility: hidden; }
            #ar-aging-print-preview,
            #ar-aging-print-preview * { visibility: visible; }
            #ar-aging-print-preview {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: 0 !important;
              box-shadow: none !important;
              padding: 0 !important;
            }
            .ar-aging-no-print { display: none !important; }
          }
        `}</style>

        <div className="ar-aging-no-print flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowPrintPreview(false)}
            className="inline-flex h-11 items-center gap-3 rounded-md border border-gray-200 bg-white px-5 text-sm font-bold text-[#06146f] shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft size={20} />
            Back to Aging Report
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-5 text-sm font-bold text-[#06146f] shadow-sm hover:bg-gray-50"
            >
              <FileText size={18} className="text-red-500" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-5 text-sm font-bold text-[#06146f] shadow-sm hover:bg-gray-50"
            >
              <Download size={18} className="text-emerald-600" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-5 text-sm font-bold text-[#06146f] shadow-sm hover:bg-gray-50"
            >
              <Printer size={18} />
              Print
            </button>
          </div>
        </div>

        <section id="ar-aging-print-preview" className="rounded-md border border-gray-200 bg-white px-8 py-7 shadow-sm">
          <div className="text-center">
            <h1 className="text-2xl font-bold leading-tight text-black">{orgName}</h1>
            <h2 className="mt-2 text-xl font-bold leading-tight text-black">Accounts Receivable</h2>
            <h3 className="mt-2 text-xl font-bold leading-tight text-black">Aging Report</h3>
            <h4 className="mt-2 text-lg font-bold leading-tight text-black">{reportPeriodLabel}</h4>
          </div>

          <div className="mt-5 flex items-center gap-8">
            <div className="h-0.5 flex-1 bg-blue-500"></div>
            <div className="whitespace-nowrap text-base font-bold text-[#06146f]">
              As of Date: {formatDateLabel(appliedFilters.agingAsOf)}
            </div>
            <div className="h-0.5 flex-1 bg-blue-500"></div>
          </div>

          <div className="mt-6 overflow-hidden rounded border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-emerald-700 text-white">
                <tr>
                  <th className="border border-gray-300 px-3 py-3 text-center font-bold">Customer ID</th>
                  <th className="border border-gray-300 px-3 py-3 text-left font-bold">Payor Name / Student Name</th>
                  <th className="border border-gray-300 px-3 py-3 text-right font-bold">Current</th>
                  <th className="border border-gray-300 px-3 py-3 text-right font-bold">1-30 Days</th>
                  <th className="border border-gray-300 px-3 py-3 text-right font-bold">31-60 Days</th>
                  <th className="border border-gray-300 px-3 py-3 text-right font-bold">61-90 Days</th>
                  <th className="border border-gray-300 px-3 py-3 text-right font-bold">Over 90 Days</th>
                  <th className="border border-gray-300 px-3 py-3 text-right font-bold">Total Outstanding</th>
                  <th className="border border-gray-300 px-3 py-3 text-center font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgingReport.map(row => (
                  <tr key={row.id}>
                    <td className="border border-gray-200 px-3 py-3 text-center font-semibold">{row.customerCode}</td>
                    <td className="border border-gray-200 px-3 py-3 font-semibold">{row.payorName}</td>
                    <td className="border border-gray-200 px-3 py-3 text-right font-semibold">{formatCurrency(row.current)}</td>
                    <td className="border border-gray-200 px-3 py-3 text-right font-semibold">{formatCurrency(row.thirty)}</td>
                    <td className="border border-gray-200 px-3 py-3 text-right font-semibold">{formatCurrency(row.sixty)}</td>
                    <td className="border border-gray-200 px-3 py-3 text-right font-semibold">{formatCurrency(row.ninety)}</td>
                    <td className="border border-gray-200 px-3 py-3 text-right font-semibold">{formatCurrency(row.overNinety)}</td>
                    <td className="border border-gray-200 px-3 py-3 text-right font-semibold">{formatCurrency(row.total)}</td>
                    <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-blue-600">{row.status}</td>
                  </tr>
                ))}
                {filteredAgingReport.length === 0 && (
                  <tr>
                    <td colSpan={9} className="border border-gray-200 px-3 py-8 text-center text-gray-500">
                      No outstanding receivables found for the selected filters.
                    </td>
                  </tr>
                )}
                <tr className="font-bold">
                  <td colSpan={2} className="border border-gray-200 px-3 py-3">Grand Total Outstanding:</td>
                  <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(totals.current)}</td>
                  <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(totals.thirty)}</td>
                  <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(totals.sixty)}</td>
                  <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(totals.ninety)}</td>
                  <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(totals.overNinety)}</td>
                  <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(totals.total)}</td>
                  <td className="border border-gray-200 px-3 py-3 text-center">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5 w-full max-w-sm">
            <h3 className="mb-2 text-base font-bold">Aging Summary by Bucket</h3>
            <table className="w-full border-collapse text-sm">
              <thead className="bg-emerald-700 text-white">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-center font-bold">Bucket</th>
                  <th className="border border-gray-300 px-3 py-2 text-center font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Current', totals.current],
                  ['1-30 Days', totals.thirty],
                  ['31-60 Days', totals.sixty],
                  ['61-90 Days', totals.ninety],
                  ['Over 90 Days', totals.overNinety],
                  ['Total', totals.total],
                ].map(([label, amount]) => (
                  <tr key={label as string} className={label === 'Total' ? 'font-bold' : undefined}>
                    <td className="border border-gray-200 px-3 py-2">{label}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right font-semibold">{formatCurrency(amount as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-9 grid grid-cols-2 gap-28 text-sm font-semibold">
            <div className="flex items-end gap-4">
              <span className="whitespace-nowrap">Prepared By:</span>
              <div className="flex-1 text-center">
                <div className="border-b border-gray-700"></div>
                <div className="mt-2">AR Specialist</div>
              </div>
            </div>
            <div className="flex items-end gap-4">
              <span className="whitespace-nowrap">Reviewed By:</span>
              <div className="flex-1 border-b border-gray-700"></div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[#06146f]">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #ar-aging-print, #ar-aging-print * { visibility: visible; }
          #ar-aging-print { position: absolute; inset: 0; padding: 0; background: white; }
          .ar-aging-no-print { display: none !important; }
        }
      `}</style>

      <div>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Aging Report</h2>
        <p className="text-sm text-gray-500 font-normal italic">
          Monitor outstanding receivables by payor and identify overdue accounts.
        </p>
      </div>

      <div id="ar-aging-print" className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold uppercase text-blue-600">Total Outstanding Receivables</p>
            <p className="mt-3 text-2xl font-bold text-emerald-600">{formatCurrency(totals.total)}</p>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold uppercase text-blue-600">No. of Overdue Accounts</p>
            <p className="mt-3 text-2xl font-bold text-emerald-600">{totals.overdueAccounts}</p>
          </div>
        </div>

        <div className="ar-aging-no-print mt-4 flex flex-wrap items-center gap-3 border-y border-gray-100 bg-white py-2">
          <label className="flex h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-semibold shadow-sm">
            Period:
            <select value={period} onChange={event => setPeriod(event.target.value as PeriodFilter)} className="bg-transparent font-bold outline-none">
              {periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none -ml-6 opacity-0" />
          </label>

          <label className="flex h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-semibold shadow-sm">
            As Of Date:
            <input type="date" value={agingAsOf} onChange={event => setAgingAsOf(event.target.value)} className="bg-transparent font-bold outline-none" />
          </label>

          <label className="flex h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-semibold shadow-sm">
            Payor Type:
            <select value={payorTypeFilter} onChange={event => setPayorTypeFilter(event.target.value as PayorTypeFilter)} className="bg-transparent font-bold outline-none">
              <option value="ALL">All</option>
              <option value="SPONSOR">Sponsor</option>
              <option value="STUDENT">Student</option>
            </select>
          </label>

          <label className="flex h-11 min-w-[250px] items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-semibold shadow-sm">
            Account No.:
            <select value={accountFilter} onChange={event => setAccountFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent font-medium outline-none">
              <option value="ALL">Select account no.</option>
              {arAccounts.map(account => <option key={account.id} value={account.code}>{account.code} - {account.name}</option>)}
            </select>
          </label>

          <label className="flex h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-semibold shadow-sm">
            Status:
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} className="bg-transparent font-bold outline-none">
              <option value="OPEN">Open</option>
              <option value="OVERDUE">Overdue</option>
              <option value="ALL">All</option>
            </select>
          </label>

          <button type="button" onClick={clearFilters} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-[#06146f]" title="Reset filters">
            <RotateCcw size={20} />
          </button>
          <button type="button" onClick={handleGenerate} className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">
            <BarChart3 size={18} /> Generate
          </button>
          <button type="button" onClick={exportCsv} className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm font-bold shadow-sm">
            <Download size={18} /> Export
          </button>
          <button type="button" onClick={() => setShowPrintPreview(true)} className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm font-bold shadow-sm">
            <Printer size={18} /> Print
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <thead className="bg-emerald-700 text-white">
                <tr>
                  <th className="w-10 border-r border-white/25 px-4 py-3"></th>
                  <th className="border-r border-white/25 px-4 py-3 text-left font-bold">Account No. / Customer Code</th>
                  <th className="border-r border-white/25 px-4 py-3 text-left font-bold">Payor Name</th>
                  <th className="border-r border-white/25 px-4 py-3 text-right font-bold">Current</th>
                  <th className="border-r border-white/25 px-4 py-3 text-right font-bold">1-30 Days</th>
                  <th className="border-r border-white/25 px-4 py-3 text-right font-bold">31-60 Days</th>
                  <th className="border-r border-white/25 px-4 py-3 text-right font-bold">61-90 Days</th>
                  <th className="border-r border-white/25 px-4 py-3 text-right font-bold">Over 90 Days</th>
                  <th className="border-r border-white/25 px-4 py-3 text-right font-bold">Total Oustanding</th>
                  <th className="border-r border-white/25 px-4 py-3 text-center font-bold">Due Date</th>
                  <th className="px-4 py-3 text-center font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAgingReport.map(row => {
                  const isExpanded = expandedPayorId === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        onClick={() => setExpandedPayorId(isExpanded ? null : row.id)}
                        className="cursor-pointer border-b border-gray-200 bg-white font-semibold hover:bg-emerald-50/40"
                      >
                        <td className="px-4 py-4 text-center">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </td>
                        <td className="border-l border-gray-200 px-4 py-4 text-[#06146f]">
                          <div>{row.customerCode}</div>
                          <div className="text-xs font-medium text-gray-500">{row.accountNo} - {row.accountName}</div>
                        </td>
                        <td className="border-l border-gray-200 px-4 py-4">{row.payorName}</td>
                        <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(row.current)}</td>
                        <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(row.thirty)}</td>
                        <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(row.sixty)}</td>
                        <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(row.ninety)}</td>
                        <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(row.overNinety)}</td>
                        <td className="border-l border-gray-200 px-4 py-4 text-right font-bold">{formatCurrency(row.total)}</td>
                        <td className="border-l border-gray-200 px-4 py-4 text-center">{formatDateLabel(row.dueDate)}</td>
                        <td className="border-l border-gray-200 px-4 py-4 text-center text-blue-600">{row.status}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-gray-200 bg-slate-50">
                          <td></td>
                          <td colSpan={10} className="p-4">
                            <div className="rounded-md border border-gray-200 bg-white p-4">
                              <h3 className="mb-3 text-base font-bold text-emerald-700">Invoice Details</h3>
                              <table className="w-full min-w-[920px] border-collapse text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="border border-gray-200 px-3 py-3 text-center">Invoice No.</th>
                                    <th className="border border-gray-200 px-3 py-3 text-center">Due Date</th>
                                    <th className="border border-gray-200 px-3 py-3 text-right">Current</th>
                                    <th className="border border-gray-200 px-3 py-3 text-right">1-30 Days</th>
                                    <th className="border border-gray-200 px-3 py-3 text-right">31-60 Days</th>
                                    <th className="border border-gray-200 px-3 py-3 text-right">61-90 Days</th>
                                    <th className="border border-gray-200 px-3 py-3 text-right">Over 90 Days</th>
                                    <th className="border border-gray-200 px-3 py-3 text-right">Balance</th>
                                    <th className="border border-gray-200 px-3 py-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.lineItems.map(item => (
                                    <tr key={item.id}>
                                      <td className="border border-gray-200 px-3 py-3 text-center text-blue-600">{item.referenceLabel}</td>
                                      <td className="border border-gray-200 px-3 py-3 text-center">{formatDateLabel(item.dueDate)}</td>
                                      <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(item.current)}</td>
                                      <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(item.thirty)}</td>
                                      <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(item.sixty)}</td>
                                      <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(item.ninety)}</td>
                                      <td className="border border-gray-200 px-3 py-3 text-right">{formatCurrency(item.overNinety)}</td>
                                      <td className="border border-gray-200 px-3 py-3 text-right font-bold">{formatCurrency(item.balance)}</td>
                                      <td className="border border-gray-200 px-3 py-3 text-center text-blue-600">{item.status}</td>
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
                })}

                {filteredAgingReport.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-gray-500">
                      <FileText size={28} className="mx-auto mb-3 opacity-40" />
                      No outstanding receivables found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredAgingReport.length > 0 && (
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-left">Grand Total Outstanding:</td>
                    <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(totals.current)}</td>
                    <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(totals.thirty)}</td>
                    <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(totals.sixty)}</td>
                    <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(totals.ninety)}</td>
                    <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(totals.overNinety)}</td>
                    <td className="border-l border-gray-200 px-4 py-4 text-right text-emerald-600">{formatCurrency(totals.total)}</td>
                    <td className="border-l border-gray-200 px-4 py-4 text-center">-</td>
                    <td className="border-l border-gray-200 px-4 py-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="ar-aging-no-print">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredAgingReport.length}
              pageStartIndex={pageStartIndex}
              pageEndIndex={pageEndIndex}
              onPageChange={setCurrentPage}
              itemLabel="payors"
            />
          </div>
        </div>

        <p className="mt-4 text-sm font-semibold text-[#1f3f91]">
          Note: Aging is computed based on invoice due date. Status includes Open and Overdue accounts only by default.
        </p>
      </div>
    </div>
  );
};

export default ARAgingReportView;
