import { config } from '../config/app';
import { User } from '../types';

/**
 * AuthService: Handles Supabase Authentication
 * Matches the actual users table schema with password_hash and salt
 */
export class AuthService {
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = config.supabase.url;
    this.supabaseKey = config.supabase.anonKey;
    console.debug('[Auth] AuthService initialized:', {
      urlConfigured: !!this.supabaseUrl,
      keyConfigured: !!this.supabaseKey,
      url: this.supabaseUrl?.substring(0, 30) + '...' || 'MISSING',
      useMockData: config.useMockData
    });
  }

  /**
   * Simple base64 encode/decode for password verification
   * Note: This is a basic implementation. For production, use bcrypt or similar.
   */
  private encodePassword(password: string): string {
    return btoa(password);
  }

  /**
   * Login with email and password against users table
   * Returns the authenticated user from the users table
   */
  async login(email: string, password: string): Promise<{ user: User; token: string } | null> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error('[Auth] Supabase credentials not configured', {
        supabaseUrl: this.supabaseUrl,
        supabaseKey: this.supabaseKey ? '***' : 'missing',
        fallback: 'Cannot authenticate without Supabase credentials'
      });
      return null;
    }

    try {
      // Step 1: Fetch user by email
      const usersResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!usersResponse.ok) {
        console.error('[Auth] Failed to fetch user:', usersResponse.status);
        return null;
      }

      const userData = await usersResponse.json();
      if (!userData || userData.length === 0) {
        console.error('[Auth] User not found:', email);
        return null;
      }

      const dbUser = userData[0];

      // Step 2: Verify password against password_hash
      const encodedPassword = this.encodePassword(password);
      if (dbUser.password_hash !== encodedPassword) {
        console.error('[Auth] Password mismatch for user:', email);
        return null;
      }

      // Step 3: Map database user to User type
      const user: User = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        orgId: dbUser.org_id,
      };

      // Step 4: Create a simple JWT-like token for session
      const token = btoa(JSON.stringify({
        userId: dbUser.id,
        email: dbUser.email,
        iat: Date.now(),
      }));

      console.info('[Auth] Login successful:', { email, userId: user.id, role: user.role });
      return { user, token };
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return null;
    }
  }

  /**
   * Get current session from localStorage
   */
  getSession(): { user: User; token: string } | null {
    try {
      const session = localStorage.getItem('at_erp_session');
      if (!session) return null;
      return JSON.parse(session);
    } catch (error) {
      console.error('[Auth] Failed to parse session:', error);
      return null;
    }
  }

  /**
   * Store session in localStorage
   */
  private storeSession(session: { user: User; token: string }): void {
    localStorage.setItem('at_erp_session', JSON.stringify(session));
  }

  /**
   * Clear session on logout
   */
  logout(): void {
    localStorage.removeItem('at_erp_session');
    console.info('[Auth] Logout successful');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getSession();
  }
}

export const authService = new AuthService();
