import React, { useState } from 'react';
import { Location } from '../types';
import { 
  Search, Plus, MapPin, Trash2, X, Edit2, ShieldCheck, 
  Map, Building, Globe, ChevronRight, MoreVertical
} from 'lucide-react';

interface LocationsViewProps {
  locations: Location[];
  onAddLocation: (location: Location) => void;
  onUpdateLocation: (location: Location) => void;
  onDeleteLocation: (id: string) => void;
}

const LocationsView: React.FC<LocationsViewProps> = ({ 
  locations, onAddLocation, onUpdateLocation, onDeleteLocation 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const [formData, setFormData] = useState<Partial<Location>>({
    code: '',
    name: '',
    address: ''
  });

  const filteredLocations = locations.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ code: '', name: '', address: '' });
    setEditingLocation(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.address) return;

    if (editingLocation) {
      onUpdateLocation({ ...editingLocation, ...formData } as Location);
    } else {
      const newLoc: Location = {
        id: `loc-${Date.now()}`,
        orgId: 'temp',
        code: formData.code!,
        name: formData.name!,
        address: formData.address!,
        createdAt: new Date().toISOString()
      };
      onAddLocation(newLoc);
    }
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <MapPin className="text-indigo-600" size={28} />
            Training Locations
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Manage physical facilities, classrooms, and satellite centers.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-medium text-sm active:scale-95"
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
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
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
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                  <Building size={24} />
                </div>
                <div className="relative group/menu">
                   <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"><MoreVertical size={18} /></button>
                   <div className="absolute top-full right-0 mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1 hidden group-hover/menu:block z-20">
                      <button 
                        onClick={() => { setEditingLocation(loc); setFormData(loc); setShowModal(true); }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit2 size={14} /> Edit Details
                      </button>
                      <button 
                        onClick={() => onDeleteLocation(loc.id)}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} /> Delete Location
                      </button>
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                 <div>
                    <div className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-tighter w-fit mb-1">
                      {loc.code}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 leading-tight truncate">{loc.name}</h3>
                 </div>

                 <div className="flex gap-3">
                    <Map size={18} className="text-slate-400 shrink-0 mt-1" />
                    <p className="text-xs font-medium text-slate-500 leading-relaxed italic">{loc.address}</p>
                 </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
               <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 uppercase tracking-widest">
                  <ShieldCheck size={14} /> Operational
               </div>
               <button className="text-indigo-600 text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                  Facility Info <ChevronRight size={14} strokeWidth={2} />
               </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
             <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                   <Map size={32} />
                </div>
                <p className="text-slate-400 text-sm font-medium italic">No training facilities registered in this workspace.</p>
             </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                  <MapPin size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">
                  {editingLocation ? 'Modify Facility' : 'Register Facility'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Facility Code (Identifier)</label>
                  <input 
                    required 
                    placeholder="e.g. MAIN-CAMPUS"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none font-mono text-indigo-600 font-semibold"
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '-')})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Facility Display Name</label>
                  <input 
                    required 
                    placeholder="e.g. Skills Development Hub"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none font-semibold text-slate-800"
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none text-sm font-medium resize-none"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex gap-3">
                 <Globe className="text-indigo-600 shrink-0" size={20} />
                 <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">
                   Training locations are linked to scheduling and attendance tracking. Ensure addresses are verifiable for accreditation purposes.
                 </p>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">Discard</button>
                <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-semibold shadow-md shadow-indigo-100 active:scale-95 transition-all">
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
