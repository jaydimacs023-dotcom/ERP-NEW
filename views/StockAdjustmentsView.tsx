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
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl text-gray-900 mb-2">Stock Adjustments</h1>
        <p className="text-gray-600">Record inventory variances, damage, and write-offs</p>
      </div>

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

      {/* Controls */}
      <div className="mb-6 flex gap-3 items-center">
        {!showForm && (
          <button
            onClick={handleAddClick}
            disabled={isLoading || submitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Adjustment
          </button>
        )}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by item code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={showForm}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
          />
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-lg text-gray-900 mb-4">
            {editingId ? 'Edit Stock Adjustment' : 'Record Stock Adjustment'}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Item */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
                <select
                  value={formData.stockItemId}
                  onChange={(e) => setFormData({ ...formData, stockItemId: e.target.value })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select an item...</option>
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse Location *
                </label>
                <select
                  value={formData.warehouseLocationId}
                  onChange={(e) => setFormData({ ...formData, warehouseLocationId: e.target.value })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select a location...</option>
                  {activeLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={formData.adjustmentType}
                  onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value as any })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  {ADJUSTMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Reason */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Physical count variance"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes about the adjustment"
                  disabled={submitting}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
                />
              </div>

              {/* Approval */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isApproved}
                    onChange={(e) => setFormData({ ...formData, isApproved: e.target.checked })}
                    disabled={submitting}
                    className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm font-medium text-gray-700">Mark as Approved</span>
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Save Adjustment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {filteredAdjustments.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Stock Adjustments</h3>
              <p className="text-xs text-gray-600 mt-1">Showing {filteredAdjustments.length} of {activeAdjustments.length} adjustment{activeAdjustments.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => {
                const exportData = filteredAdjustments.map(adj => {
                  const item = items.find(i => i.id === adj.stockItemId);
                  return {
                    referenceNumber: `ADJ-${adj.id.slice(0, 8)}`,
                    itemName: item?.name || 'N/A',
                    warehouse: adj.warehouseLocationId,
                    type: adj.adjustmentType,
                    quantity: adj.quantityChange,
                    reason: adj.reason,
                    notes: adj.notes || '',
                    status: adj.isApproved ? 'Approved' : 'Pending',
                    glStatus: adj.journalEntryId ? 'Posted' : 'Ready',
                    createdAt: new Date(adj.createdAt || Date.now()).toLocaleDateString()
                  };
                });
                DataExportService.exportStockAdjustments(exportData, currency);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading adjustments...</p>
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            <p>
              {searchTerm ? 'No adjustments match your search.' : 'No adjustments recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Approval
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    GL Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAdjustments.map((adj) => {
                  const item = stockItems.find((i) => i.id === adj.stockItemId);
                  const location = activeLocations.find((l) => l.id === adj.warehouseLocationId);

                  return (
                    <tr key={adj.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900">{item?.code}</div>
                        <div className="text-xs text-gray-600">{item?.name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {location?.code} - {location?.name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getTypeColor(adj.adjustmentType)}`}>
                          {adj.adjustmentType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 font-medium">
                        {adj.quantity} {item?.unitOfMeasure}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {adj.reason}
                      </td>
                      <td className="px-6 py-4 text-sm">
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
                      <td className="px-6 py-4 text-sm">
                        {adj.journalEntryId ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            <Check className="w-3 h-3" />
                            Posted
                          </span>
                        ) : adj.isApproved ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            <AlertCircle className="w-3 h-3" />
                            Ready
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <div className="flex justify-end gap-2">
                          {adj.isApproved && !adj.journalEntryId && onPostGL && (
                            <button
                              onClick={() => handlePostToGL(adj)}
                              disabled={submitting || postingGL === adj.id}
                              className="p-2 hover:bg-purple-50 text-purple-600 rounded hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              title="Post to GL"
                            >
                              {postingGL === adj.id ? <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" /> : <BookOpen className="w-4 h-4" />}
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
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {filteredAdjustments.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredAdjustments.length} of {activeAdjustments.length} adjustment{activeAdjustments.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default StockAdjustmentsView;
