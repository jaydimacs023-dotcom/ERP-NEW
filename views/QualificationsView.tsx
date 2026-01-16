
import React, { useState } from 'react';
import { Qualification } from '../types';
import { 
  Search, Plus, Filter, Award, Code, Clock, Trash2, X, PlusCircle, 
  Database, Info, ShieldCheck, FileText, ChevronRight, Layers,
  LayoutGrid, List, Timer, MoreVertical, Edit2
} from 'lucide-react';

interface QualificationsViewProps {
  qualifications: Qualification[];
  onAddQualification: (qual: Qualification) => void;
  onDeleteQualification: (id: string) => void;
}

const SECTORS = [
  'ICT',
  'Tourism',
  'Construction',
  'Manufacturing',
  'Agriculture',
  'Automotive',
  'Health & Social Services',
  'Electronics'
];

const QualificationsView: React.FC<QualificationsViewProps> = ({ qualifications, onAddQualification, onDeleteQualification }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Qualification>>({
    name: '',
    code: '',
    durationDays: 0,
    sector: 'ICT'
  });

  const filteredQuals = qualifications.filter(q => 
    !q.isDeleted && (
    q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.sector?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.durationDays) return;

    const newQual: Qualification = {
      id: `qual-${Date.now()}`,
      orgId: 'temp',
      name: formData.name,
      code: formData.code,
      durationDays: Number(formData.durationDays),
      sector: formData.sector,
      createdAt: new Date().toISOString()
    };

    onAddQualification(newQual);
    setShowModal(false);
    setFormData({ name: '', code: '', durationDays: 0, sector: 'ICT' });
  };

  const getSectorColor = (sector: string) => {
    switch (sector) {
      case 'ICT': return 'indigo';
      case 'Tourism': return 'emerald';
      case 'Construction': return 'amber';
      case 'Manufacturing': return 'rose';
      case 'Health & Social Services': return 'sky';
      default: return 'slate';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Award className="text-indigo-600" size={28} />
            Professional Qualifications
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">TESDA Registered Program Catalog (Training Regulations Compliance)</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-bold text-sm active:scale-95"
        >
          <Plus size={18} /> Add New Qualification
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by code, name, or sector..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors text-xs font-black uppercase tracking-widest">
            <Filter size={14} /> Filter Sector
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Code & Sector</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qualification Name</th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duration</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuals.length > 0 ? filteredQuals.map(qual => (
                <tr key={qual.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-xs font-mono font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg inline-block border border-indigo-100 w-fit">
                        {qual.code}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <Layers size={10} /> {qual.sector || 'Uncategorized'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-black text-slate-800 leading-tight">
                      {qual.name}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                      Registered on {new Date(qual.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex flex-col items-center">
                      <div className="flex items-center gap-1.5 text-slate-700 font-black text-sm">
                        <Clock size={14} className="text-amber-500" /> {qual.durationDays} Days
                      </div>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                         <div 
                           className="h-full bg-amber-500 rounded-full" 
                           style={{ width: `${Math.min(100, (qual.durationDays / 40) * 100)}%` }} 
                         />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 hover:bg-slate-100 text-slate-300 hover:text-indigo-600 rounded-xl transition-all">
                        <FileText size={18} />
                      </button>
                      <button 
                        onClick={() => onDeleteQualification(qual.id)}
                        className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200">
                        <Award size={32} />
                      </div>
                      <p className="text-slate-400 text-sm font-medium italic">No qualifications found in the registry.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {filteredQuals.map(qual => {
            const color = getSectorColor(qual.sector || '');
            return (
              <div key={qual.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group overflow-hidden flex flex-col">
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl bg-${color}-50 text-${color}-600 flex items-center justify-center border border-${color}-100 transition-all group-hover:scale-110`}>
                      <Award size={30} />
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                      {qual.sector || 'N/A'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">
                      {qual.name}
                    </h3>
                    <p className="text-xs font-mono font-black text-indigo-600 uppercase tracking-tighter">{qual.code}</p>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Standard Term</p>
                      <div className="flex items-center gap-2">
                         <Timer size={18} className="text-amber-500" />
                         <span className="text-xl font-black text-slate-800">{qual.durationDays} Days</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/80 px-8 py-5 flex items-center justify-between border-t border-slate-100">
                   <div className="flex gap-2">
                      <button className="p-2 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-xl transition-all border border-transparent hover:border-slate-200">
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => onDeleteQualification(qual.id)}
                        className="p-2 hover:bg-white text-slate-400 hover:text-rose-600 rounded-xl transition-all border border-transparent hover:border-slate-200"
                      >
                        <Trash2 size={16} />
                      </button>
                   </div>
                   <button className="text-indigo-600 text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                      Details <ChevronRight size={16} strokeWidth={3} />
                   </button>
                </div>
              </div>
            );
          })}
          {filteredQuals.length === 0 && (
            <div className="col-span-full py-32 text-center text-slate-400 italic">No matching qualifications found.</div>
          )}
        </div>
      )}

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200">
                  <Award size={24} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Register Qualification</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Qualification Title</label>
                  <input 
                    required 
                    autoFocus
                    placeholder="e.g., Computer Systems Servicing NC II"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-slate-800 font-bold"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Official Ref Code</label>
                    <input 
                      required 
                      placeholder="e.g., CSS211-1218"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-mono text-indigo-600 font-black"
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Industry Sector</label>
                    <select 
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold appearance-none"
                      value={formData.sector}
                      onChange={e => setFormData({...formData, sector: e.target.value})}
                    >
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Standard Duration (Days)</label>
                  <div className="relative">
                    <input 
                      required 
                      type="number"
                      placeholder="e.g., 35"
                      className="w-full pl-6 pr-16 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-slate-800 font-black text-xl"
                      value={formData.durationDays || ''}
                      onChange={e => setFormData({...formData, durationDays: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Days</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex gap-4">
                 <ShieldCheck size={24} className="text-blue-600 shrink-0" />
                 <p className="text-[11px] text-blue-900 leading-relaxed font-bold">
                   Registration into the institutional catalog enables this qualification for batch enrollment and automated curriculum planning within the MIS system.
                 </p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-sm font-black text-slate-500 hover:bg-slate-50 rounded-2xl transition-all">Discard</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-indigo-100 active:scale-95 transition-all">Register Program</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualificationsView;
