import React, { useState } from 'react';
import { ChartOfAccount, JournalEntry, JournalEntryLine } from '../types';
import { Search, Filter, RotateCcw, BookText } from 'lucide-react';

interface LedgerProps {
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  lines: JournalEntryLine[];
  onReverseJournal?: (entryId: string) => void;
}

const Ledger: React.FC<LedgerProps> = ({ accounts, entries, lines, onReverseJournal }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = entries.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-medium text-slate-800">General Ledger</h2>
          <p className="text-sm text-slate-400">Complete transactional audit history.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search history..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-600 border rounded-lg bg-white transition-colors"><Filter size={18} /></button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-normal text-slate-400 uppercase tracking-wider">Date / Ref</th>
                <th className="px-6 py-3 text-left text-[11px] font-normal text-slate-400 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-[11px] font-normal text-slate-400 uppercase tracking-wider">Accounts</th>
                <th className="px-6 py-3 text-right text-[11px] font-normal text-slate-400 uppercase tracking-wider">Debit</th>
                <th className="px-6 py-3 text-right text-[11px] font-normal text-slate-400 uppercase tracking-wider">Credit</th>
                <th className="px-6 py-3 text-center text-[11px] font-normal text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-[11px] font-normal text-slate-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...filteredEntries].reverse().map(entry => {
                const entryLines = lines.filter(l => l.journalEntryId === entry.id);
                return (
                  <tr key={entry.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-normal text-slate-700">{entry.date}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{entry.reference}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 max-w-xs truncate">{entry.description}</div>
                      <div className="text-[9px] text-slate-400 uppercase mt-0.5">{entry.sourceType}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        {entryLines.map(line => {
                          const acc = accounts.find(a => a.id === line.accountId);
                          return (
                            <div key={line.id} className="text-xs font-normal">
                              <span className={line.credit > 0 ? 'pl-4 text-slate-400' : 'text-slate-600'}>
                                {acc?.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right align-top">
                      {entryLines.map(line => (
                        <div key={line.id} className="text-xs h-4 mb-1.5 text-slate-500 font-normal">
                          {line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                        </div>
                      ))}
                    </td>
                    <td className="px-6 py-4 text-right align-top">
                      {entryLines.map(line => (
                        <div key={line.id} className="text-xs h-4 mb-1.5 text-slate-500 font-normal">
                          {line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                        </div>
                      ))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 text-[9px] font-normal rounded border ${
                        entry.status === 'POSTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                      }`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {entry.status === 'POSTED' && !entry.description.startsWith('REV:') && (
                        <button 
                          onClick={() => onReverseJournal?.(entry.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredEntries.length === 0 && (
          <div className="py-16 text-center">
            <BookText size={32} className="mx-auto text-slate-200 mb-2" />
            <p className="text-sm text-slate-400 italic">No entries match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Ledger;
