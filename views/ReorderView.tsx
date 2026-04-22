import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, Truck, Target, Clock, ShieldCheck, Search, ChevronDown, RotateCcw } from 'lucide-react';
import { ReorderPoint, StockItem, InventoryLevel, Organization } from '../types';
import ModalPortal from '../components/ModalPortal';

interface ReorderViewProps {
  reorderPoints: ReorderPoint[];
  items: StockItem[];
  levels: InventoryLevel[];
  onAdd: (point: Omit<ReorderPoint, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, point: Partial<ReorderPoint>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currency: string;
  isLoading?: boolean;
  organization?: Organization;
}

interface FormData {
  stockItemId: string;
  minimumLevel: number;
  maximumLevel: number;
  reorderQuantity: number;
  leadTimeDays: number;
  economicOrderQuantity: number;
  isActive: boolean;
}

const INITIAL_FORM: FormData = {
  stockItemId: '',
  minimumLevel: 0,
  maximumLevel: 0,
  reorderQuantity: 0,
  leadTimeDays: 0,
  economicOrderQuantity: 0,
  isActive: true,
};

export const ReorderView: React.FC<ReorderViewProps> = ({
  reorderPoints,
  items,
  levels,
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEEDS_REORDER' | 'HEALTHY'>('ALL');

  const stockItems = useMemo(
    () => items.filter((i) => !i.isDeleted && i.type === 'STOCK_ITEM'),
    [items]
  );

  const itemsNeedingReorder = useMemo(() => {
    return reorderPoints
      .filter((rp) => !rp.isDeleted)
      .map((rp) => {
        const item = stockItems.find((i) => i.id === rp.stockItemId);
        const itemLevels = levels.filter((l) => l.stockItemId === rp.stockItemId && !l.isDeleted);
        const currentQty = itemLevels.reduce((sum, l) => sum + (l.quantityOnHand || 0), 0);
        const needsReorder = currentQty <= rp.minimumLevel;

        return {
          reorderPoint: rp,
          item,
          currentQuantity: currentQty,
          needsReorder,
        };
      })
      .filter(entry => !!entry.item);
  }, [reorderPoints, stockItems, levels]);

  const reorderingCount = itemsNeedingReorder.filter((item) => item.needsReorder).length;

  const filteredReorderItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return itemsNeedingReorder
      .filter((entry) => {
        const searchableText = [
          entry.item?.code || '',
          entry.item?.name || '',
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesStatus = statusFilter === 'ALL'
          || (statusFilter === 'NEEDS_REORDER' && entry.needsReorder)
          || (statusFilter === 'HEALTHY' && !entry.needsReorder);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => (a.item?.code || '').localeCompare(b.item?.code || ''));
  }, [itemsNeedingReorder, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'ALL';

  const summaries = useMemo(() => ({
     total: itemsNeedingReorder.length,
     critical: itemsNeedingReorder.filter(i => i.needsReorder).length,
     pending: itemsNeedingReorder.filter(i => !i.needsReorder && i.currentQuantity < i.reorderPoint.minimumLevel * 1.2).length
  }), [itemsNeedingReorder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        await onUpdate(editingId, formData);
        setSuccess('Reorder logic recalibrated successfully.');
      } else {
        await onAdd(formData);
        setSuccess('New procurement threshold deployed.');
      }
      setShowForm(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await onDelete(id);
      setSuccess('Procurement rule decommissioned.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Deletion failed.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Procurement Intelligence</h2>
          <p className="text-sm text-gray-500 font-normal italic">Automated equilibrium tracking and safety stock thresholding.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setEditingId(null);
              setFormData(INITIAL_FORM);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded font-semibold text-xs uppercase tracking-wide shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Define Threshold
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded border border-gray-200 shadow-sm flex flex-col justify-between group">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
             <Target size={12} style={{ color: brandColor }} /> Active Rules
          </p>
          <div className="flex items-end justify-between">
            <p className="text-xl font-semibold text-gray-800 tracking-tight">{summaries.total}</p>
            <ShieldCheck className="text-gray-200 group-hover:text-orange-500/10 transition-colors" size={40} />
          </div>
        </div>

        <div className="bg-rose-50 p-6 rounded border border-rose-100 shadow-sm flex flex-col justify-between">
          <p className="text-xs font-semibold text-rose-800 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
             <AlertTriangle size={12} /> Critical Violations
          </p>
          <p className="text-xl font-semibold text-rose-600 tracking-tight">{summaries.critical}</p>
        </div>

        <div className="bg-amber-50 p-6 rounded border border-amber-100 shadow-sm flex flex-col justify-between">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
             <Clock size={12} /> Near Threshold
          </p>
          <p className="text-xl font-semibold text-amber-600 tracking-tight">{summaries.pending}</p>
        </div>
      </div>

      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search reorder points..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'NEEDS_REORDER' | 'HEALTHY')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[180px]"
            >
              <option value="ALL">All</option>
              <option value="NEEDS_REORDER">Needs Reorder</option>
              <option value="HEALTHY">Healthy</option>
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
            Showing <span className="font-semibold text-gray-700">{filteredReorderItems.length}</span> of {itemsNeedingReorder.length} reorder points
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div
              className="inline-block w-8 h-8 border-4 border-orange-200 rounded-full animate-spin"
              style={{ borderTopColor: brandColor }}
            ></div>
            <p className="mt-2 text-gray-600">Loading reorder points...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-sans">
              <thead className="bg-brand border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Item</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Current Qty</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Min Level</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Max Level</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Reorder Qty</th>
                  <th className="px-4 py-3 text-center text-[13px] font-bold text-white">Status</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReorderItems.length > 0 ? filteredReorderItems.map((entry) => (
                  <tr
                    key={entry.reorderPoint.id}
                    className={`group transition-colors ${
                      entry.needsReorder ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{entry.item?.code}</div>
                      <div className="text-xs text-gray-600">{entry.item?.name}</div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400 uppercase tracking-wide">
                        <Truck className="w-3 h-3 text-brand" />
                        {entry.reorderPoint.leadTimeDays}d lead time
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                      {entry.currentQuantity.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {entry.reorderPoint.minimumLevel.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {entry.reorderPoint.maximumLevel.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {entry.reorderPoint.reorderQuantity.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          entry.needsReorder
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {entry.needsReorder ? 'Reorder Now' : 'OK'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(entry.reorderPoint.id);
                            setFormData({
                              stockItemId: entry.reorderPoint.stockItemId,
                              minimumLevel: entry.reorderPoint.minimumLevel,
                              maximumLevel: entry.reorderPoint.maximumLevel,
                              reorderQuantity: entry.reorderPoint.reorderQuantity,
                              leadTimeDays: entry.reorderPoint.leadTimeDays,
                              economicOrderQuantity: entry.reorderPoint.economicOrderQuantity,
                              isActive: entry.reorderPoint.isActive,
                            });
                            setShowForm(true);
                          }}
                          disabled={submitting}
                          className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.reorderPoint.id)}
                          disabled={submitting}
                          className={`p-2 rounded transition-colors ${
                            deleting === entry.reorderPoint.id
                              ? 'bg-red-100 text-red-700'
                              : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={deleting === entry.reorderPoint.id ? 'Click again to confirm' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      {hasActiveFilters
                        ? 'Try adjusting your search or filters.'
                        : 'No reorder points configured yet. Create one to get started.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredReorderItems.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredReorderItems.length} reorder point{filteredReorderItems.length !== 1 ? 's' : ''} |{' '}
          {reorderingCount} need{reorderingCount === 1 ? 's' : ''} immediate action
        </div>
      )}

      {showForm && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md w-full max-w-xl shadow-md border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <header className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: brandColor }}>Logic Definition</p>
                  <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Recalibrate Threshold' : 'New Equilibrium Point'}</h3>
               </div>
               <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
            </header>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
               <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Stock Item (Target SKU)</label>
                  <select
                    required
                    value={formData.stockItemId}
                    onChange={(e) => setFormData({ ...formData, stockItemId: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-bold text-gray-800"
                  >
                    <option value="">Select Item...</option>
                    {stockItems.map(item => (
                      <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                    ))}
                  </select>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Min Level (Lower Bound)</label>
                     <input
                       type="number"
                       required
                       min="0"
                       value={formData.minimumLevel}
                       onChange={(e) => setFormData({ ...formData, minimumLevel: Number(e.target.value) })}
                       className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-bold text-gray-800"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Max Level (Upper Bound)</label>
                     <input
                       type="number"
                       required
                       min="0"
                       value={formData.maximumLevel}
                       onChange={(e) => setFormData({ ...formData, maximumLevel: Number(e.target.value) })}
                       className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-bold text-gray-800"
                     />
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Reorder Qty</label>
                     <input
                       type="number"
                       required
                       min="1"
                       value={formData.reorderQuantity}
                       onChange={(e) => setFormData({ ...formData, reorderQuantity: Number(e.target.value) })}
                       className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-bold text-gray-800"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Lead Time (Days)</label>
                     <input
                       type="number"
                       required
                       min="1"
                       value={formData.leadTimeDays}
                       onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                       className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-bold text-gray-800"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">EOQ Target</label>
                     <input
                       type="number"
                       value={formData.economicOrderQuantity}
                       onChange={(e) => setFormData({ ...formData, economicOrderQuantity: Number(e.target.value) })}
                       className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-bold text-gray-800"
                     />
                  </div>
               </div>

               <button
                 type="submit"
                 disabled={submitting}
                 style={{ backgroundColor: brandColor }}
                 onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.93'; }}
                 onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                 className="w-full py-4 text-white rounded font-semibold text-xs uppercase tracking-wide shadow-sm shadow-gray-300/20 transition-all active:scale-95 disabled:opacity-50"
               >
                 {submitting ? 'PROCESSING_LOGIC...' : editingId ? 'DEPLOY_RECALIBRATION' : 'INITIALIZE_THRESHOLD'}
               </button>
            </form>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default ReorderView;

