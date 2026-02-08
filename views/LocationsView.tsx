
import React, { useState } from 'react';
import { Location } from '../types';
import EmptyState from '../components/EmptyState';
import { generateUUID } from '../utils/uuid';
import { 
  Search, Plus, MapPin, Trash2, X, Edit2, ShieldCheck, 
  Map, Building, Globe, ChevronRight, MoreVertical, Loader2,
  CheckCircle, AlertCircle, Users
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface LocationsViewProps {
  locations: Location[];
  onAddLocation: (location: Location) => void | Promise<void>;
  onUpdateLocation: (location: Location) => void | Promise<void>;
  onDeleteLocation: (id: string) => void | Promise<boolean>;
}

const LocationsView: React.FC<LocationsViewProps> = ({ 
  locations, onAddLocation, onUpdateLocation, onDeleteLocation 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [formData, setFormData] = useState<Partial<Location>>({
    name: '',
    address: '',
    capacity: 0
  });

  const filteredLocations = locations.filter(l => 
    !l.isDeleted && (
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    l.address.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const resetForm = () => {
    setFormData({ name: '', address: '', capacity: 0 });
    setEditingLocation(null);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}`;
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const openEditModal = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      address: location.address,
      capacity: location.capacity || 0
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address) return;

    setIsSubmitting(true);
    
    try {
      if (editingLocation) {
        // Update existing location
        const updatedLocation: Location = {
          ...editingLocation,
          name: formData.name,
          address: formData.address,
          capacity: Number(formData.capacity) || 0,
          updatedAt: new Date().toISOString()
        };
        await onUpdateLocation(updatedLocation);
        showToast(`Location "${formData.name}" updated successfully!`, 'success');
      } else {
        // Create new location with proper UUID
        const newLocation: Location = {
          id: generateUUID(),
          orgId: '', // Will be set by App.tsx handler
          name: formData.name,
          address: formData.address,
          capacity: Number(formData.capacity) || 0,
          createdAt: new Date().toISOString()
        };
        await onAddLocation(newLocation);
        showToast(`Location "${formData.name}" registered successfully!`, 'success');
      }
      
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving location:', error);
      showToast(`Failed to save location: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location? This action cannot be undone.')) return;
    
    const locationToDelete = locations.find(l => l.id === id);
    setDeletingId(id);
    try {
      const result = await onDeleteLocation(id);
      if (result === false) {
        showToast('Cannot delete location: It is currently in use by batches or schedules.', 'error');
      } else {
        showToast(`Location "${locationToDelete?.name || 'Unknown'}" deleted successfully!`, 'success');
      }
    } catch (error) {
      showToast(`Failed to delete location: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border border-teal-200 text-teal-800'
                : toast.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-teal-50 border border-teal-200 text-teal-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={18} className="flex-shrink-0 text-teal-600" />}
            {toast.type === 'error' && <AlertCircle size={18} className="flex-shrink-0 text-red-600" />}
            {toast.type === 'info' && <AlertCircle size={18} className="flex-shrink-0 text-teal-600" />}
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-auto text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">
            Training Locations
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Manage physical facilities, classrooms, and satellite centers.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-md shadow-teal-100 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> Add New Facility
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by facility name or code..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLocations.length > 0 ? filteredLocations.map(loc => (
          <div key={loc.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center transition-colors group-hover:bg-teal-600 group-hover:text-white">
                  <Building size={24} />
                </div>
                <div className="flex gap-1">
                   <button 
                     onClick={() => openEditModal(loc)}
                     className="p-2 hover:bg-teal-50 rounded-xl text-slate-400 hover:text-teal-600 transition-colors"
                     title="Edit"
                   >
                     <Edit2 size={16} />
                   </button>
                   <button 
                     onClick={() => handleDelete(loc.id)}
                     disabled={deletingId === loc.id}
                     className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                     title="Delete"
                   >
                     {deletingId === loc.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                   </button>
                </div>
              </div>

              <div className="space-y-4">
                 <div>
                    <h3 className="text-lg font-semibold text-slate-800 leading-tight truncate">{loc.name}</h3>
                    {loc.capacity && loc.capacity > 0 && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                        <Users size={12} />
                        <span>Capacity: {loc.capacity}</span>
                      </div>
                    )}
                 </div>

                 <div className="flex gap-3">
                    <Map size={18} className="text-slate-400 shrink-0 mt-1" />
                    <p className="text-xs font-medium text-slate-500 leading-relaxed italic">{loc.address}</p>
                 </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
               <div className="flex items-center gap-1.5 text-[10px] font-semibold text-teal-600 uppercase tracking-widest">
                  <ShieldCheck size={14} /> Operational
               </div>
               <button className="text-teal-600 text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                  Facility Info <ChevronRight size={14} strokeWidth={2} />
               </button>
            </div>
          </div>
        )) : (
          <EmptyState 
            title="No training facilities"
            description="Register your first training location to manage classrooms and satellite centers."
            actionLabel="Add Facility"
            onAction={() => { resetForm(); setShowModal(true); }}
            icon={<MapPin size={48} className="text-slate-300" />}
          />
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-600 text-white rounded-xl shadow-md">
                  <MapPin size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">
                  {editingLocation ? 'Modify Facility' : 'Register Facility'}
                </h3>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Facility Display Name</label>
                  <input 
                    required 
                    autoFocus
                    placeholder="e.g. Skills Development Hub"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-600 outline-none font-semibold text-slate-800"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Full Physical Address</label>
                  <textarea 
                    required 
                    rows={3}
                    placeholder="Provide exact location for learner navigation..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-600 outline-none text-sm font-medium resize-none"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Seating Capacity (Optional)</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-600 outline-none font-semibold text-slate-800"
                    value={formData.capacity || ''}
                    onChange={e => setFormData({...formData, capacity: e.target.value === '' ? 0 : Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 flex gap-3">
                 <Globe className="text-teal-600 shrink-0" size={20} />
                 <p className="text-[11px] text-teal-800 leading-relaxed font-medium">
                   Training locations are linked to scheduling and attendance tracking. Ensure addresses are verifiable for accreditation purposes.
                 </p>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-3.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">Discard</button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-teal-600 text-white rounded-2xl text-sm font-semibold shadow-md shadow-teal-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {editingLocation ? 'Apply Updates' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationsView;
