import React, { useState, useEffect, useMemo } from 'react';
import { Batch, Qualification, Trainer, Student, BatchStatus, Sponsor, TrainerSchedule, DaySlot, Location, Organization } from '../types';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import {
  Search, Plus, Layers, Award, GraduationCap, Users, Calendar,
  Trash2, X, CheckCircle, Clock, MoreVertical, Edit2, AlertCircle,
  ChevronRight, Filter, LayoutGrid, List, Handshake, CalendarRange,
  ShieldCheck, Timer, MapPin, Calculator, CalendarDays, Loader2, Play, Download
} from 'lucide-react';

interface BatchesViewProps {
  batches: Batch[];
  qualifications: Qualification[];
  trainers: Trainer[];
  students: Student[];
  sponsors: Sponsor[];
  schedules: TrainerSchedule[];
  locations: Location[];
  organization?: Organization;
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
  batches, qualifications, trainers, students, sponsors, schedules, locations, organization,
  onAddBatch, onUpdateBatch, onDeleteBatch, onNotify
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'ALL'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const brandColor = organization?.primaryColor || '#059669';
  const statuses = useMemo(() => ['ALL', ...Array.from(new Set(batches.map(b => b.status)))] as (BatchStatus | 'ALL')[], [batches]);
  const hasActiveFilters = searchTerm.trim().length > 0 || statusFilter !== 'ALL';

  useEffect(() => {
    if (brandColor) {
      document.documentElement.style.setProperty('--brand', brandColor);
    }
  }, [brandColor]);
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

  const eligibleTrainers = useMemo(() => {
    if (!formData.qualificationId) return trainers;
    return trainers.filter(t => Array.isArray(t.qualificationIds) && t.qualificationIds.includes(formData.qualificationId!));
  }, [formData.qualificationId, trainers]);

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

