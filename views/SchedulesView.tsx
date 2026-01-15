
import React, { useState, useMemo } from 'react';
import { Trainer, TrainerSchedule, DaySlot, Location } from '../types';
import { 
  CalendarClock, Search, Plus, Trash2, X, ChevronRight, 
  Clock, Timer, AlertCircle, CalendarDays, Check, MapPin
} from 'lucide-react';

interface SchedulesViewProps {
  schedules: TrainerSchedule[];
  trainers: Trainer[];
  locations: Location[];
  onUpdateSchedule: (sch: TrainerSchedule) => void;
  onDeleteSchedule: (id: string) => void;
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

const SchedulesView: React.FC<SchedulesViewProps> = ({ schedules, trainers, locations, onUpdateSchedule, onDeleteSchedule }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TrainerSchedule | null>(null);

  const [formData, setFormData] = useState<Partial<TrainerSchedule>>({
    trainerId: '',
    locationId: '',
    slots: [],
    description: ''
  });

  // Current slot being added/edited
  const [activeSlot, setActiveSlot] = useState<DaySlot>({
    dayIndex: 1,
    startTime: '08:00',
    endTime: '12:00'
  });

  const totalWeeklyHours = useMemo(() => 
    (formData.slots || []).reduce((sum, s) => sum + getSlotHours(s.startTime, s.endTime), 0),
  [formData.slots]);

  const filteredSchedules = schedules.filter(s => {
    const trainer = trainers.find(t => t.id === s.trainerId);
    return trainer && `${trainer.firstName} ${trainer.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.trainerId || !formData.slots?.length) return;

    const sch: TrainerSchedule = {
      id: editingSchedule?.id || `sch-${Date.now()}`,
      orgId: 'temp',
      trainerId: formData.trainerId!,
      locationId: formData.locationId || undefined,
      slots: formData.slots!,
      description: formData.description || 'Standard Work Schedule',
      createdAt: editingSchedule?.createdAt || new Date().toISOString()
    };

    onUpdateSchedule(sch);
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ trainerId: '', locationId: '', slots: [], description: '' });
    setEditingSchedule(null);
  };

  const addSlot = () => {
    const current = formData.slots || [];
    // Replace existing slot for same day if exists
    const next = [...current.filter(s => s.dayIndex !== activeSlot.dayIndex), { ...activeSlot }].sort((a,b) => a.dayIndex - b.dayIndex);
    setFormData({ ...formData, slots: next });
  };

  const removeSlot = (dayIndex: number) => {
    setFormData({ ...formData, slots: (formData.slots || []).filter(s => s.dayIndex !== dayIndex) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <CalendarClock className="text-indigo-600" size={28} />
            Trainer Schedule
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Declare trainer weekly shifts and locations. The system uses these to project program completion.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-bold text-sm active:scale-95"
        >
          <Plus size={18} /> Declare Work Shift
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lead Instructor</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned Location</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Defined Schedule</th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Weekly Load</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSchedules.length > 0 ? filteredSchedules.map(sch => {
              const trainer = trainers.find(t => t.id === sch.trainerId);
              const location = locations.find(l => l.id === sch.locationId);
              const weeklyHours = sch.slots.reduce((sum, s) => sum + getSlotHours(s.startTime, s.endTime), 0);
              return (
                <tr key={sch.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                          {trainer?.lastName[0]}{trainer?.firstName[0]}
                       </div>
                       <div>
                          <div className="text-sm font-bold text-slate-800">{trainer?.lastName}, {trainer?.firstName}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-medium">{sch.description}</div>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {location ? (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-indigo-600" />
                        <div>
                          <div className="text-xs font-bold text-slate-700">{location.name}</div>
                          <div className="text-[9px] text-slate-400 uppercase font-mono">{location.code}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No location specified</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                     <div className="flex flex-wrap gap-2">
                        {sch.slots.map(s => (
                           <div key={s.dayIndex} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-black text-indigo-700">
                              <span className="uppercase">{DAYS[s.dayIndex].slice(0,3)}:</span>
                              {s.startTime}-{s.endTime}
                           </div>
                        ))}
                     </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                     <div className="inline-flex flex-col items-center">
                        <span className="text-xs font-black text-slate-800">{weeklyHours.toFixed(1)} hrs</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">per week</span>
                     </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                        onClick={() => { setEditingSchedule(sch); setFormData(sch); setShowModal(true); }}
                        className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"
                       >
                          <ChevronRight size={18} />
                       </button>
                       <button 
                        onClick={() => onDeleteSchedule(sch.id)}
                        className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
                       >
                          <Trash2 size={18} />
                       </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={5} className="py-24 text-center text-slate-400 italic">No trainer schedules declared.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 flex flex-col md:flex-row h-full max-h-[85vh]">
            
            <div className="flex-1 overflow-y-auto p-8 border-r border-slate-100">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100"><CalendarClock size={24} /></div>
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Declare Work Schedule</h3>
                  </div>
               </div>

               <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Lead Instructor</label>
                           <select 
                              required 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800 appearance-none"
                              value={formData.trainerId}
                              onChange={e => setFormData({...formData, trainerId: e.target.value})}
                           >
                              <option value="">Choose Instructor...</option>
                              {trainers.map(t => <option key={t.id} value={t.id}>{t.lastName}, {t.firstName}</option>)}
                           </select>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                             <MapPin size={12} className="text-indigo-600" /> Primary Location
                           </label>
                           <select 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800 appearance-none"
                              value={formData.locationId}
                              onChange={e => setFormData({...formData, locationId: e.target.value})}
                           >
                              <option value="">Choose Facility...</option>
                              {locations.map(l => <option key={l.id} value={l.id}>[{l.code}] {l.name}</option>)}
                           </select>
                        </div>
                     </div>

                     <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                           <Timer size={16} className="text-indigo-600" />
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add Daily Time Block</h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div className="col-span-2 space-y-1.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Select Work Day</label>
                              <select 
                                 className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold"
                                 value={activeSlot.dayIndex}
                                 onChange={e => setActiveSlot({...activeSlot, dayIndex: Number(e.target.value)})}
                              >
                                 {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                              </select>
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Shift Start</label>
                              <input type="time" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                 value={activeSlot.startTime} onChange={e => setActiveSlot({...activeSlot, startTime: e.target.value})} />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Shift End</label>
                              <input type="time" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                 value={activeSlot.endTime} onChange={e => setActiveSlot({...activeSlot, endTime: e.target.value})} />
                           </div>
                        </div>

                        <button 
                           type="button" 
                           onClick={addSlot}
                           className="w-full py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 border border-indigo-100"
                        >
                           <Plus size={14} /> Add or Update Slot
                        </button>
                     </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                     <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-sm font-black text-slate-500 hover:bg-slate-50 rounded-2xl transition-all">Discard</button>
                     <button type="submit" disabled={!formData.trainerId || !formData.slots?.length} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50">Save Entire Schedule</button>
                  </div>
               </form>
            </div>

            <div className="w-full md:w-80 bg-slate-50 p-8 overflow-y-auto">
               <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <CalendarDays size={18} className="text-indigo-600" />
                  Active Slots
               </h4>

               <div className="space-y-3">
                  {(formData.slots || []).length > 0 ? (formData.slots || []).map(s => {
                     const hrs = getSlotHours(s.startTime, s.endTime);
                     return (
                        <div key={s.dayIndex} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm animate-in slide-in-from-right-2 duration-300">
                           <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{DAYS[s.dayIndex]}</span>
                              <button onClick={() => removeSlot(s.dayIndex)} className="text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button>
                           </div>
                           <div className="flex justify-between items-end">
                              <div className="text-sm font-bold text-slate-800 font-mono">{s.startTime} - {s.endTime}</div>
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{hrs.toFixed(1)} hrs</div>
                           </div>
                        </div>
                     )
                  }) : (
                     <div className="py-12 text-center text-slate-400 italic text-[10px]">No work blocks defined for this instructor yet.</div>
                  )}

                  {totalWeeklyHours > 0 && (
                     <div className="mt-8 pt-6 border-t border-slate-200">
                        <div className="flex justify-between items-center text-xs font-black text-slate-800 uppercase tracking-widest">
                           <span>Weekly Load</span>
                           <span className="text-indigo-700">{totalWeeklyHours.toFixed(1)} Hours</span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-2 leading-relaxed">
                           Training projections assume <strong>1 standard qualification day = 8 actual training hours</strong>.
                        </p>
                     </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulesView;
