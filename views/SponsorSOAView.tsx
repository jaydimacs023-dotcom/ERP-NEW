import React, { useMemo, useState } from 'react';
import {
  Sponsor, JournalEntry, JournalLine, ChartOfAccount, AccountClass
} from '../types';
import { format } from 'date-fns';
import ModalPortal from '../components/ModalPortal';

interface SponsorSOAViewProps {
  sponsor: Sponsor;
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  currency: string;
  onClose: () => void;
}

const agingBuckets = [
  { label: 'Current', days: 0 },
  { label: '30 Days', days: 30 },
  { label: '60 Days', days: 60 },
  { label: '90+ Days', days: 90 },
];

const toDateInput = (d: Date) => {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split('T')[0];
};

const SponsorSOAView: React.FC<SponsorSOAViewProps> = ({
  sponsor, entries, lines, accounts, currency, onClose
}) => {
  const today = new Date();
  const [fromDate, setFromDate] = useState(
    toDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
  );
  const [toDate, setToDate] = useState(toDateInput(today));
  const [asOfDate, setAsOfDate] = useState(toDateInput(today));

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

  const sponsorArLines = useMemo(() => {
    return lines.filter(l =>
      l.contactId === sponsor.id &&
      l.contactType === 'SPONSOR' &&
      postedEntryById.has(l.journalEntryId) &&
      (arAccountIds.size === 0 || arAccountIds.has(l.accountId))
    );
  }, [lines, sponsor.id, postedEntryById, arAccountIds]);

  const transactions = useMemo(() => {
    return sponsorArLines
      .map(l => {
        const entry = postedEntryById.get(l.journalEntryId)!;
        const amount = l.debit - l.credit;
        return {
          date: entry.date,
          type: entry.sourceType,
          ref: entry.reference,
          desc: entry.description,
          amount,
          entryId: entry.id
        };
      })
      .sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (a.ref || '').localeCompare(b.ref || '');
      });
  }, [sponsorArLines, postedEntryById]);

  const beginningBalance = useMemo(() => {
    const start = new Date(fromDate);
    return transactions
      .filter(t => new Date(t.date) < start)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, fromDate]);

  const periodTransactions = useMemo(() => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    return transactions.filter(t => {
      const dt = new Date(t.date);
      return dt >= start && dt <= end;
    });
  }, [transactions, fromDate, toDate]);

  const activity = useMemo(() => {
    let running = beginningBalance;
    return periodTransactions.map(t => {
      running += t.amount;
      return {
        ...t,
        balance: running
      };
    });
  }, [periodTransactions, beginningBalance]);

  const newCharges = periodTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const payments = periodTransactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const endingBalance = beginningBalance + periodTransactions.reduce((s, t) => s + t.amount, 0);

  const aging = useMemo(() => {
    const asOf = new Date(asOfDate);
    const tx = transactions
      .filter(t => new Date(t.date) <= asOf)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const invoices: Array<{ date: string; remaining: number }> = [];
    let unappliedCredit = 0;

    tx.forEach(t => {
      if (t.amount > 0) {
        invoices.push({ date: t.date, remaining: t.amount });
        return;
      }
      if (t.amount < 0) {
        let payment = Math.abs(t.amount);
        for (const inv of invoices) {
          if (payment <= 0) break;
          if (inv.remaining <= 0) continue;
          const applied = Math.min(inv.remaining, payment);
          inv.remaining -= applied;
          payment -= applied;
        }
        if (payment > 0) unappliedCredit += payment;
      }
    });

    const buckets = [0, 0, 0, 0];
    invoices.forEach(inv => {
      if (inv.remaining <= 0) return;
      const days = Math.max(
        0,
        Math.floor((asOf.getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24))
      );
      if (days < 30) buckets[0] += inv.remaining;
      else if (days < 60) buckets[1] += inv.remaining;
      else if (days < 90) buckets[2] += inv.remaining;
      else buckets[3] += inv.remaining;
    });

    return { buckets, unappliedCredit };
  }, [transactions, asOfDate]);

  const formatAmount = (val: number) => {
    const abs = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2 });
    return val < 0 ? `(${currency} ${abs})` : `${currency} ${abs}`;
  };

  return (
    <ModalPortal>
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-y-auto p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded hover:bg-gray-100 text-gray-400">
          X
        </button>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold mb-2">Statement of Account</h2>
            <div className="font-semibold text-lg text-gray-800">{sponsor.name}</div>
            <div className="text-sm text-gray-500">{sponsor.address}</div>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-100 px-4 py-3 text-sm">
            <div className="text-gray-500">Statement Period</div>
            <div className="font-semibold text-gray-800">
              {format(new Date(fromDate), 'yyyy-MM-dd')} to {format(new Date(toDate), 'yyyy-MM-dd')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 mb-6">
          <div className="bg-white border rounded p-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide">From</label>
            <input
              type="date"
              className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div className="bg-white border rounded p-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide">To</label>
            <input
              type="date"
              className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
          <div className="bg-white border rounded p-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide">Aging As Of</label>
            <input
              type="date"
              className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
              value={asOfDate}
              onChange={e => setAsOfDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-50 rounded p-4 text-center">
            <div className="text-xs text-gray-500">Beginning Balance</div>
            <div className="font-bold text-lg">{formatAmount(beginningBalance)}</div>
          </div>
          <div className="bg-gray-50 rounded p-4 text-center">
            <div className="text-xs text-gray-500">New Charges</div>
            <div className="font-bold text-lg">{formatAmount(newCharges)}</div>
          </div>
          <div className="bg-gray-50 rounded p-4 text-center">
            <div className="text-xs text-gray-500">Payments</div>
            <div className="font-bold text-lg">{formatAmount(-payments)}</div>
          </div>
          <div className="bg-orange-50 rounded p-4 text-center">
            <div className="text-xs text-orange-600 font-bold">Ending Balance</div>
            <div className="font-bold text-2xl text-orange-600">{formatAmount(endingBalance)}</div>
          </div>
        </div>

        <div className="mb-8">
          <div className="font-semibold text-md mb-2">Activity Ledger</div>
          <div className="border rounded overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Reference</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {activity.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 italic">
                      No activity for the selected period.
                    </td>
                  </tr>
                )}
                {activity.map((a, idx) => (
                  <tr key={`${a.entryId}-${idx}`} className="border-t">
                    <td className="px-4 py-2">{format(new Date(a.date), 'yyyy-MM-dd')}</td>
                    <td className="px-4 py-2">{a.type}</td>
                    <td className="px-4 py-2">{a.ref}</td>
                    <td className="px-4 py-2">{a.desc}</td>
                    <td className={`px-4 py-2 text-right ${a.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {formatAmount(a.amount)}
                    </td>
                    <td className="px-4 py-2 text-right">{formatAmount(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8">
          <div className="font-semibold text-md mb-2">Aging Summary</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {agingBuckets.map((b, i) => (
              <div key={b.label} className="bg-gray-50 rounded p-4 text-center">
                <div className="text-xs text-gray-500">{b.label}</div>
                <div className="font-bold text-lg">{formatAmount(aging.buckets[i])}</div>
              </div>
            ))}
            <div className="bg-amber-50 rounded p-4 text-center">
              <div className="text-xs text-amber-600 font-bold">Unapplied Credit</div>
              <div className="font-bold text-lg text-amber-700">{formatAmount(-aging.unappliedCredit)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
</ModalPortal>
  );
};

export default SponsorSOAView;

