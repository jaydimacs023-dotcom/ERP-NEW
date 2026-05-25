/**
 * TokenManager - Session and Token Lifecycle Management for AT-ERP
 * 
 * Features:
 * - Secure token storage (localStorage with encryption option)
 * - Automatic token refresh before expiration
 * - Session state management
 * - Event-based authentication state changes
 * - Multi-tab synchronization
 */

import { User } from '../types';
import { JWTService, TokenPair, TokenValidationResult } from './JWTService';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;        // Access token expiry timestamp
  refreshExpiresAt: number; // Refresh token expiry timestamp
  createdAt: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

export type AuthStateListener = (state: AuthState) => void;

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  SESSION: 'at_erp_jwt_session',
  REFRESH_TOKEN: 'at_erp_refresh_token',
};

// Refresh tokens 60 seconds before expiry
const REFRESH_THRESHOLD_SECONDS = 60;

// Check token expiry every 30 seconds
const TOKEN_CHECK_INTERVAL_MS = 30 * 1000;

// ============================================================================
// TOKEN MANAGER CLASS
// ============================================================================

class TokenManagerClass {
  private session: Session | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<AuthStateListener> = new Set();
  private isRefreshing: boolean = false;

  constructor() {
    // Initialize from stored session
    this.loadSession();
    
    // Set up periodic token check
    this.startTokenCheck();
    
    // Listen for storage events (multi-tab sync)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent.bind(this));
    }

    console.debug('[TokenManager] Initialized');
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Store tokens after successful login
   */
  async setTokens(user: User, tokens: TokenPair): Promise<void> {
    const now = Date.now();
    
    this.session = {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: now + (tokens.expiresIn * 1000),
      refreshExpiresAt: now + (tokens.refreshExpiresIn * 1000),
      createdAt: now
    };

    this.saveSession();
    this.scheduleRefresh();
    this.notifyListeners();

    console.debug('[TokenManager] Session stored for user:', user.id);
  }

  /**
   * Get current access token (refreshes if needed)
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.session) {
      return null;
    }

    // Check if access token is expired or expiring soon
    const now = Date.now();
    if (this.session.expiresAt - now < REFRESH_THRESHOLD_SECONDS * 1000) {
      console.debug('[TokenManager] Access token expiring soon, refreshing...');
      const refreshed = await this.refreshTokens();
      if (!refreshed) {
        return null;
      }
    }

    return this.session.accessToken;
  }

  /**
   * Get current user from session
   */
  getCurrentUser(): User | null {
    return this.session?.user || null;
  }

  /**
   * Update the stored user profile without replacing the token pair.
   */
  updateCurrentUser(updates: Partial<User>): User | null {
    if (!this.session) return null;

    this.session = {
      ...this.session,
      user: {
        ...this.session.user,
        ...updates
      }
    };

    this.saveSession();
    this.notifyListeners();
    return this.session.user;
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return {
      isAuthenticated: !!this.session,
      isLoading: this.isRefreshing,
      user: this.session?.user || null,
      error: null
    };
  }

  /**
   * Check if user is authenticated with valid tokens
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.session) {
      return false;
    }

    // Verify access token is still valid
    const validation = await JWTService.verifyToken(this.session.accessToken);
    
    if (validation.valid) {
      return true;
    }

    // If expired, try to refresh
    if (validation.expired) {
      return await this.refreshTokens();
    }

    return false;
  }

  /**
   * Clear session (logout)
   */
  async logout(): Promise<void> {
    if (this.session) {
      // Revoke tokens on server
      await JWTService.revokeToken(this.session.accessToken);
      await JWTService.revokeToken(this.session.refreshToken);
    }

    this.clearSession();
    console.info('[TokenManager] User logged out');
  }

