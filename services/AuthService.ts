import { config } from '../config/app';
import { User } from '../types';
import { PasswordService } from './PasswordService';
import { JWTService, TokenPair } from './JWTService';
import { TokenManager, AuthState } from './TokenManager';

/**
 * AuthService: Handles Authentication with JWT Tokens and Secure Password Hashing
 * 
 * Security Features:
 * - JWT-based authentication with HMAC-SHA256 signatures
 * - Access tokens (15 min) + Refresh tokens (7 days)
 * - Automatic token refresh before expiration
 * - bcrypt password hashing (cost factor 12)
 * - Legacy password migration support (base64, plain text)
 * - Automatic password upgrade on login
 * - Multi-tab session synchronization
 */
export class AuthService {
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = config.supabase.url;
    this.supabaseKey = config.supabase.anonKey;
    console.debug('[Auth] AuthService initialized with bcrypt hashing:', {
      urlConfigured: !!this.supabaseUrl,
      keyConfigured: !!this.supabaseKey,
      useMockData: config.useMockData
    });
  }

  /**
   * Helper to get Supabase request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
  }

  /**
   * Update user's password hash in Supabase (for legacy password migration)
   */
  private async updatePasswordHash(userId: string, newHash: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/users?id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({ password_hash: newHash }),
        }
      );
      
      if (response.ok) {
        console.info('[Auth] ✅ Password hash upgraded to bcrypt for user:', userId);
        return true;
      }
      console.warn('[Auth] ⚠️ Failed to upgrade password hash:', response.status);
      return false;
    } catch (error) {
      console.error('[Auth] ❌ Error upgrading password hash:', error);
      return false;
    }
  }

  /**
   * Hash a password for new user registration
   * Uses bcrypt with cost factor 12
   * 
   * @param plainPassword - The plain text password to hash
   * @returns Promise<string> - The bcrypt hash
   */
  async hashPassword(plainPassword: string): Promise<string> {
    return PasswordService.hashPassword(plainPassword);
  }

  /**
   * Verify a password against a stored hash
   * 
   * @param plainPassword - The password to verify
   * @param hashedPassword - The stored hash
   * @returns Promise<boolean> - True if password matches
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return PasswordService.verifyPassword(plainPassword, hashedPassword);
  }

  /**
   * Get password strength analysis
   */
  analyzePasswordStrength(password: string) {
    return PasswordService.analyzePasswordStrength(password);
  }

  /**
   * Login with email and password against users table
   * Supports legacy password formats with automatic migration to bcrypt
   * Returns JWT tokens for session management
   * 
   * @param email - User's email address
   * @param password - Plain text password
   * @returns Authenticated user and tokens, or null if authentication fails
   */
  async checkSupabaseConnection(): Promise<boolean> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('[Auth] Supabase credentials missing in config.');
      return false;
    }

    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/users?select=id&limit=1`, { headers: this.getHeaders() });
      if (!res.ok) {
        console.error('[Auth] Supabase connection check failed with status', res.status);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Auth] Supabase connection check error:', error);
      return false;
    }
  }

  async login(email: string, password: string): Promise<{ user: User; token: string; tokens: TokenPair } | null> {
    // Handle Mock Login (for development/demo without Supabase)
    if (config.useMockData || !this.supabaseUrl || !this.supabaseKey) {
      console.info('[Auth] Using mock authentication (development mode)');
      return this.mockLogin(email, password);
    }

    // Handle Supabase Login with bcrypt verification
    try {
      // Connection check
      const connected = await this.checkSupabaseConnection();
      if (!connected) {
        console.error('[Auth] Supabase not connected. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        return null;
      }

      // Step 1: Fetch user by email
      const usersResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`,
        { headers: this.getHeaders() }
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

      if (!dbUser.is_active) {
        console.error('[Auth] ❌ User account is inactive:', email);
        return null;
      }

      const lockedUntil = dbUser.locked_until ? new Date(dbUser.locked_until).getTime() : 0;
      if (lockedUntil > Date.now()) {
        console.error('[Auth] ❌ User account is locked until:', dbUser.locked_until);
        return null;
      }

      const storedPassword = dbUser.password_hash || dbUser.password || '';
      if (!storedPassword) {
        console.error('[Auth] ❌ No password hash found for user:', email);
        return null;
      }

      console.debug('[Auth] Verifying password for:', email, { userId: dbUser.id, hashType: storedPassword.slice(0, 4) });
      const verification = await PasswordService.verifyWithLegacySupport(password, storedPassword);

      if (!verification.isValid) {
        console.error('[Auth] ❌ Password verification failed for:', email, 'stored password present? ', !!storedPassword);
        return null;
      }

      // Optional: update last_login_at and failed_login_attempts clear
      try {
        await fetch(`${this.supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(dbUser.id)}`, {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({ last_login_at: new Date().toISOString(), failed_login_attempts: 0 })
        });
      } catch (err) {
        console.warn('[Auth] Could not update last_login_at:', err);
      }

      // Step 3: Migrate legacy password to bcrypt if needed (automatic upgrade)
      if (verification.needsMigration) {
        console.info('[Auth] 🔄 Migrating legacy password to bcrypt for:', email);
        const newHash = await PasswordService.hashPassword(password);
        await this.updatePasswordHash(dbUser.id, newHash);
      }

      // Step 4: Build authenticated user object
      const user: User = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        orgId: dbUser.org_id,
        studentId: dbUser.student_id,
        trainerId: dbUser.trainer_id,
      };

      // Step 5: Generate JWT token pair (access + refresh)
      const tokens = await JWTService.generateTokenPair(user);
      
      // Step 6: Store session in TokenManager
      await TokenManager.setTokens(user, tokens);

      console.info('[Auth] ✅ Login successful with JWT:', { 
        email, 
        userId: user.id, 
        role: user.role,
        passwordWasMigrated: verification.needsMigration,
        accessTokenExpiresIn: tokens.expiresIn,
        refreshTokenExpiresIn: tokens.refreshExpiresIn
      });
      
      // Return legacy token format for backward compatibility + new tokens
      return { user, token: tokens.accessToken, tokens };

    } catch (error) {
      console.error('[Auth] ❌ Login error:', error);
      return null;
    }
  }

  /**
   * Mock login for development without Supabase
   * In mock mode, allows any valid email/password combination for testing
   */
  private async mockLogin(email: string, password: string): Promise<{ user: User; token: string; tokens: TokenPair } | null> {
    console.warn('[Auth] ⚠️ Mock login active - for development only');
    
    // For demo/development purposes
    if (email && password && password.length >= 1) {
      const mockUser: User = {
        id: `mock-user-${Date.now()}`,
        name: email.split('@')[0] || 'Demo User',
        email: email,
        role: 'ADMIN',
        orgId: 'mock-org-1',
      };

      // Generate JWT tokens even in mock mode
      const tokens = await JWTService.generateTokenPair(mockUser);
      await TokenManager.setTokens(mockUser, tokens);
      
      console.info('[Auth] Mock login successful with JWT:', { email, role: 'ADMIN' });
      return { user: mockUser, token: tokens.accessToken, tokens };
    }

    return null;
  }

  /**
   * Validate a JWT token
   * Now uses proper JWT verification with signature check
   */
  async validateToken(token: string): Promise<{ valid: boolean; expired: boolean; payload?: any }> {
    const result = await JWTService.verifyToken(token);
    return {
      valid: result.valid,
      expired: result.expired,
      payload: result.payload
    };
  }

  /**
   * Get current access token (refreshes if needed)
   */
  async getAccessToken(): Promise<string | null> {
    return await TokenManager.getAccessToken();
  }

  /**
   * Refresh the current session tokens
   */
  async refreshSession(): Promise<boolean> {
    return await TokenManager.forceRefresh();
  }

  /**
   * Get current session from TokenManager
   * Uses JWT-based session with automatic refresh
   */
  getSession(): { user: User; token: string } | null {
    const user = TokenManager.getCurrentUser();
    const sessionInfo = TokenManager.getSessionInfo();
    
    if (!user || !sessionInfo) {
      return null;
    }

    // For backward compatibility, we return a session-like object
    // The actual token management is handled by TokenManager
    return {
      user,
      token: 'jwt-managed' // Token is managed by TokenManager
    };
  }

  /**
   * Get full authentication state
   */
  getAuthState(): AuthState {
    return TokenManager.getAuthState();
  }

  /**
   * Get session info including token expiry times
   */
  getSessionInfo() {
    return TokenManager.getSessionInfo();
  }

  /**
   * Subscribe to authentication state changes
   */
  onAuthStateChange(callback: (state: AuthState) => void): () => void {
    return TokenManager.subscribe(callback);
  }

  /**
   * Clear session on logout
   * Properly revokes JWT tokens
   */
  async logout(): Promise<void> {
    await TokenManager.logout();
    // Also clear legacy session storage for backward compatibility
    localStorage.removeItem('at_erp_session');
    console.info('[Auth] Logout successful - tokens revoked');
  }

  /**
   * Check if user is authenticated
   * Uses JWT validation
   */
  async isAuthenticated(): Promise<boolean> {
    return await TokenManager.isAuthenticated();
  }

  /**
   * Synchronous check for authentication (for immediate UI decisions)
   * Note: Use async isAuthenticated() for accurate validation
   */
  isAuthenticatedSync(): boolean {
    return !!TokenManager.getCurrentUser();
  }

  /**
   * Revoke all tokens for a user (e.g., on password change)
   */
  revokeAllUserTokens(userId: string): void {
    JWTService.revokeAllUserTokens(userId);
  }
}

export const authService = new AuthService();
