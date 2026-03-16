
import React, { useState } from 'react';
import {
  ChartOfAccount, JournalEntry, JournalLine, Student,
  Trainer, Sponsor, Batch, NonStockItem
} from '../types';
import { Search, Filter, RotateCcw, BookText, Plus, Database, X } from 'lucide-react';
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
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const filteredEntries = entries.filter(e =>
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.glEntryNumber && e.glEntryNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {!showEntryForm && !selectedEntry && (
        <>
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

      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr className="bg-slate-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Memo / Source</div>
              </th>
              <th className="px-4 py-3 text-left">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</div>
              </th>
              <th className="px-4 py-3 text-left">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">GL Reference No.</div>
              </th>
              <th className="px-4 py-3 text-left">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Description</div>
              </th>
              <th className="px-4 py-3 text-right">
                <div className="flex items-center justify-end text-[11px] font-bold text-gray-500 uppercase tracking-wider">Transaction Total</div>
              </th>
              <th className="px-4 py-3 text-center">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</div>
              </th>
              <th className="px-4 py-3 text-left">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Created By</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  <div className="p-6 bg-white rounded shadow-sm inline-block mb-4 border border-gray-100">
                    <BookText size={48} className="text-gray-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">No Journal Records</h3>
                    <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto italic font-medium">The ledger is currently empty. Manual entries or system-generated records will appear here once posted.</p>
                    <button
                      onClick={() => setShowEntryForm(true)}
                      className="mt-6 px-8 py-3 bg-gray-800 text-white rounded text-xs font-semibold uppercase tracking-wide shadow-md active:scale-95 transition-all"
                    >
                      Create First Entry
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEntries.map(entry => {
                const entryLines = lines.filter(l => l.journalEntryId === entry.id);
                const controlTotal = entryLines.reduce((sum, l) => sum + (l.debit || 0), 0);

                return (
                  <tr 
                    key={entry.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0"></div>
                        <span className="text-xs text-gray-500 font-semibold uppercase">{entry.sourceType}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-700">{entry.date}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#F47721] font-mono font-semibold uppercase tracking-tighter">
                        {(entry.glEntryNumber || entry.reference)?.trim() || '—'}
                      </span>
                      {entry.glEntryNumber && entry.reference && (
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Ref: {entry.reference}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-gray-800 line-clamp-2">{entry.description}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-gray-800">
                        {controlTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wide ${
                          entry.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' :
                          entry.status === 'REVERSED' ? 'bg-rose-100 text-rose-600' :
                          entry.status === 'REVISION_REQUESTED' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {entry.status || 'DRAFT'}
                        </span>
                        {entry.status === 'DRAFT' && (currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onApproveJournal?.(entry.id); }}
                            className="px-2 py-1 bg-[#F47721] text-white text-xs font-semibold uppercase rounded shadow-sm hover:bg-[#E06610] transition-all active:scale-95"
                          >
                            Approve
                          </button>
                        )}
                        {entry.status === 'POSTED' && !entry.description.startsWith('REV:') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onReverseJournal?.(entry.id); }}
                            className="p-1 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Post Reversal"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{entry.createdBy || '—'}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

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

      {selectedEntry && (
        <JournalEntryDetail
          entry={selectedEntry}
          lines={lines.filter(l => l.journalEntryId === selectedEntry.id)}
          accounts={accounts}
          onClose={() => setSelectedEntry(null)}
          onApprove={onApproveJournal}
          onReverse={onReverseJournal}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

// --- Sub-component for Detail View ---
interface JournalEntryDetailProps {
  entry: JournalEntry;
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReverse?: (id: string) => void;
  currentUser?: any;
}

const JournalEntryDetail: React.FC<JournalEntryDetailProps> = ({ 
  entry, lines, accounts, onClose, onApprove, onReverse, currentUser 
}) => {
  const controlTotal = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  
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
            <div className="p-2 bg-[#F47721] text-white rounded-xl shadow-md font-bold text-xs">VOUCHER</div>
            <div>
               <h3 className="text-lg font-bold text-slate-800 tracking-tight">Journal Entry Details</h3>
               <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{entry.reference}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Header Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <DetailItem label="Memo / Source" value={entry.description} icon={<BookText size={14} />} />
            <DetailItem label="Transaction Date" value={entry.date} />
            <DetailItem label="GL Reference" value={(entry.glEntryNumber || entry.reference || '—')} highlight />
            <DetailItem label="Source Type" value={entry.sourceType} />
            <DetailItem label="Transaction Total" value={controlTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mono />
            <DetailItem label="Status" value={
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                entry.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' :
                entry.status === 'REVERSED' ? 'bg-rose-100 text-rose-600' :
                'bg-blue-100 text-blue-700'
              }`}>
                {entry.status || 'DRAFT'}
              </span>
            } />
            <DetailItem label="Created By" value={entry.createdBy || 'System'} />
            <DetailItem label="Entry ID" value={entry.id} muted />
          </div>

          {/* Lines Table */}
          <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-32">Account Code</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Account Title</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Memo</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 w-32">Debit</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 w-32">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => {
                  const acc = accounts.find(a => a.id === line.accountId);
                  return (
                    <tr key={line.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{acc?.code}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{acc?.name}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs text-slate-600 italic line-clamp-1">{line.memo || '—'}</div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-mono font-bold text-slate-700">
                          {line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-mono font-bold text-slate-700">
                          {line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 font-black">
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={3} className="px-5 py-4 text-xs uppercase tracking-widest text-slate-400">Total Voucher Value</td>
                  <td className="px-5 py-4 text-right font-mono text-sm text-slate-900 underline decoration-slate-300 decoration-2 underline-offset-4">
                    {controlTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm text-slate-900 underline decoration-slate-300 decoration-2 underline-offset-4">
                    {lines.reduce((sum, l) => sum + (l.credit || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action Footer */}
          <div className="flex justify-between items-center bg-slate-50 -m-8 mt-4 p-8 border-t">
            <div className="flex gap-2">
               <button className="px-5 py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all text-slate-600 uppercase tracking-wide shadow-sm" onClick={() => window.print()}>Print Voucher</button>
            </div>
            <div className="flex gap-4">
               {entry.status === 'DRAFT' && (currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN') && (
                  <button onClick={() => { onApprove?.(entry.id); onClose(); }} className="px-10 py-3 bg-[#F47721] text-white rounded-2xl text-sm font-bold shadow-xl shadow-orange-100 hover:bg-[#E06610] active:scale-95 transition-all">Authorize Posting</button>
               )}
               {entry.status === 'POSTED' && !entry.description.startsWith('REV:') && (
                 <button onClick={() => { onReverse?.(entry.id); onClose(); }} className="px-10 py-3 bg-rose-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-rose-100 hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-2">
                    <RotateCcw size={16} /> Post Reversal
                 </button>
               )}
               <button onClick={onClose} className="px-8 py-3 bg-slate-800 text-white rounded-2xl text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-900 active:scale-95 transition-all">Back to List</button>
            </div>
          </div>
        </div>
    </div>
  );
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode; highlight?: boolean; mono?: boolean; muted?: boolean }> = ({ 
  label, value, icon, highlight, mono, muted 
}) => (
  <div className="space-y-1">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
      {icon} {label}
    </p>
    <p className={`text-sm font-bold ${highlight ? 'text-[#F47721] cursor-default' : 'text-slate-800'} ${mono ? 'font-mono' : ''} ${muted ? 'text-slate-400 text-[11px]' : ''}`}>
      {value}
    </p>
  </div>
);

export default Ledger;

