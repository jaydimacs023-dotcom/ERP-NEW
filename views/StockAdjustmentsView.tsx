import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, Check, Search, BookOpen, AlertCircle, Download, ChevronDown, RotateCcw } from 'lucide-react';
import { StockAdjustment, StockItem, InventoryLevel, ChartOfAccount, JournalEntry, JournalLine, Organization } from '../types';
import { InventoryService } from '../services/InventoryService';
import { InventoryGLService } from '../services/InventoryGLService';
import { DataExportService } from '../services/DataExportService';

interface StockAdjustmentsViewProps {
  adjustments: StockAdjustment[];
  items: StockItem[];
  levels: InventoryLevel[];
  locations: any[];
  accounts?: ChartOfAccount[];
  onAdd: (adj: Omit<StockAdjustment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, adj: Partial<StockAdjustment>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPostGL?: (entry: Partial<JournalEntry>, lines: JournalLine[], adjustmentId: string) => Promise<void>;
  currency: string;
  isLoading?: boolean;
  currentUserId?: string;
  organization?: Organization;
}

interface FormData {
  stockItemId: string;
  warehouseLocationId: string;
  adjustmentType: 'DAMAGE' | 'WRITEOFF' | 'ADJUSTMENT' | 'CORRECTION';
  quantity: number;
  reason: string;
  notes: string;
  isApproved: boolean;
}

const ADJUSTMENT_TYPES = ['DAMAGE', 'WRITEOFF', 'ADJUSTMENT', 'CORRECTION'] as const;

const INITIAL_FORM: FormData = {
  stockItemId: '',
  warehouseLocationId: '',
  adjustmentType: 'ADJUSTMENT',
  quantity: 0,
  reason: '',
  notes: '',
  isApproved: false,
};

export const StockAdjustmentsView: React.FC<StockAdjustmentsViewProps> = ({
  adjustments,
  items,
  levels,
  locations,
  accounts = [],
  onAdd,
  onUpdate,
  onDelete,
  onPostGL,
  currency,
  isLoading = false,
  currentUserId,
  organization,
}) => {
  const brandColor = organization?.primaryColor || '#F47721';
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | typeof ADJUSTMENT_TYPES[number]>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [postingGL, setPostingGL] = useState<string | null>(null);

  const stockItems = useMemo(
    () => items.filter((i) => !i.isDeleted && i.type === 'STOCK_ITEM'),
    [items]
  );

  const activeLocations = useMemo(() => locations.filter((l) => !l.isDeleted && l.isActive), [locations]);

  const handleAddClick = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setError(null);
    setShowForm(true);
  };

