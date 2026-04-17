import React, { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Sponsor, Student, JournalEntry, JournalLine, ChartOfAccount, AccountClass } from '../types';

interface ARAgingReportViewProps {
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  students: Student[];
  sponsors: Sponsor[];
  currency: string;
  
}

const ARAgingReportView: React.FC<ARAgingReportViewProps> = ({
  entries, lines, accounts, students, sponsors, currency, 
}) => {
  const [agingAsOf, setAgingAsOf] = useState(new Date().toISOString().split('T')[0]);

  const formatCurrency = (val: number) =>
    `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const agingReport = useMemo(() => {
    const targetAccounts = accounts.filter(a =>
      a.class === AccountClass.ASSET &&
      (a.name || '').toLowerCase().includes('receivable')
    );
    const targetIds = new Set(targetAccounts.map(a => a.id));

    // ONLY POSTED entries for aging
    const targetEntries = entries.filter(e => e.date <= agingAsOf && e.status === 'POSTED');
    const targetEntryIds = new Set(targetEntries.map(e => e.id));
    const targetLines = lines.filter(l =>
      targetEntryIds.has(l.journalEntryId) &&
      targetIds.has(l.accountId) &&
      l.contactId
    );

    const referenceDate = new Date(agingAsOf);
    const buckets: Record<string, {
      name: string;
      total: number;
      current: number;
      thirty: number;
      sixty: number;
      ninety: number;
      type: string;
    }> = {};

    targetLines.forEach(line => {
      const entry = targetEntries.find(e => e.id === line.journalEntryId);
      if (!entry) return;
      const contactKey = line.contactId!;
      if (!buckets[contactKey]) {
        let name = 'Unknown Contact';
        let type = line.contactType || 'OTHER';
        if (line.contactType === 'STUDENT') {
          const s = students.find(x => x.id === contactKey);
          name = s ? `${s.lastName}, ${s.firstName}` : `Student: ${contactKey}`;
        } else if (line.contactType === 'SPONSOR') {
          const sp = sponsors.find(s => s.id === contactKey);
          name = sp ? sp.name : `Sponsor: ${contactKey}`;
        }
        buckets[contactKey] = { name, total: 0, current: 0, thirty: 0, sixty: 0, ninety: 0, type };
      }
      const diffTime = Math.abs(referenceDate.getTime() - new Date(entry.date).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const val = line.debit - line.credit;
      buckets[contactKey].total += val;
      if (diffDays <= 30) buckets[contactKey].current += val;
      else if (diffDays <= 60) buckets[contactKey].thirty += val;
      else if (diffDays <= 90) buckets[contactKey].sixty += val;
      else buckets[contactKey].ninety += val;
    });

    return Object.values(buckets).filter(b => Math.abs(b.total) > 0.01);
  }, [agingAsOf, lines, entries, accounts, students, sponsors]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#025959]/10 text-[#025959] rounded"><Calendar size={20} /></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Effective Aging Date</p>
            <input
              type="date"
              className="bg-transparent border-none outline-none font-bold text-gray-800 text-lg p-0 focus:ring-0"
              value={agingAsOf}
              onChange={e => setAgingAsOf(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead >
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Debtor Identity</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Current (0-30)</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">31 - 60 Days</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">61 - 90 Days</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-rose-500 uppercase tracking-wide">Over 90 Days</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-900 uppercase tracking-wide">Total Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {agingReport.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-5 text-sm font-bold text-gray-800">{row.name}</td>
                <td className="px-6 py-5 text-right font-mono text-xs text-[#025959] font-bold">{formatCurrency(row.current)}</td>
                <td className="px-6 py-5 text-right font-mono text-xs text-[#025959]">{formatCurrency(row.thirty)}</td>
                <td className="px-6 py-5 text-right font-mono text-xs text-[#025959]">{formatCurrency(row.sixty)}</td>
                <td className="px-6 py-5 text-right font-mono text-xs text-rose-600 font-bold bg-rose-50/20">{formatCurrency(row.ninety)}</td>
                <td className="px-6 py-5 text-right font-mono text-sm font-semibold text-gray-900">{formatCurrency(row.total)}</td>
              </tr>
            ))}
            {agingReport.length === 0 && (
              <tr><td colSpan={6} className="py-20 text-center text-gray-400 italic">No outstanding receivables found as of this date.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ARAgingReportView;

