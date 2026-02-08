
import React, { useState } from 'react';
import { 
  ChartOfAccount, JournalEntry, JournalLine, Student, 
  Trainer, Sponsor, Batch, NonStockItem 
} from '../types';
import { Search, Filter, RotateCcw, BookText, Plus, Database, ArrowRight } from 'lucide-react';
import JournalForm from '../components/JournalForm';

interface LedgerProps {
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  students: Student[];
  sponsors: Sponsor[];
  trainers: Trainer[];
  batches: Batch[];
  items: NonStockItem[];
  currentUser?: any;
  onPostEntry?: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onApproveJournal?: (entryId: string) => void;
  onReverseJournal?: (entryId: string) => void;
}

const Ledger: React.FC<LedgerProps> = ({ 
  accounts, entries, lines, students, sponsors, trainers, batches, items, 
  currentUser, onPostEntry, onApproveJournal, onReverseJournal 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEntryForm, setShowEntryForm] = useState(false);

  const filteredEntries = entries.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Journal Entries</h2>
          <p className="text-sm font-normal italic text-slate-500">Complete transactional audit history and manual double-entry postings.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Filter by ref or memo..." 
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 transition-all font-bold text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowEntryForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-teal-200 hover:bg-teal-700 transition-all active:scale-95 shrink-0"
          >
            <Plus size={18} /> New Entry
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Anchor</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Memo / Source</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Account Detail</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Debit</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Credit</th>
                <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEntries.map(entry => {
                const entryLines = lines.filter(l => l.journalEntryId === entry.id);
                return (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap align-top">
                      <div className="text-sm font-black text-slate-700">{entry.date}</div>
                      <div className="text-[10px] text-teal-600 font-mono font-black mt-1 uppercase tracking-tighter">{entry.reference}</div>
                    </td>
                    <td className="px-8 py-6 align-top">
                      <div className="text-sm font-bold text-slate-800 line-clamp-1">{entry.description}</div>
                      <div className="text-[9px] text-slate-400 font-black uppercase mt-1.5 flex items-center gap-1.5">
                         <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                         {entry.sourceType}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-2">
                        {entryLines.map(line => {
                          const acc = accounts.find(a => a.id === line.accountId);
                          return (
                            <div key={line.id} className="text-xs font-bold flex items-center gap-2">
                              {line.credit > 0 && <ArrowRight size={10} className="text-slate-300 ml-4" />}
                              <span className={line.credit > 0 ? 'text-slate-500 italic' : 'text-slate-700'}>
                                {acc?.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right align-top">
                      {entryLines.map(line => (
                        <div key={line.id} className="text-xs font-mono h-4 mb-2 text-slate-600 font-black">
                          {line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                        </div>
                      ))}
                    </td>
                    <td className="px-8 py-6 text-right align-top">
                      {entryLines.map(line => (
                        <div key={line.id} className="text-xs font-mono h-4 mb-2 text-slate-600 font-black">
                          {line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                        </div>
                      ))}
                    </td>
                    <td className="px-8 py-6 text-center align-top">
                      <div className="flex flex-col items-center gap-2">
                        <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase border tracking-widest ${
                          entry.status === 'POSTED' ? 'bg-teal-50 text-teal-600 border-teal-100' : 
                          entry.status === 'REVERSED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          'bg-amber-50 text-teal-600 border-amber-100 animate-pulse'
                        }`}>
                          {entry.status || 'DRAFT'}
                        </span>
                        {entry.status === 'DRAFT' && (currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN') && (
                          <button
                            onClick={() => onApproveJournal?.(entry.id)}
                            className="px-2 py-1 bg-teal-600 text-white text-[8px] font-black uppercase rounded shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all active:scale-95"
                          >
                            Approve
                          </button>
                        )}
                        {entry.status === 'POSTED' && !entry.description.startsWith('REV:') && (
                          <button 
                            onClick={() => onReverseJournal?.(entry.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Post Reversal"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredEntries.length === 0 && (
          <div className="py-32 text-center bg-slate-50/50">
            <div className="p-6 bg-white rounded-[2rem] shadow-xl inline-block mb-6 border border-slate-100">
               <BookText size={48} className="text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">No Journal Records</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto italic font-medium">The ledger is currently empty. Direct manual entries or system-generated receipts will appear here once posted.</p>
            <button 
              onClick={() => setShowEntryForm(true)}
              className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all"
            >
               Create First Entry
            </button>
          </div>
        )}
      </div>

      {showEntryForm && (
        <JournalForm 
          accounts={accounts}
          students={students}
          trainers={trainers}
          sponsors={sponsors}
          batches={batches}
          items={items}
          entries={entries}
          onClose={() => setShowEntryForm(false)}
          onSubmit={(entry, lines) => {
            onPostEntry?.(entry, lines);
            setShowEntryForm(false);
          }}
        />
      )}
    </div>
  );
};

export default Ledger;
