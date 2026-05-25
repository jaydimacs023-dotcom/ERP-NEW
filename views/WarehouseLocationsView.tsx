import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, Check, Search, Download, MapPin, Building2, AlertCircle, ChevronDown, RotateCcw } from 'lucide-react';
import { WarehouseLocation, Organization } from '../types';
import { DataExportService } from '../services/DataExportService';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter } from '../services/IDataService';

interface WarehouseLocationsViewProps {
  orgId: string;
  locations: WarehouseLocation[];
  onAdd: (location: Omit<WarehouseLocation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, location: Partial<WarehouseLocation>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currency: string;
  isLoading?: boolean;
  organization?: Organization;
}

interface FormData {
  code: string;
  name: string;
  location: string;
  isActive: boolean;
}

const INITIAL_FORM: FormData = {
  code: '',
  name: '',
  location: '',
  isActive: true,
};

const PAGE_SIZE = 10;
const WAREHOUSE_LOCATION_COLUMNS = 'id,org_id,code,name,location,address,description,is_active,is_deleted,created_at,updated_at';

export const WarehouseLocationsView: React.FC<WarehouseLocationsViewProps> = ({
  orgId,
  locations,
  onAdd,
  onUpdate,
  onDelete,
  currency,
  isLoading = false,
  organization,
}) => {
  // Brand color from organization, fallback to default
  const brandColor = organization?.primaryColor || '#F47721';
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [serverLocations, setServerLocations] = useState<WarehouseLocation[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoadError, setPageLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddClick = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setError(null);
    setShowForm(true);
  };

  const handleEditClick = (location: WarehouseLocation) => {
    setEditingId(location.id);
    setFormData({
      code: location.code,
      name: location.name,
      location: location.location,
      isActive: location.isActive,
    });
    setError(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.code.trim()) {
      setError('Code is required');
      return false;
    }
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!formData.location.trim()) {
      setError('Location is required');
      return false;
    }

    const duplicateCode = locations.some(
      (loc) => loc.code === formData.code.trim() && loc.id !== editingId && !loc.isDeleted
    );
    if (duplicateCode) {
      setError('A location with this code already exists');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const payload = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        location: formData.location.trim(),
        isActive: formData.isActive,
      };
      if (editingId) {
        await onUpdate(editingId, payload);
        setRefreshKey(key => key + 1);
        setSuccess('Warehouse location updated successfully');
      } else {
        await onAdd(payload);
        setRefreshKey(key => key + 1);
        setSuccess('Warehouse location added successfully');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(INITIAL_FORM);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (deleting === id) {
      setDeleting(null);
      setSubmitting(true);
      try {
        await onDelete(id);
        setRefreshKey(key => key + 1);
        setSuccess('Warehouse location deleted successfully');
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete location');
      } finally {
        setSubmitting(false);
      }
    } else {
      setDeleting(id);
    }
  };

  const activeLocations = useMemo(() => locations.filter((loc) => !loc.isDeleted), [locations]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, orgId, statusFilter]);

  const locationFilters = useMemo(() => {
    const filters: PageFilter[] = [];
    if (orgId) filters.push({ column: 'org_id', operator: 'eq', value: orgId });
    filters.push({ column: 'is_deleted', operator: 'eq', value: false });
    if (statusFilter !== 'ALL') filters.push({ column: 'is_active', operator: 'eq', value: statusFilter === 'ACTIVE' });
    return filters;
  }, [orgId, statusFilter]);

  useEffect(() => {
    if (!orgId) return;

    let isActive = true;
    setIsLoadingPage(true);
    setPageLoadError('');

    DataServiceFactory.getService().fetchPage<WarehouseLocation>('warehouse_locations', {
      page: currentPage,
      pageSize: PAGE_SIZE,
      columns: WAREHOUSE_LOCATION_COLUMNS,
      filters: locationFilters,
      search: debouncedSearchTerm.trim()
        ? { columns: ['code', 'name', 'location', 'address', 'description'], term: debouncedSearchTerm }
        : undefined,
      orderBy: [{ column: 'code', ascending: true }],
    })
      .then(result => {
        if (!isActive) return;
        setServerLocations(result.rows);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[WarehouseLocationsView] Failed to load warehouse location page:', error);
        setPageLoadError(error instanceof Error ? error.message : 'Failed to load warehouse locations.');
        setServerLocations([]);
        setServerTotal(0);
        setServerTotalPages(1);
      })
      .finally(() => {
        if (isActive) setIsLoadingPage(false);
      });

    return () => {
      isActive = false;
    };
  }, [currentPage, debouncedSearchTerm, locationFilters, orgId, refreshKey]);