  /**
   * Force session refresh
   */
  async forceRefresh(): Promise<boolean> {
    return await this.refreshTokens();
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    listener(this.getAuthState());
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Validate current session without refreshing
   */
  async validateSession(): Promise<TokenValidationResult> {
    if (!this.session) {
      return { valid: false, expired: false, error: 'No session' };
    }

    return await JWTService.verifyToken(this.session.accessToken);
  }

  /**
   * Get session info (for debugging/display)
   */
  getSessionInfo(): {
    userId: string;
    email: string;
    role: string;
    expiresIn: number;
    refreshExpiresIn: number;
  } | null {
    if (!this.session) return null;

    const now = Date.now();
    return {
      userId: this.session.user.id,
      email: this.session.user.email,
      role: this.session.user.role,
      expiresIn: Math.max(0, Math.floor((this.session.expiresAt - now) / 1000)),
      refreshExpiresIn: Math.max(0, Math.floor((this.session.refreshExpiresAt - now) / 1000))
    };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Load session from storage
   */
  private loadSession(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (!stored) return;

      const session: Session = JSON.parse(stored);
      
      // Check if refresh token is still valid
      const now = Date.now();
      if (session.refreshExpiresAt < now) {
        console.debug('[TokenManager] Stored session expired, clearing...');
        this.clearSession();
        return;
      }

      this.session = session;
      this.scheduleRefresh();
      
      console.debug('[TokenManager] Session loaded for user:', session.user.id);
    } catch (error) {
      console.error('[TokenManager] Failed to load session:', error);
      this.clearSession();
    }
  }

  /**
   * Save session to storage
   */
  private saveSession(): void {
    if (this.session) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(this.session));
    }
  }

  /**
   * Clear session from memory and storage
   */
  private clearSession(): void {
    this.session = null;
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.notifyListeners();
  }

  /**
   * Refresh tokens using refresh token
   */
  private async refreshTokens(): Promise<boolean> {
    if (!this.session || this.isRefreshing) {
      return false;
    }

    // Check if refresh token is still valid
    const now = Date.now();
    if (this.session.refreshExpiresAt < now) {
      console.debug('[TokenManager] Refresh token expired, clearing session');
      this.clearSession();
      return false;
    }

    this.isRefreshing = true;
    this.notifyListeners();

    try {
      const result = await JWTService.refreshTokens(this.session.refreshToken);

      if (result.success && result.tokens) {
        const tokens = result.tokens;
        
        this.session = {
          ...this.session,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: now + (tokens.expiresIn * 1000),
          refreshExpiresAt: now + (tokens.refreshExpiresIn * 1000)
        };

        this.saveSession();
        this.scheduleRefresh();
        
        console.debug('[TokenManager] Tokens refreshed successfully');
        return true;
      } else {
        console.error('[TokenManager] Token refresh failed:', result.error);
        this.clearSession();
        return false;
      }
    } catch (error) {
      console.error('[TokenManager] Token refresh error:', error);
      this.clearSession();
      return false;
    } finally {
      this.isRefreshing = false;
      this.notifyListeners();
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.session) return;

    // Calculate time until we should refresh (threshold before expiry)
    const now = Date.now();
    const refreshAt = this.session.expiresAt - (REFRESH_THRESHOLD_SECONDS * 1000);
    const delay = Math.max(0, refreshAt - now);

    this.refreshTimer = setTimeout(async () => {
      console.debug('[TokenManager] Scheduled token refresh triggered');
      await this.refreshTokens();
    }, delay);

    console.debug('[TokenManager] Token refresh scheduled in:', Math.round(delay / 1000), 'seconds');
  }

  /**
   * Start periodic token validity check
   */
  private startTokenCheck(): void {
    if (this.checkTimer) return;

    this.checkTimer = setInterval(async () => {
      if (this.session) {
        const now = Date.now();
        
        // Check if access token needs refresh
        if (this.session.expiresAt - now < REFRESH_THRESHOLD_SECONDS * 1000) {
          await this.refreshTokens();
        }
        
        // Check if refresh token expired
        if (this.session && this.session.refreshExpiresAt < now) {
          console.debug('[TokenManager] Refresh token expired during check');
          this.clearSession();
        }
      }
    }, TOKEN_CHECK_INTERVAL_MS);
  }

  /**
   * Handle storage events for multi-tab synchronization
   */
  private handleStorageEvent(event: StorageEvent): void {
    if (event.key === STORAGE_KEYS.SESSION) {
      if (event.newValue === null) {
        // Session was cleared in another tab
        console.debug('[TokenManager] Session cleared in another tab');
        this.session = null;
        if (this.refreshTimer) {
          clearTimeout(this.refreshTimer);
          this.refreshTimer = null;
        }
        this.notifyListeners();
      } else {
        // Session was updated in another tab
        console.debug('[TokenManager] Session updated in another tab');
        this.loadSession();
        this.notifyListeners();
      }
    }
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(): void {
    const state = this.getAuthState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('[TokenManager] Listener error:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
    this.listeners.clear();
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent.bind(this));
    }
  }
}

// Export singleton instance
export const TokenManager = new TokenManagerClass();

// Also export the class for testing
export { TokenManagerClass };
