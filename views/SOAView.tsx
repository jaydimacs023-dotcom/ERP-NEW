import React, { useMemo, useState } from 'react';
import { Sponsor, JournalEntry, JournalLine, ChartOfAccount } from '../types';
import { Search, FileText } from 'lucide-react';
import SponsorSOAView from './SponsorSOAView';

interface SOAViewProps {
  sponsors: Sponsor[];
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  currency: string;
}

const SOAView: React.FC<SOAViewProps> = ({ sponsors, entries, lines, accounts, currency }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);

  const filteredSponsors = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return sponsors.filter(s =>
      !s.isDeleted &&
      (s.name.toLowerCase().includes(term) ||
        (s.sponsorCode || '').toLowerCase().includes(term) ||
        (s.contactPerson || '').toLowerCase().includes(term))
    );
  }, [sponsors, searchTerm]);

  if (selectedSponsor) {
    return (
      <SponsorSOAView
        sponsor={selectedSponsor}
        entries={entries}
        lines={lines}
        accounts={accounts}
        currency={currency}
        onClose={() => setSelectedSponsor(null)}
      />
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Statement of Account (SOA)</h2>
          <p className="text-sm text-gray-500 font-normal italic">
            Generate customer statements based on posted AR activity.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search sponsors by name, code, or contact..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded focus:border-brand outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-500 font-medium">
          {filteredSponsors.length} sponsor{filteredSponsors.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Sponsor</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredSponsors.length > 0 ? filteredSponsors.map(sponsor => (
              <tr key={sponsor.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-5">
                  <div className="text-sm font-bold text-gray-800">{sponsor.name}</div>
                  {sponsor.sponsorCode && (
                    <div className="text-xs text-brand font-mono mt-0.5">{sponsor.sponsorCode}</div>
                  )}
                </td>
                <td className="px-6 py-5 text-sm text-gray-600">
                  {sponsor.contactPerson || <span className="italic text-gray-400">Not specified</span>}
                </td>
                <td className="px-6 py-5 text-sm text-gray-600">
                  {sponsor.email || <span className="italic text-gray-400">No email</span>}
                </td>
                <td className="px-6 py-5 text-right">
                  <button
                    onClick={() => setSelectedSponsor(sponsor)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-brand border border-brand-light rounded hover:bg-brand-light transition-colors"
                  >
                    <FileText size={14} /> View SOA
                  </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="py-20 text-center text-gray-400 italic">No sponsors found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default SOAView;




