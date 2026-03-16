
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChartOfAccount, Student, Trainer, Sponsor, Batch, NonStockItem,
  JournalLine, JournalEntry, AccountClass 
} from '../types';
import { AccountingService } from '../accountingService';
import { X, Plus, Trash2, AlertCircle, Save, CheckCircle2 } from 'lucide-react';

interface JournalFormProps {
  accounts: ChartOfAccount[];
  students: Student[];
  trainers: Trainer[];
  sponsors: Sponsor[];
  batches: Batch[];
  items: NonStockItem[];
  entries: JournalEntry[];
  onSubmit: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onClose: () => void;
}

const JournalForm: React.FC<JournalFormProps> = ({ 
  accounts, students, trainers, sponsors, batches, items = [], entries, onSubmit, onClose 
}) => {
  const [entry, setEntry] = useState<Partial<JournalEntry>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    sourceType: 'MANUAL',
    status: 'DRAFT'
  });

  useEffect(() => {
    const nextRef = AccountingService.getNextReference(entries, 'JV');
    setEntry(prev => ({ ...prev, reference: nextRef }));
  }, [entries]);

  const [lines, setLines] = useState<Partial<JournalLine>[]>([
    { id: '1', accountId: '', debit: 0, credit: 0, memo: '', contactId: '', contactType: 'OTHER', batchId: '', itemId: '' },
    { id: '2', accountId: '', debit: 0, credit: 0, memo: '', contactId: '', contactType: 'OTHER', batchId: '', itemId: '' }
  ]);

  const [controlTotal, setControlTotal] = useState<number>(0);

  const totalDebit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0), [lines]);
  
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;
  const matchesControl = Math.abs(totalDebit - controlTotal) < 0.001;
  const canPost = isBalanced && matchesControl;

  const addLine = () => {
    setLines([...lines, { 
      id: Math.random().toString(36).substr(2, 9), 
      accountId: '', 
      debit: 0, 
      credit: 0, 
      contactId: '', 
      contactType: 'OTHER',
      batchId: '',
      itemId: ''
    }]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines(lines.filter(l => l.id !== id));
  };

  const updateLine = (id: string, updates: Partial<JournalLine>) => {
    setLines(lines.map(l => {
      if (l.id !== id) return l;
      
      const newLine = { ...l, ...updates };

      if (updates.itemId) {
        const item = items.find(i => i.id === updates.itemId);
        if (item) {
          // Use expenseAccountId for debits (expenses/purchases), incomeAccountId for credits (revenue)
          newLine.accountId = newLine.debit > 0 ? item.expenseAccountId : item.incomeAccountId;
          const acc = accounts.find(a => a.id === newLine.accountId);
          if (acc?.class === AccountClass.REVENUE) {
            newLine.credit = item.unitPrice;
            newLine.debit = 0;
          } else if (acc?.class === AccountClass.ASSET) {
            newLine.debit = item.unitPrice;
            newLine.credit = 0;
          }
          if (!newLine.memo) newLine.memo = item.name;
        }
      }

      if (updates.batchId) {
        const batch = batches.find(b => b.id === updates.batchId);
        if (batch) {
          if (batch.sponsorId) {
            newLine.contactType = 'SPONSOR';
            newLine.contactId = batch.sponsorId;
          } else {
            newLine.contactType = 'STUDENT';
            newLine.contactId = ''; 
          }
        }
      }

      return newLine;
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) return;

    const entryId = `je-${Date.now()}`;
    const finalizedLines: JournalLine[] = lines.map(l => ({
      id: `l-${Math.random().toString(36).substr(2, 9)}`,
      journalEntryId: entryId,
      accountId: l.accountId!,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      memo: l.memo || entry.description,
      contactId: l.contactId,
      contactType: l.contactType,
      batchId: l.batchId,
      itemId: l.itemId
    }));

    onSubmit({ ...entry, id: entryId, createdAt: new Date().toISOString() }, finalizedLines);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors"
              title="Back to Journal Entries"
            >
              <X size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="p-2 bg-teal-600 text-white rounded-xl shadow-md"><Save size={18} /></div>
            <div>
               <h3 className="text-lg font-bold text-slate-800 tracking-tight">Post Transaction</h3>
               <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">Journal Voucher</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Transaction Date</label>
              <input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={entry.date} onChange={e => setEntry({...entry, date: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Voucher Ref</label>
              <input readOnly className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-black text-teal-600 font-mono" value={entry.reference} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Journal Memo</label>
              <input required placeholder="Batch Description" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={entry.description} onChange={e => setEntry({...entry, description: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-[#F47721]">Control Total</label>
              <input 
                type="number" 
                step="0.01" 
                required 
                placeholder="0.00"
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold font-mono outline-none transition-all ${
                  matchesControl ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-orange-50 border-orange-200 text-orange-700 focus:border-orange-400'
                }`}
                value={controlTotal || ''} 
                onChange={e => setControlTotal(parseFloat(e.target.value) || 0)} 
              />
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-12 gap-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              <div className="col-span-3">Account Title</div>
              <div className="col-span-3">Description / Memo</div>
              <div className="col-span-2 text-right">Debit</div>
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-2">System Link (Optional)</div>
            </div>

            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-12 gap-3 items-start p-4 bg-white rounded-2xl border border-slate-100 hover:border-teal-200 transition-colors shadow-sm relative group/row">
                
                {/* 1. Account Selection */}
                <div className="col-span-3 space-y-2">
                  <select 
                    required 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-teal-400" 
                    value={line.accountId} 
                    onChange={e => updateLine(line.id!, { accountId: e.target.value })}
                  >
                    <option value="">Account Title...</option>
                    {accounts.filter(a => !a.isHeader).map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                  </select>
                  
                  <div className="flex gap-2">
                    <select className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-bold uppercase" value={line.contactType} onChange={e => updateLine(line.id!, { contactType: e.target.value as any, contactId: '' })}>
                      <option value="OTHER">Other</option>
                      <option value="STUDENT">Student</option>
                      <option value="SPONSOR">Sponsor</option>
                    </select>
                    
                    <select className="flex-1 px-3 py-1.5 bg-white border border-teal-100 rounded-lg text-[10px] font-medium" value={line.contactId} onChange={e => updateLine(line.id!, { contactId: e.target.value })}>
                      <option value="">Entity (Sub)...</option>
                      {line.contactType === 'STUDENT' && students.map(s => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}
                      {line.contactType === 'SPONSOR' && sponsors.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* 2. Description / Memo */}
                <div className="col-span-3">
                  <textarea 
                    placeholder="Line Description"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none h-[68px] resize-none focus:border-teal-400"
                    value={line.memo || ''}
                    onChange={e => updateLine(line.id!, { memo: e.target.value })}
                  />
                </div>

                {/* 3. Debit */}
                <div className="col-span-2">
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-right text-sm font-mono font-bold text-teal-700 outline-none focus:border-teal-400" 
                    value={line.debit || ''} 
                    onChange={e => updateLine(line.id!, { debit: parseFloat(e.target.value) || 0, credit: 0 })} 
                  />
                </div>

                {/* 4. Credit */}
                <div className="col-span-2">
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-right text-sm font-mono font-bold text-teal-700 outline-none focus:border-teal-400" 
                    value={line.credit || ''} 
                    onChange={e => updateLine(line.id!, { credit: parseFloat(e.target.value) || 0, debit: 0 })} 
                  />
                </div>

                {/* 5. System Link (Optional) */}
                <div className="col-span-2 space-y-2">
                  <select 
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold outline-none"
                    value={line.itemId}
                    onChange={e => updateLine(line.id!, { itemId: e.target.value })}
                  >
                    <option value="">No Item</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <select 
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold outline-none"
                    value={line.batchId}
                    onChange={e => updateLine(line.id!, { batchId: e.target.value })}
                  >
                    <option value="">No Batch</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Remove button absolute to not break grid */}
                <button 
                  type="button" 
                  onClick={() => removeLine(line.id!)} 
                  className="absolute -right-2 top-4 p-1.5 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover/row:opacity-100 bg-white shadow-sm border rounded-full"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            <button type="button" onClick={addLine} className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-teal-600 hover:bg-teal-50 rounded-xl transition-all border border-dashed border-teal-200 hover:border-teal-400"><Plus size={16} /> Add Grid Line</button>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center p-6 bg-slate-50 rounded-3xl border border-slate-200">
            <div className="flex gap-8">
              <div className="text-center md:text-left">
                 <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Total Assets/Exp</p>
                 <p className="text-xl font-mono font-semibold text-slate-700">{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center md:text-left">
                 <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Total Liab/Rev</p>
                 <p className="text-xl font-mono font-semibold text-slate-700">{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="flex gap-4">
                <div className="flex items-center border rounded-2xl overflow-hidden shadow-sm">
                   <div className={`px-4 py-3 text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isBalanced ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {isBalanced ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      {isBalanced ? 'Balanced' : 'Out of Balance'}
                   </div>
                   <div className={`px-4 py-3 text-xs font-black uppercase tracking-widest flex items-center gap-2 ${matchesControl ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                      {matchesControl ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      {matchesControl ? 'Matches Control' : 'Mismatch Control'}
                   </div>
                </div>

               <button type="button" onClick={onClose} className="px-8 py-3 text-sm font-semibold text-slate-500 hover:bg-white hover:text-slate-800 rounded-2xl border border-transparent hover:border-slate-200 transition-colors">Discard</button>
               <button type="submit" disabled={!canPost} className="px-10 py-3 bg-teal-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-teal-100 disabled:opacity-30 disabled:grayscale hover:bg-teal-700 active:scale-95 transition-all">
                  {entry.status === 'DRAFT' ? 'Authorize Transaction' : 'Post Transaction'}
               </button>
            </div>
          </div>
        </form>
    </div>
  );
};

export default JournalForm;
