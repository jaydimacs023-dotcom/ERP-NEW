
import React, { useState, useMemo } from 'react';
import { Trainer, TrainerSchedule, DaySlot, Location } from '../types';
import { generateUUID } from '../utils/uuid';
import { 
  CalendarClock, Search, Plus, Trash2, X, ChevronRight, 
  Clock, Timer, AlertCircle, CalendarDays, Check, MapPin,
  Briefcase, GraduationCap, ArrowRight, Save, ShieldCheck,
  Info, Sparkles, Activity, Loader2, CheckCircle, Edit2 as Edit2Icon
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface SchedulesViewProps {
  schedules: TrainerSchedule[];
  trainers: Trainer[];
  locations: Location[];
  onAddSchedule: (sch: TrainerSchedule) => void | Promise<void>;
  onUpdateSchedule: (sch: TrainerSchedule) => void | Promise<void>;
  onDeleteSchedule: (id: string) => void | Promise<boolean>;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getSlotHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const startTotal = sH * 60 + sM;
  const endTotal = eH * 60 + eM;
  return Math.max(0, (endTotal - startTotal) / 60);
};

const SchedulesView: React.FC<SchedulesViewProps> = ({ 
  schedules, trainers, locations, onAddSchedule, onUpdateSchedule, onDeleteSchedule 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TrainerSchedule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [formData, setFormData] = useState<Partial<TrainerSchedule>>({
    trainerId: '',
    locationId: '',
    slots: []
  });

  const [activeSlot, setActiveSlot] = useState<DaySlot>({
    dayIndex: 1,
    startTime: '08:00',
    endTime: '12:00'
  });

  const totalWeeklyHours = useMemo(() => 
    (formData.slots || []).reduce((sum, s) => sum + getSlotHours(s.startTime, s.endTime), 0),
  [formData.slots]);

  const filteredSchedules = useMemo(() => schedules.filter(s => {
    if (s.isDeleted) return false;
    const trainer = trainers.find(t => t.id === s.trainerId);
    if (!trainer) return false;
    const name = `${trainer.firstName} ${trainer.lastName}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  }), [schedules, trainers, searchTerm]);

  const resetForm = () => {
    setFormData({ trainerId: '', locationId: '', slots: [] });
    setEditingSchedule(null);
    setActiveSlot({ dayIndex: 1, startTime: '08:00', endTime: '12:00' });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.trainerId || !formData.slots?.length) return;

    setIsSubmitting(true);
    const trainer = trainers.find(t => t.id === formData.trainerId);
    const trainerName = trainer ? `${trainer.firstName} ${trainer.lastName}` : 'Unknown';

    try {
      if (editingSchedule) {
        // Update existing schedule
        const updatedSchedule: TrainerSchedule = {
          ...editingSchedule,
          trainerId: formData.trainerId!,
          locationId: formData.locationId || undefined,
          slots: formData.slots!,
          updatedAt: new Date().toISOString()
        };
        await onUpdateSchedule(updatedSchedule);
        showToast(`Schedule for "${trainerName}" updated successfully!`, 'success');
      } else {
        // Create new schedule with proper UUID
        const newSchedule: TrainerSchedule = {
          id: generateUUID(),
          orgId: '', // Will be set by App.tsx handler
          trainerId: formData.trainerId!,
          locationId: formData.locationId || undefined,
          slots: formData.slots!,
          createdAt: new Date().toISOString()
        };
        await onAddSchedule(newSchedule);
        showToast(`Schedule for "${trainerName}" created successfully!`, 'success');
      }
      
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving schedule:', error);
      showToast(`Failed to save schedule: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) return;
    
    const scheduleToDelete = schedules.find(s => s.id === id);
    const trainer = scheduleToDelete ? trainers.find(t => t.id === scheduleToDelete.trainerId) : null;
    const trainerName = trainer ? `${trainer.firstName} ${trainer.lastName}` : 'Unknown';
    
    setDeletingId(id);
    try {
      const result = await onDeleteSchedule(id);
      if (result === false) {
        showToast('Cannot delete schedule: It is currently in use.', 'error');
      } else {
        showToast(`Schedule for "${trainerName}" deleted successfully!`, 'success');
      }
    } catch (error) {
      showToast(`Failed to delete schedule: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const addSlot = () => {
    const current = formData.slots || [];
    const next = [...current.filter(s => s.dayIndex !== activeSlot.dayIndex), { ...activeSlot }].sort((a,b) => a.dayIndex - b.dayIndex);
    setFormData({ ...formData, slots: next });
  };

  const removeSlot = (dayIndex: number) => {
    setFormData({ ...formData, slots: (formData.slots || []).filter(s => s.dayIndex !== dayIndex) });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 animate-in slide-in-from-right duration-300 ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : toast.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle size={18} className="text-emerald-600" />
              ) : toast.type === 'error' ? (
                <AlertCircle size={18} className="text-rose-600" />
              ) : (
                <Info size={18} className="text-blue-600" />
              )}
              <span className="text-sm font-semibold">{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="ml-2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 uppercase">
            <CalendarClock className="text-indigo-600" size={32} />
            Institutional Capacity Engine
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Trainer workload matrix and resource allocation optimization.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 font-black text-xs active:scale-95 uppercase tracking-widest"
        >
          <Plus size={16} /> Declare Capacity Profile
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            placeholder="Find profile by instructor name..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200">
              <Activity size={14} /> Total Profiles: {filteredSchedules.length}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredSchedules.length > 0 ? filteredSchedules.map(sch => {
          const trainer = trainers.find(t => t.id === sch.trainerId);
          const location = locations.find(l => l.id === sch.locationId);
          const weeklyHours = sch.slots.reduce((sum, s) => sum + getSlotHours(s.startTime, s.endTime), 0);
          
          return (
            <div key={sch.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col md:flex-row">
               <div className="p-8 md:w-80 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/30 flex flex-col justify-between">
                  <div className="space-y-6">
                     <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-xl shadow-slate-200 border-2 border-white">
                           {trainer?.lastName[0]}{trainer?.firstName[0]}
                        </div>
                        <div>
                           <p className="text-sm font-black text-slate-800 uppercase leading-none">{trainer?.lastName}, {trainer?.firstName}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Trainer Schedule</p>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Primary Station</p>
                           <div className="flex items-center gap-2">
                              <MapPin size={16} className="text-indigo-600" />
                              <span className="text-xs font-bold text-slate-700">{location?.name || 'Mobile/Remote'}</span>
                           </div>
                        </div>

                        <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 shadow-xl">
                           <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Resource Load</p>
                           <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-mono font-black text-white">{weeklyHours.toFixed(1)}</span>
                              <span className="text-[10px] font-black text-slate-500 uppercase">Hrs / Week</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-100 flex gap-2">
                     <button 
                       onClick={() => { setEditingSchedule(sch); setFormData(sch); setShowModal(true); }}
                       className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                       disabled={deletingId === sch.id}
                     >
                        <Edit2Icon size={14} /> Adjust Profile
                     </button>
                     <button 
                       onClick={() => handleDelete(sch.id)}
                       disabled={deletingId === sch.id}
                       className="p-3 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        {deletingId === sch.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                     </button>
                  </div>
               </div>

               <div className="flex-1 p-8 bg-white grid grid-cols-1 sm:grid-cols-7 gap-3">
                  {DAYS.map((day, idx) => {
                    const slot = sch.slots.find(s => s.dayIndex === idx);
                    return (
                      <div key={day} className={`p-4 rounded-3xl border-2 flex flex-col items-center justify-center transition-all ${slot ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 border-slate-50 text-slate-300 opacity-40'}`}>
                         <p className="text-[10px] font-black uppercase tracking-widest mb-3">{day.slice(0, 3)}</p>
                         {slot ? (
                           <>
                              <div className="p-2 bg-white/10 rounded-xl mb-3"><Clock size={16} /></div>
                              <p className="text-xs font-mono font-black">{slot.startTime}</p>
                              <div className="h-2 w-px bg-white/20 my-1"></div>
                              <p className="text-xs font-mono font-black">{slot.endTime}</p>
                           </>
                         ) : (
                            <div className="text-[10px] font-black uppercase italic">Off</div>
                         )}
                      </div>
                    )
                  })}
               </div>
            </div>
          );
        }) : (
          <div className="py-32 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
             <CalendarDays size={64} strokeWidth={1} className="mx-auto mb-6 text-slate-200" />
             <h3 className="text-xl font-black text-slate-400 uppercase tracking-tight">No trainer profiles established</h3>
             <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">Schedules are mandatory for computing program terminal dates and institutional instructional hours.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 flex flex-col md:flex-row h-full max-h-[90vh]">
            
            <div className="flex-1 overflow-y-auto p-10 border-r border-slate-100 bg-white">
               <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                     <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100"><CalendarClock size={28} /></div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Configuration Console</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Institutional Labor Matrix v4.1</p>
                     </div>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={32} /></button>
               </div>

               <form onSubmit={handleSubmit} className="space-y-12">
                  <section className="space-y-8">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><GraduationCap size={18} /></div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">I. Personnel Allocation</h4>
                     </div>

                     <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lead Instructor</label>
                           <select 
                              required 
                              disabled={!!editingSchedule}
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-black text-slate-800 appearance-none disabled:opacity-50"
                              value={formData.trainerId}
                              onChange={e => setFormData({...formData, trainerId: e.target.value})}
                           >
                              <option value="">Choose Personnel...</option>
                              {trainers.map(t => <option key={t.id} value={t.id}>{t.lastName.toUpperCase()}, {t.firstName}</option>)}
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Primary Deployment Station</label>
                           <select 
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-black text-slate-800 appearance-none"
                              value={formData.locationId}
                              onChange={e => setFormData({...formData, locationId: e.target.value})}
                           >
                              <option value="">Remote / Decentralized</option>
                              {locations.map(l => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
                           </select>
                        </div>
                     </div>
                  </section>

                  <section className="space-y-8">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Timer size={18} /></div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">II. Shift Definition Matrix</h4>
                     </div>

                     <div className="p-8 bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5"><Sparkles size={120} /></div>
                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                           <div className="md:col-span-2 space-y-2">
                              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1">Target Work Day</label>
                              <select 
                                 className="w-full px-5 py-3.5 bg-white/5 border-2 border-white/10 rounded-2xl outline-none text-sm font-black text-white focus:border-brand"
                                 value={activeSlot.dayIndex}
                                 onChange={e => setActiveSlot({...activeSlot, dayIndex: Number(e.target.value)})}
                              >
                                 {DAYS.map((d, i) => <option key={i} value={i} className="bg-slate-900">{d}</option>)}
                              </select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Commencement</label>
                              <input type="time" className="w-full px-5 py-3.5 bg-white/5 border-2 border-white/10 rounded-2xl outline-none text-sm font-mono font-black text-white focus:border-brand"
                                 value={activeSlot.startTime} onChange={e => setActiveSlot({...activeSlot, startTime: e.target.value})} />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Termination</label>
                              <input type="time" className="w-full px-5 py-3.5 bg-white/5 border-2 border-white/10 rounded-2xl outline-none text-sm font-mono font-black text-white focus:border-brand"
                                 value={activeSlot.endTime} onChange={e => setActiveSlot({...activeSlot, endTime: e.target.value})} />
                           </div>
                        </div>
                        <div className="mt-8 pt-8 border-t border-white/5">
                           <button 
                              type="button" 
                              onClick={addSlot}
                              className="w-full py-4 bg-brand text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand/90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand/20 active:scale-95"
                           >
                              <Check size={18} strokeWidth={4} /> Update Capacity Matrix
                           </button>
                        </div>
                     </div>
                  </section>
               </form>
            </div>

            <div className="w-full md:w-[400px] bg-slate-50 p-10 flex flex-col shrink-0">
               <div className="flex items-center justify-between mb-8">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                     <ShieldCheck size={20} className="text-indigo-600" />
                     Live Profile Load
                  </h4>
                  <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    SYNC_ID: {Date.now().toString().slice(-6)}
                  </div>
               </div>

               <div className="flex-1 space-y-3 overflow-y-auto scrollbar-hide">
                  {(formData.slots || []).length > 0 ? (formData.slots || []).map(s => {
                     const hrs = getSlotHours(s.startTime, s.endTime);
                     return (
                        <div key={s.dayIndex} className="group p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm animate-in slide-in-from-right-4 duration-500 hover:border-indigo-600 transition-all">
                           <div className="flex justify-between items-start mb-4">
                              <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em]">{DAYS[s.dayIndex]}</span>
                              <button onClick={() => removeSlot(s.dayIndex)} className="text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                           </div>
                           <div className="flex justify-between items-end">
                              <div className="space-y-1">
                                 <p className="text-lg font-mono font-black text-slate-800 tracking-tighter">{s.startTime} — {s.endTime}</p>
                                 <p className="text-[9px] font-black text-slate-400 uppercase">Operational Shift</p>
                              </div>
                              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xs group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                 {hrs.toFixed(1)}h
                              </div>
                           </div>
                        </div>
                     )
                  }) : (
                     <div className="py-20 text-center bg-white/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4">
                        <Activity size={40} className="text-slate-200" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Matrix is Unassigned</p>
                     </div>
                  )}
               </div>

               <div className="mt-8 pt-8 border-t-2 border-slate-200">
                  <div className="space-y-6">
                     <div className="flex justify-between items-end">
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cumulative Load</p>
                           <div className="flex items-baseline gap-2">
                              <h5 className="text-4xl font-mono font-black text-slate-900 tracking-tighter">{totalWeeklyHours.toFixed(1)}</h5>
                              <span className="text-xs font-black text-indigo-600 uppercase">Hours / Week</span>
                           </div>
                        </div>
                        {totalWeeklyHours > 40 && (
                          <div className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-[8px] font-black uppercase flex items-center gap-1.5 animate-pulse">
                             <AlertCircle size={10} /> Over-Capacity
                          </div>
                        )}
                     </div>

                     <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex gap-4">
                        <Info size={24} className="text-indigo-600 shrink-0" />
                        <p className="text-[10px] text-indigo-800 leading-relaxed font-bold">
                           Instructional hour metrics feed the <strong>Projected Completion Engine</strong>. Modifying this schedule re-forecasts terminal dates for all linked training batches.
                        </p>
                     </div>

                     <button 
                       onClick={handleSubmit}
                       disabled={!formData.trainerId || !formData.slots?.length || isSubmitting}
                       className="w-full py-5 bg-indigo-600 text-white rounded-3xl text-xs font-black uppercase tracking-[0.3em] shadow-xl shadow-indigo-900/40 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3"
                     >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            {editingSchedule ? 'Updating...' : 'Committing...'}
                          </>
                        ) : (
                          <>
                            <Save size={18} />
                            {editingSchedule ? 'Update Professional Profile' : 'Commit Professional Profile'}
                          </>
                        )}
                     </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusItemPortal: React.FC<{ label: string, value: string, icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
     <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">{icon}</div>
     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</span>
     <span className="text-xs font-black text-white">{value}</span>
  </div>
);

export default SchedulesView;
