import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/TokenManager', () => ({
  TokenManager: {
    getAccessToken: vi.fn(),
  },
}));

import { SupabaseDataService } from '../services/SupabaseDataService';
import { TokenManager } from '../services/TokenManager';

describe('SupabaseDataService course fee requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the Supabase key instead of the AT-ERP JWT for PostgREST updates', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('at-erp-access-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{ id: 'fee-1', fee_name: 'Tuition', amount: 1250 }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    await service.updateCourseFee('fee-1', {
      feeName: 'Tuition',
      amount: 1250,
    });

    expect(TokenManager.getAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/course_fees?id=eq.fee-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          apikey: 'supabase-anon-key',
          Prefer: 'return=representation',
        }),
      })
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.headers).not.toHaveProperty('Authorization');
  });
});
