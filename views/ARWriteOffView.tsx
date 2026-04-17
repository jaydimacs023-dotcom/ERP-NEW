import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, ChevronLeft, FileText, Filter, GraduationCap, Plus, Search } from 'lucide-react';
import { AccountingService } from '../accountingService';
import {
  Invoice,
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
  initialContext?: { invoice?: Invoice };
  onClearContext?: () => void;
}

type CustomerType = 'SPONSOR' | 'STUDENT';
type ViewMode = 'LIST' | 'FORM';
type CustomerTypeFilter = 'ALL' | CustomerType;

const ARWriteOffView: React.FC<ARWriteOffViewProps> = ({
  orgId,
  entries,
  lines,
  accounts,
  students,
  sponsors,
  currency,
  onPostJournal,
  onNotify,
  initialContext,
  onClearContext
}) => {
  const today = new Date().toISOString().split('T')[0];
  const getNextReference = () => AccountingService.getNextReference(entries, 'WO');

  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [writeOffDate, setWriteOffDate] = useState(today);
  const [reference, setReference] = useState(getNextReference());
  const [customerType, setCustomerType] = useState<CustomerType>('SPONSOR');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState(0);
  const [arAccountId, setArAccountId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilter>('ALL');

  const arAccounts = useMemo(
    () =>
      accounts.filter(
        a =>
          a.class === AccountClass.ASSET &&
          !a.isHeader &&
          ((a.name || '').toLowerCase().includes('receivable') || a.code === '1200')
      ),
    [accounts]
  );

  const expenseAccounts = useMemo(
    () => accounts.filter(a => a.class === AccountClass.EXPENSE && !a.isHeader),
    [accounts]
  );

  const arAccountIds = useMemo(() => new Set(arAccounts.map(a => a.id)), [arAccounts]);

  const resetFormState = (nextCustomerType: CustomerType = 'SPONSOR') => {
    setWriteOffDate(today);
    setReference(getNextReference());
    setCustomerType(nextCustomerType);
    setCustomerId('');
    setAmount(0);
    setReason('');
  };

  const openNewForm = () => {
    resetFormState();
    setViewMode('FORM');
  };

  const handleBackToList = () => {
    resetFormState(customerType);
    setViewMode('LIST');
  };

  useEffect(() => {
    if (!initialContext?.invoice) return;

    const { invoice } = initialContext;
    const nextCustomerType: CustomerType = invoice.sponsorId ? 'SPONSOR' : 'STUDENT';

    setViewMode('FORM');
    setWriteOffDate(today);
    setReference(getNextReference());
    setCustomerType(nextCustomerType);
    setCustomerId(invoice.sponsorId || invoice.studentId || '');
    setAmount(Math.max(0, Number(invoice.balanceDue || 0)));
    setReason(invoice.invoiceNo ? `Write-off for Invoice ${invoice.invoiceNo}` : '');

    onClearContext?.();
  }, [initialContext, onClearContext, entries, today]);

  useEffect(() => {
    if (customerType === 'SPONSOR' && customerId) {
      const sponsor = sponsors.find(s => s.id === customerId);
      if (sponsor?.arAccountId) {
        setArAccountId(sponsor.arAccountId);
        return;
      }
    }

    if (arAccounts[0]?.id) {
      setArAccountId(arAccounts[0].id);
    }
  }, [arAccounts, customerType, customerId, sponsors]);

  useEffect(() => {
    const preferred = expenseAccounts.find(
      a =>
        (a.name || '').toLowerCase().includes('bad debt') ||
        (a.name || '').toLowerCase().includes('write off') ||
        (a.name || '').toLowerCase().includes('write-off') ||
        (a.name || '').toLowerCase().includes('doubtful')
    )?.id;

    if (preferred) {
      setExpenseAccountId(preferred);
      return;
    }

    if (expenseAccounts[0]?.id) {
      setExpenseAccountId(expenseAccounts[0].id);
    }
  }, [expenseAccounts]);

  const customerBalance = useMemo(() => {
    if (!customerId) return 0;

    const postedEntryIds = new Set(entries.filter(e => e.status === 'POSTED' && e.date <= writeOffDate).map(e => e.id));

    return lines
      .filter(
        l =>
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

    const student = students.find(s => s.id === customerId);
    return student ? `${student.lastName}, ${student.firstName}` : '';
  }, [customerId, customerType, sponsors, students]);

  const writeOffRecords = useMemo(() => {
    return entries
      .filter(
        entry =>
          entry.status === 'POSTED' &&
          (entry.reference || '').startsWith('WO-') &&
          (entry.description || '').includes('[WRITE OFF]')
      )
      .map(entry => {
        const arLine = lines.find(
          line =>
            line.journalEntryId === entry.id &&
            line.credit > 0 &&
            (line.contactType === 'SPONSOR' || line.contactType === 'STUDENT')
        );

        const detectedCustomerType =
          arLine?.contactType === 'SPONSOR' || arLine?.contactType === 'STUDENT' ? arLine.contactType : null;
        const detectedCustomerId = arLine?.contactId || '';

        const detectedCustomerName =
          detectedCustomerType === 'SPONSOR'
            ? sponsors.find(s => s.id === detectedCustomerId)?.name || 'Unknown Sponsor'
            : detectedCustomerType === 'STUDENT'
              ? (() => {
                  const student = students.find(s => s.id === detectedCustomerId);
                  return student ? `${student.lastName}, ${student.firstName}` : 'Unknown Student';
                })()
              : 'Unassigned Customer';

        const arAccountName = accounts.find(a => a.id === arLine?.accountId)?.name || 'Accounts Receivable';

        return {
          entry,
          amount: Number(arLine?.credit || 0),
          customerId: detectedCustomerId,
          customerType: detectedCustomerType,
          customerName: detectedCustomerName,
          arAccountName
        };
      })
      .filter(record => customerTypeFilter === 'ALL' || record.customerType === customerTypeFilter)
      .filter(record => {
        const haystack = [
          record.entry.reference || '',
          record.entry.description || '',
          record.customerName,
          record.customerType || '',
          record.arAccountName
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime());
  }, [accounts, customerTypeFilter, entries, lines, searchTerm, sponsors, students]);

  const totalWriteOffAmount = useMemo(
    () => writeOffRecords.reduce((sum, record) => sum + record.amount, 0),
    [writeOffRecords]
  );

  const thisMonthWriteOffAmount = useMemo(() => {
    const now = new Date();
    return writeOffRecords
      .filter(record => {
        const recordDate = new Date(record.entry.date);
        return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, record) => sum + record.amount, 0);
  }, [writeOffRecords]);

  const uniqueCustomers = useMemo(() => {
    return new Set(writeOffRecords.map(record => `${record.customerType || 'UNKNOWN'}:${record.customerId}`)).size;
  }, [writeOffRecords]);

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
    const memo = reason || 'Accounts receivable write-off';
    const description = `[WRITE OFF] ${customerName}${reason ? ` - ${reason}` : ''}`;

    const journalLines: JournalLine[] = [
      {
        id: `l-wo-dr-${Date.now()}`,
        journalEntryId: entryId,
        orgId,
        accountId: expenseAccountId,
        debit: amount,
        credit: 0,
        memo
      },
      {
        id: `l-wo-cr-${Date.now()}`,
        journalEntryId: entryId,
        orgId,
        accountId: arAccountId,
        debit: 0,
        credit: amount,
        memo,
        contactId: customerId,
        contactType: customerType
      }
    ];

    onPostJournal(
      {
        id: entryId,
        date: writeOffDate,
        reference,
        description,
        sourceType: 'MANUAL',
        status: 'POSTED'
      },
      journalLines
    );

    onNotify('success', 'Write-off posted to General Ledger.');
    handleBackToList();
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {viewMode === 'LIST' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 tracking-tight">AR Write-Offs</h2>
              <p className="text-sm text-gray-500 font-normal italic">Track and post bad debt and uncollectible receivables.</p>
            </div>
            <button
              type="button"
              onClick={openNewForm}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md shadow-brand/20 font-bold text-sm"
            >
              <Plus size={16} /> New Write Off
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Posted Write-Offs</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{writeOffRecords.length}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Amount</p>
              <p className="mt-2 text-2xl font-semibold text-rose-600">{formatCurrency(totalWriteOffAmount)}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">This Month / Customers</p>
              <div className="mt-2 flex items-baseline justify-between gap-4">
                <p className="text-xl font-semibold text-brand">{formatCurrency(thisMonthWriteOffAmount)}</p>
                <p className="text-sm font-semibold text-gray-500">{uniqueCustomers} customers</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 shadow-sm p-4 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:border-brand"
                placeholder="Search by reference, customer, memo, or account..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <Filter size={14} /> Filter
              </div>
              <select
                className="px-4 py-3 bg-white border border-gray-200 rounded text-sm font-semibold text-gray-700 outline-none focus:border-brand appearance-none"
                value={customerTypeFilter}
                onChange={e => setCustomerTypeFilter(e.target.value as CustomerTypeFilter)}
              >
                <option value="ALL">All Customers</option>
                <option value="SPONSOR">Sponsors</option>
                <option value="STUDENT">Students</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <FileText size={16} /> Write-Off Registry
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Reference</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Description</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {writeOffRecords.map(record => (
                    <tr key={record.entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600">{record.entry.date}</td>
                      <td className="px-6 py-4 text-sm font-mono font-bold text-gray-700">{record.entry.reference}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">{record.customerName}</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide">{record.arAccountName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${
                          record.customerType === 'SPONSOR'
                            ? 'bg-brand/10 text-brand border-brand-light'
                            : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                        }`}>
                          {record.customerType === 'SPONSOR' ? <Building2 size={12} /> : <GraduationCap size={12} />}
                          {record.customerType || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{record.entry.description}</td>
                      <td className="px-6 py-4 text-right text-sm font-mono font-semibold text-rose-600">{formatCurrency(record.amount)}</td>
                    </tr>
                  ))}

                  {writeOffRecords.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                          <FileText size={28} className="opacity-40" />
                          <p className="text-sm font-medium">No write-offs found for the current search and filter.</p>
                          <button
                            type="button"
                            onClick={openNewForm}
                            className="mt-2 px-5 py-2 bg-brand text-white rounded text-sm font-semibold hover:bg-brand-hover transition-all"
                          >
                            Create First Write Off
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <button
                type="button"
                onClick={handleBackToList}
                className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-brand transition-colors"
              >
                <ChevronLeft size={14} /> Back to Write-Off Registry
              </button>
              <h2 className="mt-3 text-xl font-semibold text-gray-800 tracking-tight">New Write-Off</h2>
              <p className="text-sm text-gray-500 font-normal italic">Post a receivable balance to bad debt or write-off expense.</p>
            </div>
            <div className="px-4 py-2 bg-brand/10 text-brand border border-brand-light rounded text-xs font-semibold uppercase tracking-wide">
              {reference}
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
            <form onSubmit={handlePost} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded px-4 py-3 text-sm outline-none focus:border-brand"
                    value={writeOffDate}
                    onChange={e => setWriteOffDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded px-4 py-3 text-sm font-mono outline-none focus:border-brand"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer Type</label>
                  <select
                    className="w-full border border-gray-200 rounded px-4 py-3 text-sm outline-none focus:border-brand appearance-none"
                    value={customerType}
                    onChange={e => {
                      setCustomerType(e.target.value as CustomerType);
                      setCustomerId('');
                    }}
                  >
                    <option value="SPONSOR">Sponsor</option>
                    <option value="STUDENT">Student</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</label>
                  <select
                    className="w-full border border-gray-200 rounded px-4 py-3 text-sm outline-none focus:border-brand appearance-none"
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                  >
                    <option value="">Select customer...</option>
                    {customerType === 'SPONSOR' &&
                      sponsors.map(sponsor => (
                        <option key={sponsor.id} value={sponsor.id}>
                          {sponsor.name}
                        </option>
                      ))}
                    {customerType === 'STUDENT' &&
                      students.map(student => (
                        <option key={student.id} value={student.id}>
                          {student.lastName}, {student.firstName}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Outstanding Balance</label>
                  <div className="px-4 py-3 border border-gray-200 rounded text-sm font-mono bg-gray-50 text-gray-800">
                    {formatCurrency(customerBalance)}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Write-Off Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-200 rounded px-4 py-3 text-sm outline-none focus:border-brand"
                    value={amount || ''}
                    onChange={e => setAmount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AR Account (Credit)</label>
                  <select
                    className="w-full border border-gray-200 rounded px-4 py-3 text-sm outline-none focus:border-brand appearance-none"
                    value={arAccountId}
                    onChange={e => setArAccountId(e.target.value)}
                  >
                    <option value="">Select AR account...</option>
                    {arAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Write-Off Account (Debit)</label>
                  <select
                    className="w-full border border-gray-200 rounded px-4 py-3 text-sm outline-none focus:border-brand appearance-none"
                    value={expenseAccountId}
                    onChange={e => setExpenseAccountId(e.target.value)}
                  >
                    <option value="">Select expense account...</option>
                    {expenseAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason / Memo</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded px-4 py-3 text-sm outline-none focus:border-brand"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g., Uncollectible balance approved for write-off"
                />
              </div>

              <div className="bg-amber-50 p-5 rounded-md border border-amber-100 flex gap-4">
                <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                <p className="text-sm text-amber-800 leading-relaxed">
                  Posting this entry will reduce Accounts Receivable and recognize a write-off expense in the General Ledger.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                  Customer balance after posting: {formatCurrency(Math.max(customerBalance - amount, 0))}
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="flex-1 sm:flex-initial px-6 py-3 border border-gray-200 text-gray-600 rounded text-sm font-semibold hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-initial px-6 py-3 bg-brand text-white rounded text-sm font-semibold shadow-md shadow-brand/20 active:scale-95 transition-all hover:bg-brand-hover"
                  >
                    Post Write-Off
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default ARWriteOffView;
