import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
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
}

const toDateInput = (d: Date) => {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split('T')[0];
};

const ARCustomerLedgerView: React.FC<ARCustomerLedgerViewProps> = ({
  entries, lines, accounts, students, sponsors, currency
}) => {
  const today = new Date();
  const [searchTerm, setSearchTerm] = useState('');
  const [customerType, setCustomerType] = useState<'SPONSOR' | 'STUDENT'>('SPONSOR');
  const [customerId, setCustomerId] = useState('');
  const [fromDate, setFromDate] = useState(toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(toDateInput(today));

  const formatCurrency = (val: number) =>
    `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const arAccountIds = useMemo(() => {
    return new Set(
      accounts
        .filter(a =>
          a.class === AccountClass.ASSET &&
          !a.isHeader &&
          ((a.name || '').toLowerCase().includes('receivable') || a.code === '1200')
        )
        .map(a => a.id)
    );
  }, [accounts]);

  const postedEntryById = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    entries.filter(e => e.status === 'POSTED').forEach(e => map.set(e.id, e));
    return map;
  }, [entries]);

  const customers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (customerType === 'SPONSOR') {
      return sponsors.filter(s =>
        !s.isDeleted &&
        (s.name.toLowerCase().includes(term) ||
          (s.sponsorCode || '').toLowerCase().includes(term))
      );
    }
    return students.filter(s =>
      !s.isDeleted &&
      (`${s.lastName}, ${s.firstName}`.toLowerCase().includes(term) || s.uli?.toLowerCase().includes(term))
    );
  }, [customerType, searchTerm, sponsors, students]);

  const customerName = useMemo(() => {
    if (!customerId) return '';
    if (customerType === 'SPONSOR') {
      return sponsors.find(s => s.id === customerId)?.name || '';
    }
    const s = students.find(x => x.id === customerId);
    return s ? `${s.lastName}, ${s.firstName}` : '';
  }, [customerId, customerType, sponsors, students]);

  const ledgerLines = useMemo(() => {
    if (!customerId) return [];
    return lines
      .filter(l =>
        l.contactId === customerId &&
        l.contactType === customerType &&
        postedEntryById.has(l.journalEntryId) &&
        arAccountIds.has(l.accountId)
      )
      .map(l => {
        const entry = postedEntryById.get(l.journalEntryId)!;
        const amount = l.debit - l.credit;
        return {
          id: `${l.journalEntryId}-${l.id}`,
          date: entry.date,
          reference: entry.reference,
          description: entry.description,
          amount
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [customerId, customerType, lines, postedEntryById, arAccountIds]);

  const beginningBalance = useMemo(() => {
    const start = new Date(fromDate);
    return ledgerLines
      .filter(l => new Date(l.date) < start)
      .reduce((sum, l) => sum + l.amount, 0);
  }, [ledgerLines, fromDate]);

  const periodLines = useMemo(() => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    return ledgerLines.filter(l => {
      const dt = new Date(l.date);
      return dt >= start && dt <= end;
    });
  }, [ledgerLines, fromDate, toDate]);

  const runningLines = useMemo(() => {
    let running = beginningBalance;
    return periodLines.map(l => {
      running += l.amount;
      return { ...l, balance: running };
    });
  }, [periodLines, beginningBalance]);

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Customer Ledger</h2>
        <p className="text-sm text-gray-500 font-normal italic">View detailed AR activity by customer.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded border shadow-sm">
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
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search</label>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search customer..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded text-sm outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From</label>
          <input
            type="date"
            className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">To</label>
          <input
            type="date"
            className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <div className="text-sm font-semibold text-gray-700">
            {customerName ? `Ledger for ${customerName}` : 'Select a customer'}
          </div>
          <div className="text-xs text-gray-500">
            Beginning Balance: {formatCurrency(beginningBalance)}
          </div>
        </div>
        <div className="p-4 border-b">
          <select
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
          >
            <option value="">Select customer...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {customerType === 'SPONSOR'
                  ? (c as Sponsor).name
                  : `${(c as Student).lastName}, ${(c as Student).firstName}`}
              </option>
            ))}
          </select>
        </div>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Date</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Reference</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Description</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Amount</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Running Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {runningLines.map(l => (
              <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-xs text-gray-600">{format(new Date(l.date), 'yyyy-MM-dd')}</td>
                <td className="px-6 py-4 text-xs font-mono font-bold text-gray-700">{l.reference}</td>
                <td className="px-6 py-4 text-xs text-gray-700">{l.description}</td>
                <td className={`px-6 py-4 text-right text-xs font-mono ${l.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {formatCurrency(l.amount)}
                </td>
                <td className="px-6 py-4 text-right text-xs font-mono font-semibold text-gray-900">
                  {formatCurrency(l.balance)}
                </td>
              </tr>
            ))}
            {customerId && runningLines.length === 0 && (
              <tr><td colSpan={5} className="py-20 text-center text-gray-400 italic">No ledger activity for the selected period.</td></tr>
            )}
            {!customerId && (
              <tr><td colSpan={5} className="py-20 text-center text-gray-400 italic">Please select a customer to view the ledger.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ARCustomerLedgerView;
