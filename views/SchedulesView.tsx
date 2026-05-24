
import React, { useState, useMemo, useEffect } from 'react';
import { Batch, Trainer, TrainerSchedule, DaySlot, Location, Organization, Qualification } from '../types';
import { generateUUID } from '../utils/uuid';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { 
  CalendarClock, Search, Plus, Trash2, X, ChevronRight, 
  Clock, Timer, AlertCircle, CalendarDays, Check, MapPin,
  Briefcase, GraduationCap, ArrowRight, Save, ShieldCheck,
  Info, Sparkles, Activity, Loader2, CheckCircle, Edit2 as Edit2Icon, Filter
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface SchedulesViewProps {
  batches: Batch[];
  schedules: TrainerSchedule[];
  trainers: Trainer[];
  locations: Location[];
  qualifications: Qualification[];
  organization?: Organization;
  onAddSchedule: (sch: TrainerSchedule) => void | Promise<void>;
  onUpdateSchedule: (sch: TrainerSchedule) => void | Promise<void>;
  onDeleteSchedule: (id: string) => void | Promise<boolean>;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LUNCH_START_MINUTES = 12 * 60;
const LUNCH_END_MINUTES = 13 * 60;

const getSlotHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const startTotal = sH * 60 + sM;
  const endTotal = eH * 60 + eM;
  const grossMinutes = Math.max(0, endTotal - startTotal);
  const lunchOverlap = Math.max(
    0,
    Math.min(endTotal, LUNCH_END_MINUTES) - Math.max(startTotal, LUNCH_START_MINUTES)
  );
  return Math.max(0, (grossMinutes - lunchOverlap) / 60);
};

const SchedulesView: React.FC<SchedulesViewProps> = ({ 
  batches, schedules, trainers, locations, qualifications, organization, onAddSchedule, onUpdateSchedule, onDeleteSchedule 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<'ALL' | string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const brandColor = organization?.primaryColor || '#059669';
  const locationOptions = useMemo(() => locations.filter(l => !l.isDeleted), [locations]);
  const hasActiveFilters = searchTerm.trim().length > 0 || locationFilter !== 'ALL';

  useEffect(() => {
    if (brandColor) {
      document.documentElement.style.setProperty('--brand', brandColor);
    }
  }, [brandColor]);
  const [editingSchedule, setEditingSchedule] = useState<TrainerSchedule | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<TrainerSchedule | null>(null);
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
    endTime: '12:00',
    qualificationId: ''
  });

  const totalWeeklyHours = useMemo(() => 
    (formData.slots || []).reduce((sum, s) => sum + getSlotHours(s.startTime, s.endTime), 0),
  [formData.slots]);

  const selectedTrainerQualifications = useMemo(() => {
    const trainer = trainers.find(t => t.id === formData.trainerId);
    if (!trainer?.qualificationIds?.length) return qualifications;
    return qualifications.filter(q => trainer.qualificationIds.includes(q.id));
  }, [formData.trainerId, trainers, qualifications]);

  const getQualificationLabel = (qualificationId?: string) => {
    if (!qualificationId) return 'General availability';
    const qualification = qualifications.find(q => q.id === qualificationId);
    return qualification ? `${qualification.name}${qualification.code ? ` (${qualification.code})` : ''}` : 'Unknown qualification';
  };

  const filteredSchedules = useMemo(() => schedules.filter(s => {
    if (s.isDeleted) return false;
    const trainer = trainers.find(t => t.id === s.trainerId);
    if (!trainer) return false;
    const location = locations.find(l => l.id === s.locationId);
    const name = `${trainer.firstName} ${trainer.lastName}`.toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase());
    const matchesLocation = locationFilter === 'ALL' || s.locationId === locationFilter;
    return matchesSearch && matchesLocation;
  }), [schedules, trainers, locations, searchTerm, locationFilter]);

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows: paginatedSchedules,
    setCurrentPage
  } = usePaginatedRows(filteredSchedules, [searchTerm, locationFilter], 5);

  const resetForm = () => {
    setFormData({ trainerId: '', locationId: '', slots: [] });
    setEditingSchedule(null);
    setActiveSlot({ dayIndex: 1, startTime: '08:00', endTime: '12:00', qualificationId: '' });
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
        if (viewingSchedule?.id === updatedSchedule.id) {
          setViewingSchedule(updatedSchedule);
        }
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
    if (!scheduleToDelete) return;

    const trainer = trainers.find(t => t.id === scheduleToDelete.trainerId);
    const trainerName = trainer ? `${trainer.firstName} ${trainer.lastName}` : 'Unknown';

    const engagedBatch = batches.find(b =>
      b.trainerId === scheduleToDelete.trainerId &&
      (b.status === 'PLANNED' || b.status === 'ONGOING')
    );

    if (engagedBatch) {
      showToast(`Cannot delete schedule for ${trainerName}. Trainer is engaged in ${engagedBatch.status.toLowerCase()} batch ${engagedBatch.name}.`, 'error');
      return;
    }

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
    const normalizedSlot = {
      ...activeSlot,
      qualificationId: activeSlot.qualificationId || undefined
    };
    const next = [
      ...current.filter(s => !(s.dayIndex === normalizedSlot.dayIndex && (s.qualificationId || '') === (normalizedSlot.qualificationId || ''))),
      normalizedSlot
    ].sort((a,b) => a.dayIndex - b.dayIndex || (a.qualificationId || '').localeCompare(b.qualificationId || ''));
    setFormData({ ...formData, slots: next });
  };

  const removeSlot = (slotToRemove: DaySlot) => {
    setFormData({
      ...formData,
      slots: (formData.slots || []).filter(s =>
        !(
          s.dayIndex === slotToRemove.dayIndex &&
          s.startTime === slotToRemove.startTime &&
          s.endTime === slotToRemove.endTime &&
          (s.qualificationId || '') === (slotToRemove.qualificationId || '')
        )
      )
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {viewingSchedule && !showModal && (() => {
        const trainer = trainers.find(t => t.id === viewingSchedule.trainerId);
        const location = locations.find(l => l.id === viewingSchedule.locationId);
        const weeklyHours = viewingSchedule.slots.reduce((sum, s) => sum + getSlotHours(s.startTime, s.endTime), 0);

        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
              className="rounded-md border bg-white p-5 shadow-sm"
              style={{ borderColor: `${brandColor}30`, background: `linear-gradient(90deg, ${brandColor}10, #ffffff 45%)` }}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <button
                    type="button"
                    onClick={() => setViewingSchedule(null)}
                    className="mb-4 inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-brand hover:text-brand"
                  >
                    <ChevronRight size={15} className="rotate-180" />
                    Back to Schedules
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded border border-brand-light bg-brand/10 text-brand">
                      <CalendarClock size={22} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
                        {trainer ? `${trainer.lastName}, ${trainer.firstName}` : 'Schedule Details'}
                      </h2>
                      <p className="text-sm text-gray-500">{location?.name || 'Mobile/Remote'} schedule profile</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingSchedule(viewingSchedule);
                    setFormData(viewingSchedule);
                    setShowModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-colors hover:bg-brand-hover"
                >
                  <Edit2Icon size={17} />
                  Edit Schedule
                </button>
              </div>
            </div>

            <div className="rounded-md border border-brand-light bg-brand/10 p-4 text-sm text-brand shadow-sm">
              <div className="flex gap-3">
                <Info size={18} className="mt-0.5 shrink-0" />
                <p className="font-medium">
                  Schedule updates will be reflected for incoming new assignments. Existing assigned or ongoing batches keep their current schedule snapshot.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Trainer</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-brand-light bg-brand/10 text-xs font-semibold text-brand">
                    {trainer?.lastName?.[0]}{trainer?.firstName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{trainer ? `${trainer.lastName}, ${trainer.firstName}` : 'Unassigned'}</p>
                    <p className="text-xs text-gray-400">{trainer?.email || 'No email recorded'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Location</p>
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <MapPin size={16} className="text-brand" />
                  {location?.name || 'Mobile/Remote'}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Weekly Load</p>
                <div className="mt-3 inline-flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-1.5 font-mono text-sm font-semibold text-gray-800">
                  <Timer size={15} className="text-brand" />
                  {weeklyHours.toFixed(1)} hrs
                </div>
              </div>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Clock size={17} className="text-brand" />
                <h3 className="text-sm font-semibold text-gray-900">Schedule Slots</h3>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {viewingSchedule.slots.map((slot, index) => (
                  <div key={`${slot.dayIndex}-${slot.qualificationId || 'all'}-${index}`} className="rounded border border-gray-100 bg-gray-50 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{DAYS[slot.dayIndex]}</p>
                        <p className="mt-1 text-xs font-medium text-gray-500">{getQualificationLabel(slot.qualificationId)}</p>
                      </div>
                      <span className="rounded bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                        {getSlotHours(slot.startTime, slot.endTime).toFixed(1)}h
                      </span>
                    </div>
                    <p className="font-mono text-sm font-semibold text-gray-800">{slot.startTime} - {slot.endTime}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {!showModal && !viewingSchedule && (
        <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Institutional Capacity Engine</h2>
          <p className="text-sm text-gray-500 font-normal italic">Trainer workload matrix and resource allocation optimization.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-8 py-3 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-sm shadow-brand/20 font-semibold text-xs active:scale-95 uppercase tracking-wide"
        >
          <Plus size={18} /> Schedule Session
        </button>
      </div>

      <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr_1fr] items-end">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              placeholder="Search by instructor name or batch..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm focus:border-brand outline-none transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={18} />
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value as any)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-gray-700 focus:border-brand outline-none transition-all"
            >
              <option value="ALL">All locations</option>
              {locationOptions.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                setSearchTerm('');
                setLocationFilter('ALL');
              }}
              className={`text-sm font-semibold transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            >
              Clear filters
            </button>
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-900">{filteredSchedules.length}</span> of <span className="font-semibold text-gray-900">{schedules.length}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-brand border-b border-brand">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Trainer</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Location</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide">Hours</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Active Days</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Time Blocks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSchedules.length > 0 ? paginatedSchedules.map(sch => {
                const trainer = trainers.find(t => t.id === sch.trainerId);
                const location = locations.find(l => l.id === sch.locationId);
                const weeklyHours = sch.slots.reduce((sum, s) => sum + getSlotHours(s.startTime, s.endTime), 0);
                const activeDays = DAYS.map((day, idx) => ({
                  day,
                  count: sch.slots.filter(s => s.dayIndex === idx).length
                })).filter(item => item.count > 0);
                const sortedSlots = [...sch.slots].sort((a, b) =>
                  a.dayIndex - b.dayIndex ||
                  a.startTime.localeCompare(b.startTime) ||
                  (a.qualificationId || '').localeCompare(b.qualificationId || '')
                );
                const previewSlots = sortedSlots.slice(0, 3);

                return (
                  <tr
                    key={sch.id}
                    onClick={() => setViewingSchedule(sch)}
                    className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setViewingSchedule(sch);
                      }
                    }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded border border-brand-light bg-brand/10 text-brand flex items-center justify-center font-semibold text-xs">
                          {trainer?.lastName[0]}{trainer?.firstName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{trainer?.lastName}, {trainer?.firstName}</p>
                          <p className="text-xs text-gray-400">Trainer</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin size={15} className="text-brand" />
                        <span className="text-sm text-gray-700">{location?.name || 'Mobile/Remote'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 bg-white text-sm font-mono font-semibold text-gray-700">
                        <Timer size={13} className="text-brand" />
                        {weeklyHours.toFixed(1)} hrs
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {activeDays.length > 0 ? activeDays.map(item => (
                          <span key={item.day} className="inline-flex items-center gap-1 rounded border border-brand-light bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                            {item.day.slice(0, 3)}
                            {item.count > 1 && <span className="font-mono text-[10px]">{item.count}</span>}
                          </span>
                        )) : (
                          <span className="text-xs font-medium text-gray-400">No active days</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-400">{sch.slots.length} slot{sch.slots.length === 1 ? '' : 's'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {previewSlots.map((slot, idx) => (
                          <span key={`${slot.dayIndex}-${slot.qualificationId || 'all'}-${idx}`} className="inline-flex items-center gap-1.5 rounded border border-gray-100 bg-gray-50 px-2 py-1 text-xs text-gray-600">
                            <Clock size={10} className="text-brand" />
                            {DAYS[slot.dayIndex].slice(0, 3)} {slot.startTime}-{slot.endTime}
                          </span>
                        ))}
                        {sortedSlots.length > previewSlots.length && (
                          <span className="inline-flex rounded border border-brand-light bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                            +{sortedSlots.length - previewSlots.length} more
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-400">Click row to view or update</p>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <CalendarDays size={48} strokeWidth={1.5} className="mx-auto mb-4 text-gray-200" />
                    <h3 className="text-base font-semibold text-gray-500">No trainer schedules yet</h3>
                    <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">Create a schedule session to start building trainer availability.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredSchedules.length}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={setCurrentPage}
          itemLabel="schedules"
        />
      </div>
        </>
      )}

      {showModal && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: `${brandColor}30`, background: `linear-gradient(90deg, ${brandColor}10, #ffffff 45%)` }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded bg-brand text-white shadow-sm shadow-brand/20">
                  <CalendarClock size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
                    {editingSchedule ? 'Modify Schedule Session' : 'Schedule Session'}
                  </h2>
                  <p className="text-sm text-gray-500">Trainer availability, deployment station, and weekly load.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-brand hover:text-brand"
              >
                <X size={16} />
                {viewingSchedule ? 'Back to Schedule' : 'Back to Schedules'}
              </button>
            </div>
          </div>

          <div className="rounded-md border border-brand-light bg-brand/10 p-4 text-sm text-brand shadow-sm">
            <div className="flex gap-3">
              <Info size={18} className="mt-0.5 shrink-0" />
              <p className="font-medium">
                New or updated schedules will be reflected for incoming new assignments. Existing assigned or ongoing batches keep their current schedule snapshot.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <form
              id="schedule-session-form"
              onSubmit={handleSubmit}
              className="space-y-5 rounded-md border border-gray-200 bg-white p-5 shadow-sm [&_input]:rounded [&_input]:border [&_input]:border-gray-200 [&_input]:bg-gray-50 [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-sm [&_input]:outline-none [&_input]:transition-colors [&_input:focus]:border-brand [&_select]:rounded [&_select]:border [&_select]:border-gray-200 [&_select]:bg-gray-50 [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-sm [&_select]:font-semibold [&_select]:text-gray-800 [&_select]:outline-none [&_select]:transition-colors [&_select:focus]:border-brand"
            >
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <GraduationCap size={18} className="text-brand" />
                  <h3 className="text-sm font-semibold text-gray-900">Trainer Details</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Lead Instructor</label>
                    <select
                      required
                      disabled={!!editingSchedule}
                      className="w-full appearance-none disabled:opacity-50"
                      value={formData.trainerId}
                      onChange={e => setFormData({ ...formData, trainerId: e.target.value })}
                    >
                      <option value="">Choose personnel</option>
                      {trainers.map(t => <option key={t.id} value={t.id}>{t.lastName.toUpperCase()}, {t.firstName}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Deployment Station</label>
                    <select
                      className="w-full appearance-none"
                      value={formData.locationId}
                      onChange={e => setFormData({ ...formData, locationId: e.target.value })}
                    >
                      <option value="">Remote / decentralized</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Timer size={18} className="text-brand" />
                  <h3 className="text-sm font-semibold text-gray-900">Session Slot</h3>
                </div>

                <div className="rounded-md border border-gray-200 bg-gray-50/70 p-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <div className="space-y-1.5 xl:col-span-2">
                      <label className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Qualification</label>
                      <select
                        className="w-full"
                        value={activeSlot.qualificationId || ''}
                        onChange={e => setActiveSlot({ ...activeSlot, qualificationId: e.target.value || undefined })}
                      >
                        <option value="">General / any qualification</option>
                        {selectedTrainerQualifications.map(q => (
                          <option key={q.id} value={q.id}>
                            {q.name} {q.code ? `(${q.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Day</label>
                      <select
                        className="w-full"
                        value={activeSlot.dayIndex}
                        onChange={e => setActiveSlot({ ...activeSlot, dayIndex: Number(e.target.value) })}
                      >
                        {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Start</label>
                      <input
                        type="time"
                        className="w-full font-mono font-semibold"
                        value={activeSlot.startTime}
                        onChange={e => setActiveSlot({ ...activeSlot, startTime: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">End</label>
                      <input
                        type="time"
                        className="w-full font-mono font-semibold"
                        value={activeSlot.endTime}
                        onChange={e => setActiveSlot({ ...activeSlot, endTime: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-medium text-gray-500">Lunch break from 12:00 PM to 1:00 PM is excluded from training hours.</p>
                    <button
                      type="button"
                      onClick={addSlot}
                      className="inline-flex items-center justify-center gap-2 rounded bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:bg-brand-hover active:scale-95"
                    >
                      <Check size={16} />
                      Add Slot
                    </button>
                  </div>
                </div>
              </section>
            </form>

            <aside className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ShieldCheck size={18} className="text-brand" />
                  Weekly Load
                </h3>
                {totalWeeklyHours > 40 && (
                  <span className="inline-flex items-center gap-1 rounded border border-rose-100 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600">
                    <AlertCircle size={12} />
                    Over capacity
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {(formData.slots || []).length > 0 ? (formData.slots || []).map((s, index) => {
                  const hrs = getSlotHours(s.startTime, s.endTime);
                  return (
                    <div key={`${s.dayIndex}-${s.qualificationId || 'all'}-${index}`} className="group rounded border border-gray-100 bg-gray-50 p-4 transition-all hover:border-brand">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{DAYS[s.dayIndex]}</p>
                          <p className="mt-1 text-xs font-medium text-gray-500">{getQualificationLabel(s.qualificationId)}</p>
                        </div>
                        <button type="button" onClick={() => removeSlot(s)} className="rounded p-1 text-gray-300 transition-colors hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <p className="font-mono text-sm font-semibold text-gray-800">{s.startTime} - {s.endTime}</p>
                        <span className="rounded bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">{hrs.toFixed(1)}h</span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50 py-14 text-center">
                    <Activity size={34} className="text-gray-300" />
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">No slots added</p>
                  </div>
                )}
              </div>

              <div className="mt-5 border-t border-gray-100 pt-5">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-semibold text-gray-900">{totalWeeklyHours.toFixed(1)}</span>
                      <span className="text-xs font-semibold uppercase text-brand">hours/week</span>
                    </div>
                  </div>
                  <Info size={18} className="text-brand" />
                </div>

                <button
                  type="submit"
                  form="schedule-session-form"
                  disabled={!formData.trainerId || !formData.slots?.length || isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:bg-brand-hover active:scale-95 disabled:opacity-40 disabled:grayscale"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      {editingSchedule ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Save size={17} />
                      {editingSchedule ? 'Update Schedule' : 'Save Schedule'}
                    </>
                  )}
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusItemPortal: React.FC<{ label: string, value: string, icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center justify-between p-4 bg-white/5 rounded border border-white/10">
     <div className="p-2 bg-brand/10 rounded-lg text-brand">{icon}</div>
     <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">{label}</span>
     <span className="text-xs font-semibold text-white">{value}</span>
  </div>
);

export default SchedulesView;

