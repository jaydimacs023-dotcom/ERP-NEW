import React, { useState, useEffect, useMemo } from 'react';
import { Batch, Qualification, Trainer, Student, BatchStatus, Sponsor, TrainerSchedule, DaySlot, Location } from '../types';
import { generateUUID } from '../utils/uuid';
import { 
  Search, Plus, Layers, Award, GraduationCap, Users, Calendar, 
  Trash2, X, CheckCircle, Clock, MoreVertical, Edit2, AlertCircle,
  ChevronRight, Filter, LayoutGrid, List, Handshake, CalendarRange,
  ShieldCheck, Timer, MapPin, Calculator, CalendarDays, Loader2, Play
} from 'lucide-react';

interface BatchesViewProps {
  batches: Batch[];
  qualifications: Qualification[];
  trainers: Trainer[];
  students: Student[];
  sponsors: Sponsor[];
  schedules: TrainerSchedule[];
  locations: Location[];
  onAddBatch: (batch: Batch) => Promise<void> | void;
  onUpdateBatch: (batch: Batch) => Promise<void> | void;
  onDeleteBatch: (id: string) => Promise<boolean | void> | void;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
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
  onAddBatch, onUpdateBatch, onDeleteBatch, onNotify 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [viewingBatch, setViewingBatch] = useState<Batch | null>(null);

  const [formData, setFormData] = useState<Partial<Batch>>({
    name: '',
    batchCode: '',
    year: new Date().getFullYear(),
    qualificationId: '',
    trainerId: '',
    sponsorId: '',
    locationId: '',
    studentIds: [],
    status: BatchStatus.PLANNED,
    startDate: '',
    endDate: '',
    maxStudents: 30
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
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.batchCode && b.batchCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const resetForm = () => {
    setFormData({
      name: '',
      batchCode: '',
      year: new Date().getFullYear(),
      qualificationId: '',
      trainerId: '',
      sponsorId: '',
      locationId: '',
      studentIds: [],
      status: BatchStatus.PLANNED,
      startDate: '',
      endDate: '',
      maxStudents: 30
    });
    setEditingBatch(null);
    setProjection(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.qualificationId || !formData.trainerId || isSaving) return;

    setIsSaving(true);
    try {
      const studentCount = formData.studentIds?.length || 0;
      
      if (editingBatch) {
        // Keep existing status if it's ongoing, completed or cancelled
        const finalStatus = (editingBatch.status === BatchStatus.ONGOING || editingBatch.status === BatchStatus.COMPLETED || editingBatch.status === BatchStatus.CANCELLED) 
          ? editingBatch.status 
          : BatchStatus.PLANNED;
        await onUpdateBatch({ ...editingBatch, ...formData, status: finalStatus, currentStudents: studentCount } as Batch);
        onNotify?.('success', 'Batch updated successfully');
      } else {
        const newBatch: Batch = {
          id: generateUUID(),
          orgId: '',
          batchCode: formData.batchCode || '',
          name: formData.name!,
          year: Number(formData.year),
          qualificationId: formData.qualificationId!,
          trainerId: formData.trainerId!,
          sponsorId: formData.sponsorId || undefined,
          locationId: formData.locationId || undefined,
          studentIds: formData.studentIds || [],
          status: BatchStatus.PLANNED,
          startDate: formData.startDate!,
          endDate: formData.endDate!,
          maxStudents: formData.maxStudents || 30,
          currentStudents: studentCount
        };
        await onAddBatch(newBatch);
        onNotify?.('success', 'Batch created successfully');
      }
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('[BatchesView] Error saving batch:', error);
      onNotify?.('error', 'Failed to save batch');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isDeleting) return;
    setIsDeleting(id);
    try {
      await onDeleteBatch(id);
      onNotify?.('success', 'Batch deleted successfully');
    } catch (error) {
      console.error('[BatchesView] Error deleting batch:', error);
      onNotify?.('error', 'Failed to delete batch');
    } finally {
      setIsDeleting(null);
    }
  };

  // Commence Training - PLANNED → ONGOING (requires ≥5 students)
  const [isCommencing, setIsCommencing] = useState<string | null>(null);
  
  const handleCommenceTraining = async (batch: Batch) => {
    if (isCommencing) return;
    
    // Validate minimum 5 students
    if (batch.studentIds.length < 5) {
      onNotify?.('error', 'Cannot commence training. Minimum 5 students required.');
      return;
    }
    
    setIsCommencing(batch.id);
    try {
      await onUpdateBatch({ ...batch, status: BatchStatus.ONGOING });
      onNotify?.('success', 'Training commenced successfully!');
    } catch (error) {
      console.error('[BatchesView] Error commencing training:', error);
      onNotify?.('error', 'Failed to commence training');
    } finally {
      setIsCommencing(null);
    }
  };

  // Auto-complete batches when end_date has passed
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    
    batches.forEach(async (batch) => {
      // Only auto-complete ONGOING batches where end_date has passed
      if (batch.status === BatchStatus.ONGOING && batch.endDate && batch.endDate < today) {
        try {
          await onUpdateBatch({ ...batch, status: BatchStatus.COMPLETED });
          onNotify?.('info', `Batch "${batch.name}" automatically marked as completed`);
        } catch (error) {
          console.error('[BatchesView] Error auto-completing batch:', error);
        }
      }
    });
  }, [batches]);

