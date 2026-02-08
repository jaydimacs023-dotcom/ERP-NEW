import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';
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

  const activeLocations = locations.filter((loc) => !loc.isDeleted);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl text-gray-900 mb-2">Warehouse Locations</h1>
        <p className="text-gray-600">Manage physical storage locations for inventory</p>
      </div>

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

      {/* Add Button */}
      {!showForm && (
        <button
          onClick={handleAddClick}
          disabled={isLoading || submitting}
          className="mb-6 flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Warehouse Location
        </button>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Save Location'}
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
            <p className="mt-2 text-gray-600">Loading warehouse locations...</p>
          </div>
        ) : activeLocations.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            <p>No warehouse locations found. Create one to get started.</p>
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
                    Location
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
                {activeLocations.map((location) => (
                  <tr key={location.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {location.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {location.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {location.location}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          location.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {location.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(location)}
                          disabled={submitting}
                          className="p-2 hover:bg-teal-50 text-teal-600 rounded hover:text-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {activeLocations.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Total: {activeLocations.length} warehouse location{activeLocations.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default WarehouseLocationsView;
