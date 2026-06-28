import React, { useState, useMemo } from 'react';
import { Sponsor, SponsoredCourseFeeType, ChartOfAccount, TaxType, JournalEntry, JournalLine } from '../types';
import SponsorSOAView from './SponsorSOAView';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter } from '../services/IDataService';
import { 
  Search, Plus, Handshake, Mail, Phone, User, Trash2, X, 
  Building, Edit2, Loader2, CheckCircle, AlertCircle, MapPin,
  BookOpen, FileText, Receipt, Percent, Hash, ChevronDown, RotateCcw
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface SponsorsViewProps {
  orgId: string;
  sponsors: Sponsor[];
  accounts?: ChartOfAccount[];
  entries?: JournalEntry[];
  lines?: JournalLine[];
  currency?: string;
  onAddSponsor: (sponsor: Sponsor) => void | Promise<void>;
  onUpdateSponsor: (sponsor: Sponsor) => void | Promise<void>;
  onDeleteSponsor: (id: string) => void | Promise<boolean>;
}

const PAGE_SIZE = 10;
const SPONSOR_COLUMNS = 'id,org_id,sponsor_code,name,contact_person,email,phone,address,tin,tax_type,ewt_rate,ar_account_id,course_fee_type,created_at,updated_at,is_deleted,deleted_at,deleted_by';

const getNextSponsorCode = (sponsorRecords: Sponsor[]) => {
  const highest = sponsorRecords.reduce<{ prefix: string; number: number; width: number } | null>((current, sponsor) => {
    const code = (sponsor.sponsorCode || '').trim();
    const match = code.match(/^(.*?)(\d+)$/);
    if (!match) return current;

    const number = Number.parseInt(match[2], 10);
    if (Number.isNaN(number)) return current;
    if (!current || number > current.number) {
      return { prefix: match[1], number, width: match[2].length };
    }
    return current;
  }, null);

  if (!highest) return 'SP-001';

  return `${highest.prefix}${String(highest.number + 1).padStart(Math.max(highest.width, 3), '0')}`;
};

const SponsorsView: React.FC<SponsorsViewProps> = ({ 
  orgId, sponsors, accounts = [], entries = [], lines = [], currency = '?', onAddSponsor, onUpdateSponsor, onDeleteSponsor 
}) => {
  const [showSOAFor, setShowSOAFor] = useState<Sponsor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [taxTypeFilter, setTaxTypeFilter] = useState<TaxType | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [serverSponsors, setServerSponsors] = useState<Sponsor[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoadError, setPageLoadError] = useState('');

  const [formData, setFormData] = useState<Partial<Sponsor>>({
    sponsorCode: '',
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    tin: '',
    taxType: undefined,
    ewtRate: undefined,
    arAccountId: '',
    courseFeeType: 'SPONSORED'
  });

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, orgId, taxTypeFilter]);

  const sponsorFilters = useMemo(() => {
    const filters: PageFilter[] = [];
    if (orgId) {
      filters.push({ column: 'org_id', operator: 'eq', value: orgId });
    }
    filters.push({ column: 'is_deleted', operator: 'eq', value: false });
    if (taxTypeFilter !== 'ALL') {
      filters.push({ column: 'tax_type', operator: 'eq', value: taxTypeFilter });
    }
    return filters;
  }, [orgId, taxTypeFilter]);

  React.useEffect(() => {
    if (!orgId) return;

    let isActive = true;
    setIsLoadingPage(true);
    setPageLoadError('');

    DataServiceFactory.getService().fetchPage<Sponsor>('sponsors', {
      page: currentPage,
      pageSize: PAGE_SIZE,
      columns: SPONSOR_COLUMNS,
      filters: sponsorFilters,
      search: debouncedSearchTerm.trim()
        ? {
          columns: ['name', 'sponsor_code', 'contact_person', 'email', 'phone', 'tin', 'address'],
          term: debouncedSearchTerm
        }
        : undefined,
      orderBy: [{ column: 'name', ascending: true }]
    })
      .then(result => {
        if (!isActive) return;
        setServerSponsors(result.rows);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[SponsorsView] Failed to load sponsor page:', error);
        setPageLoadError(error instanceof Error ? error.message : 'Failed to load sponsors.');
        setServerSponsors([]);
        setServerTotal(0);
        setServerTotalPages(1);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingPage(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [currentPage, debouncedSearchTerm, orgId, refreshKey, sponsorFilters]);

  const filteredSponsors = useMemo(() => {
    const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();

    return sponsors
      .filter(s => {
        if (s.isDeleted) return false;

        const searchableText = [
          s.name,
          s.sponsorCode || '',
          s.contactPerson || '',
          s.email || '',
          s.phone || '',
          s.tin || '',
          s.address || '',
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesTaxType = taxTypeFilter === 'ALL' || s.taxType === taxTypeFilter;

        return matchesSearch && matchesTaxType;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sponsors, debouncedSearchTerm, taxTypeFilter]);

  const {
    currentPage: fallbackCurrentPage,
    totalPages: fallbackTotalPages,
    pageStartIndex: fallbackPageStartIndex,
    pageEndIndex: fallbackPageEndIndex,
    paginatedRows: fallbackPaginatedSponsors,
    setCurrentPage: setFallbackCurrentPage
  } = usePaginatedRows(filteredSponsors, [debouncedSearchTerm, taxTypeFilter], PAGE_SIZE);

  const useFallbackRows = !orgId || !!pageLoadError;
  const paginatedSponsors = useFallbackRows ? fallbackPaginatedSponsors : serverSponsors;
  const totalItems = useFallbackRows ? filteredSponsors.length : serverTotal;
  const totalPages = useFallbackRows ? fallbackTotalPages : serverTotalPages;
  const activePage = useFallbackRows ? fallbackCurrentPage : currentPage;
  const pageStartIndex = useFallbackRows ? fallbackPageStartIndex : (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = useFallbackRows ? fallbackPageEndIndex : Math.min(pageStartIndex + serverSponsors.length, serverTotal);
  const handlePageChange = useFallbackRows ? setFallbackCurrentPage : setCurrentPage;

  const hasActiveFilters = searchTerm.trim() !== '' || taxTypeFilter !== 'ALL';
  const nextSponsorCode = useMemo(() => getNextSponsorCode([...sponsors, ...serverSponsors]), [serverSponsors, sponsors]);

  const resetForm = () => {
    setFormData({ sponsorCode: '', name: '', contactPerson: '', email: '', phone: '', address: '', tin: '', taxType: undefined, ewtRate: undefined, arAccountId: '', courseFeeType: 'SPONSORED' });
    setEditingSponsor(null);
  };

  const openCreateModal = () => {
    setEditingSponsor(null);
    setFormData({ sponsorCode: nextSponsorCode, name: '', contactPerson: '', email: '', phone: '', address: '', tin: '', taxType: undefined, ewtRate: undefined, arAccountId: '', courseFeeType: 'SPONSORED' });
    setShowModal(true);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}`;
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsSubmitting(true);
    
    try {
      if (editingSponsor) {
        // Update existing sponsor
        const updatedSponsor: Sponsor = {
          ...editingSponsor,
          sponsorCode: formData.sponsorCode,
          name: formData.name!,
          contactPerson: formData.contactPerson,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          tin: formData.tin,
          taxType: formData.taxType,
          ewtRate: formData.ewtRate,
          arAccountId: formData.arAccountId,
          courseFeeType: formData.courseFeeType || 'SPONSORED',
          updatedAt: new Date().toISOString()
        };
        await onUpdateSponsor(updatedSponsor);
        setRefreshKey(key => key + 1);
        showToast(`Sponsor "${updatedSponsor.name}" updated successfully!`, 'success');
      } else {
        // Create new sponsor with proper UUID
        const newSponsor: Sponsor = {
          id: generateUUID(),
          orgId: '', // Will be set by App.tsx handler
          sponsorCode: formData.sponsorCode || nextSponsorCode,
          name: formData.name!,
          contactPerson: formData.contactPerson,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          tin: formData.tin,
          taxType: formData.taxType,
          ewtRate: formData.ewtRate,
          arAccountId: formData.arAccountId,
          courseFeeType: formData.courseFeeType || 'SPONSORED',
          createdAt: new Date().toISOString()
        };
        await onAddSponsor(newSponsor);
        setRefreshKey(key => key + 1);
        showToast(`Sponsor "${newSponsor.name}" created successfully!`, 'success');
      }
      
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving sponsor:', error);
      showToast(`Failed to save sponsor: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sponsor? This action cannot be undone.')) return;
    
    const sponsorToDelete = [...serverSponsors, ...sponsors].find(s => s.id === id);
    const sponsorName = sponsorToDelete?.name || 'Unknown';
    
    setDeletingId(id);
    try {
      const result = await onDeleteSponsor(id);
      if (result === false) {
        showToast('Cannot delete sponsor: It is currently in use by students or batches.', 'error');
      } else {
        setRefreshKey(key => key + 1);
        showToast(`Sponsor "${sponsorName}" deleted successfully!`, 'success');
      }
    } catch (error) {
      showToast(`Failed to delete sponsor: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (sponsor: Sponsor) => {
    setEditingSponsor(sponsor);
    setFormData({
      sponsorCode: sponsor.sponsorCode || '',
      name: sponsor.name,
      contactPerson: sponsor.contactPerson,
      email: sponsor.email,
      phone: sponsor.phone,
      address: sponsor.address,
      tin: sponsor.tin || '',
      taxType: sponsor.taxType,
      ewtRate: sponsor.ewtRate,
      arAccountId: sponsor.arAccountId || '',
      courseFeeType: sponsor.courseFeeType || 'SPONSORED'
    });
    setShowModal(true);
  };

  const taxTypeLabels: Record<TaxType, string> = {
    'VAT': 'VAT Registered',
    'NON_VAT': 'Non-VAT',
    'ZERO_RATED': 'Zero-Rated'
  };

  const formatEwtRate = (rate?: number) => {
    if (rate === undefined || rate === null) return null;
    return `${(rate * 100).toFixed(1)}%`;
  };

  if (showSOAFor) {
    return (
      <SponsorSOAView
        sponsor={showSOAFor}
        entries={entries}
        lines={lines}
        accounts={accounts}
        currency={currency}
        onClose={() => setShowSOAFor(null)}
      />
    );
  }

  return (
    <div className="space-y-8 pb-20 relative animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Financial Sponsors</h2>
          <p className="text-sm text-gray-500 font-normal italic">Manage donors, corporate grants, and sponsorship records.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md shadow-brand/20 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> New Sponsor
        </button>
      </div>

      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search sponsors..." 
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Tax:</span>
            <select
              value={taxTypeFilter}
              onChange={(e) => setTaxTypeFilter(e.target.value as TaxType | 'ALL')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[180px]"
            >
              <option value="ALL">All</option>
              <option value="VAT">VAT Registered</option>
              <option value="NON_VAT">Non-VAT</option>
              <option value="ZERO_RATED">Zero-Rated</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setTaxTypeFilter('ALL');
            }}
            className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          <div className="ml-auto text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{totalItems}</span> matching sponsor{totalItems !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full font-sans">
          <thead className="bg-brand border-b">
            <tr>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Sponsor</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Contact Person</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Contact Info</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Tax Info</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Address</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoadingPage && !useFallbackRows ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <Building size={40} className="mx-auto mb-2 text-gray-300" />
                  Loading sponsors...
                </td>
              </tr>
            ) : totalItems > 0 ? paginatedSponsors.map(sponsor => (
              <tr key={sponsor.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-brand/10 flex items-center justify-center text-brand border border-brand-light shadow-sm shrink-0">
                      <Building size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-800 leading-tight">{sponsor.name}</div>
                      {sponsor.sponsorCode && (
                        <div className="text-xs text-brand font-mono mt-0.5">{sponsor.sponsorCode}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        Added {sponsor.createdAt ? new Date(sponsor.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User size={14} className="text-gray-400" />
                    {sponsor.contactPerson || <span className="italic text-gray-400">Not specified</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {sponsor.email && (
                      <div className="text-xs text-gray-600 flex items-center gap-1.5">
                        <Mail size={12} className="text-gray-400" /> {sponsor.email}
                      </div>
                    )}
                    {sponsor.phone && (
                      <div className="text-xs text-gray-600 flex items-center gap-1.5">
                        <Phone size={12} className="text-gray-400" /> {sponsor.phone}
                      </div>
                    )}
                    {!sponsor.email && !sponsor.phone && (
                      <span className="text-xs text-gray-400 italic">No contact info</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {sponsor.tin && (
                      <div className="text-xs text-gray-600 flex items-center gap-1.5">
                        <FileText size={12} className="text-gray-400" /> TIN: {sponsor.tin}
                      </div>
                    )}
                    {sponsor.taxType && (
                      <div className="text-xs text-gray-600 flex items-center gap-1.5">
                        <Receipt size={12} className="text-gray-400" /> {taxTypeLabels[sponsor.taxType]}
                      </div>
                    )}
                    {sponsor.ewtRate !== undefined && sponsor.ewtRate !== null && (
                      <div className="text-xs text-gray-600 flex items-center gap-1.5">
                        <Percent size={12} className="text-gray-400" /> EWT: {formatEwtRate(sponsor.ewtRate)}
                      </div>
                    )}
                    {!sponsor.tin && !sponsor.taxType && (sponsor.ewtRate === undefined || sponsor.ewtRate === null) && (
                      <span className="text-xs text-gray-400 italic">No tax info</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-gray-600 flex items-start gap-1.5 max-w-xs">
                    {sponsor.address ? (
                      <>
                        <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{sponsor.address}</span>
                      </>
                    ) : (
                      <span className="italic text-gray-400">No address</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => openEditModal(sponsor)}
                      disabled={deletingId === sponsor.id}
                      className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(sponsor.id)}
                      disabled={deletingId === sponsor.id}
                      className="p-2 hover:bg-rose-50 text-gray-300 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === sponsor.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                    <button
                      onClick={() => setShowSOAFor(sponsor)}
                      className="p-2 hover:bg-brand-light text-brand hover:text-brand rounded-lg transition-colors border border-brand-light"
                      title="View Statement of Account"
                    >
                      <FileText size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <Building size={40} className="mx-auto mb-2 text-gray-300" />
                  {pageLoadError
                    ? 'Unable to load sponsors from Supabase.'
                    : hasActiveFilters
                    ? 'Try adjusting your search or filters.'
                    : 'No sponsors registered in the system.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <PaginationControls
          currentPage={activePage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={handlePageChange}
          itemLabel="sponsors"
        />
      </div>

      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-md shadow-brand/20"><Handshake size={20} /></div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">
                  {editingSponsor ? 'Edit Sponsor' : 'Onboard Sponsor'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sponsor Code</label>
                    <div className="relative">
                      <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        readOnly={!editingSponsor}
                        placeholder="Auto-generated" 
                        className={`w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium font-mono ${editingSponsor ? 'bg-gray-50' : 'bg-gray-100 text-gray-700 cursor-default'}`}
                        value={formData.sponsorCode || ''} 
                        onChange={e => setFormData({...formData, sponsorCode: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sponsor Name / Organization *</label>
                    <input 
                      required 
                      placeholder="e.g. Phoenix Foundation" 
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Person</label>
                  <input 
                    placeholder="Primary Contact Person" 
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.contactPerson || ''} 
                    onChange={e => setFormData({...formData, contactPerson: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                    <input 
                      type="email" 
                      placeholder="finance@sponsor.org" 
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                      value={formData.email || ''} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone Number</label>
                    <input 
                      placeholder="+63 XXX XXX XXXX" 
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                      value={formData.phone || ''} 
                      onChange={e => setFormData({...formData, phone: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</label>
                  <textarea 
                    placeholder="Complete business address" 
                    rows={2}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium resize-none"
                    value={formData.address || ''} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                  />
                </div>

                {/* Tax Information Section */}
                <div className="p-4 bg-blue-50/50 rounded border border-blue-100 space-y-4">
                  <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-2">
                    <Receipt size={12} /> Tax Information
                  </label>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">TIN (Tax ID Number)</label>
                      <input 
                        placeholder="000-000-000-000" 
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                        value={formData.tin || ''} 
                        onChange={e => setFormData({...formData, tin: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Tax Type</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                        value={formData.taxType || ''}
                        onChange={e => setFormData({...formData, taxType: e.target.value as TaxType || undefined})}
                      >
                        <option value="">Select Tax Type</option>
                        <option value="VAT">VAT Registered</option>
                        <option value="NON_VAT">Non-VAT</option>
                        <option value="ZERO_RATED">Zero-Rated</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">EWT Rate (%)</label>
                      <div className="relative">
                        <input 
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="e.g. 2" 
                          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium pr-8"
                          value={formData.ewtRate !== undefined && formData.ewtRate !== null ? (formData.ewtRate * 100) : ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setFormData({...formData, ewtRate: val ? parseFloat(val) / 100 : undefined});
                          }} 
                        />
                        <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 italic">
                    EWT Rate is used for computing Expanded Withholding Tax on income payments to this sponsor.
                  </p>
                </div>

                <div className="space-y-1.5 p-4 bg-brand/10 rounded border border-brand-light">
                  <label className="text-xs font-semibold text-brand uppercase tracking-wide flex items-center gap-2 mb-2">
                    <Receipt size={12} /> Course Fee Schedule
                  </label>
                  <select
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.courseFeeType || 'SPONSORED'}
                    onChange={e => setFormData({ ...formData, courseFeeType: e.target.value as SponsoredCourseFeeType })}
                  >
                    <option value="SPONSORED">Sponsored (standard, includes OJT when configured)</option>
                    <option value="TESDA_SCHOLARSHIP">TESDA Scholarship</option>
                  </select>
                  <p className="text-xs text-gray-500 italic mt-2 px-1">
                    TESDA scholarship batches use their own course-fee schedule. Other sponsors use the standard sponsored schedule.
                  </p>
                </div>

                <div className="space-y-1.5 p-4 bg-brand/10 rounded border border-brand-light">
                  <label className="text-xs font-semibold text-brand uppercase tracking-wide flex items-center gap-2 mb-2">
                    <BookOpen size={12} /> Specific G/L Receivable Account
                  </label>
                  <select 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.arAccountId || ''}
                    onChange={e => setFormData({ ...formData, arAccountId: e.target.value })}
                  >
                    <option value="">Default Accounts Receivable (1200)</option>
                    {accounts.filter(a => a.class === 'ASSET' && !a.isHeader && a.name.toLowerCase().includes('receivable')).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 italic mt-2 px-1">
                    Override the default A/R account for this specific sponsor if needed for departmental tracking.
                  </p>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !formData.name}
                  className="flex-1 py-3 bg-brand text-white rounded text-sm font-semibold shadow-md shadow-brand/20 active:scale-95 transition-all hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {editingSponsor ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingSponsor ? 'Update Sponsor' : 'Create Sponsor'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Toast Notifications moved to bottom */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded shadow-lg border flex items-center gap-2 animate-in slide-in-from-right duration-300 ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : toast.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-brand/10 text-brand border-brand-light'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle size={18} className="text-emerald-600" />
              ) : toast.type === 'error' ? (
                <AlertCircle size={18} className="text-rose-600" />
              ) : (
                <AlertCircle size={18} className="text-brand" />
              )}
              <span className="text-sm font-semibold">{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SponsorsView;




