import React, { useMemo, useState } from 'react';
import { Search, Printer, X } from 'lucide-react';
import { BankAccount, JournalEntry, JournalLine, Sponsor, Student } from '../types';
import { format } from 'date-fns';

interface ARCollectionReceiptViewProps {
  entries: JournalEntry[];
  lines: JournalLine[];
  bankAccounts: BankAccount[];
  students: Student[];
  sponsors: Sponsor[];
  currency: string;
}

const ARCollectionReceiptView: React.FC<ARCollectionReceiptViewProps> = ({
  entries, lines, bankAccounts, students, sponsors, currency
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<JournalEntry | null>(null);

  const collections = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return entries
      .filter(e => e.sourceType === 'COLLECTION' && e.status === 'POSTED')
      .filter(e =>
        (e.reference || '').toLowerCase().includes(term) ||
        (e.description || '').toLowerCase().includes(term)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, searchTerm]);

  const getPayerName = (entry: JournalEntry) => {
    const arLine = lines.find(l => l.journalEntryId === entry.id && l.contactId);
    if (!arLine?.contactId) return 'Unknown';
    if (arLine.contactType === 'SPONSOR') {
      return sponsors.find(s => s.id === arLine.contactId)?.name || 'Unknown Sponsor';
    }
    if (arLine.contactType === 'STUDENT') {
      const s = students.find(st => st.id === arLine.contactId);
      return s ? `${s.lastName}, ${s.firstName}` : 'Unknown Student';
    }
    return 'Unknown';
  };

  const getCollectionAmount = (entry: JournalEntry) => {
    const cashLine = lines.find(l => l.journalEntryId === entry.id && l.debit > 0);
    return cashLine?.debit || 0;
  };

  const getBankName = (entry: JournalEntry) => {
    const cashLine = lines.find(l => l.journalEntryId === entry.id && l.debit > 0);
    const bank = bankAccounts.find(b => b.glAccountId === cashLine?.accountId);
    return bank?.bankName || 'Treasury';
  };

  const formatCurrency = (val: number) =>
    `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Collection Receipt</h2>
        <p className="text-sm text-gray-500 font-normal italic">Review and print posted collection receipts.</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by OR / reference or payer..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-orange-400 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-500 font-medium">
          {collections.length} receipt{collections.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Receipt #</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Payer</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Bank</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {collections.length > 0 ? collections.map(coll => (
              <tr key={coll.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-5 text-xs font-mono font-bold text-gray-700">{coll.reference}</td>
                <td className="px-6 py-5 text-sm font-semibold text-gray-800">{getPayerName(coll)}</td>
                <td className="px-6 py-5 text-xs text-gray-600">{format(new Date(coll.date), 'yyyy-MM-dd')}</td>
                <td className="px-6 py-5 text-xs text-gray-600">{getBankName(coll)}</td>
                <td className="px-6 py-5 text-right text-xs font-mono font-semibold text-gray-900">{formatCurrency(getCollectionAmount(coll))}</td>
                <td className="px-6 py-5 text-right">
                  <button
                    onClick={() => setSelected(coll)}
                    className="px-3 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="py-20 text-center text-gray-400 italic">No collection receipts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:bg-white print:p-0">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-8 relative print:shadow-none print:border-none">
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 p-2 rounded hover:bg-gray-100 text-gray-400 print:hidden">
              <X size={18} />
            </button>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Official Receipt</h2>
                <p className="text-sm text-gray-500">Collection Receipt</p>
              </div>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 border border-gray-200 rounded hover:bg-gray-50 print:hidden"
              >
                <Printer size={14} /> Print
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Receipt No.</p>
                <p className="text-sm font-bold text-gray-800">{selected.reference}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
                <p className="text-sm font-bold text-gray-800">{format(new Date(selected.date), 'yyyy-MM-dd')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Received From</p>
                <p className="text-sm font-semibold text-gray-800">{getPayerName(selected)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Bank</p>
                <p className="text-sm font-semibold text-gray-800">{getBankName(selected)}</p>
              </div>
            </div>

            <div className="border rounded-md">
              <div className="grid grid-cols-3 text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-2 border-b bg-gray-50">
                <div>Description</div>
                <div className="text-right col-span-2">Amount</div>
              </div>
              <div className="grid grid-cols-3 px-4 py-4 text-sm text-gray-700">
                <div className="col-span-2">{selected.description}</div>
                <div className="text-right font-mono font-semibold text-gray-900">{formatCurrency(getCollectionAmount(selected))}</div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total Received</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(getCollectionAmount(selected))}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ARCollectionReceiptView;
