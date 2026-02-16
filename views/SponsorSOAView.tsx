import React, { useMemo } from 'react';
import {
  Sponsor, JournalEntry, JournalLine, Student, Batch, ChartOfAccount
} from '../types';
import { format } from 'date-fns';

interface SponsorSOAViewProps {
  sponsor: Sponsor;
  entries: JournalEntry[];
  lines: JournalLine[];
  students: Student[];
  batches: Batch[];
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

const SponsorSOAView: React.FC<SponsorSOAViewProps> = ({
  sponsor, entries, lines, students, batches, accounts, currency, onClose
}) => {
  // Filter all AR-related entries for this sponsor
  const sponsorEntries = useMemo(() =>
    entries.filter(e =>
      lines.some(l => l.journalEntryId === e.id && l.contactId === sponsor.id && l.contactType === 'SPONSOR')
    ),
    [entries, lines, sponsor.id]
  );

  // Build activity ledger: INVOICE, PYMT, APPL, sorted by date
  const activity = useMemo(() => {
    const acts: Array<{
      date: string;
      type: string;
      ref: string;
      desc: string;
      amount: number;
      balance: number;
    }> = [];
    let running = 0;
    // Sort all lines for this sponsor by date ascending
    const sponsorLines = lines
      .filter(l => l.contactId === sponsor.id && l.contactType === 'SPONSOR')
      .map(l => ({ ...l, entry: entries.find(e => e.id === l.journalEntryId) }))
      .filter(l => l.entry)
      .sort((a, b) => new Date(a.entry!.date).getTime() - new Date(b.entry!.date).getTime());
    sponsorLines.forEach(l => {
      const entry = l.entry!;
      let type = entry.sourceType;
      let ref = entry.reference;
      let desc = entry.description;
      let amount = 0;
      if (type === 'INVOICE') {
        amount = l.debit - l.credit;
        running += amount;
      } else if (type === 'COLLECTION') {
        amount = l.credit - l.debit;
        running -= Math.abs(amount);
      } else {
        amount = l.debit - l.credit;
        running += amount;
      }
      acts.push({
        date: entry.date,
        type,
        ref,
        desc,
        amount,
        balance: running,
      });
    });
    return acts;
  }, [lines, entries, sponsor.id]);

  // Calculate summary box
  const beginningBalance = 0; // Could be parameterized for period SOA
  const newInvoices = activity.filter(a => a.type === 'INVOICE').reduce((s, a) => s + a.amount, 0);
  const payments = activity.filter(a => a.type === 'COLLECTION').reduce((s, a) => s + Math.abs(a.amount), 0);
  const currentDue = beginningBalance + newInvoices - payments;

  // Aging buckets
  const today = new Date();
  const aging = useMemo(() => {
    const buckets = [0, 0, 0, 0];
    activity.forEach(a => {
      if (a.balance <= 0 || a.type !== 'INVOICE') return;
      const days = Math.floor((today.getTime() - new Date(a.date).getTime()) / (1000 * 60 * 60 * 24));
      if (days < 30) buckets[0] += a.balance;
      else if (days < 60) buckets[1] += a.balance;
      else if (days < 90) buckets[2] += a.balance;
      else buckets[3] += a.balance;
    });
    return buckets;
  }, [activity, today]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded hover:bg-gray-100 text-gray-400">
          ×
        </button>
        <h2 className="text-2xl font-bold mb-2">Statement of Account</h2>
        <div className="mb-6">
          <div className="font-semibold text-lg text-gray-800">{sponsor.name}</div>
          <div className="text-sm text-gray-500">{sponsor.address}</div>
        </div>
        {/* Summary Box */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-50 rounded p-4 text-center">
            <div className="text-xs text-gray-500">Beginning Balance</div>
            <div className="font-bold text-lg">{currency} {beginningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-gray-50 rounded p-4 text-center">
            <div className="text-xs text-gray-500">New Invoices</div>
            <div className="font-bold text-lg">{currency} {newInvoices.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-gray-50 rounded p-4 text-center">
            <div className="text-xs text-gray-500">Payments</div>
            <div className="font-bold text-lg">{currency} {payments.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-orange-50 rounded p-4 text-center">
            <div className="text-xs text-orange-600 font-bold">Current Amount Due</div>
            <div className="font-bold text-2xl text-orange-600">{currency} {currentDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        {/* Activity Ledger */}
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
                {activity.map((a, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-4 py-2">{format(new Date(a.date), 'yyyy-MM-dd')}</td>
                    <td className="px-4 py-2">{a.type}</td>
                    <td className="px-4 py-2">{a.ref}</td>
                    <td className="px-4 py-2">{a.desc}</td>
                    <td className="px-4 py-2 text-right">{currency} {a.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 text-right">{currency} {a.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Aging Footer */}
        <div className="mt-8">
          <div className="font-semibold text-md mb-2">Aging Summary</div>
          <div className="grid grid-cols-4 gap-4">
            {agingBuckets.map((b, i) => (
              <div key={b.label} className="bg-gray-50 rounded p-4 text-center">
                <div className="text-xs text-gray-500">{b.label}</div>
                <div className="font-bold text-lg">{currency} {aging[i].toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SponsorSOAView;
