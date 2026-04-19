import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, Check, Search, Download, MapPin, Building2, AlertCircle } from 'lucide-react';
import { WarehouseLocation, Organization } from '../types';
import { DataExportService } from '../services/DataExportService';

interface WarehouseLocationsViewProps {
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

export const WarehouseLocationsView: React.FC<WarehouseLocationsViewProps> = ({
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
        setSuccess('Warehouse location updated successfully');
      } else {
        await onAdd(payload);
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

  const activeLocations = locations.filter((loc) => !loc.isDeleted);
  const filteredItems = activeLocations.filter(loc => 
    loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loc.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              style={{
                backgroundColor: brandColor,
                boxShadow: `0 10px 15px -3px ${brandColor}20`
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${brandColor}dd`)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = brandColor)}
              className="flex items-center gap-2 px-6 py-3 text-white rounded font-semibold text-xs uppercase tracking-wide hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              New Location
            </button>
           )}
           <button
             onClick={() => {
                const exportData = filteredItems.map(loc => ({
                  Code: loc.code,
                  Name: loc.name,
                  Description: loc.location,
                  Status: loc.isActive ? 'Active' : 'Inactive'
                }));
                DataExportService.exportToCSV(exportData, `Warehouse_Map_${new Date().toISOString().split('T')[0]}.csv`);
             }}
             style={{ borderColor: `${brandColor}20` }}
             onMouseEnter={(e) => { 
               e.currentTarget.style.borderColor = `${brandColor}40`;
               e.currentTarget.style.color = brandColor;
             }}
             onMouseLeave={(e) => { 
               e.currentTarget.style.borderColor = `${brandColor}20`;
               e.currentTarget.style.color = '#9CA3AF';
             }}
             className="p-3 bg-white rounded transition-all active:scale-95 shadow-sm border text-gray-400"
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
        <div className="p-6 bg-white rounded-md border border-gray-200 shadow-sm no-print">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search via zone code, name or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                focusRingColor: `${brandColor}30`
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.boxShadow = `0 0 0 2px ${brandColor}20`;
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
              }}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded text-sm font-medium outline-none transition-all placeholder:text-gray-400"
            />
          </div>
        </div>
      )}

      {/* Table List */}
      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-8 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center w-24">CID</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Location Detail</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Physical Address</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Status</th>
                <th className="px-8 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {isLoading ? (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: `${brandColor}30`, borderTopColor: brandColor }}></div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Mapping Logistics Architecture...</p>
                   </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 italic">
                      <Building2 className="text-gray-200" size={32} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{searchTerm ? 'Search produced no coordinates' : 'No logistics centers defined'}</p>
                    <p className="text-xs text-gray-400 mt-2 italic font-medium">Add a physical location to begin inventory tracking.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((loc) => (
                  <tr key={loc.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-5">
                       <div className="text-center">
                          <div className="text-xs font-mono font-semibold text-gray-400 uppercase mb-0.5 tracking-tighter">{loc.code}</div>
                          <div className="w-8 h-1 rounded-full mx-auto" style={{ backgroundColor: `${brandColor}30` }}></div>
                       </div>
                    </td>
                    <td className="px-6 py-5 font-semibold text-gray-800 tracking-tight">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: `${brandColor}15`, color: brandColor }}>
                             <Building2 size={16} />
                          </div>
                          {loc.name}
                       </div>
                    </td>
                    <td className="px-6 py-5 text-gray-500 font-medium truncate max-w-xs">{loc.location}</td>
                    <td className="px-6 py-5 text-center">
                       <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                          loc.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                       }`}>
                          {loc.isActive ? 'ACTIVE_CENTER' : 'LOCKED'}
                       </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditClick(loc)}
                            className="p-2.5 text-gray-400 rounded transition-all shadow-sm border border-transparent hover:border-gray-100"
                            style={{}}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = brandColor;
                              e.currentTarget.style.backgroundColor = 'white';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#9CA3AF';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
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
        {!isLoading && filteredItems.length > 0 && (
           <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center no-print">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm"><Check size={16} style={{ color: brandColor }} /></div>
                  <div>
                     <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Logistics Integrity</p>
                     <p className="text-xs font-bold text-gray-600">Total physical storage footprint: {filteredItems.length} registered zones.</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-1.5"><MapPin size={12} /> COORDINATES_VERIFIED</p>
                  <p className="text-xs font-bold text-gray-300 italic mt-1 uppercase">Snapshot: {new Date().toLocaleString()}</p>
               </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default WarehouseLocationsView;

