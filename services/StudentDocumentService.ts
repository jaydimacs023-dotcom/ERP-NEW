import { Student, StudentDocument } from '../types';

/**
 * StudentDocumentService
 * Provides independent document upload handlers for students.
 * Each document type has its own isolated update function to prevent
 * interference between different document uploads.
 */

export type DocumentType = 'PHOTO' | 'TOR' | 'BIRTH_CERTIFICATE' | 'APPLICATION_FORM';

export const DOCUMENT_TYPES = {
  PHOTO: 'Passport Size Photo',
  TOR: 'Transcript of Records',
  BIRTH_CERTIFICATE: 'Birth Certificate',
  APPLICATION_FORM: 'Application Form',
} as const;

export const REQUIRED_STUDENT_DOCUMENTS: string[] = [
  DOCUMENT_TYPES.TOR,
  DOCUMENT_TYPES.BIRTH_CERTIFICATE,
  DOCUMENT_TYPES.APPLICATION_FORM,
];

const DOCUMENT_NAME_ALIASES: Record<DocumentType, string[]> = {
  PHOTO: [
    DOCUMENT_TYPES.PHOTO,
    'Profile Photo',
    'Profile Picture',
    'Passport Photo',
    'Photo',
  ],
  TOR: [
    DOCUMENT_TYPES.TOR,
    'TOR',
    'TOR (Transcript of Records)',
  ],
  BIRTH_CERTIFICATE: [
    DOCUMENT_TYPES.BIRTH_CERTIFICATE,
    'Birth Cert',
    'PSA Birth Certificate',
  ],
  APPLICATION_FORM: [
    DOCUMENT_TYPES.APPLICATION_FORM,
    'Application',
  ],
};

const STATUS_PRIORITY: Record<StudentDocument['status'], number> = {
  PENDING: 0,
  REJECTED: 1,
  UPLOADED: 2,
  VERIFIED: 3,
};

