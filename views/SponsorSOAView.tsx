import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Download, FileText, Info, Printer } from 'lucide-react';
import {
  Sponsor, JournalEntry, JournalLine, ChartOfAccount, AccountClass
} from '../types';

interface SponsorSOAViewProps {
  sponsor: Sponsor;
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  currency: string;
  brandColor?: string;
  orgName?: string;
  onClose: () => void;
}

const toDateInput = (d: Date) => {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split('T')[0];
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'MM-dd-yyyy');
};

const SponsorSOAView: React.FC<SponsorSOAViewProps> = ({
  sponsor,
  entries,
  lines,
  accounts,
  currency,
  brandColor = '#006b2d',
  orgName = 'Institution',
  onClose
}) => {
  const today = new Date();
  const [fromDate] = useState(toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate] = useState(toDateInput(today));
  const [asOfDate] = useState(toDateInput(today));

  const postedEntryById = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    entries.filter(e => e.status === 'POSTED').forEach(e => map.set(e.id, e));
    return map;
  }, [entries]);

  const arAccountIds = useMemo(() => {
    const ids = new Set<string>();
    if (sponsor.arAccountId) {
      ids.add(sponsor.arAccountId);
      return ids;
    }
    accounts
      .filter(a =>
        a.class === AccountClass.ASSET &&
        !a.isHeader &&
        ((a.code && a.code === '1200') || (a.name || '').toLowerCase().includes('receivable'))
      )
      .forEach(a => ids.add(a.id));
    return ids;
  }, [accounts, sponsor.arAccountId]);

  const sponsorArLines = useMemo(() => lines.filter(l =>
    l.contactId === sponsor.id &&
    l.contactType === 'SPONSOR' &&
    postedEntryById.has(l.journalEntryId) &&
    (arAccountIds.size === 0 || arAccountIds.has(l.accountId))
  ), [arAccountIds, lines, postedEntryById, sponsor.id]);

  const transactions = useMemo(() => sponsorArLines
    .map(l => {
      const entry = postedEntryById.get(l.journalEntryId)!;
      const runtimeEntry = entry as JournalEntry & { dueDate?: string; invoiceDueDate?: string; invoice_due_date?: string };
      return {
        date: entry.date,
        dueDate: runtimeEntry.dueDate || runtimeEntry.invoiceDueDate || runtimeEntry.invoice_due_date || entry.date,
        type: entry.sourceType,
        ref: entry.reference || entry.glEntryNumber || entry.sourceRef || entry.id,
        desc: entry.description || l.memo || l.description || 'Receivable activity',
        amount: l.debit - l.credit,
        entryId: entry.id
      };
    })
    .sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (a.ref || '').localeCompare(b.ref || '');
    }), [postedEntryById, sponsorArLines]);

  const beginningBalance = useMemo(() => {
    const start = new Date(`${fromDate}T00:00:00`);
    return transactions
      .filter(t => new Date(`${t.date}T00:00:00`) < start)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [fromDate, transactions]);

  const periodTransactions = useMemo(() => {
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T23:59:59`);
    return transactions.filter(t => {
      const dt = new Date(`${t.date}T00:00:00`);
      return dt >= start && dt <= end;
    });
  }, [fromDate, toDate, transactions]);

  const activity = useMemo(() => {
    let running = beginningBalance;
    const rows = [{
      id: 'beginning-balance',
      date: fromDate,
      dueDate: fromDate,
      ref: 'BEGIN-BAL',
      desc: 'Beginning Balance',
      charges: 0,
      credits: 0,
      balance: beginningBalance,
    }];

    periodTransactions.forEach((t, index) => {
      running += t.amount;
      rows.push({
        id: `${t.entryId}-${index}`,
        date: t.date,
        dueDate: t.dueDate,
        ref: t.ref,
        desc: t.desc,
        charges: t.amount > 0 ? t.amount : 0,
        credits: t.amount < 0 ? Math.abs(t.amount) : 0,
        balance: running,
      });
    });

    return rows;
  }, [beginningBalance, fromDate, periodTransactions]);

  const charges = periodTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const credits = periodTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const endingBalance = beginningBalance + periodTransactions.reduce((sum, t) => sum + t.amount, 0);

  const aging = useMemo(() => {
    const asOf = new Date(`${asOfDate}T00:00:00`);
    const buckets = { current: 0, thirty: 0, sixty: 0, ninety: 0, overNinety: 0 };

    transactions
      .filter(t => t.amount > 0 && new Date(`${t.date}T00:00:00`) <= asOf)
      .forEach(t => {
        const days = Math.floor((asOf.getTime() - new Date(`${t.dueDate}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 0) buckets.current += t.amount;
        else if (days <= 30) buckets.thirty += t.amount;
        else if (days <= 60) buckets.sixty += t.amount;
        else if (days <= 90) buckets.ninety += t.amount;
        else buckets.overNinety += t.amount;
      });

    const totalAged = Object.values(buckets).reduce((sum, amount) => sum + amount, 0);
    if (totalAged > 0 && credits > 0) {
      let remainingCredits = credits;
      (['overNinety', 'ninety', 'sixty', 'thirty', 'current'] as const).forEach(key => {
        const applied = Math.min(buckets[key], remainingCredits);
        buckets[key] -= applied;
        remainingCredits -= applied;
      });
    }

    return buckets;
  }, [asOfDate, credits, transactions]);

  const formatAmount = (val: number, dashZero = false) => {
    if (dashZero && Math.abs(val) <= 0.01) return '-';
    const abs = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `(${currency} ${abs})` : `${currency} ${abs}`;
  };

  const deliveryMethod = sponsor.email ? 'Email' : 'Print';
  const status = aging.thirty + aging.sixty + aging.ninety + aging.overNinety > 0 ? 'Open, Overdue' : 'Open';

  const exportCsv = () => {
    const header = ['Date', 'Reference No.', 'Description', 'Due Date', 'Charges/Billings', 'Payments/Credits', 'Balance'];
    const csv = [
      header,
      ...activity.map(row => [row.date, row.ref, row.desc, row.dueDate, row.charges, row.credits, row.balance])
    ].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `soa-${sponsor.sponsorCode || sponsor.id}-${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-5 pb-10 text-[#06146f]">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          body { background: #fff !important; }
          body * { visibility: hidden; }
          #soa-print-preview,
          #soa-print-preview * { visibility: visible; }
          #soa-print-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: 0 !important;
            box-shadow: none !important;
          }
          .soa-no-print { display: none !important; }
        }
      `}</style>

      <div className="soa-no-print flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onClose}
          className="inline-flex h-11 items-center gap-3 rounded-md border border-gray-200 bg-white px-5 text-sm font-bold text-[#06146f] shadow-sm hover:bg-gray-50"
        >
          <ArrowLeft size={20} />
          Back to Statement of Account
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

      <section id="soa-print-preview" className="mx-auto max-w-[980px] rounded-md border border-gray-200 bg-white px-8 py-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold leading-tight">{orgName}</h1>
          <h2 className="mt-4 text-2xl font-bold leading-tight">Accounts Receivable</h2>
          <h3 className="mt-4 text-2xl font-bold leading-tight">Statement of Account</h3>
          <h4 className="mt-5 text-xl font-bold leading-tight">Monthly Statement of Account</h4>
        </div>

        <div className="mt-10 flex items-center gap-8">
          <div className="h-0.5 flex-1 bg-blue-500"></div>
          <div className="whitespace-nowrap text-lg font-bold">As of Date: {formatDate(asOfDate)}</div>
          <div className="h-0.5 flex-1 bg-blue-500"></div>
        </div>

        <div className="mt-8 rounded-md border border-gray-200 p-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="grid grid-cols-[180px_1fr] gap-x-8 gap-y-5 text-base">
              <div className="font-bold">Customer ID:</div>
              <div>{sponsor.sponsorCode || sponsor.id}</div>
              <div className="font-bold">Customer / Sponsor Name:</div>
              <div>{sponsor.name}</div>
              <div className="font-bold">Contact Person:</div>
              <div>{sponsor.contactPerson || `${sponsor.name} Main`}</div>
            </div>
            <div className="grid grid-cols-[170px_1fr] gap-x-8 gap-y-5 border-l border-gray-200 pl-10 text-base">
              <div className="font-bold">Email Address:</div>
              <div>{sponsor.email || '-'}</div>
              <div className="font-bold">Statement Coverage:</div>
              <div>{formatDate(fromDate)} to {formatDate(toDate)}</div>
              <div className="font-bold">Delivery Method:</div>
              <div>{deliveryMethod}</div>
              <div className="font-bold">Status:</div>
              <div>{status}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-md border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-emerald-700 text-white">
              <tr>
                <th className="border border-gray-300 px-3 py-3 text-center font-bold">Date</th>
                <th className="border border-gray-300 px-3 py-3 text-center font-bold">Reference No.</th>
                <th className="border border-gray-300 px-3 py-3 text-left font-bold">Description</th>
                <th className="border border-gray-300 px-3 py-3 text-center font-bold">Due Date</th>
                <th className="border border-gray-300 px-3 py-3 text-right font-bold">Charges/Billings</th>
                <th className="border border-gray-300 px-3 py-3 text-right font-bold">Payments/Credits</th>
                <th className="border border-gray-300 px-3 py-3 text-right font-bold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {activity.map(row => (
                <tr key={row.id}>
                  <td className="border border-gray-200 px-3 py-3 text-center">{formatDate(row.date)}</td>
                  <td className="border border-gray-200 px-3 py-3 text-center">{row.ref}</td>
                  <td className="border border-gray-200 px-3 py-3">{row.desc}</td>
                  <td className="border border-gray-200 px-3 py-3 text-center">{formatDate(row.dueDate)}</td>
                  <td className="border border-gray-200 px-3 py-3 text-right">{formatAmount(row.charges, true)}</td>
                  <td className="border border-gray-200 px-3 py-3 text-right">{formatAmount(row.credits, true)}</td>
                  <td className="border border-gray-200 px-3 py-3 text-right font-semibold">{formatAmount(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-gray-200">
          <div className="bg-emerald-700 px-4 py-2 text-center text-base font-bold text-white">Aging Summary</div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="font-bold text-emerald-700">
                <th className="border border-gray-200 px-3 py-3 text-center">Current</th>
                <th className="border border-gray-200 px-3 py-3 text-center">1-30 Days</th>
                <th className="border border-gray-200 px-3 py-3 text-center">31-60 Days</th>
                <th className="border border-gray-200 px-3 py-3 text-center">61-90 Days</th>
                <th className="border border-gray-200 px-3 py-3 text-center">Over 90 Days</th>
                <th className="border border-gray-200 px-3 py-3 text-center">Total Outstanding</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-3 text-center">{formatAmount(aging.current)}</td>
                <td className="border border-gray-200 px-3 py-3 text-center">{formatAmount(aging.thirty)}</td>
                <td className="border border-gray-200 px-3 py-3 text-center">{formatAmount(aging.sixty)}</td>
                <td className="border border-gray-200 px-3 py-3 text-center">{formatAmount(aging.ninety)}</td>
                <td className="border border-gray-200 px-3 py-3 text-center">{formatAmount(aging.overNinety)}</td>
                <td className="border border-gray-200 px-3 py-3 text-center font-bold text-emerald-600">{formatAmount(endingBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 w-full max-w-md overflow-hidden rounded-md border border-gray-200">
          <div className="bg-emerald-700 px-4 py-2 text-center text-base font-bold text-white">Account Summary</div>
          <div className="space-y-3 p-5 text-base">
            <div className="flex justify-between"><span>Beginning Balance</span><span className="font-semibold">{formatAmount(beginningBalance)}</span></div>
            <div className="flex justify-between"><span>Charges / Billings</span><span className="font-semibold">{formatAmount(charges)}</span></div>
            <div className="flex justify-between"><span>Payments / Credits</span><span className="font-semibold">{formatAmount(credits)}</span></div>
            <div className="flex justify-between border-t border-gray-700 pt-4 font-bold">
              <span>Ending Balance</span>
              <span className="text-emerald-600">{formatAmount(endingBalance)}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-dashed border-gray-300 pt-5">
          <div className="flex items-start gap-4 text-base font-semibold">
            <Info size={22} className="mt-1 text-blue-600" />
            <p>Please settle overdue balances promptly. For questions regarding this statement, please contact the Accounts Receivable Office.</p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-16 text-sm font-semibold">
          <div>
            <div>Prepared By:</div>
            <div className="mt-10 border-b border-gray-700"></div>
            <div className="mt-2 text-center">AR Specialist</div>
          </div>
          <div>
            <div>Reviewed By:</div>
            <div className="mt-10 border-b border-gray-700"></div>
          </div>
          <div>
            <div>Received By:</div>
            <div className="mt-10 border-b border-gray-700"></div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SponsorSOAView;
