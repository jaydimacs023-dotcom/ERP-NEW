import React, { useState } from 'react';
import { Trainer, Qualification } from '../types';
import EmptyState from '../components/EmptyState';
import { 
  Search, Plus, Filter, GraduationCap, Award, Mail, Phone, 
  Trash2, X, Info, ShieldCheck, CheckCircle, ChevronRight,
  BookOpen, PlusCircle, Check
} from 'lucide-react';

interface TrainersViewProps {
  trainers: Trainer[];
  qualifications: Qualification[];
  onAddTrainer: (trainer: Trainer) => void;
  onUpdateTrainer: (trainer: Trainer) => void;
  onDeleteTrainer: (id: string) => void;
}

const TrainersView: React.FC<TrainersViewProps> = ({ 
  trainers, 
  qualifications, 
  onAddTrainer, 
  onUpdateTrainer, 
  onDeleteTrainer 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<Trainer | null>(null);
  
  const [formData, setFormData] = useState<Partial<Trainer>>({
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    contactNumber: '',
    specialization: '',
    qualificationIds: []
  });

  const filteredTrainers = trainers.filter(t => 
    `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.specialization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email) return;

    const newTrainer: Trainer = {
      id: `trainer-${Date.now()}`,
      orgId: 'temp',
      firstName: formData.firstName,
      lastName: formData.lastName,
      middleName: formData.middleName || '',
      email: formData.email,
      contactNumber: formData.contactNumber || '',
      specialization: formData.specialization || 'General',
      qualificationIds: formData.qualificationIds || [],
      createdAt: new Date().toISOString()
    };

    onAddTrainer(newTrainer);
    setShowModal(false);
    setFormData({ qualificationIds: [] });
  };

  const toggleQualificationAssignment = (trainer: Trainer, qualId: string) => {
    const isAssigned = trainer.qualificationIds.includes(qualId);
    const newQualIds = isAssigned 
      ? trainer.qualificationIds.filter(id => id !== qualId)
      : [...trainer.qualificationIds, qualId];
    
    onUpdateTrainer({ ...trainer, qualificationIds: newQualIds });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <GraduationCap className="text-indigo-600" size={28} />
            Professional Trainers
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">TVET Instructor Registry & Certification Tracking</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> Register Trainer
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or specialization..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Trainer Info</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Specialization</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Qualifications</th>
              <th className="px-6 py-4 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTrainers.length > 0 ? filteredTrainers.map(trainer => (
              <tr key={trainer.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-semibold text-xs">
                      {trainer.lastName[0]}{trainer.firstName[0]}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 leading-tight">
                        {trainer.lastName.toUpperCase()}, {trainer.firstName}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                        <div className="flex items-center gap-1"><Mail size={10} /> {trainer.email}</div>
                        <div className="flex items-center gap-1"><Phone size={10} /> {trainer.contactNumber}</div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                   <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border w-fit">
                     {trainer.specialization}
                   </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex flex-wrap gap-1.5">
                    {trainer.qualificationIds.length > 0 ? trainer.qualificationIds.map(id => {
                      const qual = qualifications.find(q => q.id === id);
                      return qual ? (
                        <div key={id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-[9px] font-semibold uppercase tracking-tight">
                          {qual.code}
                        </div>
                      ) : null;
                    }) : (
                      <span className="text-[10px] text-slate-400 italic font-medium">No qualifications assigned</span>
                    )}
                    <button 
                      onClick={() => setShowAssignModal(trainer)}
                      className="p-1 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 rounded transition-colors"
                      title="Assign Qualifications"
                    >
                      <PlusCircle size={14} />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onDeleteTrainer(trainer.id)}
                      className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-6 py-20">
                  <EmptyState 
                    title="No trainers registered"
                    description="Add your first trainer to get started with staff management."
                    actionLabel="Register Trainer"
                    onAction={() => setShowModal(true)}
                    icon={<GraduationCap size={48} className="text-slate-300" />}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                  <GraduationCap size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">Register New Trainer</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">First Name</label>
                  <input required placeholder="Elena" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none text-sm font-medium"
                    value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Last Name</label>
                  <input required placeholder="Reyes" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none text-sm font-medium"
                    value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Email Address</label>
                <input required type="email" placeholder="trainer@institution.edu" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none text-sm font-medium"
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Contact Number</label>
                  <input placeholder="+63 9xx xxx xxxx" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none text-sm font-medium"
                    value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Specialization</label>
                  <input placeholder="e.g. IT, Automotive" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none text-sm font-medium"
                    value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})} />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                 <ShieldCheck className="text-blue-600 shrink-0" size={20} />
                 <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                   Trainer records are linked to the NTTC (National TVET Trainer Certificate) database for compliance verification during audit.
                 </p>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">Discard</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold shadow-md shadow-indigo-100 active:scale-95 transition-all">Submit Registration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Qualification Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">Assign Qualifications</h3>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">Trainer: {showAssignModal.lastName}, {showAssignModal.firstName}</p>
              </div>
              <button onClick={() => setShowAssignModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 max-h-[400px] overflow-y-auto space-y-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 block">Available Qualifications (UTPRAS Registry)</label>
              {qualifications.length > 0 ? qualifications.map(qual => {
                const isAssigned = showAssignModal.qualificationIds.includes(qual.id);
                return (
                  <button 
                    key={qual.id}
                    onClick={() => toggleQualificationAssignment(showAssignModal, qual.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left group ${
                      isAssigned ? 'bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className={`text-xs font-semibold uppercase tracking-tight ${isAssigned ? 'text-indigo-100' : 'text-indigo-600'}`}>{qual.code}</div>
                      <div className={`text-sm font-medium mt-0.5 ${isAssigned ? 'text-white' : 'text-slate-900'}`}>{qual.name}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isAssigned ? 'bg-white border-white text-indigo-600' : 'bg-slate-50 border-slate-100 text-transparent group-hover:border-indigo-200'
                    }`}>
                      <Check size={14} strokeWidth={4} />
                    </div>
                  </button>
                );
              }) : (
                <div className="p-8 text-center text-slate-400 italic text-sm">No qualifications registered in the system.</div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t flex justify-end">
              <button 
                onClick={() => setShowAssignModal(null)}
                className="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold shadow-md active:scale-95 transition-all"
              >
                Close & Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainersView;
