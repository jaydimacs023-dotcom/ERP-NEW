import React, { useState, useEffect, useMemo } from 'react';
import { Batch, Qualification, Trainer, Student, BatchStatus, Sponsor, TrainerSchedule, DaySlot, Location } from '../types';
import { 
  Search, Plus, Layers, Award, GraduationCap, Users, Calendar, 
  Trash2, X, CheckCircle, Clock, MoreVertical, Edit2, AlertCircle,
  ChevronRight, Filter, LayoutGrid, List, Handshake, CalendarRange,
  ShieldCheck, Timer, MapPin, Calculator, CalendarDays
} from 'lucide-react';

interface BatchesViewProps {
  batches: Batch[];
  qualifications: Qualification[];
  trainers: Trainer[];
  students: Student[];
  sponsors: Sponsor[];
  schedules: TrainerSchedule[];
  locations: Location[];
  onAddBatch: (batch: Batch) => void;
  onUpdateBatch: (batch: Batch) => void;
  onDeleteBatch: (id: string) => void;
}

const getSlotHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const startTotal = sH * 60 + sM;
  const endTotal = eH * 60 + eM;
  return Math.max(0, (endTotal - startTotal) / 60);
};

const calculateProjectedEndDate = (
  startDateStr: string, 
  durationDays: number, 
  slots: DaySlot[]
): { endDate: string; totalHours: number; calendarDays: number; trainingDays: number } => {
  if (!startDateStr || durationDays <= 0 || !slots.length) {
    return { endDate: '', totalHours: 0, calendarDays: 0, trainingDays: 0 };
  }
  
  // Rule: 1 Qualification Day = 8 Training Hours
  const totalRequiredHours = durationDays * 8;
  let remainingHours = totalRequiredHours;
  let currentDate = new Date(startDateStr);
  let calendarDaysPassed = 0;
  
  // Guard against infinite loops if slots define 0 hours
  const hasWorkHours = slots.some(s => getSlotHours(s.startTime, s.endTime) > 0);
  if (!hasWorkHours) return { endDate: '', totalHours: 0, calendarDays: 0, trainingDays: 0 };

  // Loop through calendar days until required hours are depleted
  let safetyCounter = 0;
  while (remainingHours > 0 && safetyCounter < 3000) {
    safetyCounter++;
    const dayOfWeek = currentDate.getDay();
    const slot = slots.find(s => s.dayIndex === dayOfWeek);
    
    if (slot) {
      const dailyHours = getSlotHours(slot.startTime, slot.endTime);
      if (dailyHours > 0) {
        remainingHours -= dailyHours;
      }
    }
    
    // Increment calendar day and count it
    calendarDaysPassed++;
    if (remainingHours > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  return { 
    endDate: currentDate.toISOString().split('T')[0], 
    totalHours: totalRequiredHours,
    calendarDays: calendarDaysPassed,
    trainingDays: durationDays
  };
};

const BatchesView: React.FC<BatchesViewProps> = ({ 
  batches, qualifications, trainers, students, sponsors, schedules, locations,
  onAddBatch, onUpdateBatch, onDeleteBatch 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  const [formData, setFormData] = useState<Partial<Batch>>({
    name: '',
    year: new Date().getFullYear(),
    qualificationId: '',
    trainerId: '',
    sponsorId: '',
    locationId: '',
    studentIds: [],
    status: BatchStatus.DRAFT,
    startDate: '',
    endDate: ''
  });

  const [projection, setProjection] = useState<{ totalHours: number; calendarDays: number; trainingDays: number } | null>(null);

  // Automated End Date Projection Logic with 8-Hour Rule
  useEffect(() => {
    if (formData.startDate && formData.qualificationId && formData.trainerId) {
      const qual = qualifications.find(q => q.id === formData.qualificationId);
      const sch = schedules.find(s => s.trainerId === formData.trainerId);
      
      if (qual && sch && sch.slots.length > 0) {
        const result = calculateProjectedEndDate(
          formData.startDate, 
          qual.durationDays, 
          sch.slots
        );

        if (result.endDate !== formData.endDate) {
          setFormData(prev => ({ ...prev, endDate: result.endDate }));
          setProjection({ 
            totalHours: result.totalHours, 
            calendarDays: result.calendarDays,
            trainingDays: result.trainingDays
          });
        }
      }
    }
  }, [formData.startDate, formData.qualificationId, formData.trainerId, qualifications, schedules]);

  const filteredBatches = batches.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: '',
      year: new Date().getFullYear(),
      qualificationId: '',
      trainerId: '',
      sponsorId: '',
      locationId: '',
      studentIds: [],
      status: BatchStatus.DRAFT,
      startDate: '',
      endDate: ''
    });
    setEditingBatch(null);
    setProjection(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.qualificationId || !formData.trainerId) return;

    if (editingBatch) {
      onUpdateBatch({ ...editingBatch, ...formData } as Batch);
    } else {
      const newBatch: Batch = {
        id: `batch-${Date.now()}`,
        orgId: 'temp',
        name: formData.name!,
        year: Number(formData.year),
        qualificationId: formData.qualificationId!,
        trainerId: formData.trainerId!,
        sponsorId: formData.sponsorId || undefined,
        locationId: formData.locationId || undefined,
        studentIds: formData.studentIds || [],
        status: formData.status || BatchStatus.DRAFT,
        startDate: formData.startDate!,
        endDate: formData.endDate!,
        createdAt: new Date().toISOString()
      };
      onAddBatch(newBatch);
    }
    setShowModal(false);
    resetForm();
  };

  const getStatusBadge = (status: BatchStatus) => {
    const styles = {
      [BatchStatus.DRAFT]: 'bg-slate-100 text-slate-600 border-slate-200',
      [BatchStatus.OPEN]: 'bg-blue-50 text-blue-700 border-blue-100',
      [BatchStatus.ONGOING]: 'bg-amber-50 text-amber-700 border-amber-100',
      [BatchStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    };
    const labels = {
      [BatchStatus.DRAFT]: 'Draft',
      [BatchStatus.OPEN]: 'Open Enrollment',
      [BatchStatus.ONGOING]: 'On Going',
      [BatchStatus.COMPLETED]: 'Completed'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-tight ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const toggleStudent = (studentId: string) => {
    const current = formData.studentIds || [];
    if (current.includes(studentId)) {
      setFormData({ ...formData, studentIds: current.filter(id => id !== studentId) });
    } else {
      setFormData({ ...formData, studentIds: [...current, studentId] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Layers className="text-indigo-600" size={28} />
            Training Batches
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Institutional program monitoring with hour-based compliance tracking.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-bold text-sm active:scale-95"
        >
          <Plus size={18} /> Initialize Batch
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by batch identifier..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBatches.map(batch => {
          const qual = qualifications.find(q => q.id === batch.qualificationId);
          const trainer = trainers.find(t => t.id === batch.trainerId);
          const sponsor = sponsors.find(s => s.id === batch.sponsorId);
          const location = locations.find(l => l.id === batch.locationId);
          
          return (
            <div key={batch.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col">
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest">FY {batch.year}</span>
                      {getStatusBadge(batch.status)}
                    </div>
                    <h3 className="text-xl font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{batch.name}</h3>
                  </div>
                  <div className="relative group/menu">
                    <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"><MoreVertical size={18} /></button>
                    <div className="absolute top-full right-0 mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1 hidden group-hover/menu:block z-20">
                      <button 
                        onClick={() => { setEditingBatch(batch); setFormData(batch); setShowModal(true); }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit2 size={14} /> Update Record
                      </button>
                      <button 
                        onClick={() => onDeleteBatch(batch.id)}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} /> Delete Batch
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-3">
                     <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${sponsor ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                        {sponsor ? <Handshake size={14} /> : <Users size={14} />}
                        {sponsor ? 'Sponsored' : 'Private'}
                     </div>
                     <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest bg-slate-50 border-slate-100 text-slate-500`}>
                        <MapPin size={14} className="text-indigo-500" />
                        {location?.code || 'TBD'}
                     </div>
                   </div>

                   <div className="space-y-2">
                     <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <Award className="text-amber-500 shrink-0" size={20} />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Qualification</p>
                          <p className="text-sm font-bold text-slate-700 truncate">{qual?.name || 'Unknown'}</p>
                        </div>
                     </div>

                     <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <GraduationCap className="text-indigo-500 shrink-0" size={20} />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Lead Instructor</p>
                          <p className="text-sm font-bold text-slate-700 truncate">{trainer ? `${trainer.lastName}, ${trainer.firstName}` : 'Not Assigned'}</p>
                        </div>
                     </div>
                   </div>
                </div>
              </div>

              <div className="px-8 py-5 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-white">
                 <div className="flex items-center gap-3">
                    <CalendarRange size={18} className="text-indigo-400" />
                    <div>
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Projected End</p>
                       <p className="text-sm font-black tracking-tight">{batch.endDate}</p>
                    </div>
                 </div>
                 <button className="text-indigo-400 text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all group-hover:text-white">
                    View <ChevronRight size={16} strokeWidth={3} />
                 </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8 flex flex-col md:flex-row h-full max-h-[85vh]">
            <div className="flex-1 overflow-y-auto border-r p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100">
                    <Layers size={24} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                    {editingBatch ? 'Modify Batch Record' : 'Initialize Batch'}
                  </h3>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Batch Identifier</label>
                    <input 
                      required 
                      placeholder="e.g. CSS-2024-B1" 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800"
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fiscal Year</label>
                    <input 
                      required type="number" 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800"
                      value={formData.year} onChange={e => setFormData({...formData, year: Number(e.target.value)})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                       <Award size={12} className="text-amber-500" /> Program Qualification
                    </label>
                    <select 
                      required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 appearance-none"
                      value={formData.qualificationId} onChange={e => setFormData({...formData, qualificationId: e.target.value})}
                    >
                      <option value="">Choose program...</option>
                      {qualifications.map(q => <option key={q.id} value={q.id}>{q.name} ({q.durationDays} Days)</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                       <GraduationCap size={12} className="text-indigo-600" /> Lead Instructor
                    </label>
                    <select 
                      required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 appearance-none"
                      value={formData.trainerId} onChange={e => setFormData({...formData, trainerId: e.target.value})}
                    >
                      <option value="">Assign trainer...</option>
                      {trainers.map(t => {
                        const sch = schedules.find(s => s.trainerId === t.id);
                        const weeklyHrs = sch?.slots.reduce((acc,s) => acc + getSlotHours(s.startTime, s.endTime), 0) || 0;
                        return <option key={t.id} value={t.id}>{t.lastName}, {t.firstName} {weeklyHrs > 0 ? `(${weeklyHrs.toFixed(1)} hrs/wk)` : '(No Schedule)'}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Training Location</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 appearance-none"
                      value={formData.locationId} onChange={e => setFormData({...formData, locationId: e.target.value})}
                    >
                      <option value="">Remote / External</option>
                      {locations.map(l => <option key={l.id} value={l.id}>[{l.code}] {l.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Funding Sponsor</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 appearance-none"
                      value={formData.sponsorId} onChange={e => setFormData({...formData, sponsorId: e.target.value})}
                    >
                      <option value="">Private / Individual</option>
                      {sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Commencement Date</label>
                    <input 
                      required type="date"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                      value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1 flex items-center gap-1.5">
                       <ShieldCheck size={12} /> Projected Completion
                    </label>
                    <div className="relative">
                      <input 
                        readOnly
                        placeholder="Pending schedule input..."
                        className="w-full px-5 py-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700 font-black outline-none text-sm"
                        value={formData.endDate} 
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <CheckCircle size={16} className="text-emerald-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {projection && (
                  <div className="p-6 bg-slate-900 rounded-[2rem] space-y-4 shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-500">
                     <div className="flex items-center gap-2 mb-2 text-indigo-400">
                        <Calculator size={18} />
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Compliance Forecast Breakdown</h4>
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Required Units</p>
                           <p className="text-xl font-mono font-black text-white">{projection.trainingDays.toFixed(1)} <span className="text-[10px] text-indigo-400">Full Days</span></p>
                           <p className="text-[9px] text-slate-500 italic mt-1">(Totaling {projection.totalHours} Instructional Hours)</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Wait Duration</p>
                           <p className="text-xl font-mono font-black text-white">{projection.calendarDays} <span className="text-[10px] text-indigo-400">Calendar Days</span></p>
                           <p className="text-[9px] text-slate-500 italic mt-1">Reflecting Half-Day and Off-Day shifts.</p>
                        </div>
                     </div>
                  </div>
                )}

                {!schedules.find(s => s.trainerId === formData.trainerId) && formData.trainerId && (
                  <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 flex gap-4">
                    <AlertCircle className="text-rose-600 shrink-0" size={24} />
                    <p className="text-xs text-rose-800 leading-relaxed font-bold">
                      Critical Notice: The selected instructor has no declared work shifts. The system cannot forecast an end-date or calculate half-day increments until a weekly schedule is defined.
                    </p>
                  </div>
                )}

                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-sm font-black text-slate-500 hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-indigo-100 active:scale-95 transition-all">
                    {editingBatch ? 'Sync Record' : 'Begin Training Program'}
                  </button>
                </div>
              </form>
            </div>

            <div className="w-full md:w-80 bg-slate-50 overflow-y-auto flex flex-col">
              <div className="p-8 border-b bg-white shrink-0">
                 <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                   <Users size={20} className="text-indigo-600" />
                   Enrollment Registry
                 </h4>
              </div>
              <div className="p-6 space-y-3 flex-1 overflow-y-auto">
                 {students.map(student => {
                   const isSelected = formData.studentIds?.includes(student.id);
                   return (
                     <button 
                       key={student.id}
                       type="button"
                       onClick={() => toggleStudent(student.id)}
                       className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all border group ${
                         isSelected ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl' : 'bg-white border-slate-100 hover:border-indigo-200'
                       }`}
                     >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                        }`}>
                          {student.lastName[0]}
                        </div>
                        <div className="flex-1 text-left overflow-hidden">
                           <div className={`text-xs font-black truncate uppercase ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                             {student.lastName}, {student.firstName}
                           </div>
                           <div className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                             ULI: {student.uli.slice(-6)}
                           </div>
                        </div>
                        {isSelected && <CheckCircle size={18} className="shrink-0 text-white" />}
                     </button>
                   );
                 })}
                 {students.length === 0 && (
                    <div className="py-20 text-center px-4">
                       <Users size={32} className="mx-auto text-slate-200 mb-4" />
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No learners found in the registry.</p>
                    </div>
                 )}
              </div>
              <div className="p-8 bg-white border-t mt-auto">
                 <div className="flex justify-between items-center text-xs font-black text-slate-800 uppercase tracking-widest">
                    <span>Enrolled Learners</span>
                    <span className="text-indigo-600">{formData.studentIds?.length || 0}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchesView;