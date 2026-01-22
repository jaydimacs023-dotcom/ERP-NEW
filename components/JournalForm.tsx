
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChartOfAccount, Student, Trainer, Sponsor, Batch, NonStockItem,
  JournalEntryLine, JournalEntry, AccountClass 
} from '../types';
import { AccountingService } from '../accountingService';
import { X, Plus, Trash2, AlertCircle, Save, CheckCircle2, User, GraduationCap, Handshake, Layers, Box } from 'lucide-react';

interface JournalFormProps {
  accounts: ChartOfAccount[];
  students: Student[];
  trainers: Trainer[];
  sponsors: Sponsor[];
  batches: Batch[];
  items: NonStockItem[];
  entries: JournalEntry[];
  onSubmit: (entry: Partial<JournalEntry>, lines: JournalEntryLine[]) => void;
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
    status: 'POSTED'
  });

  useEffect(() => {
    const nextRef = AccountingService.getNextReference(entries, 'JV');
    setEntry(prev => ({ ...prev, reference: nextRef }));
  }, [entries]);

  const [lines, setLines] = useState<Partial<JournalEntryLine>[]>([
    { id: '1', accountId: '', debit: 0, credit: 0, contactId: '', contactType: 'OTHER', batchId: '', itemId: '' },
    { id: '2', accountId: '', debit: 0, credit: 0, contactId: '', contactType: 'OTHER', batchId: '', itemId: '' }
  ]);

  const totalDebit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0), [lines]);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

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

  const updateLine = (id: string, updates: Partial<JournalEntryLine>) => {
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
    if (!isBalanced) return;

    const entryId = `je-${Date.now()}`;
    const finalizedLines: JournalEntryLine[] = lines.map(l => ({
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[95%] overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><Save size={20} /></div>
            <h3 className="text-xl font-semibold text-slate-800 uppercase tracking-tight">Post Transaction (Journal Voucher)</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Transaction Date</label>
              <input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={entry.date} onChange={e => setEntry({...entry, date: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Voucher Ref (Sequential)</label>
              <input readOnly className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-black text-indigo-600 font-mono" value={entry.reference} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Journal Memo / Header</label>
              <input required placeholder="e.g. Correction of Depreciation" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={entry.description} onChange={e => setEntry({...entry, description: e.target.value})} />
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-12 gap-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              <div className="col-span-2">Item Tag</div>
              <div className="col-span-2">Batch Link</div>
              <div className="col-span-3">Account & Entity</div>
              <div className="col-span-2 text-right">Debit</div>
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-1"></div>
            </div>

            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-12 gap-3 items-start p-4 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors shadow-sm">
                
                <div className="col-span-2">
                  <select 
                    className="w-full px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] font-bold text-indigo-700 outline-none"
                    value={line.itemId}
                    onChange={e => updateLine(line.id!, { itemId: e.target.value })}
                  >
                    <option value="">Manual Entry</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <select 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold outline-none appearance-none"
                    value={line.batchId}
                    onChange={e => updateLine(line.id!, { batchId: e.target.value })}
                  >
                    <option value="">No Batch</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-3 space-y-2">
                  <select required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none" value={line.accountId} onChange={e => updateLine(line.id!, { accountId: e.target.value })}>
                    <option value="">Account Title...</option>
                    {accounts.filter(a => !a.isHeader).map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                  </select>

                  <div className="flex gap-2">
                    <select className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-bold uppercase" value={line.contactType} onChange={e => updateLine(line.id!, { contactType: e.target.value as any, contactId: '' })}>
                      <option value="OTHER">Other</option>
                      <option value="STUDENT">Student</option>
                      <option value="SPONSOR">Sponsor</option>
                    </select>
                    
                    <select className="flex-1 px-3 py-1.5 bg-white border border-indigo-100 rounded-lg text-[10px] font-medium" value={line.contactId} onChange={e => updateLine(line.id!, { contactId: e.target.value })}>
                      <option value="">Select Entity...</option>
                      {line.contactType === 'STUDENT' && students.map(s => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}
                      {line.contactType === 'SPONSOR' && sponsors.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="col-span-2">
                  <input type="number" step="0.01" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-right text-sm font-mono font-medium" value={line.debit || ''} onChange={e => updateLine(line.id!, { debit: parseFloat(e.target.value) || 0, credit: 0 })} />
                </div>

                <div className="col-span-2">
                  <input type="number" step="0.01" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-right text-sm font-mono font-medium" value={line.credit || ''} onChange={e => updateLine(line.id!, { credit: parseFloat(e.target.value) || 0, debit: 0 })} />
                </div>

                <div className="col-span-1 flex justify-center pt-2">
                  <button type="button" onClick={() => removeLine(line.id!)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}

            <button type="button" onClick={addLine} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"><Plus size={16} /> Split Entry Row</button>
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
               {isBalanced ? (
                 <div className="flex items-center gap-2 text-emerald-600 px-4">
                   <CheckCircle2 size={24} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Balanced Voucher</span>
                 </div>
               ) : (
                 <div className="flex items-center gap-2 text-amber-500 px-4">
                   <AlertCircle size={24} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Unbalanced</span>
                 </div>
               )}
               <button type="button" onClick={onClose} className="px-8 py-3 text-sm font-semibold text-slate-500 hover:bg-white rounded-2xl border border-transparent hover:border-slate-200">Discard</button>
               <button type="submit" disabled={!isBalanced} className="px-10 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold shadow-xl shadow-indigo-100 disabled:opacity-50 hover:bg-indigo-700 active:scale-95 transition-all">Post Journal</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JournalForm;
