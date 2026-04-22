import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Search, ChevronDown, RotateCcw } from 'lucide-react';
import { WarehouseLocation } from '../types';

interface WarehouseLocationsViewProps {
  locations: WarehouseLocation[];
  onAdd: (location: Omit<WarehouseLocation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, location: Partial<WarehouseLocation>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currency: string;
  isLoading?: boolean;
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

export const WarehouseLocationsView: React.FC<WarehouseLocationsViewProps> = ({
  locations,
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
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

    // Check for duplicate codes (excluding current item if editing)
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

    if (!validateForm()) {
      return;
    }

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
        setSuccess('Warehouse location updated successfully');
      } else {
        await onAdd(payload);
        setSuccess('Warehouse location added successfully');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(INITIAL_FORM);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Error saving location:', err);
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
        setSuccess('Warehouse location deleted successfully');
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete location';
        setError(message);
        console.error('Error deleting location:', err);
      } finally {
        setSubmitting(false);
      }
    } else {
      setDeleting(id);
    }
  };

  const activeLocations = React.useMemo(() => locations.filter((loc) => !loc.isDeleted), [locations]);

  const filteredLocations = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return activeLocations
      .filter(location => {
        const searchableText = [
          location.code,
          location.name,
          location.location,
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesStatus = statusFilter === 'ALL'
          || (statusFilter === 'ACTIVE' && location.isActive)
          || (statusFilter === 'INACTIVE' && !location.isActive);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [activeLocations, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'ALL';

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">{success}</p>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="text-green-500 hover:text-green-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!showForm && (
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Warehouse Locations</h2>
            <p className="text-sm text-gray-500 font-normal italic">Manage physical storage points and facility mapping for inventory operations.</p>
          </div>
          <button
            onClick={handleAddClick}
            disabled={isLoading || submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand/20 font-medium text-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Warehouse Location
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-lg text-gray-900 mb-4">
            {editingId ? 'Edit Warehouse Location' : 'New Warehouse Location'}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., WH-01"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Warehouse"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Location */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location/Address *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Building A, Floor 2"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
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
                    className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-orange-400 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Location</span>
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
                {submitting ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
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
            Showing <span className="font-semibold text-gray-700">{filteredLocations.length}</span> of {activeLocations.length} locations
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-orange-200 border-t-[#F47721] rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading warehouse locations...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-sans">
              <thead className="bg-brand border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLocations.length > 0 ? filteredLocations.map((location) => (
                  <tr key={location.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {location.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {location.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {location.location}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                          location.isActive
                            ? 'bg-brand/10 text-brand border-brand-light'
                            : 'bg-gray-100 text-gray-800 border-gray-200'
                        }`}
                      >
                        {location.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditClick(location)}
                          disabled={submitting}
                          className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(location.id)}
                          disabled={submitting}
                          className={`p-2 rounded transition-colors ${
                            deleting === location.id
                              ? 'bg-red-100 text-red-700'
                              : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={deleting === location.id ? 'Click again to confirm' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      {hasActiveFilters
                        ? 'Try adjusting your search or filters.'
                        : 'No warehouse locations found. Create one to get started.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {filteredLocations.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Total: {filteredLocations.length} warehouse location{filteredLocations.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default WarehouseLocationsView;