  const filteredBatches = batches.filter(b => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.batchCode && b.batchCode.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
    const batch = batches.find(b => b.id === id);
    if (!batch) return;
    if (batch.status === BatchStatus.ONGOING) {
      onNotify?.('error', 'Cannot delete an ongoing batch for security reasons.');
      return;
    }
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

  // Commence Training - PLANNED ? ONGOING (requires =5 students)
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
      [BatchStatus.PLANNED]: 'bg-brand/10 text-brand border-brand-light',
      [BatchStatus.ONGOING]: 'bg-amber-50 text-amber-700 border-amber-100',
      [BatchStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      [BatchStatus.CANCELLED]: 'bg-gray-100 text-gray-600 border-gray-200'
    };
    const labels = {
      [BatchStatus.PLANNED]: 'Planned',
      [BatchStatus.ONGOING]: 'On Going',
      [BatchStatus.COMPLETED]: 'Completed',
      [BatchStatus.CANCELLED]: 'Cancelled'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold uppercase tracking-tight ${styles[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
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

  const getStudentConflict = (studentId: string) => {
    // If this student is already enrolled in any planned or ongoing batch (except current editing batch), conflict.
    return batches.find(b => {
      if (editingBatch && b.id === editingBatch.id) return false;
      if (b.status !== BatchStatus.PLANNED && b.status !== BatchStatus.ONGOING) return false;
      if (!b.studentIds || !b.studentIds.includes(studentId)) return false;
      return true;
    });
  };

  const downloadCsv = () => {
    const headersSummary = ['Batch ID', 'Batch Code', 'Name', 'Year', 'Qualification', 'Trainer', 'Sponsor', 'Location', 'Status', 'Start Date', 'End Date', 'Students', 'Max Students'];
    const headersQualification = ['Qualification', 'Batch Code', 'Student Name', 'Student Email'];

    const summaryRows = batches.map(batch => {
      const qual = qualifications.find(q => q.id === batch.qualificationId)?.name || 'Unknown';
      const trainer = trainers.find(t => t.id === batch.trainerId);
      const sponsor = sponsors.find(s => s.id === batch.sponsorId)?.name || 'Private';
      const location = locations.find(l => l.id === batch.locationId)?.name || 'Remote';
      return [
        batch.id,
        batch.batchCode || '',
        batch.name,
        batch.year.toString(),
        qual,
        trainer ? `${trainer.firstName} ${trainer.lastName}` : 'Unassigned',
        sponsor,
        batch.status,
        batch.startDate,
        batch.endDate,
        (batch.studentIds?.length || 0).toString(),
        (batch.maxStudents || 0).toString()
      ];
    });

    const qualificationRows: string[][] = [];
    batches.forEach(batch => {
      const qualName = qualifications.find(q => q.id === batch.qualificationId)?.name || 'Unknown';
      const batchCode = batch.batchCode || '';
      (batch.studentIds || []).forEach(studentId => {
        const student = students.find(s => s.id === studentId);
        if (!student) return;
        qualificationRows.push([
          qualName,
          batchCode,
          `${student.firstName} ${student.lastName}`,
          student.email || ''
        ]);
      });
    });

    const escapeCSV = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const sectionToCsv = (heading: string, headers: string[], rows: string[][]) => {
      const lines = [heading, headers.map(escapeCSV).join(',')];
      rows.forEach(r => lines.push(r.map(escapeCSV).join(',')));
      return lines.join('\n');
    };

    const csvContent = [
      sectionToCsv('Batch Summary', headersSummary, summaryRows),
      '\n\n',
      sectionToCsv('Qualification Student Roster', headersQualification, qualificationRows)
    ].join('');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `training-batches-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify?.('success', 'Batch CSV exported successfully.');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
            Training Batches
          </h2>
          <p className="text-sm text-gray-500 font-normal italic">Institutional program monitoring with hour-based compliance tracking.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadCsv}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded hover:bg-gray-50 transition-all font-semibold text-sm"
          >
            <Download size={18} className="text-brand" /> Export CSV
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md shadow-brand/20 font-bold text-sm active:scale-95"
          >
            <Plus size={18} /> Initialize Batch
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr_1fr] items-end">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by batch name or ID..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm focus:border-brand outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={18} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BatchStatus | 'ALL')}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-gray-700 focus:border-brand outline-none transition-all"
            >
              <option value="ALL">All statuses</option>
              {statuses.filter(s => s !== 'ALL').map(status => (
                <option key={status} value={status}>{status.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
              className={`text-sm font-semibold transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            >
              Clear filters
            </button>
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-900">{filteredBatches.length}</span> of <span className="font-semibold text-gray-900">{batches.length}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-brand border-b">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">Batch</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">Qualification</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">Trainer</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">Location</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wide">Students</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">End Date</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wide">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-white uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBatches.map(batch => {
                const qual = qualifications.find(q => q.id === batch.qualificationId);
                const trainer = trainers.find(t => t.id === batch.trainerId);
                const sponsor = sponsors.find(s => s.id === batch.sponsorId);
                const location = locations.find(l => l.id === batch.locationId);

                return (
                  <tr key={batch.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand-light uppercase tracking-wide">FY {batch.year}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-brand transition-colors">{batch.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Award className="text-amber-500 shrink-0" size={16} />
                        <span className="text-sm text-gray-700">{qual?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="text-brand shrink-0" size={16} />
                        <span className="text-sm text-gray-700">{trainer ? `${trainer.lastName}, ${trainer.firstName}` : 'Not Assigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide ${sponsor ? 'bg-brand/10 border border-brand-light text-brand' : 'bg-amber-50 border border-amber-100 text-amber-600'}`}>
                        {sponsor ? <Handshake size={12} /> : <Users size={12} />}
                        {sponsor ? 'Sponsored' : 'Private'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <MapPin className="text-brand shrink-0" size={16} />
                        <span className="text-sm text-gray-700">{location?.code || 'TBD'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${batch.currentStudents >= 5 ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-rose-50 border border-rose-100 text-rose-600'}`}>
                        <Users size={12} />
                        {batch.currentStudents}/{batch.maxStudents}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <CalendarRange className="text-brand shrink-0" size={16} />
                        <span className="text-sm text-gray-700">{batch.endDate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {getStatusBadge(batch.status)}
                      {batch.status === 'PLANNED' && batch.currentStudents >= 5 && (
                        <button
                          onClick={() => handleCommenceTraining(batch)}
                          disabled={isCommencing === batch.id}
                          className="ml-2 inline-flex items-center gap-1 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded transition-all disabled:opacity-50"
                          title="Start Training"
                        >
                          {isCommencing === batch.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Play size={12} />
                          )}
                          Commence
                        </button>
                      )}
                      {batch.status === 'ONGOING' && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 bg-brand/10 text-brand text-xs font-semibold rounded border border-brand-light">
                          <Play size={12} /> In Progress
                        </span>
                      )}
                      {batch.status === 'COMPLETED' && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded">
                          ? Completed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingBatch(batch); setFormData(batch); setShowModal(true); }}
                          className="p-2 hover:bg-brand-light rounded text-gray-400 hover:text-brand transition-colors"
                          title="Edit Batch"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(batch.id)}
                          disabled={batch.status === BatchStatus.ONGOING || isDeleting === batch.id}
                          className={`p-2 rounded transition-colors ${batch.status === BatchStatus.ONGOING ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'hover:bg-rose-50 text-gray-400 hover:text-rose-600'} disabled:opacity-50`}
                          title={batch.status === BatchStatus.ONGOING ? 'Cannot delete ongoing batch' : 'Delete Batch'}
                        >
                          {isDeleting === batch.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                        <button
                          onClick={() => setViewingBatch(batch)}
                          className="p-2 hover:bg-brand-light rounded text-gray-400 hover:text-brand transition-colors"
                          title="View Details"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-5xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8 flex flex-col md:flex-row h-full max-h-[85vh]">
            <div className="flex-1 overflow-y-auto border-r p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand text-white rounded shadow-sm shadow-brand/20">
                    <Layers size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">
                    {editingBatch ? 'Modify Batch Record' : 'Initialize Batch'}
                  </h3>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Batch Code</label>
                    <input
                      placeholder="e.g. BATCH-001"
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-bold text-gray-800"
                      value={formData.batchCode} onChange={e => setFormData({ ...formData, batchCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Batch Name</label>
                    <input
                      required
                      placeholder="e.g. CSS-2024-B1"
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-bold text-gray-800"
                      value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Fiscal Year</label>
                    <input
                      required type="number"
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-bold text-gray-800"
                      value={formData.year} onChange={e => setFormData({ ...formData, year: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 flex items-center gap-1.5">
                      <Award size={12} className="text-amber-500" /> Program Qualification
                    </label>
                    <select
                      required
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded text-sm font-bold text-gray-800 appearance-none"
                      value={formData.qualificationId} onChange={e => {
                        const qualId = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          qualificationId: qualId,
                          trainerId: (!qualId || !prev.trainerId) ? prev.trainerId : (trainers.find(t => t.id === prev.trainerId && t.qualificationIds?.includes(qualId)) ? prev.trainerId : '')
                        }));
                      }}
                    >
                      <option value="">Choose program...</option>
                      {qualifications.map(q => <option key={q.id} value={q.id}>{q.name} ({q.durationDays} Days)</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 flex items-center gap-1.5">
                      <GraduationCap size={12} className="text-brand" /> Lead Instructor
                    </label>
                    <select
                      required
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded text-sm font-bold text-gray-800 appearance-none"
                      value={formData.trainerId} onChange={e => setFormData({ ...formData, trainerId: e.target.value })}
                    >
                      <option value="">Assign trainer...</option>
                      {eligibleTrainers.length === 0 && formData.qualificationId ? (
                        <option value="" disabled>No trainer assigned to this program</option>
                      ) : null}
                      {eligibleTrainers.map(t => {
                        const sch = schedules.find(s => s.trainerId === t.id);
                        const weeklyHrs = sch?.slots.reduce((acc, s) => acc + getSlotHours(s.startTime, s.endTime), 0) || 0;
                        return <option key={t.id} value={t.id}>{t.lastName}, {t.firstName} {weeklyHrs > 0 ? `(${weeklyHrs.toFixed(1)} hrs/wk)` : '(No Schedule)'}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Training Location</label>
                    <select
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded text-sm font-bold text-gray-800 appearance-none"
                      value={formData.locationId} onChange={e => setFormData({ ...formData, locationId: e.target.value })}
                    >
                      <option value="">Remote / External</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Funding Sponsor</label>
                    <select
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded text-sm font-bold text-gray-800 appearance-none"
                      value={formData.sponsorId} onChange={e => setFormData({ ...formData, sponsorId: e.target.value })}
                    >
                      <option value="">Private / Individual</option>
                      {sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Commencement Date</label>
                    <input
                      required type="date"
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-bold"
                      value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-brand uppercase tracking-wide px-1 flex items-center gap-1.5">
                      <ShieldCheck size={12} /> Projected Completion
                    </label>
                    <div className="relative">
                      <input
                        readOnly
                        placeholder="Pending schedule input..."
                        className="w-full px-5 py-3.5 bg-brand/10 border border-brand-light rounded text-brand font-semibold outline-none text-sm"
                        value={formData.endDate}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <CheckCircle size={16} className="text-emerald-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {projection && (
                  <div className="p-6 bg-gray-800 rounded space-y-4 shadow-md border border-gray-700 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center gap-2 mb-2 text-brand">
                      <Calculator size={18} />
                      <h4 className="text-xs font-semibold uppercase tracking-wide">Compliance Forecast Breakdown</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Required Units</p>
                        <p className="text-xl font-mono font-semibold text-white">{projection.trainingDays.toFixed(1)} <span className="text-xs text-brand">Full Days</span></p>
                        <p className="text-xs text-gray-500 italic mt-1">(Totaling {projection.totalHours} Instructional Hours)</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wait Duration</p>
                        <p className="text-xl font-mono font-semibold text-white">{projection.calendarDays} <span className="text-xs text-brand">Calendar Days</span></p>
                        <p className="text-xs text-gray-500 italic mt-1">Reflecting Half-Day and Off-Day shifts.</p>
                      </div>
                    </div>
                  </div>
                )}

                {!schedules.find(s => s.trainerId === formData.trainerId) && formData.trainerId && (
                  <div className="bg-rose-50 p-6 rounded border border-rose-100 flex gap-4">
                    <AlertCircle className="text-rose-600 shrink-0" size={24} />
                    <p className="text-xs text-rose-800 leading-relaxed font-bold">
                      Critical Notice: The selected instructor has no declared work shifts. The system cannot forecast an end-date or calculate half-day increments until a weekly schedule is defined.
                    </p>
                  </div>
                )}

                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setShowModal(false)} disabled={isSaving} className="flex-1 py-4 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded transition-all disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-brand text-white rounded text-sm font-semibold shadow-md shadow-brand/20 active:scale-95 transition-all hover:bg-brand-hover disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                    {editingBatch ? 'Sync Record' : 'Begin Training Program'}
                  </button>
                </div>
              </form>
            </div>

            <div className="w-full md:w-80 bg-gray-50 overflow-y-auto flex flex-col">
              <div className="p-8 border-b bg-white shrink-0">
                <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                  <Users size={20} className="text-brand" />
                  Enrollment Registry
                </h4>
              </div>
              <div className="p-6 space-y-3 flex-1 overflow-y-auto">
                {students
                  .filter(student => {
                    const isSelected = formData.studentIds?.includes(student.id);
                    if (isSelected) return true; // Always show if already selected
                    return !getStudentConflict(student.id); // Otherwise only show if no conflict
                  })
                  .map(student => {
                    const isSelected = formData.studentIds?.includes(student.id);

                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => toggleStudent(student.id)}
                        className={`w-full flex items-center gap-3 p-4 rounded transition-all border group ${isSelected ? 'bg-brand border-brand text-white shadow-sm shadow-brand/20' :
                            'bg-white border-gray-100 hover:border-brand-light'
                          }`}
                      >
                        <div className={`w-10 h-10 rounded flex items-center justify-center text-xs font-semibold shrink-0 ${isSelected ? 'bg-white/20 text-white' :
                            'bg-gray-100 text-gray-400 group-hover:bg-brand-light group-hover:text-brand'
                          }`}>
                          {student.lastName[0]}
                        </div>
                        <div className="flex-1 text-left overflow-hidden">
                          <div className={`text-xs font-semibold truncate uppercase ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                            {student.lastName}, {student.firstName}
                          </div>
                          <div className={`text-xs font-mono mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                            ULI: {student.uli.slice(-6)}
                          </div>
                        </div>
                        {isSelected && <CheckCircle size={18} className="shrink-0 text-white" />}
                      </button>
                    );
                  })}
                {students.length === 0 && (
                  <div className="py-20 text-center px-4">
                    <Users size={32} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">No learners found in the registry.</p>
                  </div>
                )}
              </div>
              <div className="p-8 bg-white border-t mt-auto">
                <div className="flex justify-between items-center text-xs font-semibold text-gray-800 uppercase tracking-wide">
                  <span>Enrolled Learners</span>
                  <span className="text-brand">{formData.studentIds?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Batch Detail View Modal */}
      {viewingBatch && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-5xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div
              className="px-5 py-8 text-white relative overflow-hidden"
              style={{ backgroundImage: 'linear-gradient(90deg, var(--acm-primary), var(--acm-primary-hover))' }}
            >
              <div className="absolute top-0 right-0 opacity-10">
                <Layers size={200} strokeWidth={1} />
              </div>
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-lg border border-white/30 uppercase tracking-wide">FY {viewingBatch.year}</span>
                    <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-lg border border-white/30 uppercase tracking-wide">{viewingBatch.batchCode}</span>
                  </div>
                  <h2 className="text-xl font-semibold uppercase tracking-tight mb-2">{viewingBatch.name}</h2>
                  <p className="text-white/80 text-sm font-bold">Comprehensive Batch Intelligence Report</p>
                </div>
                <button
                  onClick={() => setViewingBatch(null)}
                  className="p-3 hover:bg-white/20 rounded-full transition-colors text-white"
                >
                  <X size={28} />
                </button>
              </div>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-6 rounded-md border" style={{ backgroundImage: 'linear-gradient(135deg, rgba(var(--acm-primary-rgb), 0.08), rgba(var(--acm-primary-rgb), 0.16))', borderColor: 'rgba(var(--acm-primary-rgb), 0.18)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-brand text-white rounded shadow-lg shadow-brand/20">
                      {getStatusBadge(viewingBatch.status)}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-1">Current Status</p>
                  <p className="text-lg font-semibold text-gray-800 capitalize">{viewingBatch.status.toLowerCase()}</p>
                </div>

                <div
                  className="p-6 rounded-md border border-emerald-100"
                  style={{ backgroundImage: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(var(--acm-primary-rgb), 0.08))' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-emerald-600 text-white rounded shadow-lg">
                      <Users size={24} />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">Enrollment</p>
                  <p className="text-lg font-semibold text-gray-800">{viewingBatch.currentStudents} / {viewingBatch.maxStudents}</p>
                  <div className="mt-3 w-full bg-emerald-100 rounded-full h-2">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((viewingBatch.currentStudents / viewingBatch.maxStudents) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div
                  className="p-6 rounded-md border border-amber-100"
                  style={{ backgroundImage: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(var(--acm-primary-rgb), 0.08))' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-amber-600 text-white rounded shadow-lg">
                      <CalendarDays size={24} />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">Timeline</p>
                  <p className="text-sm font-bold text-gray-600">{viewingBatch.startDate}</p>
                  <p className="text-xs text-gray-400 font-semibold uppercase">to</p>
                  <p className="text-sm font-bold text-gray-800">{viewingBatch.endDate}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <Award size={16} className="text-brand" />
                    Qualification Details
                  </h3>
                  <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
                    <p className="text-lg font-semibold text-gray-800 mb-2">
                      {qualifications.find(q => q.id === viewingBatch.qualificationId)?.name || 'Unknown'}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Code</p>
                        <p className="text-sm font-bold text-gray-700">
                          {qualifications.find(q => q.id === viewingBatch.qualificationId)?.code || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Duration</p>
                        <p className="text-sm font-bold text-gray-700">
                          {qualifications.find(q => q.id === viewingBatch.qualificationId)?.durationDays || 0} Days
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <GraduationCap size={16} className="text-brand" />
                    Lead Instructor
                  </h3>
                  <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
                    {(() => {
                      const trainer = trainers.find(t => t.id === viewingBatch.trainerId);
                      return trainer ? (
                        <>
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 rounded bg-brand text-white flex items-center justify-center font-semibold text-lg shadow-sm shadow-brand/20">
                              {trainer.lastName[0]}{trainer.firstName[0]}
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-gray-800">{trainer.lastName}, {trainer.firstName}</p>
                              <p className="text-xs text-gray-500 font-bold">{trainer.email}</p>
                            </div>
                          </div>
                          {trainer.phone && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</p>
                              <p className="text-sm font-bold text-gray-700">{trainer.phone}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-gray-400 italic">No trainer assigned</p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <MapPin size={16} className="text-brand" />
                    Location & Sponsor
                  </h3>
                  <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Training Location</p>
                      <p className="text-sm font-bold text-gray-700">
                        {locations.find(l => l.id === viewingBatch.locationId)?.name || 'Not Specified'}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Sponsor</p>
                      <p className="text-sm font-bold text-gray-700">
                        {sponsors.find(s => s.id === viewingBatch.sponsorId)?.name || 'Private / Self-Funded'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <Calculator size={16} className="text-brand" />
                    Projected Metrics
                  </h3>
                  <div className="bg-gradient-to-br from-gray-800 to-gray-700 p-6 rounded-md border border-gray-600 shadow-sm text-white">
                    {(() => {
                      const schedule = schedules.find(s => s.trainerId === viewingBatch.trainerId);
                      const qual = qualifications.find(q => q.id === viewingBatch.qualificationId);
                      if (schedule && qual && viewingBatch.startDate) {
                        const projected = calculateProjectedEndDate(viewingBatch.startDate, qual.durationDays, schedule.slots);
                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Hours</p>
                                <p className="text-lg font-mono font-semibold">{projected.totalHours}h</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Calendar Days</p>
                                <p className="text-lg font-mono font-semibold">{projected.calendarDays}</p>
                              </div>
                            </div>
                            <div className="pt-4 border-t border-white/10">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Training Days</p>
                              <p className="text-lg font-mono font-semibold text-brand">{projected.trainingDays}</p>
                            </div>
                          </div>
                        );
                      }
                      return <p className="text-gray-400 italic text-sm">Metrics unavailable</p>;
                    })()}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                  <Users size={16} className="text-brand" />
                  Enrolled Students ({viewingBatch.studentIds?.length || 0})
                </h3>
                <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
                  {viewingBatch.studentIds && viewingBatch.studentIds.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {viewingBatch.studentIds.map(studentId => {
                        const student = students.find(s => s.id === studentId);
                        return student ? (
                          <div key={student.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded border border-gray-100">
                            <div className="w-10 h-10 rounded bg-brand text-white flex items-center justify-center text-xs font-semibold shrink-0">
                              {student.lastName[0]}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-xs font-semibold text-gray-800 truncate uppercase">
                                {student.lastName}, {student.firstName}
                              </p>
                              <p className="text-xs font-mono text-gray-400 mt-0.5">
                                {student.uli.slice(-6)}
                              </p>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <Users size={48} className="mx-auto text-gray-200 mb-4" />
                      <p className="text-sm text-gray-400 font-bold">No students enrolled yet</p>
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
                  className="flex-1 py-4 bg-brand text-white rounded text-sm font-semibold uppercase tracking-wide hover:bg-brand-hover transition-all flex items-center justify-center gap-2 shadow-sm shadow-brand/20"
                >
                  <Edit2 size={18} /> Edit Batch
                </button>
                <button
                  onClick={() => setViewingBatch(null)}
                  className="px-8 py-4 bg-gray-100 text-gray-700 rounded text-sm font-semibold uppercase tracking-wide hover:bg-gray-200 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default BatchesView;