  const handleEditClick = (adj: StockAdjustment) => {
    setEditingId(adj.id);
    setFormData({
      stockItemId: adj.stockItemId,
      warehouseLocationId: adj.warehouseLocationId,
      adjustmentType: adj.adjustmentType,
      quantity: adj.quantity,
      reason: adj.reason || '',
      notes: adj.notes || '',
      isApproved: adj.isApproved,
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
    if (!formData.stockItemId) {
      setError('Item is required');
      return false;
    }
    if (!formData.warehouseLocationId) {
      setError('Warehouse location is required');
      return false;
    }
    if (formData.quantity <= 0) {
      setError('Quantity must be greater than zero');
      return false;
    }
    if (!formData.reason.trim()) {
      setError('Reason is required');
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
        stockItemId: formData.stockItemId,
        warehouseLocationId: formData.warehouseLocationId,
        adjustmentType: formData.adjustmentType,
        quantity: formData.quantity,
        reason: formData.reason.trim(),
        notes: formData.notes.trim(),
        isApproved: formData.isApproved,
      };

      if (editingId) {
        await onUpdate(editingId, payload);
        setSuccess('Adjustment updated successfully');
      } else {
        await onAdd(payload);
        setSuccess('Adjustment recorded successfully');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(INITIAL_FORM);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Error saving adjustment:', err);
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
        setSuccess('Adjustment deleted successfully');
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete adjustment';
        setError(message);
        console.error('Error deleting adjustment:', err);
      } finally {
        setSubmitting(false);
      }
    } else {
      setDeleting(id);
    }
  };

  const handlePostToGL = async (adj: StockAdjustment) => {
    if (!onPostGL || accounts.length === 0) {
      setError('GL posting not configured. Please provide accounts and onPostGL callback.');
      return;
    }

    const item = items.find(i => i.id === adj.stockItemId);
    if (!item) {
      setError('Item not found for this adjustment.');
      return;
    }

    setPostingGL(adj.id);
    try {
      const glEntry = InventoryGLService.createAdjustmentEntry(adj, item, accounts, adj.orgId, currentUserId || 'system');
      
      if (!glEntry) {
        setError('GL entry creation failed. Please ensure required GL accounts are configured (Inventory, Variance).');
        return;
      }

      await onPostGL(glEntry.entry, glEntry.lines, adj.id);
      setSuccess(`Adjustment GL entry posted successfully (${glEntry.entry.reference})`);
      await onUpdate(adj.id, { journalEntryId: `je-adj-${adj.id}` });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to post GL entry';
      setError(message);
      console.error('Error posting GL entry:', err);
    } finally {
      setPostingGL(null);
    }
  };

  const activeAdjustments = useMemo(() => adjustments.filter((adj) => !adj.isDeleted), [adjustments]);

  const filteredAdjustments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return activeAdjustments
      .filter((adj) => {
        const item = stockItems.find((i) => i.id === adj.stockItemId);
        const location = activeLocations.find((l) => l.id === adj.warehouseLocationId);
        const searchableText = [
          item?.code || '',
          item?.name || '',
          location?.code || '',
          location?.name || '',
          adj.reason || '',
          adj.notes || '',
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesType = typeFilter === 'ALL' || adj.adjustmentType === typeFilter;
        const matchesApproval = approvalFilter === 'ALL'
          || (approvalFilter === 'APPROVED' && adj.isApproved)
          || (approvalFilter === 'PENDING' && !adj.isApproved);

        return matchesSearch && matchesType && matchesApproval;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [activeAdjustments, stockItems, activeLocations, searchTerm, typeFilter, approvalFilter]);

  const hasActiveFilters = searchTerm.trim() !== '' || typeFilter !== 'ALL' || approvalFilter !== 'ALL';

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'DAMAGE':
        return 'bg-red-100 text-red-800';
      case 'WRITEOFF':
        return 'bg-orange-100 text-orange-800';
      case 'CORRECTION':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Stock Adjustments</h2>
          <p className="text-sm text-gray-500 font-normal italic">Record inventory variances, damage, and write-offs.</p>
        </div>
        <div className="flex gap-3">
           {!showForm && (
            <button
              onClick={handleAddClick}
              disabled={isLoading || submitting}
              className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded font-semibold text-xs uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              New Adjustment
            </button>
           )}
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
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Adjustments</p>
          <div className="flex items-end justify-between">
            <p className="text-xl font-semibold text-gray-800 tracking-tight">{activeAdjustments.length}</p>
            <BookOpen className="text-gray-200 group-hover:scale-110 transition-transform" size={40} />
          </div>
        </div>
        <div className="bg-rose-50 p-6 rounded border border-rose-100 shadow-sm">
           <p className="text-xs font-semibold text-rose-800 uppercase tracking-wide mb-1">Write-Offs / Damages</p>
           <p className="text-xl font-semibold text-rose-600 tracking-tight">
             {activeAdjustments.filter(a => a.adjustmentType === 'WRITEOFF' || a.adjustmentType === 'DAMAGE').length}
           </p>
        </div>
        <div className="bg-amber-50 p-6 rounded border border-amber-100 shadow-sm">
           <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Pending GL Posting</p>
           <p className="text-xl font-semibold text-amber-600 tracking-tight">
             {activeAdjustments.filter(a => !a.journalEntryId).length}
           </p>
        </div>
        <div className="bg-gray-800 p-6 rounded border border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Units (Net Change)</p>
          <p className="text-xl font-semibold text-white tracking-tight leading-none pt-1">
            {activeAdjustments.reduce((sum, a) => sum + (a.adjustmentType === 'RECEIPT' || (a.adjustmentType === 'CORRECTION' && a.quantity > 0) ? a.quantity : -a.quantity), 0).toFixed(0)}
          </p>
        </div>
      </div>

       {/* Form Overlay (Institutional Standard) */}
       {showForm && (
        <div className="bg-white rounded-md border-2 border-orange-100 shadow-sm overflow-hidden animate-in zoom-in-95 duration-200">
           <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 uppercase tracking-tight">{editingId ? 'Edit Stock Adjustment' : 'Record Physical Variance'}</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mt-1 italic">Authorized personal only â€¢ Document #ADJ-{Date.now().toString().slice(-4)}</p>
              </div>
              <button onClick={handleCancel} className="p-2.5 bg-white rounded shadow-sm text-gray-400 hover:text-gray-600 transition-all border border-gray-100"><X size={20} /></button>
           </div>
           
           <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Reference SKU *</label>
                    <select
                      value={formData.stockItemId}
                      onChange={(e) => setFormData({ ...formData, stockItemId: e.target.value })}
                      disabled={submitting}
                      className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-semibold text-gray-800"
                    >
                      <option value="">Select an item...</option>
                      {stockItems.map((item) => (
                        <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>
                      ))}
                    </select>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Warehouse Zone *</label>
                    <select
                      value={formData.warehouseLocationId}
                      onChange={(e) => setFormData({ ...formData, warehouseLocationId: e.target.value })}
                      disabled={submitting}
                      className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-semibold text-gray-800"
                    >
                      <option value="">Select a location...</option>
                      {activeLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>[{loc.code}] {loc.name}</option>
                      ))}
                    </select>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Adjustment Type *</label>
                    <select
                      value={formData.adjustmentType}
                      onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value as any })}
                      disabled={submitting}
                      className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-semibold text-gray-800 uppercase"
                    >
                      {ADJUSTMENT_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Quantity Variance *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                      disabled={submitting}
                      className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-semibold text-gray-800 font-mono"
                    />
                 </div>

                 <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Primary Justification *</label>
                    <input
                      type="text"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      disabled={submitting}
                      placeholder="Enter legal justification for stock variance..."
                      className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-semibold text-gray-800"
                    />
                 </div>

                 <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Internal Notes</label>
                    <textarea
                       value={formData.notes || ''}
                       onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                       disabled={submitting}
                       placeholder="Additional details for audit trail..."
                       rows={3}
                       className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-semibold text-gray-800 resize-none"
                    />
                 </div>

                 <div className="md:col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.isApproved}
                          onChange={(e) => setFormData({ ...formData, isApproved: e.target.checked })}
                          disabled={submitting}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-[#F47721] transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide group-hover:text-gray-800 transition-colors">Mark as Authorized / Approved</span>
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
                  className="px-5 py-3.5 bg-[#F47721] text-white rounded font-semibold text-xs uppercase tracking-wide shadow-sm shadow-gray-300/30 hover:bg-[#E06610] hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'PROCESSING...' : 'COMMIT ADJUSTMENT'}
                </button>
              </div>
           </form>
        </div>
      )}

