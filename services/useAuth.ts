/**
 * useAuth - React Hook for JWT Authentication in AT-ERP
 * 
 * Provides:
 * - Authentication state with automatic updates
 * - Login/logout functions
 * - Session info with token expiry countdown
 * - Auto-refresh of expired tokens
 * 
 * Usage:
 *   const { isAuthenticated, user, login, logout, sessionInfo } = useAuth();
 */

import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { authService } from '../services/AuthService';
import { TokenManager, AuthState } from '../services/TokenManager';
import { TokenPair } from '../services/JWTService';

export interface UseAuthReturn {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  
  // Session info
  sessionInfo: {
    userId: string;
    email: string;
    role: string;
    expiresIn: number;
    refreshExpiresIn: number;
  } | null;
  
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  
  // Utilities
  getAccessToken: () => Promise<string | null>;
}

export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>(() => authService.getAuthState());
  const [sessionInfo, setSessionInfo] = useState(() => authService.getSessionInfo());
  const [error, setError] = useState<string | null>(null);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((state) => {
      setAuthState(state);
      setSessionInfo(authService.getSessionInfo());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Update session info periodically (for countdown display)
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const interval = setInterval(() => {
      setSessionInfo(authService.getSessionInfo());
    }, 1000);

    return () => clearInterval(interval);
  }, [authState.isAuthenticated]);

  // Login function
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    setError(null);
    
    try {
      const result = await authService.login(email, password);
      
      if (result) {
        setSessionInfo(authService.getSessionInfo());
        return { success: true, user: result.user };
      } else {
        const errorMsg = 'Invalid email or password';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    setError(null);
    await authService.logout();
    setSessionInfo(null);
  }, []);

  // Refresh session
  const refreshSession = useCallback(async (): Promise<boolean> => {
    return await authService.refreshSession();
  }, []);

  // Get access token (with auto-refresh)
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return await authService.getAccessToken();
  }, []);

  return {
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    user: authState.user,
    error: error || authState.error,
    sessionInfo,
    login,
    logout,
    refreshSession,
    getAccessToken,
  };
}

/**
 * Hook to get current access token for API calls
 * Automatically handles token refresh
 */
export function useAccessToken(): {
  getToken: () => Promise<string | null>;
  isValid: boolean;
} {
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const checkValidity = async () => {
      const valid = await TokenManager.isAuthenticated();
      setIsValid(valid);
    };

    checkValidity();
    const interval = setInterval(checkValidity, 30000);

    return () => clearInterval(interval);
  }, []);

  const getToken = useCallback(async () => {
    return await TokenManager.getAccessToken();
  }, []);

  return { getToken, isValid };
}

/**
 * Hook to display session expiry countdown
 */
export function useSessionCountdown(): {
  accessExpiresIn: number;
  refreshExpiresIn: number;
  isExpiringSoon: boolean;
} {
  const [countdown, setCountdown] = useState({ access: 0, refresh: 0 });

  useEffect(() => {
    const updateCountdown = () => {
      const info = TokenManager.getSessionInfo();
      if (info) {
        setCountdown({
          access: info.expiresIn,
          refresh: info.refreshExpiresIn
        });
      } else {
        setCountdown({ access: 0, refresh: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    accessExpiresIn: countdown.access,
    refreshExpiresIn: countdown.refresh,
    isExpiringSoon: countdown.access < 60 && countdown.access > 0
  };
}

export default useAuth;
