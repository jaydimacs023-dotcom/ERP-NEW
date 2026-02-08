import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, Check, Search, BookOpen, AlertCircle, Download } from 'lucide-react';
import { StockAdjustment, StockItem, InventoryLevel, ChartOfAccount, JournalEntry, JournalLine } from '../types';
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
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState('');
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

  const activeAdjustments = adjustments.filter((adj) => !adj.isDeleted);
  const filteredAdjustments = activeAdjustments.filter((adj) => {
    const item = stockItems.find((i) => i.id === adj.stockItemId);
    return !searchTerm || item?.code.toLowerCase().includes(searchTerm.toLowerCase()) || item?.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

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
              className="flex items-center gap-2 px-6 py-3 bg-[#F47721] text-white rounded font-semibold text-xs uppercase tracking-wide shadow-lg shadow-gray-300/30 hover:bg-[#E06610] hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              New Adjustment
            </button>
           )}
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
             className="p-3 bg-white border border-gray-200 rounded text-gray-400 hover:text-[#F47721] hover:border-orange-100 transition-all active:scale-95 shadow-sm"
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
        <div className="p-6 bg-white rounded-md border border-gray-200 shadow-sm no-print">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search historical adjustments by SKU or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded text-sm font-medium focus:ring-2 focus:ring-orange-400/20 outline-none transition-all placeholder:text-gray-400"
            />
          </div>
        </div>
      )}

      {/* List Table */}
      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-8 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center w-24">Date</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Adjustment Detail</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Type</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Variance Qty</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">GL Status</th>
                <th className="px-8 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {isLoading ? (
                <tr>
                   <td colSpan={6} className="px-8 py-20 text-center">
                      <div className="w-10 h-10 border-4 border-orange-200 border-t-[#F47721] rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Synching Records...</p>
                   </td>
                </tr>
              ) : filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 italic">
                      <BookOpen className="text-gray-200" size={32} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide">No variance logs detected</p>
                    <p className="text-xs text-gray-400 mt-2 italic font-medium">Historical adjustments will appear here after creation.</p>
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((adj) => {
                  const item = stockItems.find(i => i.id === adj.stockItemId);
                  const location = activeLocations.find(l => l.id === adj.warehouseLocationId);
                  
                  return (
                    <tr key={adj.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-8 py-5">
                         <div className="text-center">
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-0.5">{new Date(adj.createdAt).toLocaleDateString('en-US', { month: 'short' })}</div>
                            <div className="text-lg font-semibold text-gray-800 leading-none">{new Date(adj.createdAt).getDate()}</div>
                         </div>
                      </td>
                      <td className="px-6 py-5">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-[#F47721] transition-colors">
                               <BookOpen size={18} />
                            </div>
                            <div>
                               <div className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-tighter mb-0.5">LOCATION: {location?.name || 'GEN-WH'}</div>
                               <div className="text-sm font-semibold text-gray-800 tracking-tight">{item?.name || 'N/A'}</div>
                               <div className="text-xs text-gray-500 italic mt-0.5 flex items-center gap-1.5"><AlertCircle size={10} /> {adj.reason}</div>
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                            adj.adjustmentType === 'WRITEOFF' ? 'bg-rose-100 text-rose-700' :
                            adj.adjustmentType === 'CORRECTION' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                         }`}>
                            {adj.adjustmentType}
                         </span>
                      </td>
                      <td className="px-6 py-5 text-right font-mono font-semibold text-gray-800">
                         {adj.quantity > 0 ? '+' : ''}{adj.quantity.toFixed(0)} <span className="text-xs text-gray-400">{item?.unitOfMeasure}</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                         {adj.journalEntryId ? (
                            <div className="flex justify-center" title="GL Posted">
                               <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 rounded-full border border-orange-100">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#F47721] shadow-[0_0_10px_rgba(20,184,166,0.3)]"></div>
                                  <span className="text-xs font-semibold uppercase tracking-wide">Posted</span>
                               </div>
                            </div>
                         ) : adj.isApproved ? (
                            <button
                               onClick={() => handlePostToGL(adj)}
                               disabled={postingGL === adj.id || submitting}
                               className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg hover:bg-amber-600 hover:text-white transition-all border border-amber-100 uppercase tracking-wide mx-auto block"
                            >
                               {postingGL === adj.id ? 'PENDING...' : 'Post to GL'}
                            </button>
                         ) : (
                            <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 uppercase tracking-wide mx-auto block w-fit">
                               Pending
                            </span>
                         )}
                      </td>
                      <td className="px-8 py-5 text-right">
                         <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!adj.journalEntryId && (
                               <>
                                  <button
                                    onClick={() => handleEditClick(adj)}
                                    className="p-2.5 text-gray-400 hover:text-[#F47721] hover:bg-white rounded transition-all shadow-sm border border-transparent hover:border-gray-100"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(adj.id)}
                                    className={`p-2.5 rounded transition-all shadow-sm border border-transparent ${
                                       deleting === adj.id ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-rose-600 hover:bg-white hover:border-gray-100'
                                    }`}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                               </>
                            )}
                         </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Audit Footer */}
        {!isLoading && filteredAdjustments.length > 0 && (
           <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center no-print">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm"><AlertCircle size={16} className="text-amber-500" /></div>
                  <div>
                     <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Integrity Check</p>
                     <p className="text-xs font-bold text-gray-600">Representing {filteredAdjustments.length} physical count variance logs.</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-1.5"><Check size={12} className="text-[#F47721]" /> LOGISTICS_AUDIT_ENABLED</p>
                  <p className="text-xs font-bold text-gray-300 italic mt-1 uppercase">Snapshot: {new Date().toLocaleString()}</p>
               </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default StockAdjustmentsView;