  const getStatusBadge = (status: BatchStatus) => {
    const styles = {
      [BatchStatus.PLANNED]: 'bg-teal-50 text-teal-700 border-teal-100',
      [BatchStatus.ONGOING]: 'bg-amber-50 text-amber-700 border-amber-100',
      [BatchStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      [BatchStatus.CANCELLED]: 'bg-slate-100 text-slate-600 border-slate-200'
    };
    const labels = {
      [BatchStatus.PLANNED]: 'Planned',
      [BatchStatus.ONGOING]: 'On Going',
      [BatchStatus.COMPLETED]: 'Completed',
      [BatchStatus.CANCELLED]: 'Cancelled'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-tight ${styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
        {labels[status] || status}
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
            <Layers className="text-teal-600" size={28} />
            Training Batches
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Institutional program monitoring with hour-based compliance tracking.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-md shadow-teal-100 font-bold text-sm active:scale-95"
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
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 outline-none text-sm transition-all"
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
                      <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 uppercase tracking-widest">FY {batch.year}</span>
                      {getStatusBadge(batch.status)}
                    </div>
                    <h3 className="text-xl font-black text-slate-800 leading-tight group-hover:text-teal-600 transition-colors">{batch.name}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => { setEditingBatch(batch); setFormData(batch); setShowModal(true); }}
                      className="p-2 hover:bg-teal-50 rounded-xl text-slate-400 hover:text-teal-600 transition-colors"
                      title="Edit Batch"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(batch.id)}
                      disabled={isDeleting === batch.id}
                      className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                      title="Delete Batch"
                    >
                      {isDeleting === batch.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="grid grid-cols-3 gap-3">
                     <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${sponsor ? 'bg-teal-50 border-teal-100 text-teal-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                        {sponsor ? <Handshake size={14} /> : <Users size={14} />}
                        {sponsor ? 'Sponsored' : 'Private'}
                     </div>
                     <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest bg-slate-50 border-slate-100 text-slate-500`}>
                        <MapPin size={14} className="text-teal-500" />
                        {location?.code || 'TBD'}
                     </div>
                     <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${batch.currentStudents >= 5 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                        <Users size={14} />
                        {batch.currentStudents}/{batch.maxStudents}
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
                        <GraduationCap className="text-teal-500 shrink-0" size={20} />
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
                    <CalendarRange size={18} className="text-teal-400" />
                    <div>
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Projected End</p>
                       <p className="text-sm font-black tracking-tight">{batch.endDate}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                   {batch.status === 'PLANNED' && (
                     <button 
                       onClick={() => handleCommenceTraining(batch)}
                       disabled={isCommencing === batch.id}
                       className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                       title={batch.currentStudents >= 5 ? "Start Training" : "Requires at least 5 enrolled students"}
                     >
                       {isCommencing === batch.id ? (
                         <Loader2 size={14} className="animate-spin" />
                       ) : (
                         <Play size={14} />
                       )}
                       Commence
                     </button>
                   )}
                   {batch.status === 'ONGOING' && (
                     <span className="flex items-center gap-2 px-4 py-2 bg-teal-500/20 text-teal-400 text-xs font-black uppercase tracking-widest rounded-xl">
                       <Play size={14} /> In Progress
                     </span>
                   )}
                   {batch.status === 'COMPLETED' && (
                     <span className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-xl">
                       ✓ Completed
                     </span>
                   )}
                   <button 
                     onClick={() => setViewingBatch(batch)}
                     className="text-teal-400 text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all group-hover:text-white"
                   >
                      View <ChevronRight size={16} strokeWidth={3} />
                   </button>
                 </div>
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
                  <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-xl shadow-teal-100">
                    <Layers size={24} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                    {editingBatch ? 'Modify Batch Record' : 'Initialize Batch'}
                  </h3>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Batch Code</label>
                    <input 
                      placeholder="e.g. BATCH-001" 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800"
                      value={formData.batchCode} onChange={e => setFormData({...formData, batchCode: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Batch Name</label>
                    <input 
                      required 
                      placeholder="e.g. CSS-2024-B1" 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800"
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fiscal Year</label>
                    <input 
                      required type="number" 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800"
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
                       <GraduationCap size={12} className="text-teal-600" /> Lead Instructor
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
                      {locations.map(l => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
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
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold"
                      value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-teal-600 uppercase tracking-widest px-1 flex items-center gap-1.5">
                       <ShieldCheck size={12} /> Projected Completion
                    </label>
                    <div className="relative">
                      <input 
                        readOnly
                        placeholder="Pending schedule input..."
                        className="w-full px-5 py-3.5 bg-teal-50 border border-teal-100 rounded-2xl text-teal-700 font-black outline-none text-sm"
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
                     <div className="flex items-center gap-2 mb-2 text-teal-400">
                        <Calculator size={18} />
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Compliance Forecast Breakdown</h4>
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Required Units</p>
                           <p className="text-xl font-mono font-black text-white">{projection.trainingDays.toFixed(1)} <span className="text-[10px] text-teal-400">Full Days</span></p>
                           <p className="text-[9px] text-slate-500 italic mt-1">(Totaling {projection.totalHours} Instructional Hours)</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Wait Duration</p>
                           <p className="text-xl font-mono font-black text-white">{projection.calendarDays} <span className="text-[10px] text-teal-400">Calendar Days</span></p>
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
                  <button type="button" onClick={() => setShowModal(false)} disabled={isSaving} className="flex-1 py-4 text-sm font-black text-slate-500 hover:bg-slate-50 rounded-2xl transition-all disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-teal-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-teal-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                    {editingBatch ? 'Sync Record' : 'Begin Training Program'}
                  </button>
                </div>
              </form>
            </div>

            <div className="w-full md:w-80 bg-slate-50 overflow-y-auto flex flex-col">
              <div className="p-8 border-b bg-white shrink-0">
                 <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                   <Users size={20} className="text-teal-600" />
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
                         isSelected ? 'bg-teal-600 border-teal-700 text-white shadow-xl' : 'bg-white border-slate-100 hover:border-teal-200'
                       }`}
                     >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600'
                        }`}>
                          {student.lastName[0]}
                        </div>
                        <div className="flex-1 text-left overflow-hidden">
                           <div className={`text-xs font-black truncate uppercase ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                             {student.lastName}, {student.firstName}
                           </div>
                           <div className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-teal-200' : 'text-slate-400'}`}>
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
                    <span className="text-teal-600">{formData.studentIds?.length || 0}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Detail View Modal */}
      {viewingBatch && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[80] overflow-y-auto">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="bg-gradient-to-r from-teal-600 to-purple-600 px-10 py-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10">
                <Layers size={200} strokeWidth={1} />
              </div>
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-black bg-white/20 px-3 py-1 rounded-lg border border-white/30 uppercase tracking-widest">FY {viewingBatch.year}</span>
                    <span className="text-xs font-black bg-white/20 px-3 py-1 rounded-lg border border-white/30 uppercase tracking-widest">{viewingBatch.batchCode}</span>
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tight mb-2">{viewingBatch.name}</h2>
                  <p className="text-teal-200 text-sm font-bold">Comprehensive Batch Intelligence Report</p>
                </div>
                <button 
                  onClick={() => setViewingBatch(null)}
                  className="p-3 hover:bg-white/20 rounded-full transition-colors text-white"
                >
                  <X size={28} />
                </button>
              </div>
            </div>

            <div className="p-10 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-teal-50 to-purple-50 p-6 rounded-3xl border border-teal-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-lg">
                      {getStatusBadge(viewingBatch.status)}
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-1">Current Status</p>
                  <p className="text-2xl font-black text-slate-800 capitalize">{viewingBatch.status.toLowerCase()}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-3xl border border-emerald-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg">
                      <Users size={24} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Enrollment</p>
                  <p className="text-2xl font-black text-slate-800">{viewingBatch.currentStudents} / {viewingBatch.maxStudents}</p>
                  <div className="mt-3 w-full bg-emerald-100 rounded-full h-2">
                    <div 
                      className="bg-emerald-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((viewingBatch.currentStudents / viewingBatch.maxStudents) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-3xl border border-amber-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-amber-600 text-white rounded-2xl shadow-lg">
                      <CalendarDays size={24} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Timeline</p>
                  <p className="text-sm font-bold text-slate-600">{viewingBatch.startDate}</p>
                  <p className="text-[10px] text-slate-400 font-black uppercase">to</p>
                  <p className="text-sm font-bold text-slate-800">{viewingBatch.endDate}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Award size={16} className="text-teal-600" />
                    Qualification Details
                  </h3>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-lg font-black text-slate-800 mb-2">
                      {qualifications.find(q => q.id === viewingBatch.qualificationId)?.name || 'Unknown'}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Code</p>
                        <p className="text-sm font-bold text-slate-700">
                          {qualifications.find(q => q.id === viewingBatch.qualificationId)?.code || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Duration</p>
                        <p className="text-sm font-bold text-slate-700">
                          {qualifications.find(q => q.id === viewingBatch.qualificationId)?.durationDays || 0} Days
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <GraduationCap size={16} className="text-teal-600" />
                    Lead Instructor
                  </h3>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    {(() => {
                      const trainer = trainers.find(t => t.id === viewingBatch.trainerId);
                      return trainer ? (
                        <>
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-lg shadow-xl">
                              {trainer.lastName[0]}{trainer.firstName[0]}
                            </div>
                            <div>
                              <p className="text-lg font-black text-slate-800">{trainer.lastName}, {trainer.firstName}</p>
                              <p className="text-xs text-slate-500 font-bold">{trainer.email}</p>
                            </div>
                          </div>
                          {trainer.phone && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact</p>
                              <p className="text-sm font-bold text-slate-700">{trainer.phone}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-slate-400 italic">No trainer assigned</p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <MapPin size={16} className="text-teal-600" />
                    Location & Sponsor
                  </h3>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Training Location</p>
                      <p className="text-sm font-bold text-slate-700">
                        {locations.find(l => l.id === viewingBatch.locationId)?.name || 'Not Specified'}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sponsor</p>
                      <p className="text-sm font-bold text-slate-700">
                        {sponsors.find(s => s.id === viewingBatch.sponsorId)?.name || 'Private / Self-Funded'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Calculator size={16} className="text-teal-600" />
                    Projected Metrics
                  </h3>
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl text-white">
                    {(() => {
                      const schedule = schedules.find(s => s.trainerId === viewingBatch.trainerId);
                      const qual = qualifications.find(q => q.id === viewingBatch.qualificationId);
                      if (schedule && qual && viewingBatch.startDate) {
                        const projected = calculateProjectedEndDate(viewingBatch.startDate, qual.durationDays, schedule.slots);
                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Hours</p>
                                <p className="text-2xl font-mono font-black">{projected.totalHours}h</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Calendar Days</p>
                                <p className="text-2xl font-mono font-black">{projected.calendarDays}</p>
                              </div>
                            </div>
                            <div className="pt-4 border-t border-white/10">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Training Days</p>
                              <p className="text-2xl font-mono font-black text-teal-400">{projected.trainingDays}</p>
                            </div>
                          </div>
                        );
                      }
                      return <p className="text-slate-400 italic text-sm">Metrics unavailable</p>;
                    })()}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Users size={16} className="text-teal-600" />
                  Enrolled Students ({viewingBatch.studentIds?.length || 0})
                </h3>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  {viewingBatch.studentIds && viewingBatch.studentIds.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {viewingBatch.studentIds.map(studentId => {
                        const student = students.find(s => s.id === studentId);
                        return student ? (
                          <div key={student.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                              {student.lastName[0]}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-xs font-black text-slate-800 truncate uppercase">
                                {student.lastName}, {student.firstName}
                              </p>
                              <p className="text-[9px] font-mono text-slate-400 mt-0.5">
                                {student.uli.slice(-6)}
                              </p>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <Users size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-sm text-slate-400 font-bold">No students enrolled yet</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => {
                    setViewingBatch(null);
                    setEditingBatch(viewingBatch);
                    setFormData(viewingBatch);
                    setShowModal(true);
                  }}
                  className="flex-1 py-4 bg-teal-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-teal-100"
                >
                  <Edit2 size={18} /> Edit Batch
                </button>
                <button 
                  onClick={() => setViewingBatch(null)}
                  className="px-8 py-4 bg-slate-100 text-slate-700 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchesView;
