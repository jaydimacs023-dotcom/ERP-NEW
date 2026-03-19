
import React, { useState } from 'react';
import { Batch, Location, TrainerSchedule } from '../types';
import EmptyState from '../components/EmptyState';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
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
  batches: Batch[];
  schedules: TrainerSchedule[];
  onAddLocation: (location: Location) => void | Promise<void>;
  onUpdateLocation: (location: Location) => void | Promise<void>;
  onDeleteLocation: (id: string) => void | Promise<boolean>;
}

const LocationsView: React.FC<LocationsViewProps> = ({ 
  locations, batches, schedules, onAddLocation, onUpdateLocation, onDeleteLocation 
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
    const locationToDelete = locations.find(l => l.id === id);
    const engagedBatch = batches.find(b => b.locationId === id && (b.status === 'PLANNED' || b.status === 'ONGOING'));
    const engagedSchedule = schedules.find(s => s.locationId === id);

    if (engagedBatch || engagedSchedule) {
      const reason = engagedBatch ? `batch ${engagedBatch.name} (${engagedBatch.status.toLowerCase()})` : 'an active schedule';
      showToast(`Cannot delete location "${locationToDelete?.name || 'Unknown'}" because it is in use by ${reason}.`, 'error');
      return;
    }

    if (!confirm('Are you sure you want to delete this location? This action cannot be undone.')) return;
    
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Training Locations</h2>
          <p className="text-sm text-gray-500 font-normal italic">Manage physical facilities, classrooms, and satellite centers.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#F47721] text-white rounded hover:bg-[#E06610] transition-all shadow-md shadow-gray-100 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> Add New Facility
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by facility name or code..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-orange-400 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Facility</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Address</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Capacity</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLocations.length > 0 ? filteredLocations.map(loc => (
                <tr key={loc.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-orange-50 text-[#F47721] flex items-center justify-center group-hover:bg-[#F47721] group-hover:text-white transition-colors">
                        <Building size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{loc.name}</p>
                        {loc.code && (
                          <p className="text-xs text-gray-500 uppercase tracking-wide">{loc.code}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-start gap-2">
                      <Map size={16} className="text-gray-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-600 leading-relaxed">{loc.address}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {loc.capacity && loc.capacity > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <Users size={14} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">{loc.capacity}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold uppercase tracking-wide rounded">
                      <ShieldCheck size={12} />
                      Operational
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(loc)}
                        className="p-2 hover:bg-orange-50 rounded text-gray-400 hover:text-[#F47721] transition-colors"
                        title="Edit Facility"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id)}
                        disabled={
                          deletingId === loc.id ||
                          batches.some(b => b.locationId === loc.id && (b.status === 'PLANNED' || b.status === 'ONGOING')) ||
                          schedules.some(s => s.locationId === loc.id)
                        }
                        className="p-2 hover:bg-rose-50 rounded text-gray-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                        title={
                          batches.some(b => b.locationId === loc.id && (b.status === 'PLANNED' || b.status === 'ONGOING'))
                            ? 'Cannot delete location while used by active batches.'
                            : schedules.some(s => s.locationId === loc.id)
                              ? 'Cannot delete location while used in schedules.'
                              : 'Delete Facility'
                        }
                      >
                        {deletingId === loc.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                      {/* <button
                        className="p-2 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-600 transition-colors"
                        title="Facility Info"
                      >
                        <ChevronRight size={16} />
                      </button> */}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <EmptyState
                      title="No training facilities"
                      description="Register your first training location to manage classrooms and satellite centers."
                      actionLabel="Add Facility"
                      onAction={() => { resetForm(); setShowModal(true); }}
                      icon={<MapPin size={48} className="text-gray-300" />}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#F47721] text-white rounded shadow-md">
                  <MapPin size={20} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">
                  {editingLocation ? 'Modify Facility' : 'Register Facility'}
                </h3>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Facility Display Name</label>
                  <input 
                    required 
                    autoFocus
                    placeholder="e.g. Skills Development Hub"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-orange-500 outline-none font-semibold text-gray-800"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Physical Address</label>
                  <textarea 
                    required 
                    rows={3}
                    placeholder="Provide exact location for learner navigation..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm font-medium resize-none"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seating Capacity (Optional)</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-orange-500 outline-none font-semibold text-gray-800"
                    value={formData.capacity || ''}
                    onChange={e => setFormData({...formData, capacity: e.target.value === '' ? 0 : Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded border border-orange-100 flex gap-3">
                 <Globe className="text-[#F47721] shrink-0" size={20} />
                 <p className="text-xs text-orange-800 leading-relaxed font-medium">
                   Training locations are linked to scheduling and attendance tracking. Ensure addresses are verifiable for accreditation purposes.
                 </p>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-3.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded transition-colors">Discard</button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-[#F47721] text-white rounded text-sm font-semibold shadow-md shadow-gray-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {editingLocation ? 'Apply Updates' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}
      {/* Toast Notifications moved to bottom to prevent margin-top issues on header */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border border-orange-200 text-orange-800'
                : toast.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-orange-50 border border-orange-200 text-orange-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={18} className="flex-shrink-0 text-[#F47721]" />}
            {toast.type === 'error' && <AlertCircle size={18} className="flex-shrink-0 text-red-600" />}
            {toast.type === 'info' && <AlertCircle size={18} className="flex-shrink-0 text-[#F47721]" />}
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>    </div>
  );
};

export default LocationsView;

