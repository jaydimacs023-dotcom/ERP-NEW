import React, { useMemo, useRef, useState } from 'react';
import { AssessmentRegistration, AssessmentRegistrationStatus, AssessmentType, Qualification, Student } from '../types';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { downloadAssessmentRegistrationTemplate, parseAssessmentRegistrationWorkbook } from '../services/AssessmentRegistrationImportService';
import { AlertCircle, Award, CheckCircle, ClipboardCheck, Download, Loader2, Plus, Search, Upload, User, X } from 'lucide-react';

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
const normalizeMatchValue = (value?: string) => (value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');

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
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows: paginatedRegistrations,
    setCurrentPage
  } = usePaginatedRows(filteredRegistrations, [searchTerm], 7);

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

    try {
      if (editingRegistration) {
        await onUpdateRegistration(registration);
      } else {
        await onAddRegistration(registration);
      }
      setShowModal(false);
      resetForm();
    } catch {
      // The parent notification remains visible while the form stays open for correction.
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);
    const errors: string[] = [];
    let imported = 0;

    try {
      const rows = await parseAssessmentRegistrationWorkbook(file);
      const usedReferenceNumbers = new Set(
        registrations
          .map(registration => normalizeMatchValue(registration.registrationCode))
          .filter(Boolean)
      );

      for (const row of rows) {
        const rowLabel = `Row ${row.rowNumber}`;
        const referenceNumber = row.referenceNumber.trim();
        const normalizedReference = normalizeMatchValue(referenceNumber);
        if (!referenceNumber) {
          errors.push(`${rowLabel}: Reference Number is required.`);
          continue;
        }
        if (usedReferenceNumbers.has(normalizedReference)) {
          errors.push(`${rowLabel}: Reference Number "${referenceNumber}" is already registered.`);
          continue;
        }

        const normalizedLearnerId = normalizeMatchValue(row.learnerId);
        const student = students.find(candidate =>
          normalizeMatchValue(candidate.uli) === normalizedLearnerId
        );
        if (!student) {
          errors.push(`${rowLabel}: Learner ID "${row.learnerId || 'blank'}" was not found (${row.lastName}, ${row.firstName}).`);
          continue;
        }

        const normalizedTitle = normalizeMatchValue(row.qualificationTitle);
        const exactQualification = qualifications.find(qualification =>
          normalizeMatchValue(qualification.name) === normalizedTitle ||
          normalizeMatchValue(qualification.code) === normalizedTitle
        );
        const partialMatches = qualifications.filter(qualification => {
          const name = normalizeMatchValue(qualification.name);
          return normalizedTitle && (name.includes(normalizedTitle) || normalizedTitle.includes(name));
        });
        const qualification = exactQualification || (partialMatches.length === 1 ? partialMatches[0] : undefined);
        if (!qualification) {
          errors.push(`${rowLabel}: Qualification "${row.qualificationTitle || 'blank'}" could not be matched uniquely.`);
          continue;
        }

        const registration: AssessmentRegistration = {
          id: generateUUID(),
          orgId: '',
          registrationCode: referenceNumber,
          studentId: student.id,
          qualificationId: qualification.id,
          billingParty: 'SELF',
          assessmentType: 'FULL_ASSESSMENT',
          assessmentDate: row.assessmentDate,
          status: row.status,
          billingStatus: 'UNBILLED',
          totalFees: 0,
          billedAmount: 0,
          notes: row.notes,
          createdAt: new Date().toISOString(),
        };

        try {
          await onAddRegistration(registration);
          usedReferenceNumbers.add(normalizedReference);
          imported++;
        } catch (error) {
          errors.push(`${rowLabel}: ${error instanceof Error ? error.message : 'Registration could not be saved.'}`);
        }
      }

      setImportResult({ imported, errors });
    } catch (error) {
      setImportResult({
        imported: 0,
        errors: [error instanceof Error ? error.message : 'The workbook could not be imported.'],
      });
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await downloadAssessmentRegistrationTemplate();
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-end">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Assessment Registrations</h2>
          <p className="text-sm text-gray-500 italic">Walk-in candidates must be registered as learners first, then assigned here for assessment only.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
            className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloadingTemplate
              ? <Loader2 size={18} className="animate-spin" />
              : <Download size={18} />}
            Template
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center gap-2 rounded border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand shadow-sm transition-colors hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {isImporting ? 'Importing...' : 'Import TESDA Excel'}
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded font-semibold text-sm shadow-sm">
            <Plus size={18} /> Register Assessment
          </button>
        </div>
      </div>

      {importResult && (
        <div
          role="status"
          className={`rounded border p-4 shadow-sm ${
            importResult.errors.length > 0
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {importResult.errors.length > 0
              ? <AlertCircle size={20} className="mt-0.5 shrink-0 text-amber-600" />
              : <CheckCircle size={20} className="mt-0.5 shrink-0 text-emerald-600" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Imported {importResult.imported} assessment registration{importResult.imported === 1 ? '' : 's'}.
                {importResult.errors.length > 0 && ` ${importResult.errors.length} row${importResult.errors.length === 1 ? '' : 's'} need attention.`}
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                  {importResult.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => setImportResult(null)}
              className="shrink-0 text-current opacity-50 hover:opacity-100"
              aria-label="Dismiss import result"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

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
                <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase w-[34%]">Candidate</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase w-[34%]">Qualification</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase w-[32%]">Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-16 text-center text-gray-400">
                    <ClipboardCheck size={44} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-sm font-semibold">No assessment registrations found.</p>
                  </td>
                </tr>
              ) : paginatedRegistrations.map(registration => {
                const student = students.find(s => s.id === registration.studentId);
                const qualification = qualifications.find(q => q.id === registration.qualificationId);
                return (
                  <tr key={registration.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => openEdit(registration)}>
                    <td className="px-5 py-4 align-middle">
                      <p className="text-sm font-semibold text-gray-900">{student ? `${student.lastName}, ${student.firstName}` : 'Unknown candidate'}</p>
                      <p className="text-xs text-gray-500">{registration.registrationCode || registration.id}</p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <p className="text-sm font-semibold text-gray-800">{qualification?.name || 'Unknown qualification'}</p>
                      <p className="text-xs text-gray-500">{qualification?.code || '-'}</p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{registration.assessmentDate || 'To be announced'}</p>
                          <p className="text-xs text-gray-500">{registration.assessmentType.replace(/_/g, ' ')}</p>
                        </div>
                        <span className="inline-flex w-fit rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 uppercase">
                          {registration.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRegistrations.length}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={setCurrentPage}
          itemLabel="registrations"
        />
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
                      {students.map(student => <option key={student.id} value={student.id}>{student.lastName}, {student.firstName} ({student.uli || 'No ULI'})</option>)}
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
