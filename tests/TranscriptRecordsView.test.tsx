import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TranscriptRecordsView from '../views/TranscriptRecordsView';
import { SupabaseDataService } from '../services/SupabaseDataService';

describe('TranscriptRecordsView', () => {
  it('does not throw or fetch when orgId is empty', async () => {
    const getRecordsSpy = vi.spyOn(SupabaseDataService.prototype, 'getTranscriptRecords').mockResolvedValue([]);
    const getBatchRecordsSpy = vi.spyOn(SupabaseDataService.prototype, 'getBatchTranscriptRecords').mockResolvedValue([]);
    const notifyMock = vi.fn();

    render(
      <TranscriptRecordsView
        orgId=""
        batches={[]}
        enrollments={[]}
        students={[]}
        qualifications={[]}
        brandColor="#2563eb"
        onNotify={notifyMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Transcript of Records/i)).toBeDefined();
    });

    expect(getRecordsSpy).not.toHaveBeenCalled();
    expect(getBatchRecordsSpy).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('loads and renders transcript records when orgId is provided', async () => {
    vi.spyOn(SupabaseDataService.prototype, 'getTranscriptRecords').mockResolvedValue([
      {
        id: 'rec-1',
        orgId: 'org-1',
        studentId: 'student-1',
        batchId: 'batch-1',
        objectPath: 'org-1/batch-1/student-1/tor.pdf',
        fileName: 'tor.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        uploadedAt: '2026-09-20T10:00:00Z',
        createdAt: '2026-09-20T10:00:00Z',
      }
    ]);
    vi.spyOn(SupabaseDataService.prototype, 'getBatchTranscriptRecords').mockResolvedValue([]);
    const notifyMock = vi.fn();

    render(
      <TranscriptRecordsView
        orgId="org-1"
        batches={[
          {
            id: 'batch-1',
            orgId: 'org-1',
            batchNumber: 'BATCH-001',
            qualificationId: 'qual-1',
            startDate: '2026-01-01',
            status: 'COMPLETED',
            studentIds: ['student-1'],
            createdAt: '2026-01-01T00:00:00Z',
          } as any
        ]}
        enrollments={[
          {
            id: 'enr-1',
            orgId: 'org-1',
            batchId: 'batch-1',
            studentId: 'student-1',
            enrollmentStatus: 'COMPLETED',
            billingStatus: 'BILLED',
            enrollmentDate: '2026-01-01',
            createdAt: '2026-01-01T00:00:00Z',
          } as any
        ]}
        students={[
          {
            id: 'student-1',
            orgId: 'org-1',
            firstName: 'John',
            lastName: 'Doe',
            uli: 'ULI-12345',
            createdAt: '2026-01-01T00:00:00Z',
          } as any
        ]}
        qualifications={[
          {
            id: 'qual-1',
            orgId: 'org-1',
            name: 'Web Development NC III',
            code: 'WD-NC3',
            nominalHours: 120,
            trainingDurationHours: 120,
            status: 'ACTIVE',
            isDeleted: false,
            createdAt: '2026-01-01T00:00:00Z',
          } as any
        ]}
        brandColor="#2563eb"
        onNotify={notifyMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Doe, John')).toBeDefined();
      expect(screen.getByText('Web Development NC III')).toBeDefined();
    });
  });

  it('handles fetch errors without crashing component', async () => {
    vi.spyOn(SupabaseDataService.prototype, 'getTranscriptRecords').mockRejectedValue(new Error('Network error'));
    vi.spyOn(SupabaseDataService.prototype, 'getBatchTranscriptRecords').mockRejectedValue(new Error('Network error'));
    const notifyMock = vi.fn();

    render(
      <TranscriptRecordsView
        orgId="org-1"
        batches={[]}
        enrollments={[]}
        students={[]}
        qualifications={[]}
        brandColor="#2563eb"
        onNotify={notifyMock}
      />
    );

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith('error', 'Unable to load transcript records.');
    });
  });

  it('paginates the learner list by 7 items per page', async () => {
    vi.spyOn(SupabaseDataService.prototype, 'getTranscriptRecords').mockResolvedValue([]);
    vi.spyOn(SupabaseDataService.prototype, 'getBatchTranscriptRecords').mockResolvedValue([]);

    const studentIds = Array.from({ length: 10 }, (_, i) => `student-${i + 1}`);
    const students = studentIds.map((id, i) => ({
      id,
      orgId: 'org-1',
      firstName: `Student${String(i + 1).padStart(2, '0')}`,
      lastName: `Learner`,
      uli: `ULI-${i + 1}`,
      createdAt: '2026-01-01T00:00:00Z',
    })) as any;

    const enrollments = studentIds.map((studentId, i) => ({
      id: `enr-${i + 1}`,
      orgId: 'org-1',
      batchId: 'batch-1',
      studentId,
      enrollmentStatus: 'COMPLETED',
      billingStatus: 'BILLED',
      enrollmentDate: '2026-01-01',
      createdAt: '2026-01-01T00:00:00Z',
    })) as any;

    render(
      <TranscriptRecordsView
        orgId="org-1"
        batches={[
          {
            id: 'batch-1',
            orgId: 'org-1',
            batchNumber: 'BATCH-001',
            startDate: '2026-01-01',
            status: 'COMPLETED',
            studentIds,
            createdAt: '2026-01-01T00:00:00Z',
          } as any
        ]}
        enrollments={enrollments}
        students={students}
        qualifications={[]}
        brandColor="#2563eb"
        onNotify={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-7 of 10 learners/i)).toBeDefined();
      expect(screen.getByText(/Learner, Student01/i)).toBeDefined();
      expect(screen.getByText(/Learner, Student07/i)).toBeDefined();
      expect(screen.queryByText(/Learner, Student08/i)).toBeNull();
    });
  });
});
