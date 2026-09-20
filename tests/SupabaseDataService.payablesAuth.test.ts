import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/TokenManager', () => ({
  TokenManager: {
    getAccessToken: vi.fn(),
  },
}));

import { SupabaseDataService } from '../services/SupabaseDataService';
import { TokenManager } from '../services/TokenManager';

describe('SupabaseDataService payables authenticated requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('includes the authenticated Bearer token when fetching payables pages', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{ id: 'pay-1', org_id: 'org-1', payable_number: 'BILL-001', amount: 500, status: 'approved' }]),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Range': '0-0/1',
        },
      }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    const result = await service.fetchPage('payables', {
      page: 1,
      pageSize: 25,
      filters: [{ column: 'org_id', operator: 'eq', value: 'org-1' }],
    });

    expect(TokenManager.getAccessToken).toHaveBeenCalled();
    expect(result.rows).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://example.supabase.co/rest/v1/payables?'),
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'supabase-anon-key',
          Authorization: 'Bearer user-session-token',
        }),
      })
    );
  });

  it('includes the authenticated Bearer token when creating a payable', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{ id: 'pay-1', org_id: 'org-1', payable_number: 'BILL-001', amount: 500, status: 'for_approval' }]),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    await service.createPayable({
      orgId: 'org-1',
      payableNumber: 'BILL-001',
      amount: 500,
      description: 'Vendor bill',
      status: 'for_approval',
    });

    expect(TokenManager.getAccessToken).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/payables',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'supabase-anon-key',
          Authorization: 'Bearer user-session-token',
        }),
      })
    );
  });

  it('includes the authenticated Bearer token when updating a payable', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{ id: 'pay-1', org_id: 'org-1', payable_number: 'BILL-001', amount: 600 }]),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    await service.updatePayable('pay-1', {
      amount: 600,
    });

    expect(TokenManager.getAccessToken).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/payables?id=eq.pay-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          apikey: 'supabase-anon-key',
          Authorization: 'Bearer user-session-token',
        }),
      })
    );
  });
});
