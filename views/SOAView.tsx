import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Eye,
  FileText,
  MoreVertical,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { Sponsor, JournalEntry, JournalLine, ChartOfAccount, AccountClass } from '../types';
import SponsorSOAView from './SponsorSOAView';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';

interface SOAViewProps {
  sponsors: Sponsor[];
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  currency: string;
  brandColor?: string;
  orgName?: string;
}

type PeriodFilter = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY';
type CustomerTypeFilter = 'ALL' | 'SPONSOR' | 'STUDENT';
type DeliveryMethodFilter = 'ALL' | 'EMAIL' | 'PRINT';
type StatusFilter = 'ALL' | 'OPEN' | 'OVERDUE';

interface SOARow {
  id: string;
  sponsor: Sponsor;
  customerId: string;
  customerName: string;
  contactPerson: string;
  email: string;
  coverage: string;
  deliveryMethod: 'EMAIL' | 'PRINT';
  totalOutstanding: number;
  overdueAmount: number;
  status: 'Open' | 'Overdue';
}

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi Annual' },
  { value: 'YEARLY', label: 'Yearly' },
];

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

const formatDateLabel = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : `${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}-${parsed.getFullYear()}`;
};

const SOAView: React.FC<SOAViewProps> = ({
  sponsors,
  entries,
  lines,
  accounts,
  currency,
  brandColor = '#0b8f4d',
  orgName = 'Institution',
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>('MONTHLY');
  const [asOfDate, setAsOfDate] = useState(today);
  const [customerType, setCustomerType] = useState<CustomerTypeFilter>('ALL');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethodFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [appliedFilters, setAppliedFilters] = useState({ period: 'MONTHLY' as PeriodFilter, asOfDate: today });

  const formatCurrency = (val: number) =>
    `${currency}${currency.length === 1 ? '' : ' '}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const arAccounts = useMemo(
    () => accounts.filter(account =>
      account.class === AccountClass.ASSET &&
      !account.isHeader &&
      ((account.name || '').toLowerCase().includes('receivable') || account.code === '1200')
    ),
    [accounts]
  );

  const periodStartDate = useMemo(
    () => getPeriodStartDate(appliedFilters.asOfDate, appliedFilters.period),
    [appliedFilters]
  );

  const soaRows = useMemo<SOARow[]>(() => {
    const arAccountIds = new Set(arAccounts.map(account => account.id));
    const targetEntries = entries.filter(entry =>
      entry.status === 'POSTED' &&
      entry.date >= periodStartDate &&
      entry.date <= appliedFilters.asOfDate
    );
    const entryMap = new Map(targetEntries.map(entry => [entry.id, entry]));
    const referenceDate = new Date(`${appliedFilters.asOfDate}T00:00:00`);
    const buckets = new Map<string, { totalOutstanding: number; overdueAmount: number }>();

    lines
      .filter(line =>
        line.contactType === 'SPONSOR' &&
        line.contactId &&
        arAccountIds.has(line.accountId) &&
        entryMap.has(line.journalEntryId)
      )
      .forEach(line => {
        const entry = entryMap.get(line.journalEntryId);
        if (!entry || !line.contactId) return;

        const amount = line.debit - line.credit;
        if (Math.abs(amount) <= 0.01) return;

        const runtimeEntry = entry as JournalEntry & { dueDate?: string; invoiceDueDate?: string; invoice_due_date?: string };
        const dueDate = runtimeEntry.dueDate || runtimeEntry.invoiceDueDate || runtimeEntry.invoice_due_date || entry.date;
        const ageDays = Math.floor((referenceDate.getTime() - new Date(`${dueDate}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24));
        const current = buckets.get(line.contactId) || { totalOutstanding: 0, overdueAmount: 0 };
        current.totalOutstanding += amount;
        if (ageDays > 0) current.overdueAmount += amount;
        buckets.set(line.contactId, current);
      });

    return sponsors
      .filter(sponsor => !sponsor.isDeleted)
      .map(sponsor => {
        const balance = buckets.get(sponsor.id) || { totalOutstanding: 0, overdueAmount: 0 };
        const delivery = sponsor.email ? 'EMAIL' : 'PRINT';
        return {
          id: sponsor.id,
          sponsor,
          customerId: sponsor.sponsorCode || sponsor.id,
          customerName: sponsor.name,
          contactPerson: sponsor.contactPerson || `${sponsor.name} Main`,
          email: sponsor.email || '-',
          coverage: `${formatDateLabel(periodStartDate)} to ${formatDateLabel(appliedFilters.asOfDate)}`,
          deliveryMethod: delivery,
          totalOutstanding: balance.totalOutstanding,
          overdueAmount: Math.max(0, balance.overdueAmount),
          status: balance.overdueAmount > 0 ? 'Overdue' : 'Open',
        };
      })
      .filter(row => Math.abs(row.totalOutstanding) > 0.01)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [appliedFilters.asOfDate, arAccounts, entries, lines, periodStartDate, sponsors]);

  const filteredRows = useMemo(() => soaRows.filter(row => {
    const matchesCustomer = customerType === 'ALL' || customerType === 'SPONSOR';
    const matchesDelivery = deliveryMethod === 'ALL' || row.deliveryMethod === deliveryMethod;
    const matchesStatus = statusFilter === 'ALL' || row.status.toUpperCase() === statusFilter;
    return matchesCustomer && matchesDelivery && matchesStatus;
  }), [customerType, deliveryMethod, soaRows, statusFilter]);

  const summary = useMemo(() => {
    const emailCount = filteredRows.filter(row => row.deliveryMethod === 'EMAIL').length;
    const printCount = filteredRows.filter(row => row.deliveryMethod === 'PRINT').length;
    return {
      activeAccounts: soaRows.length,
      soaReady: filteredRows.length,
      totalOutstanding: filteredRows.reduce((sum, row) => sum + row.totalOutstanding, 0),
      overdueAmount: filteredRows.reduce((sum, row) => sum + row.overdueAmount, 0),
      emailCount,
      printCount,
    };
  }, [filteredRows, soaRows.length]);

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows,
    setCurrentPage,
  } = usePaginatedRows(filteredRows, [period, asOfDate, customerType, deliveryMethod, statusFilter], 8);

  const clearFilters = () => {
    setPeriod('MONTHLY');
    setAsOfDate(today);
    setCustomerType('ALL');
    setDeliveryMethod('ALL');
    setStatusFilter('ALL');
    setAppliedFilters({ period: 'MONTHLY', asOfDate: today });
  };

  const exportCsv = () => {
    const header = ['Customer ID', 'Customer / Sponsor Name', 'Contact Person', 'Email Address', 'Statement Coverage', 'Total Outstanding', 'Overdue Amount', 'Status'];
    const csv = [
      header,
      ...filteredRows.map(row => [
        row.customerId,
        row.customerName,
        row.contactPerson,
        row.email,
        row.coverage,
        row.totalOutstanding,
        row.overdueAmount,
        row.status,
      ]),
    ].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `soa-report-${appliedFilters.asOfDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (selectedSponsor) {
    return (
      <SponsorSOAView
        sponsor={selectedSponsor}
        entries={entries}
        lines={lines}
        accounts={accounts}
        currency={currency}
        brandColor={brandColor}
        orgName={orgName}
        onClose={() => setSelectedSponsor(null)}
      />
    );
  }

  return (
    <div className="space-y-6 pb-20 text-[#06146f]">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Statement of Account (SOA)</h2>
        <p className="text-sm text-gray-500 font-normal italic">
          Generate customer statements based on posted AR balances and open receivables.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase text-slate-500">Active Accounts</p>
          <p className="mt-6 text-2xl font-bold text-emerald-600">{summary.activeAccounts}</p>
        </section>
        <section className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase text-slate-500">SOA Ready</p>
          <p className="mt-6 text-2xl font-bold text-emerald-600">{summary.soaReady}</p>
        </section>
      </div>

      <section className="rounded-md border border-gray-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-semibold shadow-sm">
            Period:
            <select value={period} onChange={event => setPeriod(event.target.value as PeriodFilter)} className="bg-transparent font-bold outline-none">
              {periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="flex h-11 items-center overflow-hidden rounded-md border border-gray-200 text-sm font-semibold shadow-sm">
            <span className="px-3 text-slate-500">As Of Date</span>
            <input type="date" value={asOfDate} onChange={event => setAsOfDate(event.target.value)} className="h-full border-l border-gray-200 px-3 font-bold outline-none" />
            <Calendar size={16} className="mx-3 text-[#06146f]" />
          </label>

          <label className="flex h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-semibold shadow-sm">
            Customer Type:
            <select value={customerType} onChange={event => setCustomerType(event.target.value as CustomerTypeFilter)} className="bg-transparent font-bold outline-none">
              <option value="ALL">All</option>
              <option value="SPONSOR">Sponsor</option>
              <option value="STUDENT">Student</option>
            </select>
          </label>

          <label className="flex h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-semibold shadow-sm">
            Delivery Method:
            <select value={deliveryMethod} onChange={event => setDeliveryMethod(event.target.value as DeliveryMethodFilter)} className="bg-transparent font-bold outline-none">
              <option value="ALL">All</option>
              <option value="EMAIL">Email</option>
              <option value="PRINT">Print</option>
            </select>
          </label>

          <label className="flex h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-semibold shadow-sm">
            Status:
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} className="bg-transparent font-bold outline-none">
              <option value="ALL">Open, Overdue</option>
              <option value="OPEN">Open</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </label>

          <button type="button" onClick={clearFilters} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-[#06146f]" title="Reset filters">
            <RotateCcw size={20} />
          </button>
          <button
            type="button"
            onClick={() => setAppliedFilters({ period, asOfDate })}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <BarChart3 size={18} /> Generate
          </button>
          <button type="button" onClick={exportCsv} className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm font-bold shadow-sm">
            <Download size={18} /> Export
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm font-bold shadow-sm">
            <Printer size={18} /> Print
          </button>
        </div>
      </section>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse text-sm">
            <thead className="bg-emerald-700 text-white">
              <tr>
                <th className="border-r border-white/25 px-4 py-4 text-left font-bold">Customer ID</th>
                <th className="border-r border-white/25 px-4 py-4 text-left font-bold">Customer / Sponsor Name</th>
                <th className="border-r border-white/25 px-4 py-4 text-left font-bold">Contact Person</th>
                <th className="border-r border-white/25 px-4 py-4 text-left font-bold">Email Address</th>
                <th className="border-r border-white/25 px-4 py-4 text-left font-bold">Statement Coverage</th>
                <th className="border-r border-white/25 px-4 py-4 text-right font-bold">Total Outstanding</th>
                <th className="border-r border-white/25 px-4 py-4 text-right font-bold">Overdue Amount</th>
                <th className="border-r border-white/25 px-4 py-4 text-center font-bold">Status</th>
                <th className="px-4 py-4 text-center font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map(row => (
                <tr key={row.id} className="border-b border-gray-200 bg-white font-semibold">
                  <td className="border-l border-gray-200 px-4 py-4">{row.customerId}</td>
                  <td className="border-l border-gray-200 px-4 py-4">{row.customerName}</td>
                  <td className="border-l border-gray-200 px-4 py-4">{row.contactPerson}</td>
                  <td className="border-l border-gray-200 px-4 py-4">{row.email}</td>
                  <td className="border-l border-gray-200 px-4 py-4">{row.coverage}</td>
                  <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(row.totalOutstanding)}</td>
                  <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(row.overdueAmount)}</td>
                  <td className={`border-l border-gray-200 px-4 py-4 text-center ${row.status === 'Overdue' ? 'text-red-500' : 'text-blue-600'}`}>{row.status}</td>
                  <td className="border-l border-gray-200 px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSponsor(row.sponsor)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-[#06146f] shadow-sm hover:bg-gray-50"
                      >
                        <Eye size={15} /> Preview SOA
                      </button>
                      <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white shadow-sm" title="More actions">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-500">
                    <FileText size={28} className="mx-auto mb-3 opacity-40" />
                    No SOA accounts found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-left">Grand Total Outstanding:</td>
                  <td className="border-l border-gray-200 px-4 py-4 text-right text-emerald-600">{formatCurrency(summary.totalOutstanding)}</td>
                  <td className="border-l border-gray-200 px-4 py-4 text-right">{formatCurrency(summary.overdueAmount)}</td>
                  <td colSpan={2} className="border-l border-gray-200 px-4 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRows.length}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={setCurrentPage}
          itemLabel="statements"
        />
      </div>

      <section className="w-full max-w-md rounded-md border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-[#06146f]">SOA Delivery Summary</h3>
        <div className="space-y-2 text-sm font-semibold">
          <div className="flex justify-between"><span>Email</span><span>{summary.emailCount}</span></div>
          <div className="flex justify-between"><span>Print</span><span>{summary.printCount}</span></div>
          <div className="border-t border-gray-200 pt-3 flex justify-between"><span>Total Selected</span><span>{filteredRows.length}</span></div>
        </div>
      </section>
    </div>
  );
};

export default SOAView;
