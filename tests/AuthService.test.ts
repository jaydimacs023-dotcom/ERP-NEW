import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '../services/AuthService';
import { TokenManager } from '../services/TokenManager';

describe('AuthService Supabase session flow', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await TokenManager.logout();
    localStorage.clear();
  });

  it('authenticates with Supabase Auth and loads the ERP profile by auth_uid', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'supabase-access-token',
        refresh_token: 'supabase-refresh-token',
        expires_in: 3600,
        user: { id: '11111111-1111-1111-1111-111111111111' }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        id: '22222222-2222-2222-2222-222222222222',
        name: 'AR User',
        email: 'ar@example.com',
        role: 'AR_SPECIALIST',
        org_id: '33333333-3333-3333-3333-333333333333',
        is_active: true,
        locked_until: null
      }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await authService.login('ar@example.com', 'valid-password');

    expect(result?.token).toBe('supabase-access-token');
    expect(result?.user.role).toBe('AR_SPECIALIST');
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/v1/token?grant_type=password');
    expect(fetchMock.mock.calls[1][0]).toContain('auth_uid=eq.11111111-1111-1111-1111-111111111111');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer supabase-access-token');
  });

  it('does not query the public users table when authentication fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authService.login('bad@example.com', 'wrong')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects authenticated identities without an active linked ERP profile', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access', refresh_token: 'refresh', expires_in: 3600,
        user: { id: '44444444-4444-4444-4444-444444444444' }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authService.login('unlinked@example.com', 'valid-password')).resolves.toBeNull();
    expect(TokenManager.getCurrentUser()).toBeNull();
  });
});
