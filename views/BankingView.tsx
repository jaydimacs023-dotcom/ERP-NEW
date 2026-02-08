
import React, { useState, useMemo } from 'react';
import { BankAccount, TransactionSummary, ChartOfAccount, JournalLine, JournalEntry, AccountClass } from '../types';
import { BankReconciliationService, ReconciliationResult } from '../services/BankReconciliationService';
import { 
  Landmark, CreditCard, Wallet, ArrowRightLeft, History, Plus, 
  X, Save, ShieldCheck, AlertCircle, ChevronRight, 
  ArrowUpRight, ArrowDownLeft, BookOpen, Receipt, ExternalLink,
  ArrowDownToLine, ArrowUpFromLine, Calendar, MoreHorizontal,
  CheckCircle2, Scale, ListChecks, CheckSquare, Clock, Check,
  Activity, Zap, ShieldAlert, CheckCircle
} from 'lucide-react';

interface BankingViewProps {
  bankAccounts: BankAccount[];
  summaries: TransactionSummary[];
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  bankReconciliations?: any[];
  onAddBankAccount: (bank: Partial<BankAccount>) => void;
  onUpdateBankAccount?: (id: string, bank: Partial<BankAccount>) => void;
  onDeleteBankAccount?: (id: string) => void;
  onAddBankReconciliation?: (reconciliation: any) => void;
  onUpdateBankReconciliation?: (id: string, reconciliation: any) => void;
  onDeleteBankReconciliation?: (id: string) => void;
  onPostTransfer: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onToggleClearLine: (lineId: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type BankingTab = 'ledger' | 'reconcile';

const BankingView: React.FC<BankingViewProps> = ({ 
  bankAccounts, summaries, accounts, entries, lines, bankReconciliations, onAddBankAccount, onUpdateBankAccount, onDeleteBankAccount, onAddBankReconciliation, onUpdateBankReconciliation, onDeleteBankReconciliation, onPostTransfer, onToggleClearLine, onNotify 
}) => {
  // Utility function - defined first so it can be used in handlers
  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [activeTab, setActiveTab] = useState<BankingTab>('ledger');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState<'IN' | 'OUT' | null>(null);

  // Reconciliation State
  const [statementBalance, setStatementBalance] = useState<number>(0);
  const [reconcileAsOf, setReconcileAsOf] = useState(new Date().toISOString().split('T')[0]);

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
    currency: 'PHP',
    balance: 0
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBank.bankName || !newBank.glAccountId) {
      return onNotify('error', 'Validation Error: Bank name and GL account are required.');
    }
    onAddBankAccount({ 
      ...newBank, 
      balance: Number(newBank.balance) || 0
    });
    setShowAddModal(false);
    setNewBank({ bankName: '', accountNumber: '', type: 'SAVINGS', glAccountId: '', currency: 'PHP', balance: 0 });
    onNotify('success', 'Bank account linked successfully.');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank || !onUpdateBankAccount) return;
    if (!editingBank.bankName || !editingBank.glAccountId) {
      return onNotify('error', 'Validation Error: Bank name and GL account are required.');
    }
    onUpdateBankAccount(editingBank.id, {
      bankName: editingBank.bankName,
      accountNumber: editingBank.accountNumber,
      type: editingBank.type,
      glAccountId: editingBank.glAccountId,
      currency: editingBank.currency,
      balance: Number(editingBank.balance),
      updatedAt: new Date().toISOString()
    });
    setShowEditModal(false);
    setEditingBank(null);
    onNotify('success', 'Bank account updated successfully.');
  };

  const handleDeleteAccount = (id: string) => {
    if (!onDeleteBankAccount) return;
    if (confirm('Are you sure you want to delete this bank account? This action cannot be undone.')) {
      onDeleteBankAccount(id);
      setSelectedBank(null);
      onNotify('success', 'Bank account deleted successfully.');
    }
  };

  const openEditModal = (bank: BankAccount) => {
    setEditingBank({ ...bank });
    setShowEditModal(true);
  };

  const handleDirectEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bank = bankAccounts.find(b => b.id === targetBankId);
    if (!bank) return onNotify('error', 'Configuration Error: Please select a valid target bank account.');
    if (entryAmount <= 0) return onNotify('error', 'Validation Error: Amount must be greater than zero.');
    if (!entryAccountId) return onNotify('error', 'Configuration Error: Offset G/L account is required for proper double-entry.');

    const entryId = `je-bank-${Date.now()}`;
    const finalizedLines: JournalLine[] = [];

    if (showEntryModal === 'IN') {
      finalizedLines.push({ id: `l1-${entryId}`, journalEntryId: entryId, accountId: bank.glAccountId, debit: entryAmount, credit: 0, memo: entryMemo, isCleared: false });
      finalizedLines.push({ id: `l2-${entryId}`, journalEntryId: entryId, accountId: entryAccountId, debit: 0, credit: entryAmount, memo: entryMemo, isCleared: false });
    } else {
      finalizedLines.push({ id: `l1-${entryId}`, journalEntryId: entryId, accountId: entryAccountId, debit: entryAmount, credit: 0, memo: entryMemo, isCleared: false });
      finalizedLines.push({ id: `l2-${entryId}`, journalEntryId: entryId, accountId: bank.glAccountId, debit: 0, credit: entryAmount, memo: entryMemo, isCleared: false });
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
    onNotify('success', `${showEntryModal === 'IN' ? 'Receipt' : 'Payment'} of ${formatCurrency(entryAmount)} posted successfully.`);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fromBank = bankAccounts.find(b => b.id === targetBankId);
    const toBank = bankAccounts.find(b => b.id === entryAccountId);
    
    if (!fromBank || !toBank) return onNotify('error', 'Transfer Error: Ensure both origin and destination accounts are selected.');
    if (entryAmount <= 0) return onNotify('error', 'Validation Error: Transfer amount must be positive.');

    const entryId = `je-trf-${Date.now()}`;
    const finalizedLines: JournalLine[] = [
      { id: `l1-${entryId}`, journalEntryId: entryId, accountId: fromBank.glAccountId, debit: 0, credit: entryAmount, memo: entryMemo || `Internal Transfer`, isCleared: false },
      { id: `l2-${entryId}`, journalEntryId: entryId, accountId: toBank.glAccountId, debit: entryAmount, credit: 0, memo: entryMemo || `Internal Transfer`, isCleared: false }
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
    onNotify('success', `Transfer of ${formatCurrency(entryAmount)} from ${fromBank.bankName} to ${toBank.bankName} posted successfully.`);
  };

  const resetEntryForm = () => {
    setEntryAmount(0);
    setEntryMemo('');
    setEntryAccountId('');
    setTargetBankId('');
    setEntryDate(new Date().toISOString().split('T')[0]);
  };

  // Reconciliation Logic
  const reconciliationData = useMemo(() => {
    if (!selectedBank) return null;
    const result = BankReconciliationService.performReconciliation(
      selectedBank,
      statementBalance,
      lines,
      reconcileAsOf
    );
    return result;
  }, [selectedBank, lines, statementBalance, reconcileAsOf]);

  const handleBulkClear = () => {
    if (!reconciliationData) return;
    reconciliationData.unclearedLines.forEach(l => onToggleClearLine(l.id));
    onNotify('success', `Cleared ${reconciliationData.unclearedLines.length} transactions.`);
  };

  const handleSaveReconciliation = async () => {
    if (!selectedBank || !reconciliationData || !onAddBankReconciliation) return;
    
    if (BankReconciliationService.isReconciled(reconciliationData.difference)) {
      try {
        const reconciliationRecord = BankReconciliationService.createReconciliationRecord(
          selectedBank.orgId,
          reconciliationData,
          `Bank reconciliation completed for ${selectedBank.bankName} as of ${reconcileAsOf}`
        );
        
        await onAddBankReconciliation(reconciliationRecord);
        onNotify('success', `✅ Bank reconciliation locked and saved for ${reconcileAsOf}`);
      } catch (error) {
        console.error('Error saving reconciliation:', error);
        onNotify('error', 'Failed to save reconciliation');
      }
    } else {
      onNotify('error', `Cannot lock reconciliation with variance of ${formatCurrency(reconciliationData.difference)}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Banking & Treasury</h2>
          <p className="text-sm text-gray-500 font-normal italic">Institutional liquidity management and bank-to-ledger reconciliation.</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button 
            onClick={() => { resetEntryForm(); setShowEntryModal('IN'); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 border border-orange-100 rounded hover:bg-orange-100 transition-all font-bold text-xs"
          >
            <ArrowDownToLine size={16} /> Record Receipt
          </button>
          <button 
            onClick={() => { resetEntryForm(); setShowEntryModal('OUT'); }}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded hover:bg-rose-100 transition-all font-bold text-xs"
          >
            <ArrowUpFromLine size={16} /> Record Payment
          </button>
          <button 
            onClick={() => { resetEntryForm(); setShowTransferModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded hover:bg-gray-50 transition-all font-bold text-xs shadow-sm"
          >
            <ArrowRightLeft size={16} className="text-[#F47721]" /> Transfer
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#F47721] text-white rounded hover:bg-[#E06610] transition-all shadow-md shadow-gray-100 font-bold text-xs"
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
            // Reconciliation check
            const bankLines = lines.filter(l => l.accountId === bank.glAccountId);
            const unclearedCount = bankLines.filter(l => !l.isCleared).length;
            
            return (
              <div 
                key={bank.id} 
                onClick={() => setSelectedBank(bank)}
                className="bg-white rounded-md border border-gray-200 shadow-sm hover:shadow-sm hover:border-orange-200 transition-all overflow-hidden cursor-pointer group flex flex-col"
              >
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-8">
                    <div className="w-14 h-14 rounded bg-gray-50 text-gray-400 group-hover:bg-[#F47721] group-hover:text-white flex items-center justify-center border border-gray-100 transition-all shadow-sm">
                      {bank.type === 'CASH' ? <Wallet size={28} /> : <Landmark size={28} />}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                        {bank.type}
                       </div>
                       {unclearedCount > 0 ? (
                         <span className="flex items-center gap-1 text-xs font-semibold uppercase text-[#F47721] bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                           <Clock size={10} /> {unclearedCount} Outstanding
                         </span>
                       ) : (
                         <span className="flex items-center gap-1 text-xs font-semibold uppercase text-[#F47721] bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                           <CheckCircle size={10} /> Reconciled
                         </span>
                       )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold text-gray-800 leading-tight tracking-tight">{bank.bankName}</h3>
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-tighter">{bank.accountNumber}</p>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-end">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Current Ledger</p>
                      <p className={`text-xl font-mono font-semibold tracking-tighter ${balance >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
                        {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-xs font-semibold text-[#F47721] bg-orange-50 px-2 py-1 rounded border border-orange-100 uppercase">
                      {bank.currency}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/80 px-8 py-5 flex items-center justify-between border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide group-hover:text-[#F47721] transition-colors">
                    <History size={16} /> Open Treasury Console
                  </div>
                  <ChevronRight size={20} className="text-gray-300 group-hover:text-[#F47721] group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
            <button 
              onClick={() => { setSelectedBank(null); setActiveTab('ledger'); }}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-[#F47721] transition-colors group"
            >
              <div className="p-1.5 rounded-lg border border-gray-200 group-hover:border-orange-200 transition-all">
                <ChevronRight size={14} className="rotate-180" />
              </div>
              Exit Console
            </button>
            <div className="flex gap-2 items-center no-print">
              {selectedBank && (
                <>
                  <button 
                    onClick={() => openEditModal(selectedBank)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded hover:bg-orange-100 transition-all font-bold text-xs"
                  >
                    <Save size={14} /> Edit Account
                  </button>
                  <button 
                    onClick={() => handleDeleteAccount(selectedBank.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded hover:bg-rose-100 transition-all font-bold text-xs"
                  >
                    <X size={14} /> Delete
                  </button>
                </>
              )}
              <div className="flex bg-gray-100 rounded p-1 border border-gray-200">
                 <button 
                  onClick={() => setActiveTab('ledger')}
                  className={`flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${activeTab === 'ledger' ? 'bg-white text-[#F47721] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                   <History size={14} /> Account History
                 </button>
                 <button 
                  onClick={() => setActiveTab('reconcile')}
                  className={`flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${activeTab === 'reconcile' ? 'bg-white text-[#F47721] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                   <Scale size={14} /> Reconciliation
                 </button>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
             {activeTab === 'ledger' ? (
               <>
                 <div className="p-5 border-b bg-gray-50 flex flex-col lg:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                       <div className="w-20 h-20 rounded bg-[#F47721] text-white flex items-center justify-center shadow-md shadow-gray-200 border-4 border-white">
                         {selectedBank.type === 'CASH' ? <Wallet size={36} /> : <Landmark size={36} />}
                       </div>
                       <div>
                          <h3 className="text-xl font-semibold text-gray-800 tracking-tighter">{selectedBank.bankName}</h3>
                          <div className="flex items-center gap-3 mt-2">
                             <span className="text-sm font-mono text-gray-400 font-medium">{selectedBank.accountNumber}</span>
                             <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
                             <span className="text-xs font-semibold text-[#F47721] uppercase tracking-wide">{selectedBank.type} TRUST ACCOUNT</span>
                          </div>
                       </div>
                    </div>
                    <div className="text-center lg:text-right">
                       <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Ledger Snapshot</p>
                       <div className="flex items-baseline justify-center lg:justify-end gap-2">
                         <span className="text-lg font-semibold text-[#F47721]">{selectedBank.currency}</span>
                         <span className="text-2xl font-mono font-semibold text-gray-900 tracking-tighter">
                           {reconciliationData?.bookBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </span>
                       </div>
                    </div>
                 </div>

                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-5 py-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Transaction Date</th>
                          <th className="px-5 py-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Description / Memo</th>
                          <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Debit (In)</th>
                          <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Credit (Out)</th>
                          <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Audit Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {!reconciliationData || reconciliationData.clearedLines.length === 0 ? (
                           <tr>
                              <td colSpan={5} className="py-20 text-center text-gray-300 italic font-medium">No ledger activity found for this account.</td>
                           </tr>
                        ) : reconciliationData.clearedLines.slice().reverse().map(line => {
                          const entry = entries.find(e => e.id === line.journalEntryId);
                          return (
                            <tr key={line.id} className="hover:bg-gray-50 transition-colors group">
                              <td className="px-5 py-6 whitespace-nowrap">
                                 <div className="text-sm font-bold text-gray-700">{entry?.date}</div>
                                 <div className="text-xs font-mono text-gray-400 font-semibold uppercase mt-0.5">{entry?.reference}</div>
                              </td>
                              <td className="px-5 py-6">
                                 <div className="text-sm font-bold text-gray-800 line-clamp-1">{entry?.description}</div>
                                 <div className="text-xs text-gray-400 uppercase tracking-tight mt-1 font-medium italic">{line.memo || 'Institutional Disbursement'}</div>
                              </td>
                              <td className="px-5 py-6 text-right">
                                 {line.debit > 0 && <span className="font-mono text-sm text-[#F47721] font-bold">{formatCurrency(line.debit)}</span>}
                              </td>
                              <td className="px-5 py-6 text-right">
                                 {line.credit > 0 && <span className="font-mono text-sm text-rose-600 font-bold">({formatCurrency(line.credit)})</span>}
                              </td>
                              <td className="px-5 py-6 text-right">
                                 {line.isCleared ? (
                                   <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-[#F47721] rounded-full border border-orange-100 text-xs font-semibold uppercase tracking-wide">
                                      <CheckCircle2 size={12} /> Reconciled
                                   </span>
                                 ) : (
                                   <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-[#F47721] rounded-full border border-amber-100 text-xs font-semibold uppercase tracking-wide">
                                      <Clock size={12} /> Outstanding
                                   </span>
                                 )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                 </div>
               </>
             ) : (
               <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="p-5 border-b bg-gray-50 flex flex-col lg:flex-row justify-between items-center gap-5">
                     <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded bg-[#F47721] text-white flex items-center justify-center shadow-md shadow-gray-200 border-4 border-white">
                           <Scale size={36} />
                        </div>
                        <div className="space-y-4">
                           <div className="space-y-1">
                              <h3 className="text-lg font-semibold text-gray-800 tracking-tight">Audit Reconciliation</h3>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Statement Match Framework v4.0</p>
                           </div>
                           <div className="flex items-center gap-4">
                              <div className="space-y-1">
                                 <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Period End</label>
                                 <input type="date" className="bg-white border border-gray-200 rounded px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-400" value={reconcileAsOf} onChange={e => setReconcileAsOf(e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Actual Statement Balance</label>
                                 <div className="relative">
                                    <input type="number" step="0.01" className="bg-white border-2 border-orange-500/20 rounded pl-8 pr-4 py-1.5 text-base font-mono font-semibold text-gray-900 outline-none focus:border-orange-500" value={statementBalance || ''} onChange={e => setStatementBalance(Number(e.target.value))} placeholder="0.00" />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">{"\u20B1"}</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className={`p-8 rounded border-2 flex flex-col items-center justify-center min-w-[320px] transition-all ${Math.abs(reconciliationData?.difference || 0) < 0.01 ? 'bg-orange-50 border-orange-200' : 'bg-rose-50 border-rose-200'}`}>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Unreconciled Difference</p>
                        <div className="flex items-baseline gap-2">
                           <span className="text-xs font-semibold">{"\u20B1"}</span>
                           <div className={`text-xl font-mono font-semibold tracking-tighter ${Math.abs(reconciliationData?.difference || 0) < 0.01 ? 'text-orange-700' : 'text-rose-700'}`}>
                              {reconciliationData?.difference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                           </div>
                        </div>
                        {Math.abs(reconciliationData?.difference || 0) < 0.01 ? (
                          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#F47721] uppercase tracking-wide animate-bounce">
                             <ShieldCheck size={18} /> Verified Match
                          </div>
                        ) : (
                           <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-rose-600 uppercase tracking-wide">
                             <AlertCircle size={18} /> Variance Found
                          </div>
                        )}
                     </div>
                  </div>

                  <div className="p-5 space-y-6 bg-white">
                     <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-orange-50 text-[#F47721] rounded"><ListChecks size={18} /></div>
                           <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-tight">Audit Checklist</h4>
                        </div>
                        <div className="flex items-center gap-4">
                           <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                              {reconciliationData?.unclearedLines.length} Pending
                           </p>
                           <button 
                             onClick={handleBulkClear}
                             className="px-3 py-1 bg-orange-50 text-orange-700 border border-orange-100 rounded-lg text-xs font-semibold uppercase tracking-wide hover:bg-orange-100 transition-colors"
                           >
                             Clear All
                           </button>
                        </div>
                     </div>

                     <div className="space-y-3">
                        {reconciliationData?.unclearedLines.length === 0 && (
                          <div className="py-20 text-center bg-gray-50 rounded border border-dashed border-gray-200 text-gray-400">
                             <CheckSquare size={32} className="mx-auto mb-3 opacity-20" />
                             <p className="text-xs font-bold uppercase tracking-wide italic">Ledger and Statement are perfectly matched.</p>
                          </div>
                        )}
                        {reconciliationData?.unclearedLines.map(line => {
                          const entry = entries.find(e => e.id === line.journalEntryId);
                          return (
                            <button 
                              key={line.id}
                              onClick={() => onToggleClearLine(line.id)}
                              className="w-full flex items-center justify-between p-6 bg-white rounded border border-gray-100 hover:border-orange-500 hover:shadow-lg transition-all text-left group"
                            >
                               <div className="flex items-center gap-5">
                                  <div className="w-12 h-12 rounded border-2 border-gray-100 flex items-center justify-center text-gray-200 group-hover:border-orange-500 group-hover:text-[#F47721] group-hover:bg-orange-50 transition-all">
                                     <Check size={24} strokeWidth={4} />
                                  </div>
                                  <div>
                                     <p className="text-xs font-mono font-semibold text-[#F47721]">{entry?.date} • {entry?.reference}</p>
                                     <p className="text-sm font-bold text-gray-800 uppercase tracking-tight">{entry?.description}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className={`text-lg font-mono font-semibold ${line.debit > 0 ? 'text-[#F47721]' : 'text-rose-600'}`}>
                                     {line.debit > 0 ? `+${formatCurrency(line.debit)}` : `-${formatCurrency(line.credit)}`}
                                  </p>
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{line.memo || 'Direct Ledger Posting'}</p>
                               </div>
                            </button>
                          )
                        })}
                     </div>

                     <div className="mt-12 pt-10 border-t border-gray-100">
                        <div className="bg-gray-800 rounded-md p-5 text-white shadow-md flex flex-col md:flex-row justify-between items-center gap-5">
                           <div className="flex-1 space-y-4">
                              <div className="flex items-center gap-3">
                                 <ShieldCheck size={32} className="text-brand" />
                                 <h4 className="text-lg font-semibold tracking-tight uppercase">Immutable Closure</h4>
                              </div>
                              <p className="text-sm text-gray-400 leading-relaxed font-medium">
                                 Finalizing reconciliation establishes a cryptographic audit anchor for {reconcileAsOf}. 
                                 This lock ensures that historical liquidity positions remain constant for subsequent reporting cycles.
                              </p>
                           </div>
                           <div className="flex flex-col items-end gap-3 shrink-0">
                              <button 
                                onClick={handleSaveReconciliation}
                                disabled={Math.abs(reconciliationData?.difference || 0) > 0.01}
                                className="px-12 py-5 bg-[#F47721] text-white rounded-md text-xs font-semibold uppercase tracking-wide shadow-sm hover:bg-[#E06610] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                              >
                                 Anchor Balance Snapshot
                              </button>
                              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                 <Zap size={12} className="text-brand" /> Verified Session User: {new Date().toLocaleTimeString()}
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Direct Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-md shadow-md w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className={`p-3 ${showEntryModal === 'IN' ? 'bg-[#F47721]' : 'bg-rose-600'} text-white rounded shadow-sm`}>
                  {showEntryModal === 'IN' ? <ArrowDownToLine size={24} /> : <ArrowUpFromLine size={24} />}
                </div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Record {showEntryModal === 'IN' ? 'Receipt' : 'Payment'}</h3>
              </div>
              <button onClick={() => setShowEntryModal(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={28} /></button>
            </div>

            <form onSubmit={handleDirectEntrySubmit} className="p-5 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Txn Date</label>
                  <input type="date" required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-bold text-sm"
                    value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{showEntryModal === 'IN' ? 'Target Account' : 'Source Account'}</label>
                  <select required className="w-full px-4 py-3 bg-white border-2 border-orange-100 rounded outline-none font-semibold text-sm text-orange-700"
                    value={targetBankId} onChange={e => setTargetBankId(e.target.value)}>
                    <option value="">Select Account...</option>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Transaction Amount</label>
                <div className="relative">
                  <input type="number" step="0.01" required className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded outline-none text-xl font-mono font-semibold text-gray-900 tracking-tighter"
                    value={entryAmount || ''} onChange={e => setEntryAmount(Number(e.target.value))} placeholder="0.00" />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-semibold text-gray-300">PHP</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Linked G/L Category (Offset)</label>
                <select required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-bold text-sm"
                  value={entryAccountId} onChange={e => setEntryAccountId(e.target.value)}>
                  <option value="">Choose G/L Account...</option>
                  {showEntryModal === 'IN' 
                    ? accounts.filter(a => (a.class === AccountClass.REVENUE || a.class === AccountClass.LIABILITY) && !a.isHeader).map(acc => <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>)
                    : accounts.filter(a => (a.class === AccountClass.EXPENSE || a.class === AccountClass.ASSET) && !a.isHeader).map(acc => <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>)
                  }
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Narration / Memo</label>
                <textarea rows={2} required placeholder="State the purpose of this entry..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-medium text-sm resize-none"
                  value={entryMemo} onChange={e => setEntryMemo(e.target.value)} />
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowEntryModal(null)} className="flex-1 py-4 text-sm font-semibold text-gray-400 hover:bg-gray-50 rounded transition-all">Discard</button>
                <button type="submit" className={`flex-1 py-4 ${showEntryModal === 'IN' ? 'bg-[#F47721] shadow-gray-100' : 'bg-rose-600 shadow-rose-100'} text-white rounded text-sm font-semibold shadow-md active:scale-95 transition-all`}>
                  Commit Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-md shadow-md w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F47721] text-white rounded shadow-sm">
                  <ArrowRightLeft size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Internal Transfer</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={28} /></button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-5 space-y-8">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Transfer Date</label>
                <input type="date" required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-bold text-sm"
                  value={entryDate} onChange={e => setEntryDate(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">From Source</label>
                  <select required className="w-full px-4 py-3 bg-rose-50 border border-rose-100 rounded outline-none font-bold text-xs text-rose-700"
                    value={targetBankId} onChange={e => setTargetBankId(e.target.value)}>
                    <option value="">Choose Origin...</option>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">To Destination</label>
                  <select required className="w-full px-4 py-3 bg-orange-50 border border-orange-100 rounded outline-none font-bold text-xs text-orange-700"
                    value={entryAccountId} onChange={e => setEntryAccountId(e.target.value)}>
                    <option value="">Choose Target...</option>
                    {bankAccounts.filter(b => b.id !== targetBankId).map(b => <option key={b.id} value={b.id}>{b.bankName}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Transfer Amount</label>
                <input type="number" step="0.01" required className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded outline-none text-xl font-mono font-semibold text-gray-900 tracking-tighter"
                  value={entryAmount || ''} onChange={e => setEntryAmount(Number(e.target.value))} placeholder="0.00" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Internal Transfer Memo</label>
                <input placeholder="e.g. Funding Petty Cash..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-medium text-sm"
                  value={entryMemo} onChange={e => setEntryMemo(e.target.value)} />
              </div>

              <div className="bg-amber-50 p-5 rounded-md border border-amber-100 flex gap-4">
                 <AlertCircle className="text-[#F47721] shrink-0" size={24} />
                 <p className="text-xs text-amber-800 leading-relaxed font-medium">
                   Fund transfers generate dual journal entries impacting both G/L accounts. This action is atomic and irreversible once committed to the ledger.
                 </p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 py-4 text-sm font-semibold text-gray-400 hover:bg-gray-50 rounded transition-all">Discard</button>
                <button type="submit" disabled={entryAmount <= 0 || !targetBankId || !entryAccountId} className="flex-1 py-4 bg-[#F47721] text-white rounded text-sm font-semibold shadow-md shadow-gray-100 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale">Post Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-md shadow-md w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F47721] text-white rounded shadow-sm">
                  <Plus size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Connect Account</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={28} /></button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bank Title</label>
                  <input required placeholder="e.g. Metrobank Corporate" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-bold text-sm text-gray-800"
                    value={newBank.bankName} onChange={e => setNewBank({...newBank, bankName: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Acc # / Identifier</label>
                    <input placeholder="Optional Ref" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-mono text-xs font-bold"
                      value={newBank.accountNumber} onChange={e => setNewBank({...newBank, accountNumber: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Liquidity Type</label>
                    <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-semibold text-xs"
                      value={newBank.type} onChange={e => setNewBank({...newBank, type: e.target.value as any})}>
                      <option value="SAVINGS">Savings</option>
                      <option value="CHECKING">Checking</option>
                      <option value="CASH">Physical Cash</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#F47721] uppercase tracking-wide flex items-center gap-2">
                    <BookOpen size={16} /> G/L Ledger Mapping
                  </label>
                  <select required className="w-full px-4 py-3 bg-orange-50/50 border-2 border-orange-100 rounded outline-none font-semibold text-sm text-orange-700 appearance-none"
                    value={newBank.glAccountId} onChange={e => setNewBank({...newBank, glAccountId: e.target.value})}>
                    <option value="">Select Asset Account...</option>
                    {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader).map(acc => (
                      <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-orange-50 p-5 rounded-md border border-orange-100 flex gap-4">
                 <ShieldCheck className="text-[#F47721] shrink-0" size={24} />
                 <p className="text-xs text-orange-800 leading-relaxed font-medium">
                   Establishing this link creates a dedicated sub-ledger. All General Ledger postings to the selected account will automatically populate this bank's transaction history.
                 </p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-sm font-semibold text-gray-400 hover:bg-gray-50 rounded transition-all">Discard</button>
                <button type="submit" className="flex-1 py-4 bg-[#F47721] text-white rounded text-sm font-semibold shadow-md shadow-gray-100 transition-all active:scale-95">Link Ledger</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingBank && (
        <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-md shadow-md w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F47721] text-white rounded shadow-sm">
                  <Save size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Edit Account</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={28} /></button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bank Title</label>
                  <input required placeholder="e.g. Metrobank Corporate" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-bold text-sm text-gray-800"
                    value={editingBank.bankName} onChange={e => setEditingBank({...editingBank, bankName: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Acc # / Identifier</label>
                    <input placeholder="Optional Ref" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-mono text-xs font-bold"
                      value={editingBank.accountNumber} onChange={e => setEditingBank({...editingBank, accountNumber: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Liquidity Type</label>
                    <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-semibold text-xs"
                      value={editingBank.type} onChange={e => setEditingBank({...editingBank, type: e.target.value as any})}>
                      <option value="SAVINGS">Savings</option>
                      <option value="CHECKING">Checking</option>
                      <option value="CASH">Physical Cash</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Currency</label>
                    <input placeholder="PHP" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-mono text-xs font-bold uppercase"
                      value={editingBank.currency} onChange={e => setEditingBank({...editingBank, currency: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Current Balance</label>
                    <input type="number" step="0.01" placeholder="0.00" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none font-mono text-xs font-bold"
                      value={editingBank.balance} onChange={e => setEditingBank({...editingBank, balance: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#F47721] uppercase tracking-wide flex items-center gap-2">
                    <BookOpen size={16} /> G/L Ledger Mapping
                  </label>
                  <select required className="w-full px-4 py-3 bg-orange-50/50 border-2 border-orange-100 rounded outline-none font-semibold text-sm text-orange-700 appearance-none"
                    value={editingBank.glAccountId} onChange={e => setEditingBank({...editingBank, glAccountId: e.target.value})}>
                    <option value="">Select Asset Account...</option>
                    {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader).map(acc => (
                      <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-4 text-sm font-semibold text-gray-400 hover:bg-gray-50 rounded transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-[#F47721] text-white rounded text-sm font-semibold shadow-md shadow-gray-100 transition-all active:scale-95">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankingView;
