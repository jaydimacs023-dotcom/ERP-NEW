import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Search } from 'lucide-react';
import { StockItem, InventoryValuationMethod } from '../types';

interface StockItemsViewProps {
  items: StockItem[];
  accounts: any[];
  onAdd: (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, item: Partial<StockItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currency: string;
  isLoading?: boolean;
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
  items,
  accounts,
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    // Check for duplicate codes
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
        setSuccess('Item updated successfully');
      } else {
        await onAdd(payload);
        setSuccess('Item added successfully');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(INITIAL_FORM);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Error saving item:', err);
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
        setSuccess('Item deleted successfully');
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete item';
        setError(message);
        console.error('Error deleting item:', err);
      } finally {
        setSubmitting(false);
      }
    } else {
      setDeleting(id);
    }
  };

  const activeItems = items.filter((item) => !item.isDeleted);
  const filteredItems = activeItems.filter(
    (item) =>
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl text-gray-900 mb-2">Stock Items</h1>
        <p className="text-gray-600">Manage your inventory items and product catalog</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        )}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={showForm}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
          />
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-lg text-gray-900 mb-4">
            {editingId ? 'Edit Stock Item' : 'New Stock Item'}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., SKU-001"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Product Name"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="STOCK_ITEM">Stock Item</option>
                  <option value="NON_STOCK_ITEM">Non-Stock Item (Service)</option>
                </select>
              </div>

              {/* Unit of Measure */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit of Measure *
                </label>
                <select
                  value={formData.unitOfMeasure}
                  onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Valuation Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valuation Method *
                </label>
                <select
                  value={formData.valuationMethod}
                  onChange={(e) => setFormData({ ...formData, valuationMethod: e.target.value as InventoryValuationMethod })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  {VALUATION_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reorder Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reorder Level
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Reorder Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reorder Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.reorderQuantity}
                  onChange={(e) => setFormData({ ...formData, reorderQuantity: parseFloat(e.target.value) })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Safety Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Safety Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.safetyStock}
                  onChange={(e) => setFormData({ ...formData, safetyStock: parseFloat(e.target.value) })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional item description"
                  disabled={submitting}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
                />
              </div>

              {/* Active Status */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    disabled={submitting}
                    className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Item</span>
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
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Save Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading items...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            <p>
              {searchTerm
                ? 'No items match your search.'
                : 'No items found. Create one to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Valuation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {item.type === 'STOCK_ITEM' ? 'Stock' : 'Service'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.unitOfMeasure}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.valuationMethod.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          item.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(item)}
                          disabled={submitting}
                          className="p-2 hover:bg-teal-50 text-teal-600 rounded hover:text-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(item.id)}
                          disabled={submitting}
                          className={`p-2 rounded transition-colors ${
                            deleting === item.id
                              ? 'bg-red-100 text-red-700'
                              : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={deleting === item.id ? 'Click again to confirm' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {filteredItems.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredItems.length} of {activeItems.length} item{activeItems.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default StockItemsView;
