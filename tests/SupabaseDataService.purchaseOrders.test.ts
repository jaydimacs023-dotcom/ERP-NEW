import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/TokenManager', () => ({
  TokenManager: {
    getAccessToken: vi.fn(),
  },
}));

import { SupabaseDataService } from '../services/SupabaseDataService';
import { TokenManager } from '../services/TokenManager';

describe('SupabaseDataService purchase orders', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('translates fetchPage parameters and normalizes results for purchase_orders', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{
        id: 'po-1',
        org_id: 'org-1',
        vendor_id: 'v-1',
        po_number: 'PO-2026-001',
        order_date: '2026-09-20',
        status: 'DRAFT',
        total_amount: 1500,
        notes: 'Test PO notes',
        created_at: '2026-09-20T10:00:00Z',
      }]),
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

    const result = await service.fetchPage('purchase_orders', {
      page: 1,
      pageSize: 10,
      columns: 'id,org_id,vendor_id,date,reference,status,total_amount,memo,is_deleted',
      filters: [
        { column: 'org_id', operator: 'eq', value: 'org-1' },
        { column: 'date', operator: 'gte', value: '2026-09-01' },
        { column: 'is_deleted', operator: 'eq', value: false },
      ],
      search: {
        columns: ['reference', 'memo'],
        term: 'test',
      },
      orderBy: [{ column: 'date', ascending: false }],
    });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as any;
    expect(row.date).toBe('2026-09-20');
    expect(row.reference).toBe('PO-2026-001');
    expect(row.memo).toBe('Test PO notes');
    expect(row.lines).toEqual([]);

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toContain('order_date=gte.2026-09-01');
    expect(requestedUrl).not.toContain('is_deleted');
    expect(requestedUrl).not.toContain('purchase_orders?select=id%2Corg_id%2Cvendor_id%2Cdate');
    expect(requestedUrl).toContain('po_number');
    expect(requestedUrl).toContain('order_date');
    expect(requestedUrl).toContain('order=order_date.desc');
  });

  it('maps fields appropriately in createPurchaseOrder and persists items', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify([{
          id: 'po-uuid-1',
          org_id: 'org-1',
          vendor_id: 'vendor-1',
          po_number: 'PO-REF-001',
          order_date: '2026-09-20',
          status: 'DRAFT',
          total_amount: 1000,
          notes: 'Purchase memo',
          created_at: '2026-09-20T10:00:00Z',
        }]),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify([]),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      ));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    const created = await service.createPurchaseOrder({
      id: 'po-temp-123',
      orgId: 'org-1',
      vendorId: 'vendor-1',
      date: '2026-09-20',
      reference: 'PO-REF-001',
      memo: 'Purchase memo',
      totalAmount: 1000,
      lines: [
        { id: '1', itemId: 'item-1', description: 'Item 1', qty: 2, unitPrice: 500, taxAmount: 0 }
      ],
    });

    expect(created.id).toBe('po-uuid-1');
    expect(created.reference).toBe('PO-REF-001');
    expect(created.date).toBe('2026-09-20');
    expect(created.memo).toBe('Purchase memo');
    expect(created.lines).toHaveLength(1);

    // Verify PO post payload
    const poCall = fetchMock.mock.calls[0];
    const poPayload = JSON.parse(poCall[1].body);
    expect(poPayload.po_number).toBe('PO-REF-001');
    expect(poPayload.order_date).toBe('2026-09-20');
    expect(poPayload.notes).toBe('Purchase memo');
    expect(poPayload.id).toBeUndefined();
    expect(poPayload.lines).toBeUndefined();

    // Verify PO items post payload
    const itemsCall = fetchMock.mock.calls[1];
    expect(itemsCall[0]).toContain('/purchase_order_items');
    const itemsPayload = JSON.parse(itemsCall[1].body);
    expect(itemsPayload[0]).toEqual({
      po_id: 'po-uuid-1',
      item_id: 'item-1',
      quantity: 2,
      unit_price: 500,
      received_quantity: 0,
    });
  });

  it('translates fields in updatePurchaseOrder', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{
        id: 'po-1',
        org_id: 'org-1',
        vendor_id: 'v-1',
        po_number: 'PO-2026-002',
        order_date: '2026-09-21',
        status: 'APPROVED',
        total_amount: 2000,
        notes: 'Updated notes',
        gl_entry_number: 'GL-PO-001',
      }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    const updated = await service.updatePurchaseOrder('po-1', {
      reference: 'PO-2026-002',
      date: '2026-09-21',
      status: 'APPROVED',
      glEntryNumber: 'GL-PO-001',
      memo: 'Updated notes',
    });

    expect(updated.reference).toBe('PO-2026-002');
    expect(updated.date).toBe('2026-09-21');
    expect(updated.memo).toBe('Updated notes');

    const patchCall = fetchMock.mock.calls[0];
    expect(patchCall[1].method).toBe('PATCH');
    const patchPayload = JSON.parse(patchCall[1].body);
    expect(patchPayload.po_number).toBe('PO-2026-002');
    expect(patchPayload.order_date).toBe('2026-09-21');
    expect(patchPayload.notes).toBe('Updated notes');
    expect(patchPayload.gl_entry_number).toBe('GL-PO-001');
  });

  it('deletes purchase order using HTTP DELETE method', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('user-session-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'supabase-anon-key';

    await service.deletePurchaseOrder('po-to-delete');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/purchase_orders?id=eq.po-to-delete',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
