import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/TokenManager', () => ({
  TokenManager: {
    getAccessToken: vi.fn(),
  },
}));

import { SupabaseDataService } from '../services/SupabaseDataService';
import { TokenManager } from '../services/TokenManager';

describe('SupabaseDataService transcript records fetch & download resilience', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns empty arrays when orgId is empty', async () => {
    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    const records = await service.getTranscriptRecords('');
    const batchRecords = await service.getBatchTranscriptRecords('');

    expect(records).toEqual([]);
    expect(batchRecords).toEqual([]);
  });

  it('falls back to REST when transcripts edge function returns 403 or fails', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/functions/v1/transcripts')) {
        return Promise.resolve(new Response(
          JSON.stringify({ error: 'Registrar access is required' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      if (urlStr.includes('/rest/v1/transcript_records')) {
        return Promise.resolve(new Response(
          JSON.stringify([{
            id: 'tor-1',
            org_id: 'org-test',
            student_id: 'student-1',
            batch_id: 'batch-1',
            object_path: 'org-test/batch-1/student-1/file.pdf',
            file_name: 'transcript.pdf',
            file_size: 1024,
            mime_type: 'application/pdf',
            uploaded_at: '2026-09-20T10:00:00Z',
          }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      if (urlStr.includes('/rest/v1/batch_transcript_records')) {
        return Promise.resolve(new Response(
          JSON.stringify([{
            id: 'batch-tor-1',
            org_id: 'org-test',
            batch_id: 'batch-1',
            object_path: 'org-test/batch-1/batch/file.pdf',
            file_name: 'batch-transcript.pdf',
            file_size: 2048,
            mime_type: 'application/pdf',
            uploaded_at: '2026-09-20T10:00:00Z',
          }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    const records = await service.getTranscriptRecords('org-test');
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('tor-1');
    expect(records[0].studentId).toBe('student-1');

    const batchRecords = await service.getBatchTranscriptRecords('org-test');
    expect(batchRecords).toHaveLength(1);
    expect(batchRecords[0].id).toBe('batch-tor-1');
    expect(batchRecords[0].batchId).toBe('batch-1');
  });

  it('uses REST directly in local environment', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('local-token');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/functions/v1/')) {
        throw new Error('Edge function should not be called in local mode');
      }
      if (urlStr.includes('/rest/v1/transcript_records')) {
        return Promise.resolve(new Response(
          JSON.stringify([]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      if (urlStr.includes('/rest/v1/batch_transcript_records')) {
        return Promise.resolve(new Response(
          JSON.stringify([]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'http://127.0.0.1:54321';
    (service as any).supabaseKey = 'anon-key';

    const records = await service.getTranscriptRecords('org-local');
    expect(records).toEqual([]);

    const batchRecords = await service.getBatchTranscriptRecords('org-local');
    expect(batchRecords).toEqual([]);
  });

  it('falls back to storage REST when downloading transcript fails via edge function', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');

    const mockData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/functions/v1/transcripts')) {
        return Promise.resolve(new Response(
          'Function error',
          { status: 500, headers: { 'Content-Type': 'text/plain' } }
        ));
      }
      if (urlStr.includes('/storage/v1/object/authenticated/transcripts/')) {
        return Promise.resolve(new Response(mockData, { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    const blob = await service.downloadTranscriptPdf('org-1/batch-1/student-1/test.pdf');
    expect(blob).toBeDefined();
    expect(blob.size).toBe(mockData.byteLength);
  });
});
