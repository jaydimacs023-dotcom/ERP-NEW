import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Search, Download, MapPin, Building2, AlertCircle } from 'lucide-react';
import { WarehouseLocation } from '../types';
import { DataExportService } from '../services/DataExportService';

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
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Warehouse Locations</h2>
          <p className="text-sm text-slate-500 font-normal italic">Define physical storage zones and internal logistics centers.</p>
        </div>
        <div className="flex gap-3">
           {!showForm && (
            <button
              onClick={handleAddClick}
              disabled={isLoading || submitting}
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-teal-900/20 hover:bg-teal-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
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
             className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-teal-600 hover:border-teal-100 transition-all active:scale-95 shadow-sm"
             title="Export CSV"
           >
             <Download size={20} />
           </button>
        </div>
      </header>

      {/* Notifications */}
      <div className="space-y-4">
        {error && (
          <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
               <AlertCircle className="text-rose-600" size={20} />
               <p className="text-sm font-black text-rose-800 uppercase tracking-tight">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-1.5 hover:bg-rose-100 rounded-lg text-rose-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
             <div className="flex items-center gap-3">
               <Check className="text-emerald-600" size={20} />
               <p className="text-sm font-black text-emerald-800 uppercase tracking-tight">{success}</p>
             </div>
             <button onClick={() => setSuccess(null)} className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-500 transition-colors">
               <X className="w-4 h-4" />
             </button>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Zones</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-slate-800 tracking-tight">{activeLocations.length}</p>
            <MapPin className="text-slate-100 group-hover:scale-110 transition-transform" size={40} />
          </div>
        </div>
        <div className="bg-teal-50 p-6 rounded-[2rem] border border-teal-100 shadow-sm">
           <p className="text-[10px] font-black text-teal-800 uppercase tracking-widest mb-1">Active Centers</p>
           <p className="text-3xl font-black text-teal-600 tracking-tight">
             {activeLocations.filter(l => l.isActive).length}
           </p>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl md:col-span-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Logistics Integrity</p>
          <div className="flex items-center gap-4 mt-2">
             <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: '100%' }}></div>
             </div>
             <span className="text-xs font-black text-white uppercase tracking-widest">Verified</span>
          </div>
        </div>
      </div>

      {/* Form Overlay */}
      {showForm && (
        <div className="bg-white rounded-[2.5rem] border-2 border-teal-100 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
           <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingId ? 'Edit Storage Zone' : 'Define New Capacity'}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 italic">Internal Warehouse Mapping Specification</p>
              </div>
              <button onClick={handleCancel} className="p-2.5 bg-white rounded-xl shadow-sm text-slate-400 hover:text-slate-600 transition-all border border-slate-100"><X size={20} /></button>
           </div>
           
           <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Zone Code *</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="e.g. WH-01"
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-teal-500/20 focus:bg-white transition-all text-sm font-black text-slate-800 font-mono"
                    />
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Friendly Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Bulk Storage Alpha"
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-teal-500/20 focus:bg-white transition-all text-sm font-black text-slate-800"
                    />
                 </div>

                 <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Physical Address / Description *</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Enter precise physical location details..."
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-teal-500/20 focus:bg-white transition-all text-sm font-black text-slate-800"
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
                        <div className="w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-teal-600 transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-800 transition-colors">Active Warehouse Center</span>
                    </label>
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-8 py-3.5 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-10 py-3.5 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-teal-900/20 hover:bg-teal-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {editingId ? 'COMMIT CHANGES' : 'CREATE STORAGE ZONE'}
                </button>
              </div>
           </form>
        </div>
      )}

      {/* Filter Bar */}
      {!showForm && (
        <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm no-print">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search via zone code, name or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-teal-500/20 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      )}

      {/* Table List */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-24">CID</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location Detail</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Physical Address</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {isLoading ? (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Mapping Logistics Architecture...</p>
                   </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 italic">
                      <Building2 className="text-slate-200" size={32} />
                    </div>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest">{searchTerm ? 'Search produced no coordinates' : 'No logistics centers defined'}</p>
                    <p className="text-xs text-slate-400 mt-2 italic font-medium">Add a physical location to begin inventory tracking.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                       <div className="text-center">
                          <div className="text-[10px] font-mono font-black text-slate-400 uppercase mb-0.5 tracking-tighter">{loc.code}</div>
                          <div className="w-8 h-1 bg-teal-500/20 rounded-full mx-auto"></div>
                       </div>
                    </td>
                    <td className="px-6 py-5 font-black text-slate-800 tracking-tight">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">
                             <Building2 size={16} />
                          </div>
                          {loc.name}
                       </div>
                    </td>
                    <td className="px-6 py-5 text-slate-500 font-medium truncate max-w-xs">{loc.location}</td>
                    <td className="px-6 py-5 text-center">
                       <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          loc.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                       }`}>
                          {loc.isActive ? 'ACTIVE_CENTER' : 'LOCKED'}
                       </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditClick(loc)}
                            className="p-2.5 text-slate-400 hover:text-teal-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(loc.id)}
                            className={`p-2.5 rounded-xl transition-all shadow-sm border border-transparent ${
                               deleting === loc.id ? 'bg-rose-600 text-white shadow-rose-900/20' : 'text-slate-400 hover:text-rose-600 hover:bg-white hover:border-slate-100'
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
           <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center no-print">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm"><Check size={16} className="text-teal-600" /></div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Logistics Integrity</p>
                     <p className="text-xs font-bold text-slate-600">Total physical storage footprint: {filteredItems.length} registered zones.</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1.5 font-bold"><MapPin size={12} /> COORDINATES_VERIFIED</p>
                  <p className="text-[9px] font-bold text-slate-300 italic mt-1 uppercase">Snapshot: {new Date().toLocaleString()}</p>
               </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default WarehouseLocationsView;
