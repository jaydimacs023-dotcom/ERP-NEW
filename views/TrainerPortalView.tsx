
import React, { useState, useMemo } from 'react';
import { 
  GraduationCap, CalendarDays, Award, Clock, MapPin, 
  ChevronRight, LayoutDashboard, UserCircle, Settings,
  Calendar, Users, Info, Layers, BookOpen, Briefcase,
  Mail, Phone, ShieldCheck, Globe, Star
} from 'lucide-react';
import { Trainer, Batch, Qualification, Location, TrainerSchedule } from '../types';

interface TrainerPortalViewProps {
  trainer: Trainer;
  batches: Batch[];
  qualifications: Qualification[];
  locations: Location[];
  schedules: TrainerSchedule[];
  brandColor: string;
  onUpdateTrainer: (trainer: Trainer) => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TrainerPortalView: React.FC<TrainerPortalViewProps> = ({ 
  trainer, batches, qualifications, locations, schedules, brandColor, onUpdateTrainer 
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'QUALIFICATIONS' | 'SCHEDULE' | 'PROFILE'>('OVERVIEW');

  const [editProfile, setEditProfile] = useState<Partial<Trainer>>({
    email: trainer.email,
    contactNumber: trainer.contactNumber,
    specialization: trainer.specialization
  });

  const accreditedQuals = useMemo(() => {
    return qualifications.filter(q => trainer.qualificationIds.includes(q.id));
  }, [qualifications, trainer.qualificationIds]);

  const activeBatches = useMemo(() => {
    return batches.filter(b => b.status === 'ON_GOING' || b.status === 'OPEN_FOR_ENROLLMENT');
  }, [batches]);

  const trainerSchedule = useMemo(() => {
    return schedules.find(s => s.trainerId === trainer.id);
  }, [schedules, trainer.id]);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTrainer({ ...trainer, ...editProfile } as Trainer);
    setActiveTab('OVERVIEW');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      {/* High-Fidelity Header */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
            <GraduationCap size={200} />
         </div>
         <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="w-28 h-28 rounded-[2rem] border-4 border-white/10 flex items-center justify-center shadow-2xl shrink-0" style={{ backgroundColor: brandColor }}>
               <UserCircle size={60} />
            </div>
            <div className="text-center md:text-left flex-1">
               <div className="flex flex-col md:flex-row items-center gap-4">
                  <h1 className="text-4xl font-black tracking-tight">{trainer.lastName.toUpperCase()}, {trainer.firstName}</h1>
                  <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5">NTTC Certified</span>
               </div>
               <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                  <span className="text-xs font-black bg-white/5 px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2" style={{ color: brandColor }}>
                     <Briefcase size={14} /> {trainer.specialization}
                  </span>
                  <span className="text-xs font-black text-slate-400 bg-white/5 px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2">
                     <Mail size={14} /> {trainer.email}
                  </span>
               </div>
            </div>
            <div className="shrink-0 flex flex-col items-center md:items-end gap-3">
               <div className="px-6 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck size={16} /> Active Status
               </div>
            </div>
         </div>
      </div>

      {/* Navigation */}
      <div className="flex bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm max-w-lg mx-auto md:mx-0 overflow-x-auto">
         <TabButton active={activeTab === 'OVERVIEW'} onClick={() => setActiveTab('OVERVIEW')} label="My Work" icon={<LayoutDashboard size={14}/>} brandColor={brandColor} />
         <TabButton active={activeTab === 'QUALIFICATIONS'} onClick={() => setActiveTab('QUALIFICATIONS')} label="Programs" icon={<Award size={14}/>} brandColor={brandColor} />
         <TabButton active={activeTab === 'SCHEDULE'} onClick={() => setActiveTab('SCHEDULE')} label="My Shifts" icon={<CalendarDays size={14}/>} brandColor={brandColor} />
         <TabButton active={activeTab === 'PROFILE'} onClick={() => setActiveTab('PROFILE')} label="Profile" icon={<Settings size={14}/>} brandColor={brandColor} />
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="md:col-span-2 space-y-8">
              {/* Active Batches Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                   <div className="p-2 text-white rounded-lg shadow-lg" style={{ backgroundColor: brandColor }}>
                      <Layers size={18} />
                   </div>
                   <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Active Training Commitments</h3>
                </div>

                {activeBatches.length > 0 ? (
                  <div className="space-y-6">
                    {activeBatches.map(batch => {
                      const qual = qualifications.find(q => q.id === batch.qualificationId);
                      const location = locations.find(l => l.id === batch.locationId);
                      
                      return (
                        <div key={batch.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-500">
                           <div className="p-8 border-b bg-slate-50/50 group-hover:bg-white transition-colors">
                              <div className="flex justify-between items-start mb-4">
                                 <span className="px-4 py-1.5 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full">
                                    {batch.status.replace('_', ' ')}
                                 </span>
                                 <p className="text-[10px] font-mono font-black text-slate-400 uppercase">BATCH: {batch.name}</p>
                              </div>
                              <h4 className="text-2xl font-black text-slate-800 leading-tight tracking-tight">{qual?.name}</h4>
                              <div className="flex items-center gap-4 mt-4">
                                 <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <MapPin size={14} style={{ color: brandColor }} /> {location?.name || 'Main Hub'}
                                 </div>
                                 <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <Users size={14} style={{ color: brandColor }} /> {batch.studentIds.length} Learners
                                 </div>
                              </div>
                           </div>
                           <div className="p-8 grid grid-cols-2 gap-8">
                              <div>
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Cycle Start</p>
                                 <p className="text-sm font-black text-slate-800">{batch.startDate}</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Cycle End</p>
                                 <p className="text-sm font-black" style={{ color: brandColor }}>{batch.endDate}</p>
                              </div>
                           </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-[3rem] p-16 text-center border-2 border-dashed border-slate-200 text-slate-300">
                     <Layers size={48} className="mx-auto mb-4 opacity-50" />
                     <p className="text-sm font-black uppercase tracking-widest">No Active Batches Assigned</p>
                  </div>
                )}
              </div>
           </div>

           <div className="space-y-6">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6" style={{ color: brandColor }}>Instructor Snapshot</h4>
                 <div className="space-y-4">
                    <StatusItemPortal label="Accreditations" value={accreditedQuals.length.toString()} icon={<Award size={14}/>} brandColor={brandColor} />
                    <StatusItemPortal label="Total Batches" value={batches.length.toString()} icon={<Layers size={14}/>} brandColor={brandColor} />
                    <StatusItemPortal label="Weekly Hours" value={trainerSchedule?.slots.length ? "Defined" : "Pending"} icon={<Clock size={14}/>} brandColor={brandColor} />
                 </div>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                 <div className="flex gap-4">
                    <Info size={24} className="shrink-0" style={{ color: brandColor }} />
                    <div>
                       <h4 className="text-xs font-black text-slate-800 uppercase">MIS Compliance</h4>
                       <p className="text-[10px] text-slate-500 leading-relaxed font-bold mt-2">
                         Batch completion reports must be submitted within 3 working days of the terminal training date to maintain accreditation standing.
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'QUALIFICATIONS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           {accreditedQuals.length > 0 ? accreditedQuals.map(qual => (
             <div key={qual.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 space-y-6 group hover:shadow-2xl transition-all" style={{ '--hover-border': brandColor } as any}>
                <div className="flex justify-between items-start">
                   <div className="p-4 rounded-2xl shadow-sm group-hover:text-white transition-all" style={{ backgroundColor: `${brandColor}11`, color: brandColor }}>
                      <Award size={28}/>
                   </div>
                   <Star size={18} className="text-amber-400 fill-amber-400" />
                </div>
                <div>
                   <h3 className="text-lg font-black text-slate-800 leading-tight tracking-tight">{qual.name}</h3>
                   <p className="text-[10px] font-mono font-black uppercase tracking-widest mt-2" style={{ color: brandColor }}>{qual.code}</p>
                </div>
                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                   <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Duration: {qual.durationDays} Days</div>
                   <div style={{ color: brandColor }}><ChevronRight size={16} strokeWidth={3} /></div>
                </div>
             </div>
           )) : (
              <div className="col-span-full p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-300">
                 <Award size={48} className="mx-auto mb-4 opacity-50" />
                 <p className="text-sm font-black uppercase tracking-widest">No Qualifications Registered</p>
              </div>
           )}
        </div>
      )}

      {activeTab === 'SCHEDULE' && (
         <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {trainerSchedule ? (
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                     <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <div className="p-2 text-white rounded-lg" style={{ backgroundColor: brandColor }}><Calendar size={18} /></div>
                           <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Weekly Work Shifts</h3>
                        </div>
                     </div>
                     <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {trainerSchedule.slots.map(slot => (
                              <div key={slot.dayIndex} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between group hover:bg-white transition-all">
                                 <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: brandColor }}>{DAYS[slot.dayIndex]}</p>
                                    <p className="text-lg font-black text-slate-800 font-mono tracking-tighter">{slot.startTime} - {slot.endTime}</p>
                                 </div>
                                 <div className="p-3 bg-white rounded-2xl text-slate-300 group-hover:text-brand transition-all"><Clock size={20} /></div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
                  <div className="space-y-8">
                     <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4" style={{ color: brandColor }}>Institutional Note</h4>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed italic">
                           "Shifts are optimized based on institutional capacity. If you need to request a schedule adjustment, please contact the Registrar's Office directly."
                        </p>
                     </div>
                  </div>
               </div>
            ) : (
               <div className="p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-300">
                  <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-sm font-black uppercase tracking-widest">No Defined Work Shifts Found</p>
               </div>
            )}
         </div>
      )}

      {activeTab === 'PROFILE' && (
        <div className="max-w-4xl mx-auto bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
           <div className="p-8 border-b bg-slate-50/50 flex items-center gap-4">
              <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl"><Globe size={24}/></div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Instructor Data Sync</h3>
           </div>
           
           <form onSubmit={handleProfileSave} className="p-10 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Institutional Email</label>
                    <input className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': brandColor } as any} value={editProfile.email} onChange={e => setEditProfile({...editProfile, email: e.target.value})} />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mobile Contact</label>
                    <input className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': brandColor } as any} value={editProfile.contactNumber} onChange={e => setEditProfile({...editProfile, contactNumber: e.target.value})} />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Core Specialization</label>
                 <input className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': brandColor } as any} value={editProfile.specialization} onChange={e => setEditProfile({...editProfile, specialization: e.target.value})} />
              </div>

              <div className="pt-8 border-t border-slate-100 flex gap-4">
                 <button type="button" onClick={() => setActiveTab('OVERVIEW')} className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors">Discard</button>
                 <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">Update Registry</button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, label: string, onClick: () => void, icon: React.ReactNode, brandColor: string }> = ({ active, label, onClick, icon, brandColor }) => (
  <button 
    onClick={onClick} 
    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
    style={active ? { backgroundColor: brandColor, boxShadow: `0 10px 15px -3px ${brandColor}44` } : {}}
  >
    {icon} {label}
  </button>
);

const StatusItemPortal: React.FC<{ label: string, value: string, icon: React.ReactNode, brandColor: string }> = ({ label, value, icon, brandColor }) => (
  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
     <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${brandColor}22`, color: brandColor }}>{icon}</div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</span>
     </div>
     <span className="text-xs font-black text-white">{value}</span>
  </div>
);

export default TrainerPortalView;
