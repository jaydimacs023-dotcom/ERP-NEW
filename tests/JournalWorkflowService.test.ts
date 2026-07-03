import { describe, expect, it } from 'vitest';
import {
  canTransitionJournal,
  isEditableJournalStatus,
  isManualJournalSource
} from '../services/JournalWorkflowService';

describe('manual journal workflow', () => {
  it('recognizes both app and database manual source names', () => {
    expect(isManualJournalSource('JOURNAL')).toBe(true);
    expect(isManualJournalSource('MANUAL')).toBe(true);
    expect(isManualJournalSource('INVOICE')).toBe(false);
  });

  it('allows only draft-like journals to be edited', () => {
    expect(isEditableJournalStatus('ON_HOLD')).toBe(true);
    expect(isEditableJournalStatus('PENDING_APPROVAL')).toBe(false);
    expect(isEditableJournalStatus('APPROVED')).toBe(false);
    expect(isEditableJournalStatus('POSTED')).toBe(false);
  });

  it('enforces approval before posting', () => {
    expect(canTransitionJournal('ON_HOLD', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransitionJournal('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransitionJournal('APPROVED', 'POSTED')).toBe(true);
    expect(canTransitionJournal('ON_HOLD', 'POSTED')).toBe(false);
    expect(canTransitionJournal('PENDING_APPROVAL', 'POSTED')).toBe(false);
  });
});
