import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Search, AlertCircle, Package, ShieldCheck, Database, Info, Tag, Zap, Target, ChevronDown, RotateCcw } from 'lucide-react';
import { StockItem, InventoryValuationMethod, Organization } from '../types';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter } from '../services/IDataService';

interface StockItemsViewProps {
  orgId: string;
  items: StockItem[];
  accounts: any[];
  onAdd: (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, item: Partial<StockItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currency: string;
  isLoading?: boolean;
  organization?: Organization;
}

interface FormData {
  code: string;
  name: string;
  description: string;
  type: 'STOCK_ITEM' | 'NON_STOCK_ITEM';
  unitOfMeasure: string;
  valuationMethod: InventoryValuationMethod;
  reorderLevel: number;
  reorderQuantity: number;
  safetyStock: number;
  isActive: boolean;
}

const VALUATION_METHODS: InventoryValuationMethod[] = ['FIFO', 'LIFO', 'WEIGHTED_AVERAGE', 'STANDARD_COST'];
const UNITS = ['PCS', 'BOX', 'KG', 'L', 'M', 'HOUR', 'SERVICE'];
const PAGE_SIZE = 10;
const STOCK_ITEM_COLUMNS = 'id,org_id,code,name,description,type,unit_of_measure,valuation_method,reorder_level,reorder_quantity,safety_stock,is_active,is_deleted,created_at,updated_at';

const INITIAL_FORM: FormData = {
  code: '',
  name: '',
  description: '',
  type: 'STOCK_ITEM',
  unitOfMeasure: 'PCS',
  valuationMethod: 'FIFO',
  reorderLevel: 0,
  reorderQuantity: 0,
  safetyStock: 0,
  isActive: true,
};

export const StockItemsView: React.FC<StockItemsViewProps> = ({
  orgId,
  items,
  accounts,
  onAdd,
  onUpdate,
  onDelete,
  currency,
  isLoading = false,
  organization,
}) => {
  const brandColor = organization?.primaryColor || '#F47721';
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'STOCK_ITEM' | 'NON_STOCK_ITEM'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [serverItems, setServerItems] = useState<StockItem[]>([]);
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

  const handleEditClick = (item: StockItem) => {
    setEditingId(item.id);
    setFormData({
      code: item.code,
      name: item.name,
      description: item.description || '',
      type: item.type,
      unitOfMeasure: item.unitOfMeasure,
      valuationMethod: item.valuationMethod,
      reorderLevel: item.reorderLevel,
      reorderQuantity: item.reorderQuantity,
      safetyStock: item.safetyStock,
      isActive: item.isActive,
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

    const duplicateCode = items.some(
      (item) => item.code === formData.code.trim() && item.id !== editingId && !item.isDeleted
    );
    if (duplicateCode) {
      setError('An item with this code already exists');
      return false;
    }

    if (formData.reorderLevel < 0 || formData.reorderQuantity < 0 || formData.safetyStock < 0) {
      setError('Quantities cannot be negative');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        unitOfMeasure: formData.unitOfMeasure,
        valuationMethod: formData.valuationMethod,
        reorderLevel: formData.reorderLevel,
        reorderQuantity: formData.reorderQuantity,
        safetyStock: formData.safetyStock,
        isActive: formData.isActive,
      };

      if (editingId) {
        await onUpdate(editingId, payload);
        setRefreshKey(key => key + 1);
        setSuccess('Item updated successfully');
      } else {
        await onAdd(payload);
        setRefreshKey(key => key + 1);
        setSuccess('Item added successfully');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(INITIAL_FORM);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
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
        setSuccess('Item deleted successfully');
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete item';
        setError(message);
      } finally {
        setSubmitting(false);
      }
    } else {
      setDeleting(id);
    }
  };

  const activeItems = useMemo(() => items.filter((item) => !item.isDeleted), [items]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, orgId, statusFilter, typeFilter]);

  const itemFilters = useMemo(() => {
    const filters: PageFilter[] = [];
    if (orgId) filters.push({ column: 'org_id', operator: 'eq', value: orgId });
    filters.push({ column: 'is_deleted', operator: 'eq', value: false });
    if (typeFilter !== 'ALL') filters.push({ column: 'type', operator: 'eq', value: typeFilter });
    if (statusFilter !== 'ALL') filters.push({ column: 'is_active', operator: 'eq', value: statusFilter === 'ACTIVE' });
    return filters;
  }, [orgId, statusFilter, typeFilter]);

  useEffect(() => {
    if (!orgId) return;

    let isActive = true;
    setIsLoadingPage(true);
    setPageLoadError('');

    DataServiceFactory.getService().fetchPage<StockItem>('stock_items', {
      page: currentPage,
      pageSize: PAGE_SIZE,
      columns: STOCK_ITEM_COLUMNS,
      filters: itemFilters,
      search: debouncedSearchTerm.trim()
        ? { columns: ['code', 'name', 'description', 'unit_of_measure', 'valuation_method'], term: debouncedSearchTerm }
        : undefined,
      orderBy: [{ column: 'code', ascending: true }],
    })
      .then(result => {
        if (!isActive) return;
        setServerItems(result.rows);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[StockItemsView] Failed to load stock item page:', error);
        setPageLoadError(error instanceof Error ? error.message : 'Failed to load stock items.');
        setServerItems([]);
        setServerTotal(0);
        setServerTotalPages(1);
      })
      .finally(() => {
        if (isActive) setIsLoadingPage(false);
      });

    return () => {
      isActive = false;
    };
  }, [currentPage, debouncedSearchTerm, itemFilters, orgId, refreshKey]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();

    return activeItems
      .filter((item) => {
        const searchableText = [
          item.code,
          item.name,
          item.description || '',
          item.unitOfMeasure,
          item.valuationMethod,
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
        const matchesStatus = statusFilter === 'ALL'
          || (statusFilter === 'ACTIVE' && item.isActive)
          || (statusFilter === 'INACTIVE' && !item.isActive);

        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [activeItems, debouncedSearchTerm, typeFilter, statusFilter]);

  const {
    currentPage: fallbackCurrentPage,
    totalPages: fallbackTotalPages,
    pageStartIndex: fallbackPageStartIndex,
    pageEndIndex: fallbackPageEndIndex,
    paginatedRows: fallbackPaginatedItems,
    setCurrentPage: setFallbackCurrentPage,
  } = usePaginatedRows(filteredItems, [debouncedSearchTerm, statusFilter, typeFilter], PAGE_SIZE);

  const useFallbackRows = !orgId || !!pageLoadError;
  const paginatedItems = useFallbackRows ? fallbackPaginatedItems : serverItems;
  const totalItems = useFallbackRows ? filteredItems.length : serverTotal;
  const totalPages = useFallbackRows ? fallbackTotalPages : serverTotalPages;
  const activePage = useFallbackRows ? fallbackCurrentPage : currentPage;
  const pageStartIndex = useFallbackRows ? fallbackPageStartIndex : (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = useFallbackRows ? fallbackPageEndIndex : Math.min(pageStartIndex + serverItems.length, serverTotal);
  const handlePageChange = useFallbackRows ? setFallbackCurrentPage : setCurrentPage;

  const hasActiveFilters = searchTerm.trim() !== '' || typeFilter !== 'ALL' || statusFilter !== 'ALL';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 no-print">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Stock Item Registry</h2>
          <p className="text-sm text-gray-500 font-normal italic">Physical inventory master data, valuation methods, and replenishment SKU tracking.</p>
        </div>
        {!showForm && (
          <button
            onClick={handleAddClick}
            disabled={isLoading || submitting}
            className="flex items-center gap-2 px-8 py-3 bg-brand text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand/20 font-semibold text-xs active:scale-95 uppercase tracking-wide hover:bg-brand-hover"
          >
            <Plus className="w-5 h-5" />
            Define Stock Item
          </button>
        )}
      </header>

      {/* Constraints & Policy Banner */}
      {!showForm && (
        <div className="bg-gray-800 rounded-md p-5 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-md relative overflow-hidden no-print border border-gray-700">
          <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-1/4 -translate-y-1/4">
            <ShieldCheck size={240} />
          </div>
          <div className="flex items-center gap-8 relative z-10">
            <div style={{ backgroundColor: `${brandColor}10`, borderColor: `${brandColor}40` }} className="p-6 rounded-md border text-orange-400">
               <Package size={40} />
            </div>
            <div>
               <h4 className="text-xl font-semibold uppercase tracking-tight">Valuation Control Active</h4>
               <p className="text-sm text-gray-400 font-medium leading-relaxed max-w-2xl italic">
                  Inventory units are valuated using precise algorithmic models. Calibrate unit measurements and safety levels to maintain operational integrity in the production pipeline.
               </p>
            </div>
          </div>
          <div className="shrink-0 relative z-10 px-8 py-4 bg-[#F47721]/10 border border-orange-400/20 rounded text-xs font-semibold uppercase tracking-wide text-orange-400 flex items-center gap-3">
             <span className="w-2 h-2 bg-[#F47721] rounded-full animate-pulse" /> SYSTEM_PROTECTED
          </div>
        </div>
      )}

      {/* Messaging Nodes */}
      {(error || success) && (
        <div className="space-y-4">
          {error && (
            <div className="p-6 bg-rose-50 border border-rose-100 rounded flex items-start gap-4 animate-in slide-in-from-top-4">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><AlertCircle size={20} /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-800 uppercase tracking-wide">System Alert</p>
                <p className="text-xs text-rose-600 font-bold mt-1">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-rose-300 hover:text-rose-600 transition-colors"><X size={20} /></button>
            </div>
          )}
          {success && (
            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded flex items-start gap-4 animate-in slide-in-from-top-4">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Check size={20} /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">Entry Verified</p>
                <p className="text-xs text-emerald-600 font-bold mt-1">{success}</p>
              </div>
              <button onClick={() => setSuccess(null)} className="text-emerald-300 hover:text-emerald-600 transition-colors"><X size={20} /></button>
            </div>
          )}
        </div>
      )}

      {!showForm && (
        <div className="bg-white border-y px-4 py-2 no-print">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full sm:w-64">
              <Search size={14} className="text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Search stock items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
              />
            </div>

            <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
              <span className="text-[13px] text-gray-500 mr-1">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'STOCK_ITEM' | 'NON_STOCK_ITEM')}
                className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[180px]"
              >
                <option value="ALL">All</option>
                <option value="STOCK_ITEM">Stock</option>
                <option value="NON_STOCK_ITEM">Service</option>
              </select>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
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
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
              className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
              title="Clear all filters"
            >
              <RotateCcw size={16} />
            </button>

            <div className="ml-auto text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{totalItems}</span> matching items
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-md border border-gray-200 shadow-md overflow-hidden animate-in zoom-in-95 duration-300 max-w-5xl mx-auto">
          <div className="p-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-6">
                <div style={{ backgroundColor: brandColor }} className="w-14 h-14 rounded flex items-center justify-center text-white shadow-sm shadow-gray-300/10">
                    <Database size={28} />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">
                        {editingId ? 'Modify Inventory Specification' : 'Initialize Stock Item Entry'}
                    </h2>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">Logistics Architecture & Valuation Calibration</p>
                </div>
            </div>
            <button onClick={handleCancel} className="p-4 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-800"><X size={24} /></button>
          </div>

          <form onSubmit={handleSubmit} className="p-12 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-8">
                 <div className="bg-gray-50 p-8 rounded border border-gray-100 space-y-6">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                       <Tag size={14} style={{ color: brandColor }} /> Identity Attributes
                    </h3>
                    <div className="space-y-4">
                       <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Universal Item ID / SKU</label>
                          <input required type="text" placeholder="e.g. LAB-COAT-XL" className="w-full px-6 py-4 bg-white border border-gray-200 rounded outline-none font-bold text-gray-800 focus:ring-4 focus:ring-orange-400/10 transition-all uppercase"
                            value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Official Nomenclature</label>
                          <input required type="text" placeholder="e.g. Protective Laboratory Gear" className="w-full px-6 py-4 bg-white border border-gray-200 rounded outline-none font-semibold text-gray-800 focus:ring-4 focus:ring-orange-400/10 transition-all"
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                       </div>
                    </div>
                 </div>

                 <div className="bg-gray-50 p-8 rounded border border-gray-100 space-y-6">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                       <Zap size={14} className="text-[#F47721]" /> Measurement Dynamics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Unit System</label>
                          <select className="w-full px-6 py-4 bg-white border border-gray-200 rounded outline-none font-semibold text-gray-800"
                            value={formData.unitOfMeasure} onChange={e => setFormData({...formData, unitOfMeasure: e.target.value})}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Valuation Logic</label>
                          <select className="w-full px-6 py-4 bg-white border border-gray-200 rounded outline-none font-semibold text-gray-800"
                            value={formData.valuationMethod} onChange={e => setFormData({...formData, valuationMethod: e.target.value as any})}>
                            {VALUATION_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                          </select>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-8">
                 <div className="bg-gray-800 p-8 rounded border border-gray-700 shadow-sm space-y-6">
                    <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wide flex items-center gap-2">
                       <Target size={14} /> Threshold Surveillance
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2 text-white">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Reorder Edge</label>
                          <input type="number" step="0.01" className="w-full px-6 py-4 bg-gray-700 border border-gray-600 rounded outline-none font-semibold text-white focus:ring-4 focus:ring-orange-400/20"
                            value={formData.reorderLevel} onChange={e => setFormData({...formData, reorderLevel: parseFloat(e.target.value) || 0})} />
                       </div>
                       <div className="space-y-2 text-white">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Standard Lot</label>
                          <input type="number" step="0.01" className="w-full px-6 py-4 bg-gray-700 border border-gray-600 rounded outline-none font-semibold text-white focus:ring-4 focus:ring-orange-400/20"
                            value={formData.reorderQuantity} onChange={e => setFormData({...formData, reorderQuantity: parseFloat(e.target.value) || 0})} />
                       </div>
                       <div className="col-span-2 space-y-2 text-white">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Strategic Safety Buffer</label>
                          <input type="number" step="0.01" className="w-full px-6 py-4 bg-gray-700 border border-gray-600 rounded outline-none font-semibold text-white focus:ring-4 focus:ring-orange-400/20"
                            value={formData.safetyStock} onChange={e => setFormData({...formData, safetyStock: parseFloat(e.target.value) || 0})} />
                          <p className="text-xs text-gray-500 italic mt-2">This buffer is excluded from ATP (Available-to-Promise) calculations.</p>
                       </div>
                    </div>
                 </div>

                 <div className="bg-gray-50 p-8 rounded border border-gray-100 flex items-center justify-between">
                    <div>
                       <p className="text-xs font-semibold text-gray-800 uppercase tracking-tight">Deployment Status</p>
                       <p className="text-xs font-bold text-gray-500 mt-1 uppercase">Activate for logistics pipelines</p>
                    </div>
                    <button type="button" onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                      style={{ backgroundColor: formData.isActive ? brandColor : '#D1D5DB' }}
                      className="w-14 h-8 rounded-full transition-all flex items-center px-1">
                      <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${formData.isActive ? 'translate-x-6' : ''}`} />
                    </button>
                 </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-gray-100">
               <button type="button" onClick={handleCancel} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded font-semibold text-xs uppercase tracking-wide hover:bg-gray-200 transition-all">
                  Cancel Specification
               </button>
               <button type="submit" disabled={submitting} style={{ backgroundColor: brandColor }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }} className="flex-[2] py-4 text-white rounded font-semibold text-xs uppercase tracking-wide shadow-sm shadow-gray-300/10 transition-all disabled:opacity-50">
                  {submitting ? 'PROCESSING RECAPITULATION...' : 'REALIZE ITEM INDEX'}
               </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full font-sans">
              <thead className="bg-brand border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Index / SKU</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Logic & Metrics</th>
                  <th className="px-4 py-3 text-center text-[13px] font-bold text-white">Thresholds</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Status</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">System Nodes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(isLoading || isLoadingPage) ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      <div className="mx-auto mb-3 h-8 w-8 rounded-full border-4 border-brand-light border-t-gray-300 animate-spin"></div>
                      Loading stock items...
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                       <Package size={40} className="mx-auto mb-2 text-gray-300" />
                       {hasActiveFilters ? 'Try adjusting your search or filters.' : 'The inventory index is currently void for the specified criteria.'}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded bg-brand/10 flex items-center justify-center text-brand border border-brand-light shadow-sm shrink-0">
                             <Package size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold font-mono text-gray-400 uppercase tracking-tight mb-1">{item.code}</p>
                            <p className="text-sm font-semibold text-gray-900 tracking-tight leading-none mb-1">{item.name}</p>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">SKU_REF: {item.id.substring(0,8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                         <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${item.type === 'STOCK_ITEM' ? 'bg-brand/10 text-brand border-brand-light' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                               {item.type === 'STOCK_ITEM' ? 'Stock' : 'Service'}
                            </span>
                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold uppercase tracking-wide border border-gray-200">
                               {item.valuationMethod}
                            </span>
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                               {item.unitOfMeasure}
                            </span>
                         </div>
                      </td>
                      <td className="px-4 py-3">
                         <div className="flex justify-center gap-4">
                            <div className="text-center">
                               <p className="text-xs font-semibold text-gray-400 uppercase tracking-tighter">REORDER</p>
                               <p className="text-xs font-semibold text-gray-800">{item.reorderLevel.toLocaleString()}</p>
                            </div>
                            <div className="text-center">
                               <p className="text-xs font-semibold text-gray-400 uppercase tracking-tighter">BUFFER</p>
                               <p className="text-xs font-semibold text-gray-800">{item.safetyStock.toLocaleString()}</p>
                            </div>
                         </div>
                      </td>
                      <td className="px-4 py-3">
                         <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${
                            item.isActive ? 'bg-brand/10 text-brand border-brand-light' : 'bg-gray-100 text-gray-500 border-gray-200'
                         }`}>
                            {item.isActive ? 'Active' : 'Archived'}
                         </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditClick(item)} 
                            className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded-lg transition-colors shadow-sm">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteClick(item.id)}
                            className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 rounded transition-all shadow-sm hover:shadow-md">
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

          <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-white rounded border border-gray-100 shadow-sm text-brand"><Database size={20} /></div>
                 <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1.5">Master Index State</p>
                    <p className="text-xs font-bold text-gray-600">Total of {totalItems} logistics definitions active for simulation.</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-2"><ShieldCheck size={14} className="text-brand" /> STOCK_INTEGRITY_SHIELD</p>
                 <p className="text-xs font-semibold text-gray-300 italic mt-2 uppercase tracking-tighter">System Pulse: {new Date().toISOString()}</p>
              </div>
          </div>
          <PaginationControls
            currentPage={activePage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageStartIndex={pageStartIndex}
            pageEndIndex={pageEndIndex}
            onPageChange={handlePageChange}
            itemLabel="stock items"
          />        </div>
      )}
    </div>
  );
};

export default StockItemsView;

