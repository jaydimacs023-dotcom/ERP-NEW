import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  Search,
  Upload,
  Users,
  X
} from 'lucide-react';
import { Batch, BatchTranscriptRecord, Enrollment, Qualification, Student, TranscriptRecord } from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';

interface TranscriptRecordsViewProps {
  orgId: string;
  currentUserId?: string;
  batches: Batch[];
  enrollments: Enrollment[];
  students: Student[];
  qualifications: Qualification[];
  brandColor: string;
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

const alpha = (hex: string, opacity: number) => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${opacity})`;
};

const formatBytes = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const TranscriptRecordsView: React.FC<TranscriptRecordsViewProps> = ({
  orgId,
  currentUserId,
  batches,
  enrollments,
  students,
  qualifications,
  brandColor,
  onNotify
}) => {
  const dataService = useMemo(() => DataServiceFactory.getService(), []);
  const [selectedBatchId, setSelectedBatchId] = useState(batches[0]?.id || '');
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [records, setRecords] = useState<TranscriptRecord[]>([]);
  const [batchRecords, setBatchRecords] = useState<BatchTranscriptRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [batchUploadFile, setBatchUploadFile] = useState<File | null>(null);
  const [isBatchDragging, setIsBatchDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedBatchId && batches.length) setSelectedBatchId(batches[0].id);
  }, [batches, selectedBatchId]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([
      dataService.getTranscriptRecords(orgId),
      dataService.getBatchTranscriptRecords(orgId)
    ])
      .then(([learnerRows, batchRows]) => {
        if (!active) return;
        setRecords(learnerRows);
        setBatchRecords(batchRows);
      })
      .catch(error => {
        console.error(error);
        if (active) onNotify('error', 'Unable to load transcript records.');
      })
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [dataService, onNotify, orgId]);

  const selectedBatch = batches.find(batch => batch.id === selectedBatchId);
  const selectedBatchRecord = batchRecords.find(record => record.batchId === selectedBatchId);
  const selectedQualification = qualifications.find(item => item.id === selectedBatch?.qualificationId);
  const recordForEnrollment = (enrollment: Enrollment) => records.find(record =>
    (record.enrollmentId && record.enrollmentId === enrollment.id)
    || (record.batchId === enrollment.batchId && record.studentId === enrollment.studentId)
  );
  const allBatchEnrollments = useMemo(() => {
    const persistedEnrollments = enrollments
      .filter(enrollment => enrollment.batchId === selectedBatchId && !enrollment.isDeleted);
    const persistedStudentIds = new Set(persistedEnrollments.map(enrollment => enrollment.studentId));
    const batchMemberFallbacks: Enrollment[] = (selectedBatch?.studentIds || [])
      .filter(studentId => !persistedStudentIds.has(studentId))
      .map(studentId => ({
        id: `batch-member:${selectedBatchId}:${studentId}`,
        orgId,
        studentId,
        batchId: selectedBatchId,
        billingStatus: 'UNBILLED',
        enrollmentStatus: selectedBatch?.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE',
        enrollmentDate: selectedBatch?.startDate || '',
        createdAt: selectedBatch?.createdAt || ''
      }));

    return [...persistedEnrollments, ...batchMemberFallbacks]
      .sort((left, right) => {
        const leftStudent = students.find(item => item.id === left.studentId);
        const rightStudent = students.find(item => item.id === right.studentId);
        return `${leftStudent?.lastName} ${leftStudent?.firstName}`.localeCompare(`${rightStudent?.lastName} ${rightStudent?.firstName}`);
      });
  }, [enrollments, orgId, selectedBatch, selectedBatchId, students]);

  const batchEnrollments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allBatchEnrollments
      .filter(enrollment => {
        if (!term) return true;
        const student = students.find(item => item.id === enrollment.studentId);
        return [
          enrollment.enrollmentCode,
          student?.uli,
          student?.firstName,
          student?.middleName,
          student?.lastName
        ].some(value => String(value || '').toLowerCase().includes(term));
      });
  }, [allBatchEnrollments, search, students]);

  const selectedStudent = students.find(student => student.id === selectedEnrollment?.studentId);
  const selectedRecord = selectedEnrollment ? recordForEnrollment(selectedEnrollment) : undefined;
  const graduateCount = selectedBatch?.status === 'COMPLETED'
    ? allBatchEnrollments.length
    : allBatchEnrollments.filter(enrollment => enrollment.enrollmentStatus === 'COMPLETED').length;
  const uploadedCount = selectedBatchRecord
    ? graduateCount
    : allBatchEnrollments.filter(enrollment =>
      (enrollment.enrollmentStatus === 'COMPLETED' || selectedBatch?.status === 'COMPLETED')
      && !!recordForEnrollment(enrollment)
    ).length;
  const selectedHasEnrollmentRecord = !!selectedEnrollment && !selectedEnrollment.id.startsWith('batch-member:');
  const isSelectedGraduate = !!selectedEnrollment && (
    selectedEnrollment.enrollmentStatus === 'COMPLETED'
    || selectedBatch?.status === 'COMPLETED'
  );
  const selectBatchUploadFile = (file?: File) => {
    if (!file) return;
    if ((file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) || file.size > 15 * 1024 * 1024) {
      onNotify('warning', 'Select one PDF file up to 15 MB.');
      return;
    }
    setBatchUploadFile(file);
  };

  const handleBatchUpload = async () => {
    if (!batchUploadFile || !selectedBatch) return;
    setIsUploading(true);
    try {
      const saved = await dataService.uploadBatchTranscriptPdf({
        orgId,
        batchId: selectedBatch.id,
        file: batchUploadFile
      });
      setBatchRecords(previous => [saved, ...previous.filter(record => record.batchId !== saved.batchId)]);
      setBatchUploadFile(null);
      setShowBatchUpload(false);
      onNotify('success', 'The consolidated batch TOR PDF was uploaded successfully.');
    } catch (error) {
      console.error(error);
      onNotify('error', error instanceof Error ? error.message : 'Batch TOR upload failed.');
    } finally {
      setIsUploading(false);
      if (batchFileInputRef.current) batchFileInputRef.current.value = '';
    }
  };

  const handleBatchDownload = async () => {
    if (!selectedBatchRecord) return;
    setDownloadingId(selectedBatchRecord.id);
    try {
      const blob = await dataService.downloadBatchTranscriptPdf(selectedBatchRecord.objectPath, orgId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = selectedBatchRecord.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      onNotify('error', 'Unable to download the consolidated batch TOR.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUpload = async (file?: File) => {
    if (!file || !selectedEnrollment) return;
    if (!isSelectedGraduate) {
      onNotify('warning', 'TOR upload is available after the learner is marked Completed.');
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      onNotify('error', 'Please select a PDF file.');
      return;
    }
    setIsUploading(true);
    try {
      const saved = await dataService.uploadTranscriptPdf({
        orgId,
        enrollmentId: selectedEnrollment.id.startsWith('batch-member:') ? undefined : selectedEnrollment.id,
        studentId: selectedEnrollment.studentId,
        batchId: selectedEnrollment.batchId,
        uploadedBy: currentUserId,
        file
      });
      setRecords(previous => [saved, ...previous.filter(record =>
        !(record.batchId === saved.batchId && record.studentId === saved.studentId)
      )]);
      onNotify('success', selectedRecord ? 'Transcript replaced successfully.' : 'Transcript uploaded successfully.');
    } catch (error) {
      console.error(error);
      onNotify('error', error instanceof Error ? error.message : 'Unable to upload transcript.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (record: TranscriptRecord) => {
    setDownloadingId(record.id);
    try {
      const blob = await dataService.downloadTranscriptPdf(record.objectPath);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = record.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      onNotify('error', 'Unable to download the transcript PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
            Transcript of Records
          </h2>
          <p className="text-sm text-gray-500 font-normal">Issue and maintain the official PDF transcript for learners in their training batch.</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded border border-gray-200 bg-white px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Batches</p>
            <p className="text-lg font-semibold text-gray-900">{batches.length}</p>
          </div>
          <div className="rounded px-4 py-2 text-white" style={{ backgroundColor: brandColor }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Uploaded</p>
            <p className="text-lg font-semibold">{uploadedCount}/{graduateCount}</p>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="grid gap-4 border-b border-gray-100 p-5 md:grid-cols-[minmax(240px,1fr)_minmax(240px,0.7fr)_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Training batch</span>
            <select
              value={selectedBatchId}
              onChange={event => { setSelectedBatchId(event.target.value); setSelectedEnrollment(null); }}
              className="h-11 w-full rounded border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none"
              style={{ boxShadow: `inset 3px 0 0 ${brandColor}` }}
            >
              {batches.map(batch => <option key={batch.id} value={batch.id}>{batch.batchCode || batch.name} — {batch.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Find learner</span>
            <span className="relative block">
              <Search className="absolute left-3 top-3 text-gray-400" size={17} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Name, ULI or enrollment no."
                className="h-11 w-full rounded border border-gray-200 pl-10 pr-3 text-sm outline-none"
              />
            </span>
          </label>
          <button
            type="button"
            onClick={() => setShowBatchUpload(true)}
            disabled={selectedBatch?.status !== 'COMPLETED'}
            className="flex h-11 items-center justify-center gap-2 rounded px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-300"
            style={selectedBatch?.status === 'COMPLETED' ? { backgroundColor: brandColor } : undefined}
            title={selectedBatch?.status === 'COMPLETED' ? 'Upload one consolidated TOR PDF for this batch' : 'Complete the batch before uploading its consolidated TOR'}
          >
            <Upload size={17} /> {selectedBatchRecord ? 'Replace batch TOR' : 'Upload by batch'}
          </button>
        </div>

        {selectedBatch && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-gray-100 px-5 py-3 text-xs text-gray-500" style={{ backgroundColor: alpha(brandColor, 0.045) }}>
            <span className="font-semibold text-gray-800">{selectedBatch.name}</span>
            <span>{selectedQualification?.name || 'Qualification not assigned'}</span>
            <span>{selectedBatch.startDate} — {selectedBatch.endDate}</span>
            <span className="flex items-center gap-1"><Users size={13} /> {allBatchEnrollments.length} enrolled</span>
            <span>{graduateCount} completed</span>
            {selectedBatchRecord && (
              <button type="button" onClick={handleBatchDownload} className="ml-auto flex items-center gap-1.5 font-semibold" style={{ color: brandColor }}>
                {downloadingId === selectedBatchRecord.id ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />}
                Download consolidated TOR
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr style={{ backgroundColor: brandColor }}>
                {['Learner', 'ULI', 'Enrollment', 'Status', 'TOR status / file', ''].map(label => (
                  <th key={label} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm text-gray-400"><Loader2 className="mx-auto mb-2 animate-spin" size={22} />Loading transcript records…</td></tr>
              ) : batchEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14">
                    <div
                      className="mx-auto max-w-md rounded-lg border border-dashed px-6 py-8 text-center"
                      style={{ borderColor: alpha(brandColor, 0.28), backgroundColor: alpha(brandColor, 0.035) }}
                    >
                      <span
                        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ color: brandColor, backgroundColor: alpha(brandColor, 0.1) }}
                      >
                        <GraduationCap size={25} />
                      </span>
                      <h3 className="mt-4 text-sm font-semibold text-gray-800">
                        {batches.length === 0 ? 'No training batches available' : 'No enrolled learners in this batch yet'}
                      </h3>
                      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-gray-500">
                        {batches.length === 0
                          ? 'Create a training batch first. Its completed learners will appear here for TOR processing.'
                          : 'Learners will appear here as soon as their enrollment is added to this training batch.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : batchEnrollments.map(enrollment => {
                const student = students.find(item => item.id === enrollment.studentId);
                const record = recordForEnrollment(enrollment);
                const isCompleted = enrollment.enrollmentStatus === 'COMPLETED' || selectedBatch?.status === 'COMPLETED';
                return (
                  <tr
                    key={enrollment.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedEnrollment(enrollment)}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedEnrollment(enrollment); }}
                    className="group cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 focus:outline-none"
                    style={{ ['--row-accent' as string]: alpha(brandColor, 0.08) }}
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{student ? `${student.lastName}, ${student.firstName} ${student.middleName || ''}`.trim() : 'Learner not found'}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{student?.email || 'No email on file'}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-600">{student?.uli || '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{enrollment.enrollmentCode || '—'}</td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{
                          color: isCompleted ? brandColor : '#6b7280',
                          backgroundColor: isCompleted ? alpha(brandColor, 0.1) : '#f3f4f6'
                        }}
                      >
                        {isCompleted ? <CheckCircle2 size={13} /> : <Users size={13} />}
                        {isCompleted ? 'COMPLETED' : 'ON GOING'}
                      </span>
                    </td>
                    <td className="max-w-[220px] px-5 py-4">
                      {selectedBatchRecord ? (
                        <>
                          <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: brandColor }}>
                            <CheckCircle2 size={14} /> TOR already uploaded
                          </p>
                          <p className="mt-0.5 truncate text-xs text-gray-400">Shared batch PDF · {selectedBatchRecord.fileName}</p>
                        </>
                      ) : (
                        <>
                          <p className="truncate text-sm font-medium text-gray-700">
                            {record?.fileName || (isCompleted ? 'Awaiting TOR PDF' : 'Available after completion')}
                          </p>
                          {record && <p className="mt-0.5 text-xs text-gray-400">{formatBytes(record.fileSize)} · {new Date(record.uploadedAt).toLocaleDateString()}</p>}
                        </>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right"><ChevronRight className="ml-auto text-gray-300 transition-transform group-hover:translate-x-1" size={18} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedEnrollment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-[2px]" onMouseDown={() => !isUploading && setSelectedEnrollment(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-start justify-between p-5 text-white" style={{ backgroundColor: brandColor }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">Transcript file</p>
                <h2 className="mt-1 text-lg font-semibold">{selectedStudent ? `${selectedStudent.lastName}, ${selectedStudent.firstName}` : 'Learner'}</h2>
                <p className="mt-1 text-xs text-white/75">{selectedEnrollment.enrollmentCode || 'Enrollment record'}</p>
              </div>
              <button aria-label="Close" onClick={() => setSelectedEnrollment(null)} className="rounded p-1.5 hover:bg-white/10"><X size={19} /></button>
            </div>
            <div className="space-y-4 p-5">
              {selectedRecord && !selectedBatchRecord ? (
                <div className="flex items-center gap-4 rounded border p-4" style={{ borderColor: alpha(brandColor, 0.2), backgroundColor: alpha(brandColor, 0.05) }}>
                  <div className="rounded p-3 text-white" style={{ backgroundColor: brandColor }}><FileText size={22} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{selectedRecord.fileName}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatBytes(selectedRecord.fileSize)} · Uploaded {new Date(selectedRecord.uploadedAt).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => handleDownload(selectedRecord)}
                    disabled={downloadingId === selectedRecord.id}
                    className="rounded border border-gray-200 bg-white p-2.5 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                    title="Download PDF"
                  >
                    {downloadingId === selectedRecord.id ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                  </button>
                </div>
              ) : selectedBatchRecord ? (
                <div className="flex items-center gap-4 rounded border p-4" style={{ borderColor: alpha(brandColor, 0.2), backgroundColor: alpha(brandColor, 0.05) }}>
                  <div className="rounded p-3 text-white" style={{ backgroundColor: brandColor }}><FileText size={22} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: brandColor }}>TOR already uploaded by batch</p>
                    <p className="mt-1 truncate text-xs text-gray-500">{selectedBatchRecord.fileName} · {formatBytes(selectedBatchRecord.fileSize)}</p>
                  </div>
                  <button
                    onClick={handleBatchDownload}
                    disabled={downloadingId === selectedBatchRecord.id}
                    className="rounded border border-gray-200 bg-white p-2.5 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                    title="Download shared batch TOR PDF"
                  >
                    {downloadingId === selectedBatchRecord.id ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                  </button>
                </div>
              ) : isSelectedGraduate ? (
                <div className="rounded border border-dashed border-gray-300 px-5 py-8 text-center">
                  <FileText className="mx-auto text-gray-300" size={32} />
                  <p className="mt-3 text-sm font-semibold text-gray-700">No graduate transcript uploaded yet</p>
                  <p className="mt-1 text-xs text-gray-400">Upload the graduate’s official Transcript of Records PDF.</p>
                </div>
              ) : (
                <div className="rounded border border-gray-200 bg-gray-50 px-5 py-6 text-center">
                  <GraduationCap className="mx-auto text-gray-300" size={30} />
                  <p className="mt-3 text-sm font-semibold text-gray-700">TOR upload is not available yet</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {selectedHasEnrollmentRecord
                      ? 'This learner remains listed for tracking. Upload becomes available when the enrollment status is marked Completed.'
                      : 'This learner is assigned through the batch roster. Create or link the enrollment record before processing the TOR.'}
                  </p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => handleUpload(event.target.files?.[0])} />
              {isSelectedGraduate && !selectedBatchRecord && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={event => { event.preventDefault(); setIsDraggingFile(true); }}
                    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setIsDraggingFile(true); }}
                    onDragLeave={event => {
                      event.preventDefault();
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingFile(false);
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      setIsDraggingFile(false);
                      handleUpload(event.dataTransfer.files?.[0]);
                    }}
                    disabled={isUploading}
                    className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-5 py-7 text-center transition-all disabled:opacity-60"
                    style={{
                      borderColor: isDraggingFile ? brandColor : alpha(brandColor, 0.32),
                      backgroundColor: isDraggingFile ? alpha(brandColor, 0.1) : alpha(brandColor, 0.035),
                      color: brandColor,
                      transform: isDraggingFile ? 'scale(1.01)' : undefined
                    }}
                  >
                    {isUploading ? <Loader2 className="animate-spin" size={25} /> : <Upload size={25} />}
                    <span className="mt-3 text-sm font-semibold">
                      {isUploading ? 'Uploading PDF…' : isDraggingFile ? 'Drop the PDF here' : selectedRecord ? 'Drop a replacement PDF here' : 'Drag and drop the TOR PDF here'}
                    </span>
                    {!isUploading && <span className="mt-1 text-xs text-gray-500">or click to browse files</span>}
                  </button>
                  <p className="text-center text-[11px] text-gray-400">PDF only · maximum file size 15 MB</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showBatchUpload && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-[2px]" onMouseDown={() => !isUploading && setShowBatchUpload(false)}>
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-start justify-between p-5 text-white" style={{ backgroundColor: brandColor }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">Batch TOR processing</p>
                <h2 className="mt-1 text-lg font-semibold">Upload consolidated TOR for {selectedBatch?.name}</h2>
                <p className="mt-1 text-xs text-white/75">One PDF containing the TOR pages for all learners in this batch</p>
              </div>
              <button aria-label="Close" onClick={() => !isUploading && setShowBatchUpload(false)} className="rounded p-1.5 hover:bg-white/10"><X size={19} /></button>
            </div>
            <div className="overflow-y-auto p-5">
              <input
                ref={batchFileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={event => selectBatchUploadFile(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => batchFileInputRef.current?.click()}
                onDragEnter={event => { event.preventDefault(); setIsBatchDragging(true); }}
                onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setIsBatchDragging(true); }}
                onDragLeave={event => {
                  event.preventDefault();
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsBatchDragging(false);
                }}
                onDrop={event => {
                  event.preventDefault();
                  setIsBatchDragging(false);
                  selectBatchUploadFile(event.dataTransfer.files?.[0]);
                }}
                disabled={isUploading}
                className="flex w-full flex-col items-center rounded-lg border-2 border-dashed px-6 py-7 transition-all disabled:opacity-60"
                style={{
                  borderColor: isBatchDragging ? brandColor : alpha(brandColor, 0.3),
                  color: brandColor,
                  backgroundColor: isBatchDragging ? alpha(brandColor, 0.1) : alpha(brandColor, 0.035)
                }}
              >
                <Upload size={27} />
                <span className="mt-3 text-sm font-semibold">{isBatchDragging ? 'Drop the consolidated PDF here' : 'Drag and drop one consolidated TOR PDF'}</span>
                <span className="mt-1 text-xs text-gray-500">or click to select a file · PDF only · maximum 15 MB</span>
              </button>

              {batchUploadFile && (
                <div className="mt-5 flex items-center gap-4 rounded border border-gray-200 bg-gray-50 p-4">
                  <div className="rounded p-3 text-white" style={{ backgroundColor: brandColor }}><FileText size={22} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{batchUploadFile.name}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{formatBytes(batchUploadFile.size)} · Consolidated batch PDF</p>
                  </div>
                  <button type="button" disabled={isUploading} onClick={() => setBatchUploadFile(null)} className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <X size={17} />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-gray-100 bg-gray-50 px-5 py-4">
              <p className="min-w-0 truncate text-xs text-gray-500">{isUploading ? 'Uploading consolidated batch TOR…' : batchUploadFile ? '1 consolidated PDF ready' : 'Select one PDF to continue'}</p>
              <div className="flex shrink-0 gap-2">
                <button type="button" disabled={isUploading} onClick={() => setShowBatchUpload(false)} className="rounded border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-50">Cancel</button>
                <button
                  type="button"
                  onClick={handleBatchUpload}
                  disabled={isUploading || !batchUploadFile}
                  className="flex items-center gap-2 rounded px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                  style={!isUploading && batchUploadFile ? { backgroundColor: brandColor } : undefined}
                >
                  {isUploading ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
                  {selectedBatchRecord ? 'Replace batch PDF' : 'Upload batch PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptRecordsView;