function normalizeNameKey(value: string | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getCanonicalDocumentName(name: string | undefined): string {
  const normalizedName = normalizeNameKey(name);
  const match = (Object.entries(DOCUMENT_NAME_ALIASES) as [DocumentType, string[]][])
    .find(([, aliases]) => aliases.some(alias => normalizeNameKey(alias) === normalizedName));

  return match ? DOCUMENT_TYPES[match[0]] : String(name || '').trim();
}

function getDocumentTypeFromNameInternal(name: string | undefined): DocumentType | null {
  const normalizedName = normalizeNameKey(name);
  const match = (Object.entries(DOCUMENT_NAME_ALIASES) as [DocumentType, string[]][])
    .find(([, aliases]) => aliases.some(alias => normalizeNameKey(alias) === normalizedName));

  return match?.[0] || null;
}

function buildStudentDocumentId(doc: Partial<StudentDocument> | undefined, index: number): string {
  const explicitId = typeof doc?.id === 'string' ? doc.id.trim() : '';
  if (explicitId) return explicitId;

  const rawName = getCanonicalDocumentName(doc?.name) || `document-${index + 1}`;
  const slug = rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `doc-${index}-${slug || 'item'}`;
}

function shouldPreferIncomingDocument(existing: StudentDocument, incoming: StudentDocument): boolean {
  if (incoming.fileData && incoming.fileData !== existing.fileData) return true;
  return STATUS_PRIORITY[incoming.status] >= STATUS_PRIORITY[existing.status];
}

function mergeStudentDocument(existing: StudentDocument, incoming: StudentDocument): StudentDocument {
  if (!shouldPreferIncomingDocument(existing, incoming)) {
    return {
      ...incoming,
      ...existing,
      id: existing.id || incoming.id,
      name: existing.name,
      status: STATUS_PRIORITY[existing.status] >= STATUS_PRIORITY[incoming.status] ? existing.status : incoming.status,
      fileData: existing.fileData || incoming.fileData,
      verifiedAt: existing.verifiedAt || incoming.verifiedAt,
      verifiedBy: existing.verifiedBy || incoming.verifiedBy,
      remarks: existing.remarks || incoming.remarks,
    };
  }

  return {
    ...existing,
    ...incoming,
    id: existing.id || incoming.id,
    name: incoming.name,
    status: STATUS_PRIORITY[incoming.status] >= STATUS_PRIORITY[existing.status] ? incoming.status : existing.status,
    fileData: incoming.fileData || existing.fileData,
    verifiedAt: incoming.verifiedAt || existing.verifiedAt,
    verifiedBy: incoming.verifiedBy || existing.verifiedBy,
    remarks: incoming.remarks || existing.remarks,
  };
}

function isImageSource(value?: string): boolean {
  return Boolean(value && (
    value.startsWith('data:image/') ||
    value.startsWith('blob:') ||
    /^https?:\/\//i.test(value)
  ));
}

export function normalizeStudentDocuments(documents: StudentDocument[] | undefined): StudentDocument[] {
  if (!Array.isArray(documents)) return [];

  const canonicalDocuments = documents.reduce<StudentDocument[]>((acc, doc, index) => {
    const safeDoc = doc && typeof doc === 'object' ? doc : {};
    const normalizedDoc: StudentDocument = {
      ...safeDoc,
      id: buildStudentDocumentId(safeDoc, index),
      name: getCanonicalDocumentName(safeDoc.name) || `Document ${index + 1}`,
      status: safeDoc.status || 'PENDING',
    };

    const existingIndex = acc.findIndex(existing => existing.name === normalizedDoc.name);
    if (existingIndex === -1) {
      acc.push(normalizedDoc);
      return acc;
    }

    acc[existingIndex] = mergeStudentDocument(acc[existingIndex], normalizedDoc);
    return acc;
  }, []);

  return canonicalDocuments;
}

export function getDocumentTypeFromName(name: string | undefined): DocumentType | null {
  return getDocumentTypeFromNameInternal(name);
}

export function isDocumentNameOfType(name: string | undefined, docType: DocumentType): boolean {
  return getDocumentTypeFromNameInternal(name) === docType;
}

export function getStudentProfilePhoto(student: Student | null | undefined): string | undefined {
  if (!student) return undefined;
  if (isImageSource(student.profilePhoto)) return student.profilePhoto;

  const photoDocument = normalizeStudentDocuments(student.documents)
    .find(doc => isDocumentNameOfType(doc.name, 'PHOTO') && isImageSource(doc.fileData));

  return photoDocument?.fileData;
}

export function getComplianceDocuments(student: Student | null | undefined): StudentDocument[] {
  if (!student) return [];
  return normalizeStudentDocuments(student.documents).filter(doc => !isDocumentNameOfType(doc.name, 'PHOTO'));
}

/**
 * Find or create a document in the student's document array
 * @param documents - Current documents array
 * @param docType - Type of document to find
 * @returns Document if found, otherwise undefined
 */
function findDocument(documents: StudentDocument[] | undefined, docType: DocumentType): StudentDocument | undefined {
  return normalizeStudentDocuments(documents).find(d => isDocumentNameOfType(d.name, docType));
}

/**
 * Update profile photo independently
 * Preserves all documents without modification
 * @param student - Current student object
 * @param fileData - New photo data
 * @returns Updated student object
 */
export function updateProfilePhoto(student: Student, fileData: string): Student {
  return {
    ...student,
    profilePhoto: fileData,
    documents: normalizeStudentDocuments(student.documents),
  };
}

/**
 * Update TOR (Transcript of Records) independently
 * Only affects the TOR document in the array
 * @param student - Current student object
 * @param fileData - New TOR file data
 * @returns Updated student object
 */
export function updateTOR(student: Student, fileData: string): Student {
  const documents = normalizeStudentDocuments(student.documents);
  const torIndex = documents.findIndex(d => isDocumentNameOfType(d.name, 'TOR'));

  if (torIndex >= 0) {
    documents[torIndex] = {
      ...documents[torIndex],
      name: DOCUMENT_TYPES.TOR,
      fileData,
      status: 'UPLOADED',
    };
  } else {
    documents.push({
      id: `doc-tor-${Date.now()}`,
      name: DOCUMENT_TYPES.TOR,
      status: 'UPLOADED',
      fileData,
    });
  }

  return {
    ...student,
    documents,
    profilePhoto: student.profilePhoto,
  };
}

/**
 * Update Birth Certificate independently
 * Only affects the Birth Certificate document in the array
 * @param student - Current student object
 * @param fileData - New Birth Certificate file data
 * @returns Updated student object
 */
export function updateBirthCertificate(student: Student, fileData: string): Student {
  const documents = normalizeStudentDocuments(student.documents);
  const bcIndex = documents.findIndex(d => isDocumentNameOfType(d.name, 'BIRTH_CERTIFICATE'));

  if (bcIndex >= 0) {
    documents[bcIndex] = {
      ...documents[bcIndex],
      name: DOCUMENT_TYPES.BIRTH_CERTIFICATE,
      fileData,
      status: 'UPLOADED',
    };
  } else {
    documents.push({
      id: `doc-birth-${Date.now()}`,
      name: DOCUMENT_TYPES.BIRTH_CERTIFICATE,
      status: 'UPLOADED',
      fileData,
    });
  }

  return {
    ...student,
    documents,
    profilePhoto: student.profilePhoto,
  };
}

/**
 * Update Application Form independently
 * Only affects the Application Form document in the array
 * @param student - Current student object
 * @param fileData - New Application Form file data
 * @returns Updated student object
 */
export function updateApplicationForm(student: Student, fileData: string): Student {
  const documents = normalizeStudentDocuments(student.documents);
  const afIndex = documents.findIndex(d => isDocumentNameOfType(d.name, 'APPLICATION_FORM'));

  if (afIndex >= 0) {
    documents[afIndex] = {
      ...documents[afIndex],
      name: DOCUMENT_TYPES.APPLICATION_FORM,
      fileData,
      status: 'UPLOADED',
    };
  } else {
    documents.push({
      id: `doc-app-form-${Date.now()}`,
      name: DOCUMENT_TYPES.APPLICATION_FORM,
      status: 'UPLOADED',
      fileData,
    });
  }

  return {
    ...student,
    documents,
    profilePhoto: student.profilePhoto,
  };
}

/**
 * Generic independent document updater
 * Use this for custom document types
 * @param student - Current student object
 * @param docType - Type of document to update
 * @param fileData - New file data
 * @returns Updated student object
 */
export function updateDocument(student: Student, docType: DocumentType, fileData: string): Student {
  switch (docType) {
    case 'PHOTO':
      return updateProfilePhoto(student, fileData);
    case 'TOR':
      return updateTOR(student, fileData);
    case 'BIRTH_CERTIFICATE':
      return updateBirthCertificate(student, fileData);
    case 'APPLICATION_FORM':
      return updateApplicationForm(student, fileData);
    default:
      return student;
  }
}

/**
 * Get document by type
 * @param student - Student object
 * @param docType - Type of document to retrieve
 * @returns Document if found, otherwise undefined
 */
export function getDocumentByType(student: Student, docType: DocumentType): StudentDocument | undefined {
  if (docType === 'PHOTO') {
    return undefined;
  }
  return findDocument(student.documents, docType);
}

/**
 * Check if a specific document type is uploaded
 * @param student - Student object
 * @param docType - Type of document to check
 * @returns True if document exists and has fileData
 */
export function isDocumentUploaded(student: Student, docType: DocumentType): boolean {
  if (docType === 'PHOTO') {
    return Boolean(getStudentProfilePhoto(student));
  }
  const doc = findDocument(student.documents, docType);
  return !!doc?.fileData;
}

/**
 * Check if a specific document type is verified
 * @param student - Student object
 * @param docType - Type of document to check
 * @returns True if document is verified
 */
export function isDocumentVerified(student: Student, docType: DocumentType): boolean {
  if (docType === 'PHOTO') {
    // Profile photo doesn't have verification status
    return false;
  }
  const doc = findDocument(student.documents, docType);
  return doc?.status === 'VERIFIED';
}

/**
 * Get upload progress for all required documents
 * @param student - Student object
 * @returns Object with upload status for each document type
 */
export function getDocumentUploadProgress(student: Student): Record<DocumentType, boolean> {
  return {
    PHOTO: isDocumentUploaded(student, 'PHOTO'),
    TOR: isDocumentUploaded(student, 'TOR'),
    BIRTH_CERTIFICATE: isDocumentUploaded(student, 'BIRTH_CERTIFICATE'),
    APPLICATION_FORM: isDocumentUploaded(student, 'APPLICATION_FORM'),
  };
}

/**
 * Calculate overall compliance percentage
 * @param student - Student object
 * @returns Percentage of required documents uploaded (0-100)
 */
export function getCompliancePercentage(student: Student): number {
  const progress = getDocumentUploadProgress(student);
  const uploadedCount = Object.values(progress).filter(v => v).length;
  return Math.round((uploadedCount / Object.keys(progress).length) * 100);
}
