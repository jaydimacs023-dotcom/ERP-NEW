import React, { useState, useMemo } from 'react';
import { Enrollment, BillingStatus, EnrollmentStatus, Student, Batch, Sponsor, Qualification } from '../types';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import { 
  Search, Plus, UserCheck, Trash2, X, GraduationCap,
  Edit2, Loader2, CheckCircle, AlertCircle,
  DollarSign, FileText, Layers, Building,
  ChevronDown, RotateCcw
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface EnrollmentsViewProps {
  enrollments: Enrollment[];
  students: Student[];
  batches: Batch[];
  sponsors: Sponsor[];
  qualifications: Qualification[];
  currency?: string;
  onAddEnrollment: (enrollment: Enrollment) => void | Promise<void>;
  onUpdateEnrollment: (enrollment: Enrollment) => void | Promise<void>;
  onDeleteEnrollment: (id: string) => void | Promise<boolean>;
}

const BILLING_STATUS_OPTIONS: { value: BillingStatus; label: string; color: string }[] = [
  { value: 'UNBILLED', label: 'Unbilled', color: 'bg-amber-100 text-amber-700' },
  { value: 'BILLED', label: 'Billed', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'PARTIALLY_BILLED', label: 'Partially Billed', color: 'bg-blue-100 text-blue-700' },
];

const ENROLLMENT_STATUS_OPTIONS: { value: EnrollmentStatus; label: string; color: string }[] = [
  { value: 'ACTIVE', label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'ON_HOLD', label: 'On Hold', color: 'bg-amber-100 text-amber-700' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  { value: 'DROPPED', label: 'Dropped', color: 'bg-rose-100 text-rose-700' },
];

const formatEnrollmentDate = (value?: string) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
};

const EnrollmentsView: React.FC<EnrollmentsViewProps> = ({ 
  enrollments, students, batches, sponsors, qualifications, currency = 'PHP',
  onAddEnrollment, onUpdateEnrollment, onDeleteEnrollment 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBatch, setFilterBatch] = useState<string>('');
  const [filterBillingStatus, setFilterBillingStatus] = useState<BillingStatus | ''>('');
  const [filterEnrollmentStatus, setFilterEnrollmentStatus] = useState<EnrollmentStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [formData, setFormData] = useState<Partial<Enrollment>>({
    enrollmentCode: '',
    studentId: '',
    batchId: '',
    sponsorId: '',
    billingStatus: 'UNBILLED',
    enrollmentStatus: 'ACTIVE',
    enrollmentDate: new Date().toISOString().split('T')[0],
    totalFees: 0,
    billedAmount: 0,
    notes: ''
  });

  // Get students that are not already enrolled in the selected batch
  const availableStudents = useMemo(() => {
    if (!formData.batchId) return students.filter(s => !s.isDeleted);
    
    const enrolledStudentIds = enrollments
      .filter(e => e.batchId === formData.batchId && !e.isDeleted && e.id !== editingEnrollment?.id)
      .map(e => e.studentId);
    
    return students.filter(s => !s.isDeleted && !enrolledStudentIds.includes(s.id));
  }, [students, enrollments, formData.batchId, editingEnrollment]);

  const filteredEnrollments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return enrollments
      .filter(e => {
        if (e.isDeleted) return false;

        const student = students.find(s => s.id === e.studentId);
        const batch = batches.find(b => b.id === e.batchId);
        const sponsor = sponsors.find(sp => sp.id === e.sponsorId);
        const qualification = batch ? qualifications.find(q => q.id === batch.qualificationId) : null;

        const searchableText = [
          e.enrollmentCode || '',
          `${student?.firstName || ''} ${student?.lastName || ''}`,
          student?.uli || '',
          batch?.batchCode || '',
          batch?.name || '',
          qualification?.code || '',
          qualification?.name || '',
          sponsor?.name || '',
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesBatch = !filterBatch || e.batchId === filterBatch;
        const matchesBillingStatus = !filterBillingStatus || e.billingStatus === filterBillingStatus;
        const matchesEnrollmentStatus = !filterEnrollmentStatus || e.enrollmentStatus === filterEnrollmentStatus;

        return matchesSearch && matchesBatch && matchesBillingStatus && matchesEnrollmentStatus;
      })
      .sort((a, b) => (b.enrollmentDate || '').localeCompare(a.enrollmentDate || ''));
  }, [enrollments, students, batches, sponsors, qualifications, searchTerm, filterBatch, filterBillingStatus, filterEnrollmentStatus]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    !!filterBatch ||
    !!filterBillingStatus ||
    !!filterEnrollmentStatus;

  const resetForm = () => {
    setFormData({ 
      enrollmentCode: '',
      studentId: '',
      batchId: '',
      sponsorId: '',
      billingStatus: 'UNBILLED',
      enrollmentStatus: 'ACTIVE',
      enrollmentDate: new Date().toISOString().split('T')[0],
      totalFees: 0,
      billedAmount: 0,
      notes: ''
    });
    setEditingEnrollment(null);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}`;
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const generateEnrollmentCode = (batchId: string, studentId: string) => {
    const batch = batches.find(b => b.id === batchId);
    const student = students.find(s => s.id === studentId);
    const prefix = batch?.batchCode || 'ENR';
    const suffix = student?.uli?.slice(-4) || Date.now().toString().slice(-4);
    return `${prefix}-${suffix}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.batchId) return;

    setIsSubmitting(true);
    
    try {
      if (editingEnrollment) {
        const updatedEnrollment: Enrollment = {
          ...editingEnrollment,
          enrollmentCode: formData.enrollmentCode || editingEnrollment.enrollmentCode,
          studentId: formData.studentId!,
          batchId: formData.batchId!,
          sponsorId: formData.sponsorId || undefined,
          billingStatus: formData.billingStatus || 'UNBILLED',
          enrollmentStatus: formData.enrollmentStatus || 'ACTIVE',
          enrollmentDate: formData.enrollmentDate || editingEnrollment.enrollmentDate,
          completionDate: formData.enrollmentStatus === 'COMPLETED' || formData.enrollmentStatus === 'DROPPED' 
            ? new Date().toISOString() 
            : undefined,
          totalFees: Number(formData.totalFees) || 0,
          billedAmount: Number(formData.billedAmount) || 0,
          notes: formData.notes,
          updatedAt: new Date().toISOString()
        };
        await onUpdateEnrollment(updatedEnrollment);
        showToast(`Enrollment updated successfully!`, 'success');
      } else {
        const newEnrollment: Enrollment = {
          id: generateUUID(),
          orgId: '', // Will be set by App.tsx handler
          enrollmentCode: formData.enrollmentCode || generateEnrollmentCode(formData.batchId!, formData.studentId!),
          studentId: formData.studentId!,
          batchId: formData.batchId!,
          sponsorId: formData.sponsorId || undefined,
          billingStatus: formData.billingStatus || 'UNBILLED',
          enrollmentStatus: formData.enrollmentStatus || 'ACTIVE',
          enrollmentDate: formData.enrollmentDate || new Date().toISOString(),
          totalFees: Number(formData.totalFees) || 0,
          billedAmount: Number(formData.billedAmount) || 0,
          notes: formData.notes,
          createdAt: new Date().toISOString()
        };
        await onAddEnrollment(newEnrollment);
        showToast(`Student enrolled successfully!`, 'success');
      }
      
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving enrollment:', error);
      showToast(`Failed to save enrollment: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this enrollment?')) return;
    
    setDeletingId(id);
    try {
      const result = await onDeleteEnrollment(id);
      if (result === false) {
        showToast('Cannot delete enrollment: It may have associated billing records.', 'error');
      } else {
        showToast('Enrollment removed successfully!', 'success');
      }
    } catch (error) {
      showToast(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (enrollment: Enrollment) => {
    setEditingEnrollment(enrollment);
    setFormData({
      enrollmentCode: enrollment.enrollmentCode || '',
      studentId: enrollment.studentId,
      batchId: enrollment.batchId,
      sponsorId: enrollment.sponsorId || '',
      billingStatus: enrollment.billingStatus,
      enrollmentStatus: enrollment.enrollmentStatus,
      enrollmentDate: enrollment.enrollmentDate?.split('T')[0] || '',
      totalFees: enrollment.totalFees || 0,
      billedAmount: enrollment.billedAmount || 0,
      notes: enrollment.notes || ''
    });
    setShowModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: currency,
      minimumFractionDigits: 2 
    }).format(amount);
  };

  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    return student ? `${student.firstName} ${student.lastName}` : 'Unknown';
  };

  const getStudentULI = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    return student?.uli || 'N/A';
  };

  const getBatchName = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    return batch?.name || 'Unknown';
  };

  const getBatchCode = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    return batch?.batchCode || '';
  };

  const getQualificationForBatch = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return null;
    return qualifications.find(q => q.id === batch.qualificationId);
  };

  const getSponsorName = (sponsorId?: string) => {
    if (!sponsorId) return null;
    const sponsor = sponsors.find(s => s.id === sponsorId);
    return sponsor?.name;
  };

  const getBillingBadge = (status: BillingStatus) => {
    const opt = BILLING_STATUS_OPTIONS.find(o => o.value === status);
    if (!opt) return null;
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${opt.color}`}>
        {opt.label}
      </span>
    );
  };

  const getEnrollmentBadge = (status: EnrollmentStatus) => {
    const opt = ENROLLMENT_STATUS_OPTIONS.find(o => o.value === status);
    if (!opt) return null;
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${opt.color}`}>
        {opt.label}
      </span>
    );
  };

  // Summary stats
  const totalEnrollments = filteredEnrollments.length;
  const activeEnrollments = filteredEnrollments.filter(e => e.enrollmentStatus === 'ACTIVE').length;
  const unbilledCount = filteredEnrollments.filter(e => e.billingStatus === 'UNBILLED').length;
  const totalUnbilledAmount = filteredEnrollments
    .filter(e => e.billingStatus === 'UNBILLED' || e.billingStatus === 'PARTIALLY_BILLED')
    .reduce((sum, e) => sum + ((e.totalFees || 0) - (e.billedAmount || 0)), 0);

  return (
    <div className="space-y-8 pb-20 relative animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Enrollments</h2>
          <p className="text-sm text-gray-500 font-normal italic">Track student enrollments, sponsors, and billing status.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-brand/20 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> New Enrollment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Enrollments</p>
          <p className="text-2xl font-bold text-gray-800">{totalEnrollments}</p>
        </div>
        <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-1">Active</p>
          <p className="text-2xl font-bold text-gray-800">{activeEnrollments}</p>
        </div>
        <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Unbilled</p>
          <p className="text-2xl font-bold text-gray-800">{unbilledCount}</p>
        </div>
        <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-1">Unbilled Amount</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalUnbilledAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search enrollments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Batch:</span>
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[180px]"
            >
              <option value="">All</option>
              {batches.filter(b => !b.isDeleted).map(b => (
                <option key={b.id} value={b.id}>{b.batchCode || b.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Billing:</span>
            <select
              value={filterBillingStatus}
              onChange={(e) => setFilterBillingStatus(e.target.value as BillingStatus | '')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[170px]"
            >
              <option value="">All</option>
              {BILLING_STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={filterEnrollmentStatus}
              onChange={(e) => setFilterEnrollmentStatus(e.target.value as EnrollmentStatus | '')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[160px]"
            >
              <option value="">All</option>
              {ENROLLMENT_STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setFilterBatch('');
              setFilterBillingStatus('');
              setFilterEnrollmentStatus('');
            }}
            className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full font-sans">
          <thead className="bg-brand border-b">
            <tr>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Date</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Student</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Batch / Course</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Sponsor</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Fees</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Billing</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Status</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredEnrollments.length > 0 ? filteredEnrollments.map(enrollment => {
              const qual = getQualificationForBatch(enrollment.batchId);
              const sponsorName = getSponsorName(enrollment.sponsorId);
              const unbilledAmt = (enrollment.totalFees || 0) - (enrollment.billedAmount || 0);

              return (
                <tr key={enrollment.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {formatEnrollmentDate(enrollment.enrollmentDate)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-brand/10 flex items-center justify-center text-brand border border-brand-light shadow-sm shrink-0">
                        <UserCheck size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-800 leading-tight">{getStudentName(enrollment.studentId)}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{getStudentULI(enrollment.studentId)}</div>
                        {enrollment.enrollmentCode && (
                          <div className="text-xs text-brand font-mono mt-0.5">{enrollment.enrollmentCode}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-800 font-medium">
                        <Layers size={14} className="text-gray-400" />
                        {getBatchName(enrollment.batchId)}
                      </div>
                      <div className="text-xs text-gray-400">{getBatchCode(enrollment.batchId)}</div>
                      {qual && (
                        <div className="text-xs text-gray-500 flex items-center gap-1.5">
                          <GraduationCap size={12} className="text-gray-400" />
                          {qual.code} - {qual.name}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {sponsorName ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Building size={14} className="text-gray-400" />
                        <span className="truncate max-w-[160px]">{sponsorName}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Self-pay</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-brand font-mono">
                        {formatCurrency(enrollment.totalFees || 0)}
                      </div>
                      {unbilledAmt > 0 && (
                        <div className="text-xs text-amber-600">
                          {formatCurrency(unbilledAmt)} unbilled
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getBillingBadge(enrollment.billingStatus)}
                  </td>
                  <td className="px-4 py-3">
                    {getEnrollmentBadge(enrollment.enrollmentStatus)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(enrollment)}
                        disabled={deletingId === enrollment.id}
                        className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(enrollment.id)}
                        disabled={deletingId === enrollment.id}
                        className="p-2 hover:bg-rose-50 text-gray-300 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === enrollment.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                  {hasActiveFilters
                    ? 'Try adjusting your search or filters.'
                    : 'No enrollments found. Enroll a student in a batch to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-brand/20"><UserCheck size={20} /></div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">
                  {editingEnrollment ? 'Edit Enrollment' : 'New Enrollment'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                {/* Batch Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Training Batch *</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.batchId || ''}
                    onChange={e => setFormData({...formData, batchId: e.target.value, studentId: ''})}
                    disabled={!!editingEnrollment}
                  >
                    <option value="">Select a batch...</option>
                    {batches.filter(b => !b.isDeleted && b.status !== 'COMPLETED').map(b => {
                      const qual = qualifications.find(q => q.id === b.qualificationId);
                      return (
                        <option key={b.id} value={b.id}>
                          {b.batchCode || b.name} {qual ? `- ${qual.code}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Student Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Student *</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.studentId || ''}
                    onChange={e => setFormData({...formData, studentId: e.target.value})}
                    disabled={!formData.batchId || !!editingEnrollment}
                  >
                    <option value="">Select a student...</option>
                    {availableStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.uli})
                      </option>
                    ))}
                  </select>
                  {!formData.batchId && (
                    <p className="text-xs text-amber-600 italic">Select a batch first to see available students.</p>
                  )}
                </div>

                {/* Sponsor Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sponsor (Optional)</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.sponsorId || ''}
                    onChange={e => setFormData({...formData, sponsorId: e.target.value})}
                  >
                    <option value="">Self-pay (No Sponsor)</option>
                    {sponsors.filter(s => !s.isDeleted).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 italic">Select a sponsor if this enrollment is sponsored. Leave blank for self-paying students.</p>
                </div>

                {/* Enrollment Date and Code */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Enrollment Date</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                      value={formData.enrollmentDate || ''} 
                      onChange={e => setFormData({...formData, enrollmentDate: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Enrollment Code</label>
                    <input 
                      placeholder="Auto-generated if blank" 
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium font-mono"
                      value={formData.enrollmentCode || ''} 
                      onChange={e => setFormData({...formData, enrollmentCode: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Fees Section */}
                <div className="p-4 bg-blue-50/50 rounded border border-blue-100 space-y-4">
                  <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-2">
                    <DollarSign size={12} /> Fees & Billing
                  </label>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Total Fees</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currency}</span>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00" 
                          className="w-full pl-14 pr-4 py-2.5 bg-white border border-gray-200 rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm font-medium font-mono"
                          value={formData.totalFees || ''} 
                          onChange={e => setFormData({...formData, totalFees: parseFloat(e.target.value) || 0})} 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Billed Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currency}</span>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00" 
                          className="w-full pl-14 pr-4 py-2.5 bg-white border border-gray-200 rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm font-medium font-mono"
                          value={formData.billedAmount || ''} 
                          onChange={e => setFormData({...formData, billedAmount: parseFloat(e.target.value) || 0})} 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Billing Status</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                        value={formData.billingStatus || 'UNBILLED'}
                        onChange={e => setFormData({...formData, billingStatus: e.target.value as BillingStatus})}
                      >
                        {BILLING_STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Enrollment Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Enrollment Status</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.enrollmentStatus || 'ACTIVE'}
                    onChange={e => setFormData({...formData, enrollmentStatus: e.target.value as EnrollmentStatus})}
                  >
                    {ENROLLMENT_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</label>
                  <textarea 
                    placeholder="Optional notes about this enrollment..." 
                    rows={2}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium resize-none"
                    value={formData.notes || ''} 
                    onChange={e => setFormData({...formData, notes: e.target.value})} 
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !formData.studentId || !formData.batchId}
                  className="flex-1 py-3 bg-brand text-white rounded text-sm font-semibold shadow-brand/20 active:scale-95 transition-all hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {editingEnrollment ? 'Updating...' : 'Enrolling...'}
                    </>
                  ) : (
                    editingEnrollment ? 'Update Enrollment' : 'Enroll Student'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded shadow-lg border flex items-center gap-2 animate-in slide-in-from-right duration-300 ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : toast.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-brand/10 text-brand border-brand-light'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle size={18} className="text-emerald-600" />
              ) : toast.type === 'error' ? (
                <AlertCircle size={18} className="text-rose-600" />
              ) : (
                <AlertCircle size={18} className="text-brand" />
              )}
              <span className="text-sm font-semibold">{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnrollmentsView;

