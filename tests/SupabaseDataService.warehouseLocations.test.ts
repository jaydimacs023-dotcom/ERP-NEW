import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/TokenManager', () => ({
  TokenManager: {
    getAccessToken: vi.fn(),
  },
}));

import { SupabaseDataService } from '../services/SupabaseDataService';
import { TokenManager } from '../services/TokenManager';

describe('SupabaseDataService warehouse location requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('authenticates the Edge Function with the AT-ERP token and Supabase API key', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('at-erp-access-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ location: { id: 'location-1', org_id: 'org-1', code: 'HEO', name: 'Tool Room' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    await service.createWarehouseLocation({
      orgId: 'org-1',
      code: 'HEO',
      name: 'Tool Room',
      address: 'Main Campus',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/warehouse-locations-write',
      expect.objectContaining({
        method: 'POST',
        headers: {
          apikey: 'supabase-anon-key',
          'Content-Type': 'application/json',
          Authorization: 'Bearer at-erp-access-token',
        },
      })
    );
  });
});
