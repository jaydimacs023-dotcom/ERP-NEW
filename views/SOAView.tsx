import React, { useMemo, useState } from 'react';
import { Sponsor, JournalEntry, JournalLine, ChartOfAccount } from '../types';
import { ChevronDown, FileText, Filter, Mail, RotateCcw, Search, Users } from 'lucide-react';
import SponsorSOAView from './SponsorSOAView';

interface SOAViewProps {
  sponsors: Sponsor[];
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  currency: string;
  brandColor?: string;
}

type SponsorFilter = 'ALL' | 'WITH_EMAIL' | 'MISSING_EMAIL' | 'WITH_CONTACT';

const SOAView: React.FC<SOAViewProps> = ({
  sponsors,
  entries,
  lines,
  accounts,
  currency,
  brandColor = '#4f46e5'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [sponsorFilter, setSponsorFilter] = useState<SponsorFilter>('ALL');
  const [showSponsorFilterDropdown, setShowSponsorFilterDropdown] = useState(false);

  const filteredSponsors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sponsors.filter(sponsor => {
      if (sponsor.isDeleted) return false;

      const matchesSearch =
        !term ||
        sponsor.name.toLowerCase().includes(term) ||
        (sponsor.sponsorCode || '').toLowerCase().includes(term) ||
        (sponsor.contactPerson || '').toLowerCase().includes(term) ||
        (sponsor.email || '').toLowerCase().includes(term);

      const hasEmail = !!String(sponsor.email || '').trim();
      const hasContact = !!String(sponsor.contactPerson || '').trim();
      const matchesFilter =
        sponsorFilter === 'ALL' ||
        (sponsorFilter === 'WITH_EMAIL' && hasEmail) ||
        (sponsorFilter === 'MISSING_EMAIL' && !hasEmail) ||
        (sponsorFilter === 'WITH_CONTACT' && hasContact);

      return matchesSearch && matchesFilter;
    });
  }, [searchTerm, sponsorFilter, sponsors]);

  const summary = useMemo(() => {
    const activeSponsors = sponsors.filter(sponsor => !sponsor.isDeleted);
    return {
      total: activeSponsors.length,
      filtered: filteredSponsors.length,
      withEmail: activeSponsors.filter(sponsor => !!String(sponsor.email || '').trim()).length,
      withContact: activeSponsors.filter(sponsor => !!String(sponsor.contactPerson || '').trim()).length,
    };
  }, [filteredSponsors.length, sponsors]);

  const hasActiveFilters = searchTerm.trim().length > 0 || sponsorFilter !== 'ALL';
  const sponsorFilterLabel =
    sponsorFilter === 'ALL'
      ? 'All'
      : sponsorFilter === 'WITH_EMAIL'
        ? 'With Email'
        : sponsorFilter === 'MISSING_EMAIL'
          ? 'Missing Email'
          : 'With Contact';

  const clearFilters = () => {
    setSearchTerm('');
    setSponsorFilter('ALL');
    setShowSponsorFilterDropdown(false);
  };

  if (selectedSponsor) {
    return (
      <SponsorSOAView
        sponsor={selectedSponsor}
        entries={entries}
        lines={lines}
        accounts={accounts}
        currency={currency}
        brandColor={brandColor}
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Active Sponsors</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.total}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Visible Results</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.filtered}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">With Email</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>{summary.withEmail}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">With Contact Person</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.withContact}</p>
        </div>
      </div>

      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-72">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search sponsors..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative">
            <div
              onClick={() => setShowSponsorFilterDropdown(prev => !prev)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[220px]"
            >
              <span className="text-[13px] text-gray-500 mr-1 truncate">Filter:</span>
              <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">{sponsorFilterLabel}</span>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {showSponsorFilterDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSponsorFilterDropdown(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1">
                    {([
                      ['ALL', 'All Sponsors'],
                      ['WITH_EMAIL', 'With Email'],
                      ['MISSING_EMAIL', 'Missing Email'],
                      ['WITH_CONTACT', 'With Contact'],
                    ] as [SponsorFilter, string][]).map(([option, label]) => (
                      <button
                        key={option}
                        onClick={() => {
                          setSponsorFilter(option);
                          setShowSponsorFilterDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${
                          sponsorFilter === option ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        style={sponsorFilter === option ? { backgroundColor: brandColor } : undefined}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="p-2 text-gray-400 transition-colors"
            style={hasActiveFilters ? { color: brandColor } : undefined}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <Filter size={14} />
            <span>{filteredSponsors.length} record{filteredSponsors.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead style={{ backgroundColor: brandColor }}>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-white">Sponsor</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-white">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-white">Email</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-white">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSponsors.length > 0 ? filteredSponsors.map(sponsor => (
                <tr key={sponsor.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="text-sm font-bold text-gray-800">{sponsor.name}</div>
                    {sponsor.sponsorCode && (
                      <div className="mt-1 inline-flex items-center gap-2 text-xs font-mono font-semibold" style={{ color: brandColor }}>
                        <Users size={12} />
                        {sponsor.sponsorCode}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-600">
                    {sponsor.contactPerson ? (
                      <span>{sponsor.contactPerson}</span>
                    ) : (
                      <span className="italic text-gray-400">Not specified</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    {sponsor.email ? (
                      <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                        <Mail size={14} className="text-gray-400" />
                        {sponsor.email}
                      </div>
                    ) : (
                      <span className="italic text-sm text-gray-400">No email</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button
                      onClick={() => setSelectedSponsor(sponsor)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded transition-colors"
                      style={{ backgroundColor: brandColor }}
                    >
                      <FileText size={14} /> View SOA
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <FileText size={28} className="opacity-40" />
                      <p className="text-sm font-medium">No sponsors found for the current search and filter.</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-2 px-5 py-2 text-white rounded text-sm font-semibold transition-all"
                          style={{ backgroundColor: brandColor }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default SOAView;
