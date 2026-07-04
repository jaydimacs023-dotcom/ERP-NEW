import { JournalEntry } from '../types';

export type JournalWorkflowStatus = JournalEntry['status'];

export const isManualJournalSource = (sourceType?: string): boolean =>
  ['MANUAL', 'JOURNAL'].includes(String(sourceType || '').toUpperCase());

export const isEditableJournalStatus = (status?: string): boolean =>
  ['DRAFT', 'ON_HOLD', 'REVISION_REQUESTED'].includes(String(status || '').toUpperCase());

export const canTransitionJournal = (
  currentStatus: string | undefined,
  nextStatus: JournalWorkflowStatus
): boolean => {
  const current = String(currentStatus || '').toUpperCase();
  if (nextStatus === 'PENDING_APPROVAL') {
    return ['DRAFT', 'ON_HOLD', 'REVISION_REQUESTED'].includes(current);
  }
  if (nextStatus === 'APPROVED') {
    return ['DRAFT', 'ON_HOLD', 'PENDING_APPROVAL'].includes(current);
  }
  if (nextStatus === 'POSTED') {
    return current === 'APPROVED';
  }
  return false;
};

export const buildJournalApprovalUpdates = (
  entry: JournalEntry,
  glEntryNumber: string,
  approvedBy: string,
  timestamp: string
): Partial<JournalEntry> => ({
  status: 'POSTED',
  glEntryNumber: String(entry.glEntryNumber || '').trim() || glEntryNumber,
  approvedBy,
  approvedAt: timestamp,
  postedBy: approvedBy,
  postedAt: timestamp,
  updatedBy: approvedBy,
  updatedAt: timestamp,
});
