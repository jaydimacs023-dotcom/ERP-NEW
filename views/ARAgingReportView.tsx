import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronDown,
  FileText,
  Filter,
  GraduationCap,
  Printer,
  RotateCcw,
  Search,
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
}

type DebtorFilter = 'ALL' | 'SPONSOR' | 'STUDENT' | 'OTHER';
type AgingBucketKey = 'current' | 'thirty' | 'sixty' | 'ninety';

interface AgingLineItem {
  id: string;
  journalEntryId: string;
  entryDate: string;
  sourceType: JournalEntry['sourceType'];
  referenceLabel: string;
  glReference: string;
  description: string;
  memo: string;
  debit: number;
  credit: number;
  amount: number;
  ageDays: number;
  bucket: AgingBucketKey;
  bucketLabel: string;
  arAccountName: string;
}

interface AgingRow {
  id: string;
  name: string;
  total: number;
  current: number;
  thirty: number;
  sixty: number;
  ninety: number;
  type: DebtorFilter;
  lastActivityDate: string;
  arAccountName: string;
  lineItems: AgingLineItem[];
}

const normalizeDebtorType = (type?: JournalLine['contactType']): DebtorFilter =>
  type === 'SPONSOR' || type === 'STUDENT' ? type : 'OTHER';

const bucketLabelMap: Record<AgingBucketKey, string> = {
  current: '0 - 30 Days',
  thirty: '31 - 60 Days',
  sixty: '61 - 90 Days',
  ninety: 'Over 90 Days',
};

