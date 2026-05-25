import React, { useState, useEffect, useMemo } from 'react';
import { Batch, Trainer, Qualification, TrainerSchedule, Organization } from '../types';
import EmptyState from '../components/EmptyState';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { 
  Search, Plus, Filter, GraduationCap, Award, Mail, Phone, 
  Trash2, X, Info, ShieldCheck, CheckCircle, ChevronRight,
  BookOpen, PlusCircle, Check, Edit2, Loader2, AlertCircle
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface TrainersViewProps {
  trainers: Trainer[];
  qualifications: Qualification[];
  batches: Batch[];
  schedules: TrainerSchedule[];
  organization?: Organization;
  onAddTrainer: (trainer: Trainer) => void | Promise<void>;
  onUpdateTrainer: (trainer: Trainer) => void | Promise<void>;
  onDeleteTrainer: (id: string) => void | Promise<boolean>;
}

const TrainersView: React.FC<TrainersViewProps> = ({ 
  trainers, 
  qualifications, 
  batches,
  schedules,
  organization,
  onAddTrainer, 
  onUpdateTrainer, 
  onDeleteTrainer 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState<'ALL' | string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<Trainer | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [viewingTrainer, setViewingTrainer] = useState<Trainer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const brandColor = organization?.primaryColor || '#059669';
  const specializations = useMemo(() => Array.from(new Set(trainers.map(t => t.specialization).filter(Boolean))).sort(), [trainers]);
  const hasActiveFilters = searchTerm.trim().length > 0 || specializationFilter !== 'ALL';

  useEffect(() => {
    if (brandColor) {
      document.documentElement.style.setProperty('--brand', brandColor);
    }
  }, [brandColor]);
  
  const [formData, setFormData] = useState<Partial<Trainer>>({
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    contactNumber: '',
    specialization: '',
    qualificationIds: []
  });

  const filteredTrainers = trainers.filter(t => {
    const matchesSearch =
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.specialization.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = specializationFilter === 'ALL' || t.specialization === specializationFilter;
    return matchesSearch && matchesFilter;
  });

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows: paginatedTrainers,
    setCurrentPage
  } = usePaginatedRows(filteredTrainers, [searchTerm, specializationFilter], 7);

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      middleName: '',
      email: '',
      contactNumber: '',
      specialization: '',
      qualificationIds: []
    });
    setEditingTrainer(null);
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

  const openEditModal = (trainer: Trainer) => {
    setEditingTrainer(trainer);
    setFormData({
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      middleName: trainer.middleName,
      email: trainer.email,
      contactNumber: trainer.contactNumber,
      specialization: trainer.specialization,
      qualificationIds: [...trainer.qualificationIds]
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email) return;
    
    setIsSubmitting(true);
    
    try {
      if (editingTrainer) {
        // Update existing trainer
        const updatedTrainer: Trainer = {
          ...editingTrainer,
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName || '',
          email: formData.email,
          contactNumber: formData.contactNumber || '',
          specialization: formData.specialization || 'General',
          qualificationIds: formData.qualificationIds || [],
          updatedAt: new Date().toISOString()
        };
        await onUpdateTrainer(updatedTrainer);
        if (viewingTrainer?.id === updatedTrainer.id) {
          setViewingTrainer(updatedTrainer);
        }
        showToast(`Trainer "${formData.firstName} ${formData.lastName}" updated successfully!`, 'success');
      } else {
        // Create new trainer with proper UUID
        const newTrainer: Trainer = {
          id: generateUUID(),
          orgId: '', // Will be set by App.tsx handler
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName || '',
          email: formData.email,
          contactNumber: formData.contactNumber || '',
          specialization: formData.specialization || 'General',
          qualificationIds: formData.qualificationIds || [],
          createdAt: new Date().toISOString()
        };
        await onAddTrainer(newTrainer);
        showToast(`Trainer "${formData.firstName} ${formData.lastName}" registered successfully!`, 'success');
      }
      
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving trainer:', error);
      showToast(`Failed to save trainer: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const trainerToDelete = trainers.find(t => t.id === id);
    const engagedBatch = batches.find(b => b.trainerId === id && (b.status === 'PLANNED' || b.status === 'ONGOING'));
    const engagedSchedule = schedules.find(s => s.trainerId === id);

    if (engagedBatch || engagedSchedule) {
      const reason = engagedBatch ? `batch ${engagedBatch.name} (${engagedBatch.status.toLowerCase()})` : 'a linked schedule';
      showToast(`Cannot delete trainer "${trainerToDelete?.firstName} ${trainerToDelete?.lastName}" because they are engaged in ${reason}.`, 'error');
      return;
    }

    if (!confirm('Are you sure you want to delete this trainer? This action cannot be undone.')) return;
    
    setDeletingId(id);
    try {
      const result = await onDeleteTrainer(id);
      if (result === false) {
        showToast('Cannot delete trainer: They are currently assigned to active batches.', 'error');
      } else {
        showToast(`Trainer "${trainerToDelete?.firstName} ${trainerToDelete?.lastName}" deleted successfully!`, 'success');
      }
    } catch (error) {
      showToast(`Failed to delete trainer: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleQualificationAssignment = async (trainer: Trainer, qualId: string) => {
    const isAssigned = trainer.qualificationIds.includes(qualId);
    const newQualIds = isAssigned 
      ? trainer.qualificationIds.filter(id => id !== qualId)
      : [...trainer.qualificationIds, qualId];
    
    const updatedTrainer = { ...trainer, qualificationIds: newQualIds, updatedAt: new Date().toISOString() };
    await onUpdateTrainer(updatedTrainer);
    if (viewingTrainer?.id === trainer.id) {
      setViewingTrainer(updatedTrainer);
    }
    if (showAssignModal?.id === trainer.id) {
      setShowAssignModal(updatedTrainer);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {viewingTrainer && !showModal && (() => {
        const trainerQualifications = viewingTrainer.qualificationIds
          .map(id => qualifications.find(q => q.id === id))
          .filter((q): q is Qualification => !!q);
        const trainerBatches = batches.filter(b => b.trainerId === viewingTrainer.id && !b.isDeleted);
        const trainerSchedules = schedules.filter(s => s.trainerId === viewingTrainer.id && !s.isDeleted);

        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
              className="rounded-md border bg-white p-5 shadow-sm"
              style={{ borderColor: `${brandColor}30`, background: `linear-gradient(90deg, ${brandColor}10, #ffffff 45%)` }}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <button
                    type="button"
                    onClick={() => setViewingTrainer(null)}
                    className="mb-4 inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-brand hover:text-brand"
                  >
                    <ChevronRight size={15} className="rotate-180" />
                    Back to Trainers
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded border border-brand-light bg-brand/10 text-brand text-sm font-semibold">
                      {viewingTrainer.lastName[0]}{viewingTrainer.firstName[0]}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
                        {viewingTrainer.lastName}, {viewingTrainer.firstName}
                      </h2>
                      <p className="text-sm text-gray-500">{viewingTrainer.specialization || 'General'} trainer profile.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(viewingTrainer)}
                    className="inline-flex items-center justify-center gap-2 rounded border border-brand-light bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/15"
                  >
                    <PlusCircle size={17} />
                    Assign Qualifications
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(viewingTrainer)}
                    className="inline-flex items-center justify-center gap-2 rounded bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-colors hover:bg-brand-hover"
                  >
                    <Edit2 size={17} />
                    Edit Trainer
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</p>
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Mail size={15} className="text-brand" />
                  {viewingTrainer.email}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Contact</p>
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Phone size={15} className="text-brand" />
                  {viewingTrainer.contactNumber || 'Not recorded'}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Specialization</p>
                <p className="mt-3 text-sm font-semibold text-gray-800">{viewingTrainer.specialization || 'General'}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Award size={17} className="text-brand" />
                  <h3 className="text-sm font-semibold text-gray-900">Qualifications</h3>
                </div>
                {trainerQualifications.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {trainerQualifications.map(qual => (
                      <span key={qual.id} className="rounded border border-brand-light bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                        {qual.code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No qualifications assigned.</p>
                )}
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <BookOpen size={17} className="text-brand" />
                  <h3 className="text-sm font-semibold text-gray-900">Current Workload</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Batches</p>
                    <p className="mt-2 text-xl font-semibold text-gray-900">{trainerBatches.length}</p>
                  </div>
                  <div className="rounded border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Schedules</p>
                    <p className="mt-2 text-xl font-semibold text-gray-900">{trainerSchedules.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {trainerBatches.length > 0 && (
              <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <GraduationCap size={17} className="text-brand" />
                  <h3 className="text-sm font-semibold text-gray-900">Assigned Batches</h3>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {trainerBatches.slice(0, 6).map(batch => (
                    <div key={batch.id} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-sm font-semibold text-gray-800">{batch.name}</p>
                      <p className="text-xs text-gray-400">{batch.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {!viewingTrainer && (
        <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Professional Trainers</h2>
          <p className="text-sm text-gray-500 font-normal italic">TVET Instructor Registry & Certification Tracking</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md shadow-brand/20 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> Register Trainer
        </button>
      </div>

      <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr_1fr] items-end">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name or specialization..." 
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm focus:border-brand outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={18} />
            <select
              value={specializationFilter}
              onChange={e => setSpecializationFilter(e.target.value as any)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-gray-700 focus:border-brand outline-none transition-all"
            >
              <option value="ALL">All specializations</option>
              {specializations.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                setSearchTerm('');
                setSpecializationFilter('ALL');
              }}
              className={`text-sm font-semibold transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            >
              Clear filters
            </button>
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-900">{filteredTrainers.length}</span> of <span className="font-semibold text-gray-900">{trainers.length}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-brand border-b">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">Trainer Info</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">Specialization</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">Qualifications</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTrainers.length > 0 ? paginatedTrainers.map(trainer => (
              <tr
                key={trainer.id}
                onClick={() => setViewingTrainer(trainer)}
                className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setViewingTrainer(trainer);
                  }
                }}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded border border-brand-light bg-brand/10 flex items-center justify-center text-brand font-semibold text-xs">
                      {trainer.lastName[0]}{trainer.firstName[0]}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800 leading-tight">
                        {trainer.lastName.toUpperCase()}, {trainer.firstName}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-medium text-gray-400">
                        <div className="flex items-center gap-1"><Mail size={10} /> {trainer.email}</div>
                        <div className="flex items-center gap-1"><Phone size={10} /> {trainer.contactNumber}</div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                   <div className="text-xs font-semibold text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100 w-fit">
                     {trainer.specialization}
                   </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {trainer.qualificationIds.length > 0 ? trainer.qualificationIds.map(id => {
                      const qual = qualifications.find(q => q.id === id);
                      return qual ? (
                        <div key={id} className="px-2 py-0.5 bg-brand/10 text-brand border border-brand-light rounded text-xs font-semibold">
                          {qual.code}
                        </div>
                      ) : null;
                    }) : (
                      <span className="text-xs text-gray-400 italic font-medium">No qualifications assigned</span>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={3} className="px-6 py-20">
                  <EmptyState 
                    title="No trainers registered"
                    description="Add your first trainer to get started with staff management."
                    actionLabel="Register Trainer"
                    onAction={() => setShowModal(true)}
                    icon={<GraduationCap size={48} className="text-gray-300" />}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTrainers.length}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={setCurrentPage}
          itemLabel="trainers"
        />
      </div>
        </>
      )}

      {/* Registration/Edit Modal */}
      {showModal && (
        <ModalPortal>
                <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
                  <div className="bg-white rounded-md shadow-md w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
                    <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand text-white rounded shadow-md shadow-brand/20">
                          {editingTrainer ? <Edit2 size={20} /> : <GraduationCap size={20} />}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">
                          {editingTrainer ? 'Edit Trainer' : 'Register New Trainer'}
                        </h3>
                      </div>
                      <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">First Name</label>
                          <input required placeholder="Elena" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-medium"
                            value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Middle Name</label>
                          <input placeholder="Santos" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-medium"
                            value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Name</label>
                          <input required placeholder="Reyes" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-medium"
                            value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email Address</label>
                        <input required type="email" placeholder="trainer@institution.edu" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-medium"
                          value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Number</label>
                          <input placeholder="+63 9xx xxx xxxx" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-medium"
                            value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Specialization</label>
                          <input placeholder="e.g. IT, Automotive" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-medium"
                            value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})} />
                        </div>
                      </div>

                      <div className="bg-brand/10 p-4 rounded border border-brand-light flex gap-3">
                        <ShieldCheck className="text-brand shrink-0" size={20} />
                        <p className="text-xs text-brand leading-relaxed font-medium">
                          Trainer records are linked to the NTTC (National TVET Trainer Certificate) database for compliance verification during audit.
                        </p>
                      </div>

                      <div className="pt-6 flex gap-3">
                        <button 
                          type="button" 
                          onClick={() => { setShowModal(false); resetForm(); }} 
                          disabled={isSubmitting}
                          className="flex-1 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                        >
                          Discard
                        </button>
                        <button 
                          type="submit" 
                          disabled={isSubmitting}
                          className="flex-1 py-3 bg-brand text-white rounded text-sm font-semibold shadow-md shadow-brand/20 active:scale-95 transition-all hover:bg-brand-hover disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              {editingTrainer ? 'Updating...' : 'Creating...'}
                            </>
                          ) : (
                            editingTrainer ? 'Update Trainer' : 'Submit Registration'
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
        </ModalPortal>
      )}

      {/* Qualification Assignment Modal */}
      {showAssignModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Assign Qualifications</h3>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-1">Trainer: {showAssignModal.lastName}, {showAssignModal.firstName}</p>
              </div>
              <button onClick={() => setShowAssignModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 max-h-[400px] overflow-y-auto space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Available Qualifications (UTPRAS Registry)</label>
              {qualifications.length > 0 ? qualifications.map(qual => {
                const isAssigned = showAssignModal.qualificationIds.includes(qual.id);
                return (
                  <button 
                    key={qual.id}
                    onClick={() => toggleQualificationAssignment(showAssignModal, qual.id)}
                    className={`w-full flex items-center justify-between p-4 rounded border transition-all text-left group ${
                      isAssigned ? 'bg-brand border-brand text-white shadow-md shadow-brand/20' : 'bg-white border-gray-100 hover:border-brand-light'
                    }`}
                  >
                    <div className="flex-1">
                      <div className={`text-xs font-semibold uppercase tracking-tight ${isAssigned ? 'text-white/80' : 'text-brand'}`}>{qual.code}</div>
                      <div className={`text-sm font-medium mt-0.5 ${isAssigned ? 'text-white' : 'text-gray-900'}`}>{qual.name}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isAssigned ? 'bg-white border-white text-brand' : 'bg-gray-50 border-gray-100 text-transparent group-hover:border-brand-light'
                    }`}>
                      <Check size={14} strokeWidth={4} />
                    </div>
                  </button>
                );
              }) : (
                <div className="p-8 text-center text-gray-400 italic text-sm">No qualifications registered in the system.</div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t flex justify-end">
              <button 
                onClick={() => setShowAssignModal(null)}
                className="px-8 py-2.5 bg-brand text-white rounded text-sm font-semibold shadow-md shadow-brand/20 active:scale-95 transition-all hover:bg-brand-hover"
              >
                Close & Save Changes
              </button>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Toast Notifications moved to bottom to prevent margin-top issues on header */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : toast.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-brand/10 border border-brand-light text-brand'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={18} className="flex-shrink-0 text-emerald-600" />}
            {toast.type === 'error' && <AlertCircle size={18} className="flex-shrink-0 text-red-600" />}
            {toast.type === 'info' && <AlertCircle size={18} className="flex-shrink-0 text-brand" />}
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrainersView;