      {/* Filter & List Bar */}
      {!showForm && (
        <div className="bg-white border-y px-4 py-2 no-print">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
              <Search size={14} className="text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Search adjustments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
              />
            </div>

            <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
              <span className="text-[13px] text-gray-500 mr-1">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'ALL' | typeof ADJUSTMENT_TYPES[number])}
                className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[170px]"
              >
                <option value="ALL">All</option>
                {ADJUSTMENT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
              <span className="text-[13px] text-gray-500 mr-1">Approval:</span>
              <select
                value={approvalFilter}
                onChange={(e) => setApprovalFilter(e.target.value as 'ALL' | 'APPROVED' | 'PENDING')}
                className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[170px]"
              >
                <option value="ALL">All</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
              </select>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            <button
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('ALL');
                setApprovalFilter('ALL');
              }}
              className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
              title="Clear all filters"
            >
              <RotateCcw size={16} />
            </button>

            <div className="ml-auto text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{filteredAdjustments.length}</span> of {activeAdjustments.length} adjustments
            </div>

            <button
              onClick={() => {
                const exportData = filteredAdjustments.map(adj => {
                  const item = stockItems.find(i => i.id === adj.stockItemId);
                  const location = activeLocations.find(l => l.id === adj.warehouseLocationId);
                  return {
                    Date: new Date(adj.createdAt).toLocaleDateString(),
                    Code: item?.code || 'N/A',
                    Item: item?.name || 'N/A',
                    Location: location?.name || 'N/A',
                    Type: adj.adjustmentType,
                    Qty: adj.quantity,
                    Reason: adj.reason,
                    Posted: adj.journalEntryId ? 'Yes' : 'No'
                  };
                });
                DataExportService.exportToCSV(exportData, `Stock_Adjustments_${new Date().toISOString().split('T')[0]}.csv`);
              }}
              className="flex items-center gap-2 h-9 px-3 bg-white text-gray-700 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-[13px] font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={filteredAdjustments.length === 0}
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>
      )}

      {/* List Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-orange-200 border-t-[#F47721] rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading adjustments...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-sans">
              <thead className="bg-brand border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Item</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Location</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Type</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Quantity</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Reason</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Approval</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">GL Status</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAdjustments.length > 0 ? filteredAdjustments.map((adj) => {
                  const item = stockItems.find((i) => i.id === adj.stockItemId);
                  const location = activeLocations.find((l) => l.id === adj.warehouseLocationId);

                  return (
                    <tr key={adj.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{item?.code}</div>
                        <div className="text-xs text-gray-600">{item?.name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {location?.code} - {location?.name}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getTypeColor(adj.adjustmentType)}`}>
                          {adj.adjustmentType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                        {adj.quantity} {item?.unitOfMeasure}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {adj.reason}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            adj.isApproved
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {adj.isApproved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {adj.journalEntryId ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            <Check className="w-3 h-3" />
                            Posted
                          </span>
                        ) : adj.isApproved ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                            <AlertCircle className="w-3 h-3" />
                            Ready
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {adj.isApproved && !adj.journalEntryId && onPostGL && (
                            <button
                              onClick={() => handlePostToGL(adj)}
                              disabled={submitting || postingGL === adj.id}
                              className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              title="Post to GL"
                            >
                              {postingGL === adj.id ? <div className="w-4 h-4 border-2 border-brand-light border-t-gray-500 rounded-full animate-spin" /> : <BookOpen className="w-4 h-4" />}
                            </button>
                          )}
                          {adj.journalEntryId && (
                            <div className="flex items-center gap-1 text-xs text-green-600 px-2 py-1 bg-green-50 rounded">
                              <Check className="w-3 h-3" />
                              GL Posted
                            </div>
                          )}
                          <button
                            onClick={() => handleEditClick(adj)}
                            disabled={submitting}
                            className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(adj.id)}
                            disabled={submitting}
                            className={`p-2 rounded transition-colors ${
                              deleting === adj.id
                                ? 'bg-red-100 text-red-700'
                                : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={deleting === adj.id ? 'Click again to confirm' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <BookOpen size={40} className="mx-auto mb-2 text-gray-300" />
                      {hasActiveFilters
                        ? 'Try adjusting your search or filters.'
                        : 'No adjustments recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Audit Footer */}
        {!isLoading && filteredAdjustments.length > 0 && (
           <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center no-print">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm"><AlertCircle size={16} className="text-amber-500" /></div>
                  <div>
                     <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Integrity Check</p>
                     <p className="text-xs font-bold text-gray-600">Representing {filteredAdjustments.length} physical count variance logs.</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-1.5"><Check size={12} className="text-brand" /> LOGISTICS_AUDIT_ENABLED</p>
                  <p className="text-xs font-bold text-gray-300 italic mt-1 uppercase">Snapshot: {new Date().toLocaleString()}</p>
               </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default StockAdjustmentsView;

