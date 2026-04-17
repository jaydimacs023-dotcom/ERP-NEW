import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, FileText, Plus, Search } from 'lucide-react';
import { AccountingService } from '../accountingService';
import {
  Sponsor,
  Student,
  JournalEntry,
  JournalLine,
  ChartOfAccount,
  AccountClass
} from '../types';

interface ARCreditDebitMemoViewProps {
  orgId: string;
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  students: Student[];
  sponsors: Sponsor[];
  currency: string;
  onPostJournal: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  brandColor?: string;
}

type MemoType = 'CREDIT' | 'DEBIT';
type ViewMode = 'LIST' | 'FORM';

const ARCreditDebitMemoView: React.FC<ARCreditDebitMemoViewProps> = ({
  orgId,
  entries,
  lines,
  accounts,
  students,
  sponsors,
  currency,
  onPostJournal,
  onNotify,
  brandColor = '#4f46e5'
}) => {
  const today = new Date().toISOString().split('T')[0];
  const getNextReference = (type: MemoType) =>
    AccountingService.getNextReference(entries, type === 'CREDIT' ? 'CM' : 'DM');

  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [memoType, setMemoType] = useState<MemoType>('CREDIT');
  const [memoDate, setMemoDate] = useState(today);
  const [reference, setReference] = useState('');
  const [customerType, setCustomerType] = useState<'SPONSOR' | 'STUDENT'>('SPONSOR');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState(0);
  const [arAccountId, setArAccountId] = useState('');
  const [offsetAccountId, setOffsetAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setReference(getNextReference(memoType));
  }, [entries, memoType]);

  useEffect(() => {
    if (customerType === 'SPONSOR' && customerId) {
      const sponsor = sponsors.find(s => s.id === customerId);
      if (sponsor?.arAccountId) {
        setArAccountId(sponsor.arAccountId);
        return;
      }
    }

    const defaultAr =
      accounts.find(a => a.code === '1200' && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('accounts receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id;
    if (defaultAr) setArAccountId(defaultAr);
  }, [accounts, customerType, customerId, sponsors]);

  useEffect(() => {
    if (memoType === 'CREDIT') {
      const preferred = accounts.find(a =>
        a.class === AccountClass.REVENUE &&
        !a.isHeader &&
        (
          (a.name || '').toLowerCase().includes('sales return') ||
          (a.name || '').toLowerCase().includes('allowance') ||
          (a.name || '').toLowerCase().includes('contra')
        )
      )?.id;

      if (preferred) {
        setOffsetAccountId(preferred);
        return;
      }
    }

    const fallback =
      accounts.find(a => a.class === AccountClass.REVENUE && !a.isHeader)?.id ||
      accounts.find(a => a.class === AccountClass.EXPENSE && !a.isHeader)?.id;
    if (fallback) setOffsetAccountId(fallback);
  }, [accounts, memoType]);

  const customerName = useMemo(() => {
    if (!customerId) return '';
    if (customerType === 'SPONSOR') {
      return sponsors.find(s => s.id === customerId)?.name || '';
    }
    const student = students.find(x => x.id === customerId);
    return student ? `${student.lastName}, ${student.firstName}` : '';
  }, [customerId, customerType, sponsors, students]);

  const memoEntries = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return entries
      .filter(e => e.status === 'POSTED' && (e.reference || '').match(/^(CM|DM)-/))
      .filter(e =>
        (e.reference || '').toLowerCase().includes(term) ||
        (e.description || '').toLowerCase().includes(term)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, searchTerm]);

  const formatCurrency = (val: number) =>
    `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const resetFormState = (nextMemoType: MemoType = memoType) => {
    setMemoType(nextMemoType);
    setMemoDate(today);
    setReference(getNextReference(nextMemoType));
    setCustomerType('SPONSOR');
    setCustomerId('');
    setAmount(0);
    setReason('');
  };

  const openNewForm = () => {
    resetFormState(memoType);
    setViewMode('FORM');
  };

  const handleBackToList = () => {
    resetFormState(memoType);
    setViewMode('LIST');
  };

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return onNotify('error', 'Please select a customer.');
    if (!arAccountId) return onNotify('error', 'Please select an Accounts Receivable G/L account.');
    if (!offsetAccountId) return onNotify('error', 'Please select an offset account.');
    if (amount <= 0) return onNotify('error', 'Memo amount must be greater than zero.');

    const entryId = `je-memo-${Date.now()}`;
    const descPrefix = memoType === 'CREDIT' ? '[CREDIT MEMO]' : '[DEBIT MEMO]';
    const desc = `${descPrefix} ${customerName}${reason ? ` - ${reason}` : ''}`;

    const journalLines: JournalLine[] = memoType === 'CREDIT'
      ? [
          {
            id: `l-cm-dr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: offsetAccountId,
            debit: amount,
            credit: 0,
            memo: reason || 'Credit memo'
          },
          {
            id: `l-cm-cr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: arAccountId,
            debit: 0,
            credit: amount,
            memo: reason || 'Credit memo',
            contactId: customerId,
            contactType: customerType
          }
        ]
      : [
          {
            id: `l-dm-dr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: arAccountId,
            debit: amount,
            credit: 0,
            memo: reason || 'Debit memo',
            contactId: customerId,
            contactType: customerType
          },
          {
            id: `l-dm-cr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: offsetAccountId,
            debit: 0,
            credit: amount,
            memo: reason || 'Debit memo'
          }
        ];

    onPostJournal(
      {
        id: entryId,
        date: memoDate,
        reference,
        description: desc,
        sourceType: 'CREDIT_MEMO',
        status: 'POSTED'
      },
      journalLines
    );

    handleBackToList();
    onNotify('success', `${memoType === 'CREDIT' ? 'Credit' : 'Debit'} memo posted to General Ledger.`);
  };

  return (
    <div className="space-y-8 pb-20">
      {viewMode === 'LIST' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Credit / Debit Memo</h2>
              <p className="text-sm text-gray-500 font-normal italic">Adjust customer balances with credit or debit memos.</p>
            </div>
            <button
              type="button"
              onClick={openNewForm}
              className="flex items-center gap-2 px-6 py-2.5 text-white rounded-lg transition-all shadow-md font-bold text-sm"
              style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -10px ${brandColor}` }}
            >
              <Plus size={16} /> New Memo
            </button>
          </div>

          <div className="bg-white rounded-md border border-gray-200 shadow-sm">
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ backgroundColor: 'var(--acm-primary-light)' }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: brandColor }}>
                <FileText size={16} /> Posted Memos
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
              <thead style={{ backgroundColor: brandColor }}>
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Reference</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Description</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {memoEntries.map(e => {
                  const arLine = lines.find(l => l.journalEntryId === e.id && (l.debit > 0 || l.credit > 0) && l.contactId);
                  const amountVal = arLine ? Math.abs(arLine.debit - arLine.credit) : 0;
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-xs text-gray-600">{e.date}</td>
                      <td className="px-6 py-4 text-xs font-mono font-bold text-gray-700">{e.reference}</td>
                      <td className="px-6 py-4 text-xs text-gray-700">{e.description}</td>
                      <td className="px-6 py-4 text-right text-xs font-mono font-semibold text-gray-900">
                        {formatCurrency(amountVal)}
                      </td>
                    </tr>
                  );
                })}
                {memoEntries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-gray-400 italic">No memos posted yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <button
                type="button"
                onClick={handleBackToList}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide transition-colors"
                style={{ color: brandColor }}
              >
                <ChevronLeft size={14} /> Back to Memo Registry
              </button>
              <h2 className="mt-3 text-xl font-semibold text-gray-800 tracking-tight">New Credit / Debit Memo</h2>
              <p className="text-sm text-gray-500 font-normal italic">Create a memo entry on a dedicated form page before posting it to the General Ledger.</p>
            </div>
            <div
              className="px-4 py-2 border rounded text-xs font-semibold uppercase tracking-wide"
              style={{ backgroundColor: 'var(--acm-primary-light)', color: brandColor, borderColor: 'var(--acm-primary-light)' }}
            >
              {reference}
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
            <form onSubmit={handlePost} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Memo Type</label>
                  <select
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={memoType}
                    onChange={e => setMemoType(e.target.value as MemoType)}
                  >
                    <option value="CREDIT">Credit Memo</option>
                    <option value="DEBIT">Debit Memo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
                  <input
                    type="date"
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={memoDate}
                    onChange={e => setMemoDate(e.target.value)}
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</label>
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
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AR Account</label>
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
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {memoType === 'CREDIT' ? 'Contra / Revenue Account' : 'Revenue Account'}
                  </label>
                  <select
                    className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={offsetAccountId}
                    onChange={e => setOffsetAccountId(e.target.value)}
                  >
                    <option value="">Select account...</option>
                    {accounts.filter(a => (a.class === AccountClass.REVENUE || a.class === AccountClass.EXPENSE) && !a.isHeader).map(a => (
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
                  placeholder="e.g., Pricing adjustment or billing correction"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="px-6 py-3 border border-gray-200 text-gray-600 rounded text-sm font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 text-white rounded text-sm font-semibold shadow-md active:scale-95 transition-all"
                  style={{ backgroundColor: brandColor }}
                >
                  Post Memo
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default ARCreditDebitMemoView;