const ARAgingReportView: React.FC<ARAgingReportViewProps> = ({
  entries,
  lines,
  accounts,
  students,
  sponsors,
  currency,
  brandColor = '#4f46e5',
}) => {
  const [agingAsOf, setAgingAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debtorTypeFilter, setDebtorTypeFilter] = useState<DebtorFilter>('ALL');
  const [showDebtorDropdown, setShowDebtorDropdown] = useState(false);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);

  const formatCurrency = (val: number) =>
    `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDateLabel = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'MMM dd, yyyy');
  };

  const agingReport = useMemo<AgingRow[]>(() => {
    const targetAccounts = accounts.filter(account =>
      account.class === AccountClass.ASSET &&
      (account.name || '').toLowerCase().includes('receivable')
    );
    const targetAccountIds = new Set(targetAccounts.map(account => account.id));

    const targetEntries = entries.filter(entry => entry.date <= agingAsOf && entry.status === 'POSTED');
    const entryMap = new Map(targetEntries.map(entry => [entry.id, entry]));
    const targetLines = lines.filter(line =>
      entryMap.has(line.journalEntryId) &&
      targetAccountIds.has(line.accountId) &&
      line.contactId
    );

    const referenceDate = new Date(agingAsOf);
    const buckets: Record<string, AgingRow> = {};

    targetLines.forEach(line => {
      const entry = entryMap.get(line.journalEntryId);
      if (!entry || !line.contactId) return;

      const contactKey = line.contactId;
      const normalizedType = normalizeDebtorType(line.contactType);

      if (!buckets[contactKey]) {
        let name = 'Unknown Contact';
        if (normalizedType === 'STUDENT') {
          const student = students.find(item => item.id === contactKey);
          name = student ? `${student.lastName}, ${student.firstName}` : `Student: ${contactKey}`;
        } else if (normalizedType === 'SPONSOR') {
          const sponsor = sponsors.find(item => item.id === contactKey);
          name = sponsor ? sponsor.name : `Sponsor: ${contactKey}`;
        }

        buckets[contactKey] = {
          id: contactKey,
          name,
          total: 0,
          current: 0,
          thirty: 0,
          sixty: 0,
          ninety: 0,
          type: normalizedType,
          lastActivityDate: entry.date,
          arAccountName: accounts.find(account => account.id === line.accountId)?.name || 'Accounts Receivable',
          lineItems: [],
        };
      }

      const diffMs = referenceDate.getTime() - new Date(entry.date).getTime();
      const ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const value = line.debit - line.credit;
      const bucket: AgingBucketKey =
        ageDays <= 30 ? 'current' :
        ageDays <= 60 ? 'thirty' :
        ageDays <= 90 ? 'sixty' :
        'ninety';

      buckets[contactKey].total += value;
      buckets[contactKey][bucket] += value;
      if (entry.date > buckets[contactKey].lastActivityDate) {
        buckets[contactKey].lastActivityDate = entry.date;
      }

      buckets[contactKey].lineItems.push({
        id: line.id,
        journalEntryId: line.journalEntryId,
        entryDate: entry.date,
        sourceType: entry.sourceType,
        referenceLabel: entry.reference || entry.glEntryNumber || entry.sourceRef || line.journalEntryId,
        glReference: entry.glEntryNumber || 'Pending',
        description: entry.description || line.memo || line.description || 'Receivable transaction',
        memo: line.memo || line.description || '-',
        debit: line.debit,
        credit: line.credit,
        amount: value,
        ageDays,
        bucket,
        bucketLabel: bucketLabelMap[bucket],
        arAccountName: accounts.find(account => account.id === line.accountId)?.name || 'Accounts Receivable',
      });
    });

    return Object.values(buckets)
      .filter(bucket => Math.abs(bucket.total) > 0.01)
      .map(bucket => ({
        ...bucket,
        lineItems: [...bucket.lineItems].sort((a, b) => {
          const dateDiff = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
          if (dateDiff !== 0) return dateDiff;
          return a.referenceLabel.localeCompare(b.referenceLabel);
        }),
      }))
      .sort((a, b) => b.total - a.total);
  }, [accounts, agingAsOf, entries, lines, sponsors, students]);

  const filteredAgingReport = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return agingReport.filter(row => {
      const matchesSearch =
        !normalizedSearch ||
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.arAccountName.toLowerCase().includes(normalizedSearch) ||
        row.type.toLowerCase().includes(normalizedSearch);

      const matchesType = debtorTypeFilter === 'ALL' || row.type === debtorTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [agingReport, debtorTypeFilter, searchTerm]);

  const selectedDebtor = useMemo(
    () => agingReport.find(row => row.id === selectedDebtorId) || null,
    [agingReport, selectedDebtorId]
  );

  const visibleSummary = useMemo(() => {
    const totalBalance = filteredAgingReport.reduce((sum, row) => sum + row.total, 0);
    const overdueBalance = filteredAgingReport.reduce((sum, row) => sum + row.thirty + row.sixty + row.ninety, 0);
    const overNinetyBalance = filteredAgingReport.reduce((sum, row) => sum + row.ninety, 0);

    return {
      debtorCount: filteredAgingReport.length,
      totalBalance,
      overdueBalance,
      overNinetyBalance,
    };
  }, [filteredAgingReport]);

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows: paginatedAgingReport,
    setCurrentPage
  } = usePaginatedRows(filteredAgingReport, [searchTerm, debtorTypeFilter, agingAsOf]);

  const hasActiveFilters = searchTerm.trim().length > 0 || debtorTypeFilter !== 'ALL';

  const clearFilters = () => {
    setSearchTerm('');
    setDebtorTypeFilter('ALL');
    setShowDebtorDropdown(false);
  };

  const renderDebtorIcon = (type: DebtorFilter) =>
    type === 'SPONSOR' ? <Building2 size={12} /> : type === 'STUDENT' ? <GraduationCap size={12} /> : <FileText size={12} />;

  const renderDebtorLabel = (type: DebtorFilter) =>
    type === 'SPONSOR' ? 'Sponsor' : type === 'STUDENT' ? 'Student' : 'Other';

  const renderSignedAmount = (amount: number, positiveClass = 'text-gray-900') => (
    <span className={amount < 0 ? 'text-rose-600' : positiveClass}>
      {amount < 0 ? `(${formatCurrency(Math.abs(amount))})` : formatCurrency(amount)}
    </span>
  );

  const selectedDebtorMeta = useMemo(() => {
    if (!selectedDebtor) return null;
    if (selectedDebtor.type === 'SPONSOR') {
      const sponsor = sponsors.find(item => item.id === selectedDebtor.id);
      return {
        code: sponsor?.sponsorCode || selectedDebtor.id,
        secondary: sponsor?.contactPerson || sponsor?.email || sponsor?.phone || '-',
      };
    }
    if (selectedDebtor.type === 'STUDENT') {
      const student = students.find(item => item.id === selectedDebtor.id);
      return {
        code: student?.uli || selectedDebtor.id,
        secondary: student?.contactNumber || [student?.city, student?.province].filter(Boolean).join(', ') || '-',
      };
    }
    return {
      code: selectedDebtor.id,
      secondary: '-',
    };
  }, [selectedDebtor, sponsors, students]);

  const handlePrintDetail = () => {
    window.print();
  };

  if (selectedDebtor) {
    const overdueBalance = selectedDebtor.thirty + selectedDebtor.sixty + selectedDebtor.ninety;

    return (
      <>
        <style>{`
          @page {
            size: A4 portrait;
            margin: 14mm;
          }
          @media print {
            body {
              background: #fff !important;
            }
            body * {
              visibility: hidden;
            }
            #aging-detail-print-shell,
            #aging-detail-print-shell * {
              visibility: visible;
            }
            #aging-detail-print-shell {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              max-width: none !important;
              min-height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: #fff !important;
              overflow: visible !important;
            }
            .aging-detail-no-print {
              display: none !important;
            }
            .aging-print-header {
              padding: 0 0 5mm 0 !important;
            }
            .aging-print-body {
              padding: 5mm 0 0 0 !important;
            }
            .aging-print-summary {
              margin-bottom: 4mm !important;
              gap: 3mm !important;
            }
            .aging-print-table-wrap {
              margin-left: 0 !important;
              margin-right: 0 !important;
              margin-top: 4mm !important;
              border-left: none !important;
              border-right: none !important;
              overflow: visible !important;
            }
            .aging-print-table {
              width: 100% !important;
              min-width: 0 !important;
              table-layout: fixed !important;
              font-size: 10px !important;
            }
            .aging-print-table th,
            .aging-print-table td {
              padding: 2.2mm 1.6mm !important;
              line-height: 1.25 !important;
            }
            .aging-print-table th {
              font-size: 9px !important;
              letter-spacing: 0.08em !important;
            }
            .aging-print-wrap {
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
              white-space: normal !important;
            }
            .aging-print-signatures {
              margin-top: 6mm !important;
              gap: 6mm !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}</style>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 aging-detail-no-print">
            <button
              type="button"
              onClick={() => setSelectedDebtorId(null)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <ArrowLeft size={16} />
              Back to Aging Report
            </button>

            <button
              type="button"
              onClick={handlePrintDetail}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: brandColor }}
            >
              <Printer size={16} />
              Print A4
            </button>
          </div>

          <div
            id="aging-detail-print-shell"
            className="mx-auto w-full max-w-[210mm] min-h-[297mm] rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="aging-print-header border-b border-gray-200 px-10 py-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Accounts Receivable</p>
                  <h2 className="mt-2 text-3xl font-semibold text-gray-900">Aging Detail Schedule</h2>
                  <p className="mt-2 text-sm text-gray-500">Formal debtor aging detail prepared for review and A4 printing.</p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p className="font-semibold text-gray-700">As of {formatDateLabel(agingAsOf)}</p>
                  <p>Printed {formatDateLabel(new Date().toISOString())}</p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Debtor</p>
                  <p className="mt-2 text-xl font-semibold text-gray-900">{selectedDebtor.name}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {renderDebtorLabel(selectedDebtor.type)} • Code: {selectedDebtorMeta?.code || '-'}
                  </p>
                  <p className="text-sm text-gray-500">{selectedDebtorMeta?.secondary || '-'}</p>
                </div>
                <div className="md:text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Receivable Account</p>
                  <p className="mt-2 text-base font-semibold text-gray-900">{selectedDebtor.arAccountName}</p>
                  <p className="mt-1 text-sm text-gray-500">Last activity {formatDateLabel(selectedDebtor.lastActivityDate)}</p>
                </div>
              </div>
            </div>

            <div className="aging-print-body px-10 py-8">
              <div className="aging-print-summary mb-6 grid grid-cols-1 gap-4 md:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Current</p>
                  <p className="mt-2 font-semibold text-gray-900">{formatCurrency(selectedDebtor.current)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Overdue</p>
                  <p className="mt-2 font-semibold" style={{ color: brandColor }}>{formatCurrency(overdueBalance)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Over 90 Days</p>
                  <p className="mt-2 font-semibold text-rose-600">{formatCurrency(selectedDebtor.ninety)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Ending Balance</p>
                  <p className="mt-2 font-semibold text-gray-900">{formatCurrency(selectedDebtor.total)}</p>
                </div>
              </div>

              <div className="aging-print-table-wrap -mx-10 mt-8 overflow-hidden border-y border-gray-200">
                <table className="aging-print-table min-w-full divide-y divide-gray-200 text-sm">
                  <colgroup>
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '23%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '12%' }} />
                  </colgroup>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Source</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Reference</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Description</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Aging Bucket</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Debit</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Credit</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Net Effect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedDebtor.lineItems.map(item => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 align-top text-gray-700 aging-print-wrap">{formatDateLabel(item.entryDate)}</td>
                        <td className="px-4 py-3 align-top aging-print-wrap">
                          <div className="font-semibold text-gray-800">{item.sourceType}</div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-400">{item.glReference}</div>
                        </td>
                        <td className="px-4 py-3 align-top text-gray-700 aging-print-wrap">{item.referenceLabel}</td>
                        <td className="px-4 py-3 align-top aging-print-wrap">
                          <div className="font-medium text-gray-800">{item.description}</div>
                          <div className="text-xs text-gray-400">{item.memo}</div>
                        </td>
                        <td className="px-4 py-3 align-top aging-print-wrap">
                          <div className="font-medium text-gray-800">{item.bucketLabel}</div>
                          <div className="text-xs text-gray-400">{item.ageDays} day{item.ageDays !== 1 ? 's' : ''}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">
                          {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">
                          {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          {renderSignedAmount(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-right text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
                        Ending Receivable Balance
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-sm font-bold text-gray-900">
                        {formatCurrency(selectedDebtor.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="aging-print-signatures mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Prepared For</p>
                  <div className="mt-14 border-t border-gray-300 pt-3 text-sm text-gray-500">
                    Debtor Review / Confirmation
                  </div>
                </div>
                <div className="md:text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Prepared By</p>
                  <div className="mt-14 border-t border-gray-300 pt-3 text-sm text-gray-500">
                    Accounts Receivable Team
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">AR Aging Report</h2>
          <p className="text-sm text-gray-500 font-normal italic">Review outstanding receivables by debtor and aging bucket.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--acm-primary-light)', color: brandColor }}
          >
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Aging As Of</p>
            <input
              type="date"
              className="bg-transparent border-none outline-none font-semibold text-gray-800 text-sm p-0 focus:ring-0"
              value={agingAsOf}
              onChange={e => setAgingAsOf(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Visible Debtors</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{visibleSummary.debtorCount}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Balance</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(visibleSummary.totalBalance)}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Overdue Balance</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>
            {formatCurrency(visibleSummary.overdueBalance)}
          </p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Over 90 Days</p>
          <p className="mt-2 text-2xl font-semibold text-rose-600">{formatCurrency(visibleSummary.overNinetyBalance)}</p>
        </div>
      </div>

      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-72">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search debtors..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative">
            <div
              onClick={() => setShowDebtorDropdown(prev => !prev)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[220px]"
            >
              <span className="text-[13px] text-gray-500 mr-1 truncate">Debtor Type:</span>
              <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">
                {debtorTypeFilter === 'ALL' ? 'All' : renderDebtorLabel(debtorTypeFilter)}
              </span>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {showDebtorDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDebtorDropdown(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1">
                    {(['ALL', 'SPONSOR', 'STUDENT', 'OTHER'] as DebtorFilter[]).map(option => {
                      const isActive = debtorTypeFilter === option;
                      const label = option === 'ALL' ? 'All Debtors' : renderDebtorLabel(option);

                      return (
                        <button
                          key={option}
                          onClick={() => {
                            setDebtorTypeFilter(option);
                            setShowDebtorDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${
                            isActive ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          style={isActive ? { backgroundColor: brandColor } : undefined}
                        >
                          {label}
                        </button>
                      );
                    })}
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
            title="Clear search and filters"
          >
            <RotateCcw size={16} />
          </button>

          <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <Filter size={14} />
            <span>{filteredAgingReport.length} record{filteredAgingReport.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead style={{ backgroundColor: brandColor }}>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-white">Debtor Identity</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-white">Type</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-white">Current (0-30)</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-white">31 - 60 Days</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-white">61 - 90 Days</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-white">Over 90 Days</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-white">Total Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedAgingReport.map(row => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedDebtorId(row.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedDebtorId(row.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-800">{row.name}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      {row.arAccountName} - Last activity {formatDateLabel(row.lastActivityDate)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${
                        row.type === 'STUDENT' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : ''
                      }`}
                      style={row.type !== 'STUDENT'
                        ? { backgroundColor: 'var(--acm-primary-light)', color: brandColor, borderColor: 'var(--acm-primary-light)' }
                        : undefined}
                    >
                      {renderDebtorIcon(row.type)}
                      {renderDebtorLabel(row.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-mono font-semibold" style={{ color: brandColor }}>
                    {formatCurrency(row.current)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-mono text-gray-700">
                    {formatCurrency(row.thirty)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-mono text-gray-700">
                    {formatCurrency(row.sixty)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-mono font-semibold text-rose-600">
                    {formatCurrency(row.ninety)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-mono font-semibold text-gray-900">
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ))}

              {filteredAgingReport.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <FileText size={28} className="opacity-40" />
                      <p className="text-sm font-medium">No outstanding receivables found for the current search and filter.</p>
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
            </tbody>
          </table>
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredAgingReport.length}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={setCurrentPage}
          itemLabel="aging rows"
        />
      </div>
    </div>
  );
};

export default ARAgingReportView;
