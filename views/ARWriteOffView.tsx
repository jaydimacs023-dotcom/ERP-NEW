import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Search } from 'lucide-react';
import { AccountingService } from '../accountingService';
import {
  Sponsor,
  Student,
  JournalEntry,
  JournalLine,
  ChartOfAccount,
  AccountClass
} from '../types';

interface ARWriteOffViewProps {
  orgId: string;
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  students: Student[];
  sponsors: Sponsor[];
  currency: string;
  onPostJournal: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const ARWriteOffView: React.FC<ARWriteOffViewProps> = ({
  orgId, entries, lines, accounts, students, sponsors, currency, onPostJournal, onNotify
}) => {
  const [writeOffDate, setWriteOffDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [customerType, setCustomerType] = useState<'SPONSOR' | 'STUDENT'>('SPONSOR');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState(0);
  const [arAccountId, setArAccountId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setReference(AccountingService.getNextReference(entries, 'WO'));
  }, [entries]);

  useEffect(() => {
    if (customerType === 'SPONSOR' && customerId) {
      const sponsor = sponsors.find(s => s.id === customerId);
      if (sponsor?.arAccountId) {
        setArAccountId(sponsor.arAccountId);
        return;
      }
    }
    const defaultAr = accounts.find(a => a.code === '1200' && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('accounts receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id;
    if (defaultAr) setArAccountId(defaultAr);
  }, [accounts, customerType, customerId, sponsors]);

  useEffect(() => {
    const preferred = accounts.find(a =>
      a.class === AccountClass.EXPENSE &&
      !a.isHeader &&
      (
        (a.name || '').toLowerCase().includes('bad debt') ||
        (a.name || '').toLowerCase().includes('write off') ||
        (a.name || '').toLowerCase().includes('write-off') ||
        (a.name || '').toLowerCase().includes('doubtful')
      )
    )?.id;
    if (preferred) {
      setExpenseAccountId(preferred);
      return;
    }
    const fallback = accounts.find(a => a.class === AccountClass.EXPENSE && !a.isHeader)?.id;
    if (fallback) setExpenseAccountId(fallback);
  }, [accounts]);

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

  const customerBalance = useMemo(() => {
    if (!customerId) return 0;
    const postedEntryIds = new Set(entries.filter(e => e.status === 'POSTED' && e.date <= writeOffDate).map(e => e.id));
    return lines
      .filter(l =>
        postedEntryIds.has(l.journalEntryId) &&
        arAccountIds.has(l.accountId) &&
        l.contactId === customerId &&
        l.contactType === customerType
      )
      .reduce((sum, l) => sum + (l.debit - l.credit), 0);
  }, [entries, lines, arAccountIds, customerId, customerType, writeOffDate]);

  const customerName = useMemo(() => {
    if (!customerId) return '';
    if (customerType === 'SPONSOR') {
      return sponsors.find(s => s.id === customerId)?.name || '';
    }
    const s = students.find(x => x.id === customerId);
    return s ? `${s.lastName}, ${s.firstName}` : '';
  }, [customerId, customerType, sponsors, students]);

  const writeOffEntries = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return entries
      .filter(e => e.status === 'POSTED' && (e.reference || '').startsWith('WO-') && (e.description || '').includes('[WRITE OFF]'))
      .filter(e =>
        (e.reference || '').toLowerCase().includes(term) ||
        (e.description || '').toLowerCase().includes(term)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, searchTerm]);

  const formatCurrency = (val: number) =>
    `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return onNotify('error', 'Please select a customer.');
    if (!arAccountId) return onNotify('error', 'Please select an Accounts Receivable G/L account.');
    if (!expenseAccountId) return onNotify('error', 'Please select a Write-Off (Expense) G/L account.');
    if (amount <= 0) return onNotify('error', 'Write-off amount must be greater than zero.');
    if (amount > customerBalance) return onNotify('error', 'Write-off amount exceeds customer outstanding balance.');

    const entryId = `je-wo-${Date.now()}`;
    const desc = `[WRITE OFF] ${customerName}${reason ? ` - ${reason}` : ''}`;

    const journalLines: JournalLine[] = [
      {
        id: `l-wo-dr-${Date.now()}`,
        journalEntryId: entryId,
        orgId,
        accountId: expenseAccountId,
        debit: amount,
        credit: 0,
        memo: reason || 'Accounts receivable write-off'
      },
      {
        id: `l-wo-cr-${Date.now()}`,
        journalEntryId: entryId,
        orgId,
        accountId: arAccountId,
        debit: 0,
        credit: amount,
        memo: reason || 'Accounts receivable write-off',
        contactId: customerId,
        contactType: customerType
      }
    ];

    onPostJournal(
      {
        id: entryId,
        date: writeOffDate,
        reference,
        description: desc,
        sourceType: 'MANUAL',
        status: 'POSTED'
      },
      journalLines
    );

    setAmount(0);
    setReason('');
    setCustomerId('');
    setReference(AccountingService.getNextReference(entries, 'WO'));
    onNotify('success', 'Write-off posted to General Ledger.');
  };

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">AR Write-Offs</h2>
        <p className="text-sm text-gray-500 font-normal italic">Post bad debt and uncollectible receivables.</p>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
        <form onSubmit={handlePost} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
              <input
                type="date"
                className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                value={writeOffDate}
                onChange={e => setWriteOffDate(e.target.value)}
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Outstanding Balance</label>
              <div className="mt-2 px-3 py-2 border border-gray-200 rounded text-sm font-mono bg-gray-50">
                {formatCurrency(customerBalance)}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Write-Off Amount</label>
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
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AR Account (Credit)</label>
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
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Write-Off Account (Debit)</label>
              <select
                className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                value={expenseAccountId}
                onChange={e => setExpenseAccountId(e.target.value)}
              >
                <option value="">Select expense account...</option>
                {accounts.filter(a => a.class === AccountClass.EXPENSE && !a.isHeader).map(a => (
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
              placeholder="e.g., Uncollectible balance approved for write-off"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle size={14} />
              Write-offs reduce A/R and record Bad Debt Expense.
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-[#F47721] text-white rounded text-sm font-semibold shadow-md active:scale-95 transition-all"
            >
              Post Write-Off
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FileText size={16} /> Posted Write-Offs
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded text-xs outline-none w-64"
              placeholder="Search by ref or memo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Date</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Reference</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Description</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {writeOffEntries.map(e => {
              const arLine = lines.find(l => l.journalEntryId === e.id && l.credit > 0);
              return (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-xs text-gray-600">{e.date}</td>
                  <td className="px-6 py-4 text-xs font-mono font-bold text-gray-700">{e.reference}</td>
                  <td className="px-6 py-4 text-xs text-gray-700">{e.description}</td>
                  <td className="px-6 py-4 text-right text-xs font-mono font-semibold text-rose-600">
                    {formatCurrency(arLine?.credit || 0)}
                  </td>
                </tr>
              );
            })}
            {writeOffEntries.length === 0 && (
              <tr><td colSpan={4} className="py-20 text-center text-gray-400 italic">No write-offs posted yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ARWriteOffView;