  const filteredLocations = useMemo(() => {
    const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();

    return activeLocations
      .filter((loc) => {
        const searchableText = [
          loc.code,
          loc.name,
          loc.location,
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesStatus = statusFilter === 'ALL'
          || (statusFilter === 'ACTIVE' && loc.isActive)
          || (statusFilter === 'INACTIVE' && !loc.isActive);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [activeLocations, debouncedSearchTerm, statusFilter]);

  const {
    currentPage: fallbackCurrentPage,
    totalPages: fallbackTotalPages,
    pageStartIndex: fallbackPageStartIndex,
    pageEndIndex: fallbackPageEndIndex,
    paginatedRows: fallbackPaginatedLocations,
    setCurrentPage: setFallbackCurrentPage,
  } = usePaginatedRows(filteredLocations, [debouncedSearchTerm, statusFilter], PAGE_SIZE);

  const useFallbackRows = !orgId || !!pageLoadError;
  const paginatedLocations = useFallbackRows ? fallbackPaginatedLocations : serverLocations;
  const totalItems = useFallbackRows ? filteredLocations.length : serverTotal;
  const totalPages = useFallbackRows ? fallbackTotalPages : serverTotalPages;
  const activePage = useFallbackRows ? fallbackCurrentPage : currentPage;
  const pageStartIndex = useFallbackRows ? fallbackPageStartIndex : (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = useFallbackRows ? fallbackPageEndIndex : Math.min(pageStartIndex + serverLocations.length, serverTotal);
  const handlePageChange = useFallbackRows ? setFallbackCurrentPage : setCurrentPage;

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'ALL';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Warehouse Locations</h2>
          <p className="text-sm text-gray-500 font-normal italic">Define physical storage zones and internal logistics centers.</p>
        </div>
        <div className="flex gap-3">
           {!showForm && (
           <button
              onClick={handleAddClick}
              disabled={isLoading || submitting}
              className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded font-semibold text-xs uppercase tracking-wide hover:bg-brand-hover hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-brand/20"
            >
              <Plus className="w-4 h-4" />
              New Location
            </button>
           )}
           <button
             onClick={() => {
                const exportData = filteredLocations.map(loc => ({
                  Code: loc.code,
                  Name: loc.name,
                  Description: loc.location,
                  Status: loc.isActive ? 'Active' : 'Inactive'
                }));
                DataExportService.exportToCSV(exportData, `Warehouse_Map_${new Date().toISOString().split('T')[0]}.csv`);
             }}
             className="p-3 bg-white rounded transition-all active:scale-95 shadow-sm border border-gray-200 text-gray-400 hover:text-brand hover:border-brand-light"
             title="Export CSV"
           >
             <Download size={20} />
           </button>
        </div>
      </header>

      {/* Notifications */}
      <div className="space-y-4">
        {error && (
          <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
               <AlertCircle className="text-rose-600" size={20} />
               <p className="text-sm font-semibold text-rose-800 uppercase tracking-tight">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-1.5 hover:bg-rose-100 rounded-lg text-rose-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
             <div className="flex items-center gap-3">
               <Check className="text-emerald-600" size={20} />
               <p className="text-sm font-semibold text-emerald-800 uppercase tracking-tight">{success}</p>
             </div>
             <button onClick={() => setSuccess(null)} className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-500 transition-colors">
               <X className="w-4 h-4" />
             </button>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Zones</p>
          <div className="flex items-end justify-between">
            <p className="text-xl font-semibold text-gray-800 tracking-tight">{activeLocations.length}</p>
            <MapPin className="text-gray-200 group-hover:scale-110 transition-transform" size={40} />
          </div>
        </div>
        <div className="p-6 rounded border shadow-sm" style={{ backgroundColor: `${brandColor}10`, borderColor: `${brandColor}20` }}>
           <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: brandColor }}>Active Centers</p>
           <p className="text-xl font-semibold tracking-tight" style={{ color: brandColor }}>
             {activeLocations.filter(l => l.isActive).length}
           </p>
        </div>
        <div className="bg-gray-800 p-6 rounded border border-gray-700 shadow-sm md:col-span-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Logistics Integrity</p>
          <div className="flex items-center gap-4 mt-2">
             <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: brandColor }}></div>
             </div>
             <span className="text-xs font-semibold text-white uppercase tracking-wide">Verified</span>
          </div>
        </div>
      </div>

      {/* Form Overlay */}
      {showForm && (
        <div className="bg-white rounded-md shadow-sm overflow-hidden animate-in zoom-in-95 duration-200" style={{ borderWidth: '2px', borderColor: `${brandColor}30` }}>
           <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 uppercase tracking-tight">{editingId ? 'Edit Storage Zone' : 'Define New Capacity'}</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mt-1 italic">Internal Warehouse Mapping Specification</p>
              </div>
              <button onClick={handleCancel} className="p-2.5 bg-white rounded shadow-sm text-gray-400 hover:text-gray-600 transition-all border border-gray-100"><X size={20} /></button>
           </div>
           
           <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Zone Code *</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="e.g. WH-01"
                      style={{
                        borderColor: 'transparent'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = `${brandColor}40`;
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }}
                      className="w-full px-5 py-3.5 bg-gray-50 border-2 rounded outline-none transition-all text-sm font-semibold text-gray-800 font-mono"
                    />
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Friendly Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Bulk Storage Alpha"
                      style={{
                        borderColor: 'transparent'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = `${brandColor}40`;
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }}
                      className="w-full px-5 py-3.5 bg-gray-50 border-2 rounded outline-none transition-all text-sm font-semibold text-gray-800"
                    />
                 </div>

                 <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Physical Address / Description *</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Enter precise physical location details..."
                      style={{
                        borderColor: 'transparent'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = `${brandColor}40`;
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }}
                      className="w-full px-5 py-3.5 bg-gray-50 border-2 rounded outline-none transition-all text-sm font-semibold text-gray-800"
                    />
                 </div>

                 <div className="md:col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-gray-200 rounded-full transition-colors" style={{ backgroundColor: formData.isActive ? brandColor : '#D1D5DB' }}></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide group-hover:text-gray-800 transition-colors">Active Warehouse Center</span>
                    </label>
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-8 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor: brandColor,
                    boxShadow: `0 2px 4px 0 ${brandColor}40`
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${brandColor}dd`;
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = brandColor;
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  }}
                  className="px-5 py-3.5 text-white rounded font-semibold text-xs uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50"
                >
                  {editingId ? 'COMMIT CHANGES' : 'CREATE STORAGE ZONE'}
                </button>
              </div>
           </form>
        </div>
      )}

      {/* Filter Bar */}
      {!showForm && (
        <div className="bg-white border-y px-4 py-2 no-print">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full sm:w-64">
              <Search size={14} className="text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Search locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
              />
            </div>

            <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
              <span className="text-[13px] text-gray-500 mr-1">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[160px]"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
              className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
              title="Clear all filters"
            >
              <RotateCcw size={16} />
            </button>

            <div className="ml-auto text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{totalItems}</span> matching locations
            </div>
          </div>
        </div>
      )}

      {/* Table List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full font-sans">
            <thead className="bg-brand border-b">
              <tr>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Code</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Location Detail</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Physical Address</th>
                <th className="px-4 py-3 text-center text-[13px] font-bold text-white">Status</th>
                <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {(isLoading || isLoadingPage) ? (
                <tr>
                   <td colSpan={5} className="px-4 py-16 text-center">
                      <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4 border-brand-light border-t-gray-300"></div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Mapping Logistics Architecture...</p>
                   </td>
                </tr>
              ) : paginatedLocations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Building2 className="text-gray-200" size={32} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      {hasActiveFilters ? 'No locations match your filters' : 'No logistics centers defined'}
                    </p>
                    <p className="text-xs text-gray-400 mt-2 italic font-medium">
                      {hasActiveFilters ? 'Try adjusting your search or status filter.' : 'Add a physical location to begin inventory tracking.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedLocations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3">
                       <div className="text-left">
                          <div className="text-sm font-semibold text-gray-900 font-mono">{loc.code}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Zone ID</div>
                       </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800 tracking-tight">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-brand/10 text-brand border border-brand-light shadow-sm flex items-center justify-center shrink-0">
                             <Building2 size={16} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{loc.name}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">{loc.isActive ? 'Operational' : 'Inactive'}</div>
                          </div>
                       </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-medium max-w-xs">{loc.location}</td>
                    <td className="px-4 py-3 text-center">
                       <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${
                          loc.isActive ? 'bg-brand/10 text-brand border-brand-light' : 'bg-gray-100 text-gray-500 border-gray-200'
                       }`}>
                          {loc.isActive ? 'ACTIVE_CENTER' : 'LOCKED'}
                       </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditClick(loc)}
                            className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(loc.id)}
                            className={`p-2.5 rounded transition-all shadow-sm border border-transparent ${
                               deleting === loc.id ? 'bg-rose-600 text-white shadow-rose-900/20' : 'text-gray-400 hover:text-rose-600 hover:bg-white hover:border-gray-100'
                            }`}
                          >
                            <Trash2 size={16} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Audit Footnote */}
        {!isLoading && filteredLocations.length > 0 && (
           <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center no-print">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm"><Check size={16} className="text-brand" /></div>
                  <div>
                     <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Logistics Integrity</p>
                     <p className="text-xs font-bold text-gray-600">Total physical storage footprint: {totalItems} registered zones.</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-1.5"><MapPin size={12} /> COORDINATES_VERIFIED</p>
                  <p className="text-xs font-bold text-gray-300 italic mt-1 uppercase">Snapshot: {new Date().toLocaleString()}</p>
               </div>
           </div>
        )}
      </div>
        <PaginationControls
          currentPage={activePage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={handlePageChange}
          itemLabel="locations"
        />
    </div>
  );
};

export default WarehouseLocationsView;

