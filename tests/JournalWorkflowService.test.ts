import { describe, expect, it } from 'vitest';
import {
  buildJournalApprovalUpdates,
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

  it('posts a manual journal and assigns a GL reference when approved', () => {
    const updates = buildJournalApprovalUpdates(
      { id: 'je-1', status: 'PENDING_APPROVAL' } as any,
      'GL00000042',
      'user-1',
      '2026-07-04T01:00:00.000Z'
    );

    expect(updates).toMatchObject({
      status: 'POSTED',
      glEntryNumber: 'GL00000042',
      approvedBy: 'user-1',
      approvedAt: '2026-07-04T01:00:00.000Z',
      postedBy: 'user-1',
      postedAt: '2026-07-04T01:00:00.000Z',
    });
  });

  it('keeps an existing GL reference when approval is retried', () => {
    const updates = buildJournalApprovalUpdates(
      { id: 'je-1', status: 'PENDING_APPROVAL', glEntryNumber: 'GL00000017' } as any,
      'GL00000042',
      'user-1',
      '2026-07-04T01:00:00.000Z'
    );

    expect(updates.glEntryNumber).toBe('GL00000017');
  });
});
