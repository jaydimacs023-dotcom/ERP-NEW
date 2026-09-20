import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/TokenManager', () => ({
  TokenManager: {
    getAccessToken: vi.fn(),
  },
}));

import { SupabaseDataService } from '../services/SupabaseDataService';
import { TokenManager } from '../services/TokenManager';

describe('SupabaseDataService inventory edge function fallbacks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('falls back to REST when stock-adjustments-write fails with name resolution error', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/functions/v1/stock-adjustments-write')) {
        return Promise.resolve(new Response(
          JSON.stringify({ error: 'name resolution failed' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      if (url.includes('/rest/v1/inventory_levels')) {
        return Promise.resolve(new Response(
          JSON.stringify([{
            id: 'level-1',
            org_id: 'org-1',
            stock_item_id: 'item-1',
            warehouse_location_id: 'loc-1',
            quantity_on_hand: 50,
            quantity_reserved: 5,
            quantity_available: 45,
            updated_at: '2026-09-20T10:00:00Z',
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

    const levels = await service.getInventoryLevelsByOrg('org-1');
    expect(levels).toHaveLength(1);
    expect(levels[0].stockItemId).toBe('item-1');
    expect(levels[0].quantityOnHand).toBe(50);
  });

  it('falls back to REST when inventory-accounting fails with 503 for classes', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/functions/v1/inventory-accounting')) {
        return Promise.resolve(new Response(
          JSON.stringify({ error: 'Service Unavailable' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      if (url.includes('/rest/v1/inventory_classes')) {
        return Promise.resolve(new Response(
          JSON.stringify([{
            id: 'class-1',
            org_id: 'org-1',
            code: 'RAW',
            name: 'Raw Materials',
            valuation_method: 'FIFO',
            is_active: true,
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

    const classes = await service.getInventoryClasses('org-1');
    expect(classes).toHaveLength(1);
    expect(classes[0].code).toBe('RAW');
    expect(classes[0].name).toBe('Raw Materials');
  });

  it('falls back to REST in fetchPage for inventory_transactions when edge function fails', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/functions/v1/inventory-accounting')) {
        return Promise.resolve(new Response(
          JSON.stringify({ error: 'name resolution failed' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      if (url.includes('/rest/v1/inventory_transactions')) {
        return Promise.resolve(new Response(
          JSON.stringify([{
            id: 'tx-1',
            org_id: 'org-1',
            reference_number: 'TX-001',
            transaction_type: 'RECEIPT',
            quantity: 10,
            unit_cost: 100,
            total_cost: 1000,
            created_at: '2026-09-20T10:00:00Z',
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

    const result = await service.fetchPage('inventory_transactions', {
      page: 1,
      pageSize: 10,
      filters: [{ column: 'org_id', operator: 'eq', value: 'org-1' }],
    });

    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as any).referenceNumber).toBe('TX-001');
  });
});
