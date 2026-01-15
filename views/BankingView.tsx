
import React, { useState, useMemo } from 'react';
import { BankAccount, TransactionSummary, ChartOfAccount, JournalEntryLine, JournalEntry, AccountClass } from '../types';
import { 
  Landmark, CreditCard, Wallet, ArrowRightLeft, History, Plus, 
  X, Save, ShieldCheck, AlertCircle, ChevronRight, 
  ArrowUpRight, ArrowDownLeft, BookOpen, Receipt, ExternalLink,
  ArrowDownToLine, ArrowUpFromLine, Calendar, MoreHorizontal
} from 'lucide-react';

interface BankingViewProps {
  bankAccounts: BankAccount[];
  summaries: TransactionSummary[];
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  lines: JournalEntryLine[];
  onAddBankAccount: (bank: Partial<BankAccount>) => void;
  onPostTransfer: (entry: Partial<JournalEntry>, lines: JournalEntryLine[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const BankingView: React.FC<BankingViewProps> = ({ 
  bankAccounts, summaries, accounts, entries, lines, onAddBankAccount, onPostTransfer, onNotify 
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState<'IN' | 'OUT' | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);

  // Form States
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryAmount, setEntryAmount] = useState<number>(0);
  const [entryMemo, setEntryMemo] = useState('');
  const [entryAccountId, setEntryAccountId] = useState('');
  const [targetBankId, setTargetBankId] = useState('');

  const [newBank, setNewBank] = useState<Partial<BankAccount>>({
    bankName: '',
    accountNumber: '',
    type: 'SAVINGS',
    glAccountId: '',
    currency: 'PHP'
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBank.bankName || !newBank.glAccountId) return;
    onAddBankAccount({ ...newBank, id: `bank-${Date.now()}` });
    setShowAddModal(false);
    setNewBank({ bankName: '', accountNumber: '', type: 'SAVINGS', glAccountId: '', currency: 'PHP' });
  };

  const handleDirectEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bank = bankAccounts.find(b => b.id === targetBankId);
    if (!bank) return onNotify('error', 'Configuration Error: Please select a valid target bank account.');
    if (entryAmount <= 0) return onNotify('error', 'Validation Error: Amount must be greater than zero.');
    if (!entryAccountId) return onNotify('error', 'Configuration Error: Offset G/L account is required for proper double-entry.');

    const entryId = `je-bank-${Date.now()}`;
    const finalizedLines: JournalEntryLine[] = [];

    if (showEntryModal === 'IN') {
      finalizedLines.push({ id: `l1-${entryId}`, journalEntryId: entryId, accountId: bank.glAccountId, debit: entryAmount, credit: 0, memo: entryMemo });
      finalizedLines.push({ id: `l2-${entryId}`, journalEntryId: entryId, accountId: entryAccountId, debit: 0, credit: entryAmount, memo: entryMemo });
    } else {
      finalizedLines.push({ id: `l1-${entryId}`, journalEntryId: entryId, accountId: entryAccountId, debit: entryAmount, credit: 0, memo: entryMemo });
      finalizedLines.push({ id: `l2-${entryId}`, journalEntryId: entryId, accountId: bank.glAccountId, debit: 0, credit: entryAmount, memo: entryMemo });
    }

    onPostTransfer({
      id: entryId,
      date: entryDate,
      reference: `${showEntryModal === 'IN' ? 'RCPT' : 'PYMT'}-${Date.now().toString().slice(-4)}`,
      description: `${showEntryModal === 'IN' ? 'Miscellaneous Receipt' : 'Direct Cash Payment'}: ${entryMemo}`,
      sourceType: showEntryModal === 'IN' ? 'COLLECTION' : 'PAYMENT',
      status: 'POSTED'
    }, finalizedLines);

    setShowEntryModal(null);
    resetEntryForm();
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fromBank = bankAccounts.find(b => b.id === targetBankId);
    const toBank = bankAccounts.find(b => b.id === entryAccountId);
    
    if (!fromBank || !toBank) return onNotify('error', 'Transfer Error: Ensure both origin and destination accounts are selected.');
    if (entryAmount <= 0) return onNotify('error', 'Validation Error: Transfer amount must be positive.');

    const entryId = `je-trf-${Date.now()}`;
    const finalizedLines: JournalEntryLine[] = [
      { id: `l1-${entryId}`, journalEntryId: entryId, accountId: fromBank.glAccountId, debit: 0, credit: entryAmount, memo: entryMemo || `Internal Transfer` },
      { id: `l2-${entryId}`, journalEntryId: entryId, accountId: toBank.glAccountId, debit: entryAmount, credit: 0, memo: entryMemo || `Internal Transfer` }
    ];

    onPostTransfer({
      id: entryId,
      date: entryDate,
      reference: `TRF-${Date.now().toString().slice(-4)}`,
      description: `Internal Fund Transfer: ${fromBank.bankName} to ${toBank.bankName}`,
      sourceType: 'TRANSFER',
      status: 'POSTED'
    }, finalizedLines);

    setShowTransferModal(false);
    resetEntryForm();
  };

  const resetEntryForm = () => {
    setEntryAmount(0);
    setEntryMemo('');
    setEntryAccountId('');
    setTargetBankId('');
    setEntryDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Banking & Treasury</h2>
          <p className="text-sm text-slate-500 font-normal italic">Institutional liquidity management and bank-to-ledger synchronization.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => { resetEntryForm(); setShowEntryModal('IN'); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all font-bold text-xs"
          >
            <ArrowDownToLine size={16} /> Record Receipt
          </button>
          <button 
            onClick={() => { resetEntryForm(); setShowEntryModal('OUT'); }}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl hover:bg-rose-100 transition-all font-bold text-xs"
          >
            <ArrowUpFromLine size={16} /> Record Payment
          </button>
          <button 
            onClick={() => { resetEntryForm(); setShowTransferModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-xs shadow-sm"
          >
            <ArrowRightLeft size={16} className="text-indigo-600" /> Transfer
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-bold text-xs"
          >
            <Plus size={16} /> Link Account
          </button>
        </div>
      </div>

      {!selectedBank ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bankAccounts.map(bank => {
            const summary = summaries.find(s => s.accountId === bank.glAccountId);
            const balance = summary?.balance || 0;
            return (
              <div 
                key={bank.id} 
                onClick={() => setSelectedBank(bank)}
                className="bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all overflow-hidden cursor-pointer group flex flex-col"
              >
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center border border-slate-100 transition-all shadow-sm">
                      {bank.type === 'CASH' ? <Wallet size={28} /> : <Landmark size={28} />}
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                      {bank.type}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800 leading-tight tracking-tight">{bank.bankName}</h3>
                    <p className="text-xs font-mono text-slate-400 uppercase tracking-tighter">{bank.accountNumber}</p>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Book Balance</p>
                      <p className={`text-3xl font-mono font-black tracking-tighter ${balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                        {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 uppercase">
                      {bank.currency}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/80 px-8 py-5 flex items-center justify-between border-t border-slate-100">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
                    <History size={16} /> View Sub-Ledger
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setSelectedBank(null)}
              className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors group"
            >
              <div className="p-1.5 rounded-lg border border-slate-200 group-hover:border-indigo-200 transition-all">
                <ChevronRight size={14} className="rotate-180" />
              </div>
              Back to Treasury
            </button>
            <div className="flex gap-2">
              <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"><Receipt size={18}/></button>
              <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"><ExternalLink size={18}/></button>
            </div>
          </div>
          
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-10 border-b bg-slate-50/30 flex flex-col lg:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-6">
                   <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-indigo-200 border-4 border-white">
                     {selectedBank.type === 'CASH' ? <Wallet size={36} /> : <Landmark size={36} />}
                   </div>
                   <div>
                      <h3 className="text-3xl font-black text-slate-800 tracking-tighter">{selectedBank.bankName}</h3>
                      <div className="flex items-center gap-3 mt-2">
                         <span className="text-sm font-mono text-slate-400 font-medium">{selectedBank.accountNumber}</span>
                         <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                         <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{selectedBank.type} TRUST ACCOUNT</span>
                      </div>
                   </div>
                </div>
                <div className="text-center lg:text-right">
                   <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Total Available Liquidity</p>
                   <div className="flex items-baseline justify-center lg:justify-end gap-2">
                     <span className="text-lg font-black text-indigo-600">{selectedBank.currency}</span>
                     <span className="text-5xl font-mono font-black text-slate-900 tracking-tighter">
                       {(summaries.find(s => s.accountId === selectedBank.glAccountId)?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                     </span>
                   </div>
                </div>
             </div>

             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Date</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type / Memo</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Inflow</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Outflow</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Cumulative Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(() => {
                      const bankLines = lines.filter(l => l.accountId === selectedBank.glAccountId);
                      let currentRunBal = 0;
                      const sortedLines = [...bankLines].sort((a, b) => {
                        const entryA = entries.find(e => e.id === a.journalEntryId);
                        const entryB = entries.find(e => e.id === b.journalEntryId);
                        return (entryA?.date || '').localeCompare(entryB?.date || '');
                      });

                      const history = sortedLines.map(line => {
                        const entry = entries.find(e => e.id === line.journalEntryId);
                        currentRunBal += (line.debit - line.credit);
                        return { line, entry, runBal: currentRunBal };
                      });

                      return history.reverse().map(({ line, entry, runBal }) => (
                        <tr key={line.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-10 py-6 whitespace-nowrap">
                             <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                   <Calendar size={14} />
                                </div>
                                <div>
                                   <div className="text-sm font-bold text-slate-700">{entry?.date}</div>
                                   <div className="text-[10px] font-mono text-slate-400 font-semibold uppercase mt-0.5">{entry?.reference}</div>
                                </div>
                             </div>
                          </td>
                          <td className="px-10 py-6">
                             <div className="text-sm font-bold text-slate-800 line-clamp-1">{entry?.description}</div>
                             <div className="text-[10px] text-slate-400 uppercase tracking-tight mt-1 font-medium">{line.memo || 'General Transaction'}</div>
                          </td>
                          <td className="px-10 py-6 text-right">
                             {line.debit > 0 && (
                               <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 font-mono text-xs font-black">
                                  <ArrowDownLeft size={12} strokeWidth={3} /> {line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                               </div>
                             )}
                          </td>
                          <td className="px-10 py-6 text-right">
                             {line.credit > 0 && (
                               <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-100 font-mono text-xs font-black">
                                  <ArrowUpRight size={12} strokeWidth={3} /> {line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                             )}
                          </td>
                          <td className="px-10 py-6 text-right font-mono text-sm font-black text-slate-900 bg-slate-50/20 group-hover:bg-slate-50/40 transition-colors">
                             {runBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ));
                    })()}
                    {lines.filter(l => l.accountId === selectedBank.glAccountId).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-32 text-center">
                          <div className="flex flex-col items-center gap-4 text-slate-300">
                             <Receipt size={48} strokeWidth={1} />
                             <p className="text-sm font-medium italic">No ledger activity recorded for this account.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {/* Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className={`p-3 ${showEntryModal === 'IN' ? 'bg-emerald-600' : 'bg-rose-600'} text-white rounded-2xl shadow-xl`}>
                  {showEntryModal === 'IN' ? <ArrowDownToLine size={24} /> : <ArrowUpFromLine size={24} />}
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Record {showEntryModal === 'IN' ? 'Receipt' : 'Payment'}</h3>
              </div>
              <button onClick={() => setShowEntryModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={28} /></button>
            </div>

            <form onSubmit={handleDirectEntrySubmit} className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Txn Date</label>
                  <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm"
                    value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{showEntryModal === 'IN' ? 'Target Account' : 'Source Account'}</label>
                  <select required className="w-full px-4 py-3 bg-white border-2 border-indigo-100 rounded-2xl outline-none font-black text-sm text-indigo-700"
                    value={targetBankId} onChange={e => setTargetBankId(e.target.value)}>
                    <option value="">Select Account...</option>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Amount</label>
                <div className="relative">
                  <input type="number" step="0.01" required className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] outline-none text-4xl font-mono font-black text-slate-900 tracking-tighter"
                    value={entryAmount || ''} onChange={e => setEntryAmount(Number(e.target.value))} placeholder="0.00" />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-black text-slate-300">PHP</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Linked G/L Category (Offset)</label>
                <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm"
                  value={entryAccountId} onChange={e => setEntryAccountId(e.target.value)}>
                  <option value="">Choose G/L Account...</option>
                  {showEntryModal === 'IN' 
                    ? accounts.filter(a => (a.class === AccountClass.REVENUE || a.class === AccountClass.LIABILITY) && !a.isHeader).map(acc => <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>)
                    : accounts.filter(a => (a.class === AccountClass.EXPENSE || a.class === AccountClass.ASSET) && !a.isHeader).map(acc => <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>)
                  }
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Narration / Memo</label>
                <textarea rows={2} required placeholder="State the purpose of this entry..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium text-sm resize-none"
                  value={entryMemo} onChange={e => setEntryMemo(e.target.value)} />
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowEntryModal(null)} className="flex-1 py-4 text-sm font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">Discard</button>
                <button type="submit" className={`flex-1 py-4 ${showEntryModal === 'IN' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-rose-600 shadow-rose-100'} text-white rounded-2xl text-sm font-black shadow-2xl active:scale-95 transition-all`}>
                  Commit Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl">
                  <ArrowRightLeft size={24} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Internal Transfer</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={28} /></button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-10 space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transfer Date</label>
                <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm"
                  value={entryDate} onChange={e => setEntryDate(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">From Source</label>
                  <select required className="w-full px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl outline-none font-bold text-xs text-rose-700"
                    value={targetBankId} onChange={e => setTargetBankId(e.target.value)}>
                    <option value="">Choose Origin...</option>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">To Destination</label>
                  <select required className="w-full px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl outline-none font-bold text-xs text-emerald-700"
                    value={entryAccountId} onChange={e => setEntryAccountId(e.target.value)}>
                    <option value="">Choose Target...</option>
                    {bankAccounts.filter(b => b.id !== targetBankId).map(b => <option key={b.id} value={b.id}>{b.bankName}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transfer Amount</label>
                <input type="number" step="0.01" required className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] outline-none text-4xl font-mono font-black text-slate-900 tracking-tighter"
                  value={entryAmount || ''} onChange={e => setEntryAmount(Number(e.target.value))} placeholder="0.00" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Internal Transfer Memo</label>
                <input placeholder="e.g. Funding Petty Cash..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium text-sm"
                  value={entryMemo} onChange={e => setEntryMemo(e.target.value)} />
              </div>

              <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100 flex gap-4">
                 <AlertCircle className="text-amber-600 shrink-0" size={24} />
                 <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                   Fund transfers generate dual journal entries impacting both G/L accounts. This action is atomic and irreversible once committed to the ledger.
                 </p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 py-4 text-sm font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">Discard</button>
                <button type="submit" disabled={entryAmount <= 0 || !targetBankId || !entryAccountId} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale">Post Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Bank Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl">
                  <Plus size={24} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Connect Account</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={28} /></button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Bank Title</label>
                  <input required placeholder="e.g. Metrobank Corporate" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm text-slate-800"
                    value={newBank.bankName} onChange={e => setNewBank({...newBank, bankName: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Acc # / Identifier</label>
                    <input placeholder="Optional Ref" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-mono text-xs font-bold"
                      value={newBank.accountNumber} onChange={e => setNewBank({...newBank, accountNumber: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Liquidity Type</label>
                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-xs"
                      value={newBank.type} onChange={e => setNewBank({...newBank, type: e.target.value as any})}>
                      <option value="SAVINGS">Savings</option>
                      <option value="CHECKING">Checking</option>
                      <option value="CASH">Physical Cash</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2">
                    <BookOpen size={16} /> G/L Ledger Mapping
                  </label>
                  <select required className="w-full px-4 py-3 bg-indigo-50/50 border-2 border-indigo-100 rounded-2xl outline-none font-black text-sm text-indigo-700 appearance-none"
                    value={newBank.glAccountId} onChange={e => setNewBank({...newBank, glAccountId: e.target.value})}>
                    <option value="">Select Asset Account...</option>
                    {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader).map(acc => (
                      <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex gap-4">
                 <ShieldCheck className="text-blue-600 shrink-0" size={24} />
                 <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                   Establishing this link creates a dedicated sub-ledger. All General Ledger postings to the selected account will automatically populate this bank's transaction history.
                 </p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-sm font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">Discard</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-indigo-100 transition-all active:scale-95">Link Ledger</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankingView;
