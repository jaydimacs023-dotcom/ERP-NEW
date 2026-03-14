
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
  initialSearchTerm?: string;
}

const Ledger: React.FC<LedgerProps> = ({
  accounts, entries, lines, students, sponsors, trainers, batches, items,
  currentUser, onPostEntry, onApproveJournal, onReverseJournal,
  initialSearchTerm = ''
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [showEntryForm, setShowEntryForm] = useState(false);

  const filteredEntries = entries.filter(e =>
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.glEntryNumber && e.glEntryNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Journal Entries</h2>
          <p className="text-sm font-normal italic text-gray-500">Complete transactional audit history and manual double-entry postings.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Filter by ref or memo..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded outline-none focus:ring-2 focus:ring-orange-400/20 transition-all font-bold text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowEntryForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#F47721] text-white rounded font-semibold text-xs uppercase tracking-wide shadow-sm shadow-gray-200 hover:bg-[#E06610] transition-all active:scale-95 shrink-0"
          >
            <Plus size={18} /> New Entry
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-8 py-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">GL Entry # / Date</th>
                <th className="px-8 py-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Memo / Source</th>
                <th className="px-8 py-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Account Detail</th>
                <th className="px-8 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Debit</th>
                <th className="px-8 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Credit</th>
                <th className="px-8 py-5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-8 py-5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredEntries.map(entry => {
                const entryLines = lines.filter(l => l.journalEntryId === entry.id);
                return (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap align-top">
                      <div className="text-sm font-semibold text-gray-700">{entry.date}</div>
                      <div className="text-xs text-[#F47721] font-mono font-semibold mt-1 uppercase tracking-tighter">
                        {(entry.glEntryNumber || entry.reference)?.trim()}
                      </div>
                      {entry.glEntryNumber && entry.reference && (
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Ref: {entry.reference}</div>
                      )}
                    </td>
                    <td className="px-8 py-6 align-top">
                      <div className="text-sm font-bold text-gray-800 line-clamp-1">{entry.description}</div>
                      <div className="text-xs text-gray-400 font-semibold uppercase mt-1.5 flex items-center gap-1.5">
                        <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                        {entry.sourceType}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-2">
                        {entryLines.map(line => {
                          const acc = accounts.find(a => a.id === line.accountId);
                          const accountName = acc?.name || (line.accountId ? `[ID: ${line.accountId.slice(0, 8)}]` : 'Unknown Account');
                          return (
                            <div key={line.id} className="text-xs font-bold flex items-center gap-2">
                              {line.credit > 0 && <ArrowRight size={10} className="text-gray-300 ml-4" />}
                              <span className={line.credit > 0 ? 'text-gray-500 italic' : 'text-gray-700'}>
                                {accountName}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right align-top">
                      {entryLines.map(line => (
                        <div key={line.id} className="text-xs font-mono h-4 mb-2 text-gray-600 font-semibold">
                          {line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                        </div>
                      ))}
                    </td>
                    <td className="px-8 py-6 text-right align-top">
                      {entryLines.map(line => (
                        <div key={line.id} className="text-xs font-mono h-4 mb-2 text-gray-600 font-semibold">
                          {line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                        </div>
                      ))}
                    </td>
                    <td className="px-8 py-6 text-center align-top">
                      <div className="flex flex-col items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded uppercase border tracking-wide ${entry.status === 'POSTED' ? 'bg-orange-50 text-[#F47721] border-orange-100' :
                          entry.status === 'REVERSED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            'bg-amber-50 text-[#F47721] border-amber-100 animate-pulse'
                          }`}>
                          {entry.status || 'DRAFT'}
                        </span>
                        {entry.status === 'DRAFT' && (currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN') && (
                          <button
                            onClick={() => onApproveJournal?.(entry.id)}
                            className="px-2 py-1 bg-[#F47721] text-white text-xs font-semibold uppercase rounded shadow-lg shadow-gray-100 hover:bg-[#E06610] transition-all active:scale-95"
                          >
                            Approve
                          </button>
                        )}
                        {entry.status === 'POSTED' && !entry.description.startsWith('REV:') && (
                          <button
                            onClick={() => onReverseJournal?.(entry.id)}
                            className="p-1.5 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
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
          <div className="py-16 text-center bg-gray-50">
            <div className="p-6 bg-white rounded shadow-sm inline-block mb-6 border border-gray-100">
              <BookText size={48} className="text-gray-200" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 uppercase tracking-tight">No Journal Records</h3>
            <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto italic font-medium">The ledger is currently empty. Direct manual entries or system-generated receipts will appear here once posted.</p>
            <button
              onClick={() => setShowEntryForm(true)}
              className="mt-8 px-8 py-3 bg-gray-800 text-white rounded text-xs font-semibold uppercase tracking-wide shadow-md active:scale-95 transition-all"
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

