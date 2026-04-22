import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, Check, AlertTriangle, Search, ChevronDown, RotateCcw } from 'lucide-react';
import { ReorderPoint, StockItem, InventoryLevel } from '../types';

interface ReorderViewProps {
  reorderPoints: ReorderPoint[];
  items: StockItem[];
  levels: InventoryLevel[];
  onAdd: (point: Omit<ReorderPoint, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, point: Partial<ReorderPoint>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currency: string;
  isLoading?: boolean;
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
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEEDS_REORDER' | 'HEALTHY'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stockItems = useMemo(
    () => items.filter((i) => !i.isDeleted && i.type === 'STOCK_ITEM'),
    [items]
  );

  const itemsNeedingReorder = useMemo(() => {
    return reorderPoints
      .filter((rp) => !rp.isDeleted && rp.isActive)
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
      });
  }, [reorderPoints, stockItems, levels]);

  const handleAddClick = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setError(null);
    setShowForm(true);
  };

  const handleEditClick = (point: ReorderPoint) => {
    setEditingId(point.id);
    setFormData({
      stockItemId: point.stockItemId,
      minimumLevel: point.minimumLevel,
      maximumLevel: point.maximumLevel,
      reorderQuantity: point.reorderQuantity,
      leadTimeDays: point.leadTimeDays,
      economicOrderQuantity: point.economicOrderQuantity,
      isActive: point.isActive,
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

    // Check for duplicate item
    const duplicateItem = reorderPoints.some(
      (rp) =>
        rp.stockItemId === formData.stockItemId &&
        rp.id !== editingId &&
        !rp.isDeleted
    );
    if (duplicateItem) {
      setError('Reorder point already exists for this item');
      return false;
    }

    if (formData.minimumLevel < 0 || formData.maximumLevel < 0) {
      setError('Levels cannot be negative');
      return false;
    }

    if (formData.minimumLevel >= formData.maximumLevel) {
      setError('Minimum level must be less than maximum level');
      return false;
    }

    if (formData.reorderQuantity < 0) {
      setError('Reorder quantity cannot be negative');
      return false;
    }

    if (formData.leadTimeDays < 0) {
      setError('Lead time cannot be negative');
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
        minimumLevel: formData.minimumLevel,
        maximumLevel: formData.maximumLevel,
        reorderQuantity: formData.reorderQuantity,
        leadTimeDays: formData.leadTimeDays,
        economicOrderQuantity: formData.economicOrderQuantity,
        isActive: formData.isActive,
      };

      if (editingId) {
        await onUpdate(editingId, payload);
        setSuccess('Reorder point updated successfully');
      } else {
        await onAdd(payload);
        setSuccess('Reorder point created successfully');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(INITIAL_FORM);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Error saving reorder point:', err);
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
        setSuccess('Reorder point deleted successfully');
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete reorder point';
        setError(message);
        console.error('Error deleting reorder point:', err);
      } finally {
        setSubmitting(false);
      }
    } else {
      setDeleting(id);
    }
  };

  const activePoints = reorderPoints.filter((rp) => !rp.isDeleted);
  const reorderingCount = itemsNeedingReorder.filter((i) => i.needsReorder).length;
  const filteredReorderItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return itemsNeedingReorder
      .filter((item) => {
        const searchableText = [
          item.item?.code || '',
          item.item?.name || '',
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesStatus = statusFilter === 'ALL'
          || (statusFilter === 'NEEDS_REORDER' && item.needsReorder)
          || (statusFilter === 'HEALTHY' && !item.needsReorder);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => (a.item?.code || '').localeCompare(b.item?.code || ''));
  }, [itemsNeedingReorder, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'ALL';

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alert */}
      {reorderingCount > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">
              {reorderingCount} item{reorderingCount !== 1 ? 's' : ''} need{reorderingCount === 1 ? 's' : ''} reordering
            </p>
            <p className="text-sm text-yellow-700 mt-1">Current stock is below minimum levels</p>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Reorder Management</h2>
            <p className="text-sm text-gray-500 font-normal italic">Configure minimum and maximum inventory thresholds for replenishment planning.</p>
          </div>
          <button
            onClick={handleAddClick}
            disabled={isLoading || submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand/20 font-medium text-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Reorder Point
          </button>
        </div>
      )}

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

      {/* Form */}
      {showForm && (
        <div className="mb-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-lg text-gray-900 mb-4">
            {editingId ? 'Edit Reorder Point' : 'New Reorder Point'}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Item */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
                <select
                  value={formData.stockItemId}
                  onChange={(e) => setFormData({ ...formData, stockItemId: e.target.value })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select an item...</option>
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Minimum Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Level *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minimumLevel}
                  onChange={(e) => setFormData({ ...formData, minimumLevel: parseFloat(e.target.value) })}
                  placeholder="e.g., 100"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-600 mt-1">When stock falls below this, reorder is triggered</p>
              </div>

              {/* Maximum Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Level *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.maximumLevel}
                  onChange={(e) => setFormData({ ...formData, maximumLevel: parseFloat(e.target.value) })}
                  placeholder="e.g., 500"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-600 mt-1">Target stock level to maintain</p>
              </div>

              {/* Reorder Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reorder Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.reorderQuantity}
                  onChange={(e) => setFormData({ ...formData, reorderQuantity: parseFloat(e.target.value) })}
                  placeholder="e.g., 200"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-600 mt-1">Standard purchase order quantity</p>
              </div>

              {/* Lead Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead Time (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.leadTimeDays}
                  onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) })}
                  placeholder="e.g., 7"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-600 mt-1">Days from order to delivery</p>
              </div>

              {/* Economic Order Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Economic Order Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.economicOrderQuantity}
                  onChange={(e) => setFormData({ ...formData, economicOrderQuantity: parseFloat(e.target.value) })}
                  placeholder="Optional"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-600 mt-1">Optimal order size (calculated automatically)</p>
              </div>

              {/* Active Status */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    disabled={submitting}
                    className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-orange-400 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#F47721] text-white rounded-lg hover:bg-[#E06610] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Save Reorder Point'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-orange-200 border-t-[#F47721] rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading reorder points...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-sans">
              <thead className="bg-brand border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">
                    Item
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">
                    Current Qty
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">
                    Min Level
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">
                    Max Level
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">
                    Reorder Qty
                  </th>
                  <th className="px-4 py-3 text-center text-[13px] font-bold text-white">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReorderItems.length > 0 ? filteredReorderItems.map((item) => (
                  <tr
                    key={item.reorderPoint.id}
                    className={`group transition-colors ${
                      item.needsReorder ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{item.item?.code}</div>
                      <div className="text-xs text-gray-600">{item.item?.name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                      {item.currentQuantity.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {item.reorderPoint.minimumLevel.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {item.reorderPoint.maximumLevel.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {item.reorderPoint.reorderQuantity.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          item.needsReorder
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {item.needsReorder ? 'Reorder Now' : 'OK'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditClick(item.reorderPoint)}
                          disabled={submitting}
                          className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(item.reorderPoint.id)}
                          disabled={submitting}
                          className={`p-2 rounded transition-colors ${
                            deleting === item.reorderPoint.id
                              ? 'bg-red-100 text-red-700'
                              : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={deleting === item.reorderPoint.id ? 'Click again to confirm' : 'Delete'}
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

      {/* Summary */}
      {filteredReorderItems.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredReorderItems.length} reorder point{filteredReorderItems.length !== 1 ? 's' : ''} |{' '}
          {reorderingCount} need{reorderingCount === 1 ? 's' : ''} immediate action
        </div>
      )}
    </div>
  );
};

export default ReorderView;
