import React, { useMemo, useState } from 'react';
import { AssessmentRegistration, AssessmentRegistrationStatus, AssessmentType, Qualification, Student } from '../types';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import { ClipboardCheck, Plus, Search, X, Edit2, User, Award } from 'lucide-react';

interface AssessmentRegistrationsViewProps {
  registrations: AssessmentRegistration[];
  students: Student[];
  qualifications: Qualification[];
  onAddRegistration: (registration: AssessmentRegistration) => void | Promise<void>;
  onUpdateRegistration: (registration: AssessmentRegistration) => void | Promise<void>;
  onDeleteRegistration: (id: string) => void | Promise<boolean>;
}

const statusOptions: AssessmentRegistrationStatus[] = ['PENDING', 'ASSESSED', 'COMPLETED', 'COMPETENT', 'NOT_YET_COMPETENT', 'CANCELLED'];
const assessmentTypes: AssessmentType[] = ['FULL_ASSESSMENT', 'REASSESSMENT', 'COC', 'RPL'];
const fieldClass = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-gray-800 outline-none focus:border-brand disabled:opacity-50';

const AssessmentRegistrationsView: React.FC<AssessmentRegistrationsViewProps> = ({
  registrations,
  students,
  qualifications,
  onAddRegistration,
  onUpdateRegistration,
  onDeleteRegistration
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState<AssessmentRegistration | null>(null);
  const [formData, setFormData] = useState<Partial<AssessmentRegistration>>({
    assessmentType: 'FULL_ASSESSMENT',
    assessmentDate: '',
    status: 'PENDING'
  });

  const filteredRegistrations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return registrations
      .filter(registration => !registration.isDeleted)
      .filter(registration => {
        if (!term) return true;
        const student = students.find(s => s.id === registration.studentId);
        const qualification = qualifications.find(q => q.id === registration.qualificationId);
        return [
          registration.registrationCode,
          student ? `${student.firstName} ${student.lastName} ${student.uli || ''}` : '',
          qualification ? `${qualification.name} ${qualification.code}` : '',
          registration.status
        ].join(' ').toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const aDate = a.assessmentDate || '';
        const bDate = b.assessmentDate || '';
        if (!aDate && !bDate) return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        if (!aDate) return 1;
        if (!bDate) return -1;
        return bDate.localeCompare(aDate);
      });
  }, [registrations, searchTerm, students, qualifications]);

  const resetForm = () => {
    setEditingRegistration(null);
    setFormData({
      assessmentType: 'FULL_ASSESSMENT',
      assessmentDate: '',
      status: 'PENDING'
    });
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (registration: AssessmentRegistration) => {
    setEditingRegistration(registration);
    setFormData(registration);
    setShowModal(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.studentId || !formData.qualificationId) return;

    const existingFinancialFields = editingRegistration
      ? {
          billingParty: editingRegistration.billingParty,
          sponsorId: editingRegistration.sponsorId,
          billingStatus: editingRegistration.billingStatus,
          totalFees: editingRegistration.totalFees,
          billedAmount: editingRegistration.billedAmount,
          invoiceId: editingRegistration.invoiceId
        }
      : {
          billingParty: 'SELF' as const,
          billingStatus: 'UNBILLED' as const,
          totalFees: 0,
          billedAmount: 0
        };

    const registration: AssessmentRegistration = {
      ...(editingRegistration || {}),
      ...existingFinancialFields,
      id: editingRegistration?.id || generateUUID(),
      orgId: editingRegistration?.orgId || '',
      registrationCode: formData.registrationCode || `ASM-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
      studentId: formData.studentId!,
      qualificationId: formData.qualificationId!,
      assessmentType: formData.assessmentType || 'FULL_ASSESSMENT',
      assessmentDate: formData.assessmentDate || null,
      status: formData.status || 'PENDING',
      notes: formData.notes,
      createdAt: editingRegistration?.createdAt || new Date().toISOString(),
      updatedAt: editingRegistration ? new Date().toISOString() : undefined
    };

    if (editingRegistration) {
      await onUpdateRegistration(registration);
    } else {
      await onAddRegistration(registration);
    }
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-end">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Assessment Registrations</h2>
          <p className="text-sm text-gray-500 italic">Walk-in candidates must be registered as learners first, then assigned here for assessment only.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded font-semibold text-sm shadow-sm">
          <Plus size={18} /> Register Assessment
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search candidate, qualification, sponsor, or status..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:border-brand"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-brand">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase">Candidate</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase">Qualification</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase">Assessment</th>
                <th className="px-5 py-4 text-right text-xs font-semibold text-white uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-gray-400">
                    <ClipboardCheck size={44} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-sm font-semibold">No assessment registrations found.</p>
                  </td>
                </tr>
              ) : filteredRegistrations.map(registration => {
                const student = students.find(s => s.id === registration.studentId);
                const qualification = qualifications.find(q => q.id === registration.qualificationId);
                return (
                  <tr key={registration.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(registration)}>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">{student ? `${student.lastName}, ${student.firstName}` : 'Unknown candidate'}</p>
                      <p className="text-xs text-gray-500">{registration.registrationCode || registration.id}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-800">{qualification?.name || 'Unknown qualification'}</p>
                      <p className="text-xs text-gray-500">{qualification?.code || '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-700">{registration.assessmentDate || 'To be announced'}</p>
                      <p className="text-xs text-gray-500">{registration.assessmentType.replace(/_/g, ' ')}</p>
                      <p className="text-xs font-semibold text-gray-600">{registration.status.replace(/_/g, ' ')}</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={event => {
                          event.stopPropagation();
                          openEdit(registration);
                        }}
                        className="p-2 rounded text-gray-400 hover:text-brand hover:bg-brand/10"
                        title="Edit registration"
                      >
                        <Edit2 size={16} />
                      </button>
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
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <form onSubmit={handleSubmit} className="bg-white rounded-md shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-5 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand text-white rounded"><ClipboardCheck size={20} /></div>
                  <h3 className="text-lg font-semibold text-gray-800">{editingRegistration ? 'Edit Assessment Registration' : 'Register Assessment Candidate'}</h3>
                </div>
                <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded"><X size={20} /></button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Candidate">
                    <select required value={formData.studentId || ''} onChange={e => setFormData(prev => ({ ...prev, studentId: e.target.value }))} className={fieldClass}>
                      <option value="">Select learner/candidate...</option>
                      {students.map(student => <option key={student.id} value={student.id}>{student.lastName}, {student.firstName} ({student.uli})</option>)}
                    </select>
                  </Field>
                  <Field label="Qualification">
                    <select
                      required
                      value={formData.qualificationId || ''}
                      onChange={e => {
                        setFormData(prev => ({ ...prev, qualificationId: e.target.value }));
                      }}
                      className={fieldClass}
                    >
                      <option value="">Select qualification...</option>
                      {qualifications.map(qualification => <option key={qualification.id} value={qualification.id}>{qualification.name} ({qualification.code})</option>)}
                    </select>
                  </Field>
                  <Field label="Assessment Type">
                    <select value={formData.assessmentType || 'FULL_ASSESSMENT'} onChange={e => setFormData(prev => ({ ...prev, assessmentType: e.target.value as AssessmentType }))} className={fieldClass}>
                      {assessmentTypes.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
                    </select>
                  </Field>
                  <Field label="Assessment Date">
                    <input type="date" value={formData.assessmentDate || ''} onChange={e => setFormData(prev => ({ ...prev, assessmentDate: e.target.value || null }))} className={fieldClass} />
                    <p className="text-xs text-gray-500">Leave blank while waiting for TESDA/certifier schedule.</p>
                  </Field>
                  <Field label="Registration Status">
                    <select value={formData.status || 'PENDING'} onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as AssessmentRegistrationStatus }))} className={fieldClass}>
                      {statusOptions.map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                    </select>
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Notes">
                      <textarea rows={3} value={formData.notes || ''} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} className={fieldClass} />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t bg-gray-50 flex justify-between">
                {editingRegistration ? (
                  <button
                    type="button"
                    onClick={() => {
                      Promise.resolve(onDeleteRegistration(editingRegistration.id)).then(() => setShowModal(false));
                    }}
                    className="px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded"
                  >
                    Delete
                  </button>
                ) : <span />}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-brand text-white rounded text-sm font-semibold">Save Registration</button>
                </div>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-2">
    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
      {label === 'Candidate' && <User size={12} />}
      {label === 'Qualification' && <Award size={12} />}
      {label}
    </span>
    {children}
  </label>
);

export default AssessmentRegistrationsView;
